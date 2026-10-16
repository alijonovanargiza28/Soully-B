import { PipelineStage, Types } from "mongoose";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { ProductCollection, ProductStatus } from "../libs/enums/product.enum";
import { ViewGroup } from "../libs/enums/view.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Product, ProductInput, ProductInquery, ProductUpdateInput } from "../libs/types/product";
import { ViewInput } from "../libs/types/view";
import { validateProductInput } from "../libs/validation/product";
import ProductModel from "../schema/Product.model";
import OrderModel from "../schema/Order.model";
import OrderItemModel from "../schema/OrderItem.model";
import { OrderStatus } from "../libs/enums/order.enum";
import ViewService from "./view.service";
type ObjectId = Types.ObjectId;

class ProductService {
  private readonly productModel;
  public viewService;

  constructor() {
    this.productModel = ProductModel;
    this.viewService = new ViewService();
  }

  public async getProductPage(inquiry: ProductInquery) {
    if (
      !Number.isSafeInteger(inquiry.page) ||
      inquiry.page < 1 ||
      !Number.isSafeInteger(inquiry.limit) ||
      inquiry.limit < 1 ||
      inquiry.limit > 100
    ) {
      throw new Errors(
        HttpCode.BAD_REQUEST,
        "Page and limit must be positive integers; limit cannot exceed 100.",
      );
    }
    const order = ["createdAt", "productPrice", "productViews", "productSold"].includes(
      inquiry.order,
    )
      ? inquiry.order
      : "createdAt";
    const match: Record<string, unknown> = { productStatus: ProductStatus.PROCESS };
    if (inquiry.productCollection) {
      const category =
        String(inquiry.productCollection) === "WEDDING"
          ? ProductCollection.WEDDING_BOUQUET
          : inquiry.productCollection;
      if (!Object.values(ProductCollection).includes(category))
        throw new Errors(HttpCode.BAD_REQUEST, "Invalid product collection.");
      match.productCollection =
        category === ProductCollection.WEDDING_BOUQUET ? { $in: [category, "WEDDING"] } : category;
    }
    if (inquiry.search)
      match.productName = {
        $regex: new RegExp(inquiry.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      };
    // Derive sales from existing order lines; status transitions never increment a cached counter.
    const salesStages: PipelineStage[] =
      order === "productSold"
        ? [
            {
              $lookup: {
                from: OrderItemModel.collection.name,
                let: { productId: "$_id" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$productId", "$$productId"] } } },
                  {
                    $lookup: {
                      from: OrderModel.collection.name,
                      let: { orderId: "$orderId" },
                      pipeline: [
                        {
                          $match: {
                            $expr: { $eq: ["$_id", "$$orderId"] },
                            orderStatus: { $in: [OrderStatus.PROCESS, OrderStatus.FINISH] },
                          },
                        },
                        { $project: { _id: 1 } },
                      ],
                      as: "confirmedOrder",
                    },
                  },
                  { $match: { "confirmedOrder.0": { $exists: true } } },
                  { $group: { _id: null, total: { $sum: "$itemQuantity" } } },
                ],
                as: "sales",
              },
            },
            {
              $addFields: { productSold: { $ifNull: [{ $arrayElemAt: ["$sales.total", 0] }, 0] } },
            },
            { $match: { productSold: { $gt: 0 } } },
            { $project: { sales: 0 } },
          ]
        : [];
    const result = await this.productModel
      .aggregate([
        { $match: match },
        ...salesStages,
        {
          $facet: {
            products: [
              { $sort: { [order]: order === "productPrice" ? 1 : -1, _id: 1 } },
              { $skip: (inquiry.page - 1) * inquiry.limit },
              { $limit: inquiry.limit },
            ],
            count: [{ $count: "total" }],
          },
        },
      ])
      .exec();
    const total = result[0]?.count[0]?.total ?? 0;
    return {
      products: (result[0]?.products ?? []) as Product[],
      pagination: {
        page: inquiry.page,
        limit: inquiry.limit,
        total,
        totalPages: Math.ceil(total / inquiry.limit),
      },
    };
  }

  public async getProducts(inquiry: ProductInquery): Promise<Product[]> {
    return (await this.getProductPage(inquiry)).products;
  }

  public async getProduct(memberId: ObjectId | undefined, id: string): Promise<Product> {
    const productId = shapeIntoMongooseObjectId(id);

    let result = await this.productModel
      .findOne({
        _id: productId,
        productStatus: ProductStatus.PROCESS,
      })
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    if (memberId) {
      //Check Existance
      const input: ViewInput = {
        memberId: memberId,
        viewRefId: productId,
        viewGroup: ViewGroup.PRODUCT,
      };
      const existView = await this.viewService.checkViewExistence(input);

      if (!existView) {
        //Insert view

        await this.viewService.insertMemberView(input);

        //Increase count
        result = await this.productModel
          .findByIdAndUpdate(productId, { $inc: { productViews: +1 } }, { new: true })
          .exec();
      }
    }
    return result;
  }

  //SSR backend da frontent qurish
  public async getAllProduct(): Promise<Product[]> {
    const result = await this.productModel.find().exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    return result;
  }

  public async createNewProduct(input: ProductInput): Promise<Product> {
    const values = validateProductInput(input) as ProductInput;
    if (!input.productImages?.length)
      throw new Errors(HttpCode.BAD_REQUEST, "Upload at least one product image.");
    return this.productModel.create({ ...values, productImages: input.productImages });
  }

  public async updateChosenProduct(id: string, input: ProductUpdateInput): Promise<Product> {
    const values = validateProductInput(input, true);
    const result = await this.productModel
      .findOneAndUpdate(
        { _id: shapeIntoMongooseObjectId(id) },
        {
          $set: {
            ...values,
            ...(input.productImages?.length ? { productImages: input.productImages } : {}),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!result) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return result;
  }
}
export default ProductService;
