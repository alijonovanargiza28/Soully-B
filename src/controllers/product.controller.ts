import { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";
import { ProductCollection, ProductSize, ProductStatus } from "../libs/enums/product.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { AdminRequest, ExtendedRequest } from "../libs/types/member";
import { ProductInput, ProductUpdateInput } from "../libs/types/product";
import { uploadedFiles } from "../libs/utils/request";
import ProductService from "../models/Product.service";

const productService = new ProductService();
function sendError(res: Response, error: unknown): void {
  if (error instanceof Errors) {
    res.status(error.code).json({ message: error.message });
    return;
  }
  const failure = error as {
    code?: number;
    name?: string;
    errors?: Record<string, { message: string }>;
  };
  if (failure?.code === 11000) {
    res.status(HttpCode.CONFLICT).json({ message: "A product with this name already exists." });
    return;
  }
  if (failure?.name === "ValidationError") {
    res.status(400).json({
      message: Object.values(failure.errors ?? {})
        .map((item) => item.message)
        .join(" "),
    });
    return;
  }
  console.error("Product request failed", error);
  res.status(500).json({ message: Message.SOMETHING_WENT_WRONG });
}
async function discardNewUploads(files: Express.Multer.File[] = []): Promise<void> {
  // These UUID paths belong only to the failed request, never existing product assets.
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
}
const productController = {
  async getProducts(req: Request, res: Response) {
    try {
      const { products, pagination } = await productService.getProductPage({
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 8),
        order: String(req.query.order ?? "createdAt"),
        ...(req.query.productCollection && req.query.productCollection !== "ALL"
          ? { productCollection: String(req.query.productCollection) as ProductCollection }
          : {}),
        ...(req.query.search ? { search: String(req.query.search).slice(0, 200) } : {}),
      });
      res.status(200).json({ result: products, pagination });
    } catch (error) {
      sendError(res, error);
    }
  },
  async getAllProducts(req: Request, res: Response) {
    try {
      res.render("menu", {
        products: await productService.getAllProduct(),
        saved: req.query.saved === "created" || req.query.saved === "updated",
        collections: Object.values(ProductCollection),
        sizes: Object.values(ProductSize),
        statuses: Object.values(ProductStatus),
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  async getProduct(req: ExtendedRequest, res: Response) {
    try {
      res.status(200).json(await productService.getProduct(req.member?._id, String(req.params.id)));
    } catch (error) {
      sendError(res, error);
    }
  },
  async createNewProduct(req: AdminRequest, res: Response) {
    try {
      const files = uploadedFiles(req);
      if (!files.length) throw new Errors(400, "Upload at least one product image.");
      const input: ProductInput = {
        ...req.body,
        productImages: files.map((file) => `uploads/products/${path.basename(file.path)}`),
      };
      res.status(201).json({ data: await productService.createNewProduct(input) });
    } catch (error) {
      await discardNewUploads(uploadedFiles(req));
      sendError(res, error);
    }
  },
  async updateChosenProduct(req: AdminRequest, res: Response) {
    try {
      const images = uploadedFiles(req).map(
        (file) => `uploads/products/${path.basename(file.path)}`,
      );
      const input: ProductUpdateInput = {
        ...req.body,
        ...(images?.length ? { productImages: images } : {}),
      };
      res
        .status(200)
        .json({ data: await productService.updateChosenProduct(String(req.params.id), input) });
    } catch (error) {
      await discardNewUploads(uploadedFiles(req));
      sendError(res, error);
    }
  },
};
export default productController;
