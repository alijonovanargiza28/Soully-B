import { shapeIntoMongooseObjectId } from "../libs/config";
import { OrderStatus } from "../libs/enums/order.enum";
import { ProductStatus } from "../libs/enums/product.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Member } from "../libs/types/member";
import { Order, OrderInquiry, OrderItemInput, OrderUpdateInput } from "../libs/types/order";
import OrderModel from "../schema/Order.model";
import OrderItemModel from "../schema/OrderItem.model";
import ProductModel from "../schema/Product.model";
import MemberService from "./Member.service";

class OrderService {
  private readonly orderModel = OrderModel;
  private readonly orderItemModel = OrderItemModel;
  private readonly memberService = new MemberService();

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
    // Match ownership and previous state atomically to prevent repeated transitions.
    const result = await this.orderModel
      .findOneAndUpdate(
        {
          _id: shapeIntoMongooseObjectId(input.orderId),
          memberId: shapeIntoMongooseObjectId(member._id),
          orderStatus: previousStatus,
        },
        { $set: { orderStatus: input.orderStatus } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!result) throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    if (input.orderStatus === OrderStatus.PROCESS) await this.memberService.addUserPoint(member, 1);
    return result as unknown as Order;
  }
}
export default OrderService;
