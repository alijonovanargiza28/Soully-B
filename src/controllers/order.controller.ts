import { Response } from "express";
import { OrderStatus } from "../libs/enums/order.enum";
import Errors, { HttpCode } from "../libs/Errors";
import { ExtendedRequest } from "../libs/types/member";
import { OrderInquiry, OrderUpdateInput } from "../libs/types/order";
import { requireMember } from "../libs/utils/request";
import OrderService from "../models/Order.service";

const orderService = new OrderService();

const orderController = {
  createOrder: async (req: ExtendedRequest, res: Response) => {
    try {
      const result = await orderService.createOrder(requireMember(req), req.body);

      res.status(HttpCode.CREATED).json({ result });
    } catch (err) {
      console.error("Error,createOrder", err);
      if (err instanceof Errors) res.status(err.code).json(err);
      else res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  getMyOrders: async (req: ExtendedRequest, res: Response) => {
    try {
      const { page, limit, orderStatus } = req.query; //ajratvolyabmiz
      const inquery: OrderInquiry = {
        page: Number(page ?? 1),
        limit: Number(limit ?? 10),
        orderStatus: orderStatus as OrderStatus,
      };

      const result = await orderService.getMyOrders(requireMember(req), inquery);

      res.status(HttpCode.OK).json({ result });
    } catch (err) {
      console.error("Error,createOrder", err);
      if (err instanceof Errors) res.status(err.code).json(err);
      else res.status(Errors.standard.code).json(Errors.standard);
    }
  },
  updateOrder: async (req: ExtendedRequest, res: Response) => {
    try {
      const input: OrderUpdateInput = req.body;

      const result = await orderService.updateOrder(requireMember(req), input);

      res.status(HttpCode.OK).json({ result });
    } catch (err) {
      console.error("Error updateOrder", err);

      if (err instanceof Errors) res.status(err.code).json(err);
      else res.status(Errors.standard.code).json(Errors.standard);
    }
  },
};

export default orderController;
