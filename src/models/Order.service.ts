import { shapeIntoMongooseObjectId } from "../libs/config";
import { OrderStatus } from "../libs/enums/order.enum";
import { MemberStatus, MemberType } from "../libs/enums/member.enum";
import MemberModel from "../schema/Member.module";
import { ProductStatus } from "../libs/enums/product.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Member } from "../libs/types/member";
import { Order, OrderInquiry, OrderItemInput, OrderUpdateInput } from "../libs/types/order";
import OrderModel from "../schema/Order.model";
import OrderItemModel from "../schema/OrderItem.model";
import ProductModel from "../schema/Product.model";

class OrderService {
  private readonly orderModel = OrderModel;
  private readonly orderItemModel = OrderItemModel;

  public async createOrder(member: Member, input: OrderItemInput[]): Promise<Order> {
    if (!Array.isArray(input) || input.length === 0 || input.length > 100) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
    const quantities = new Map<string, number>();
    for (const item of input) {
      if (
        !item ||
        !Number.isSafeInteger(item.itemQuantity) ||
        item.itemQuantity < 1 ||
        item.itemQuantity > 999
      ) {
        throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
      }
      const id = String(shapeIntoMongooseObjectId(item.productId));
      const quantity = (quantities.get(id) || 0) + item.itemQuantity;
      if (quantity > 999) throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
      quantities.set(id, quantity);
    }
    const products = await ProductModel.find({
      _id: { $in: [...quantities.keys()] },
      productStatus: ProductStatus.PROCESS,
    })
      .lean()
      .exec();
    if (products.length !== quantities.size)
      throw new Errors(HttpCode.BAD_REQUEST, Message.NO_DATA_FOUND);
    const items = products.map((product) => {
      const quantity = quantities.get(String(product._id))!;
      if (
        product.productLeftCount < quantity ||
        !Number.isFinite(product.productPrice) ||
        product.productPrice < 0
      ) {
        throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
      }
      return { productId: product._id, itemQuantity: quantity, itemPrice: product.productPrice };
    });
    // Prices are always read from the catalog, never trusted from the browser.
    const amount =
      Math.round(
        items.reduce((total, item) => total + item.itemPrice * item.itemQuantity, 0) * 100,
      ) / 100;
    const delivery = amount < 100 ? 5 : 0;
    const order = await this.orderModel.create({
      orderTotal: amount + delivery,
      orderDelivery: delivery,
      memberId: member._id,
    });
    try {
      await this.orderItemModel.insertMany(
        items.map((item) => ({ ...item, orderId: order._id })),
        { ordered: true },
      );
    } catch (error) {
      await this.orderItemModel.deleteMany({ orderId: order._id });
      await this.orderModel.deleteOne({ _id: order._id });
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
    return order as unknown as Order;
  }

  public async getMyOrders(member: Member, inquiry: OrderInquiry): Promise<Order[]> {
    if (
      !Number.isSafeInteger(inquiry.page) ||
      inquiry.page < 1 ||
      !Number.isSafeInteger(inquiry.limit) ||
      inquiry.limit < 1 ||
      inquiry.limit > 100 ||
      !Object.values(OrderStatus).includes(inquiry.orderStatus)
    ) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.NO_DATA_FOUND);
    }
    return this.orderModel
      .aggregate([
        {
          $match: {
            memberId: shapeIntoMongooseObjectId(member._id),
            orderStatus: inquiry.orderStatus,
          },
        },
        { $sort: { updatedAt: -1 } },
        { $skip: (inquiry.page - 1) * inquiry.limit },
        { $limit: inquiry.limit },
        {
          $lookup: {
            from: "orderItems",
            localField: "_id",
            foreignField: "orderId",
            as: "orderItems",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "orderItems.productId",
            foreignField: "_id",
            as: "productData",
          },
        },
      ])
      .exec();
  }

  public async updateOrder(member: Member, input: OrderUpdateInput): Promise<Order> {
    const previousStatus =
      input.orderStatus === OrderStatus.FINISH ? OrderStatus.PROCESS : OrderStatus.PAUSE;
    if (
      ![OrderStatus.PROCESS, OrderStatus.DELETE, OrderStatus.FINISH].includes(input.orderStatus)
    ) {
      throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }
    const filter = {
      _id: shapeIntoMongooseObjectId(input.orderId),
      memberId: shapeIntoMongooseObjectId(member._id),
      orderStatus: previousStatus,
    };
    if (input.orderStatus === OrderStatus.PROCESS) {
      // Confirm the order, decrement every line and award points in one transaction.
      // Concurrent confirmations retry against current stock; partial changes roll back.
      return this.orderModel.db.transaction(async (session) => {
        const result = await this.orderModel
          .findOneAndUpdate(
            filter,
            { $set: { orderStatus: OrderStatus.PROCESS } },
            { new: true, runValidators: true, session },
          )
          .exec();
        if (!result) throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
        const items = await this.orderItemModel
          .find({ orderId: result._id })
          .session(session)
          .lean()
          .exec();
        if (!items.length) throw new Errors(HttpCode.BAD_REQUEST, "This order has no products.");
        const quantities = new Map<string, number>();
        for (const item of items) {
          const id = String(shapeIntoMongooseObjectId(item.productId));
          const total = (quantities.get(id) || 0) + item.itemQuantity;
          if (
            !Number.isSafeInteger(item.itemQuantity) ||
            item.itemQuantity < 1 ||
            !Number.isSafeInteger(total)
          )
            throw new Errors(HttpCode.BAD_REQUEST, "Invalid order quantity.");
          quantities.set(id, total);
        }
        for (const [productId, quantity] of quantities) {
          const stock = await ProductModel.updateOne(
            {
              _id: shapeIntoMongooseObjectId(productId),
              productStatus: ProductStatus.PROCESS,
              productLeftCount: { $gte: quantity },
            },
            { $inc: { productLeftCount: -quantity } },
            { session },
          ).exec();
          if (stock.modifiedCount !== 1)
            throw new Errors(
              HttpCode.CONFLICT,
              "Some flowers are no longer available in the requested quantity. Please refresh your order.",
            );
        }
        await MemberModel.updateOne(
          { _id: filter.memberId, memberType: MemberType.USER, memberStatus: MemberStatus.ACTIVE },
          { $inc: { memberPoints: 1 } },
          { session },
        ).exec();
        return result as unknown as Order;
      });
    }
    // Cancelling a pending order or finishing a confirmed one never changes stock.
    const result = await this.orderModel
      .findOneAndUpdate(
        filter,
        { $set: { orderStatus: input.orderStatus } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!result) throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    return result as unknown as Order;
  }
}
export default OrderService;
