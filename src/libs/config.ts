import mongoose from "mongoose";
import Errors, { HttpCode, Message } from "./Errors";

export const AUTH_TIMER = 24;
export const MORGAN_FORMAT = ":method :url :response-time [:status]";
export const shapeIntoMongooseObjectId = (target: unknown): mongoose.Types.ObjectId => {
  if (target instanceof mongoose.Types.ObjectId) return target;
  if (typeof target !== "string" || !/^[a-fA-F0-9]{24}$/.test(target)) {
    throw new Errors(HttpCode.BAD_REQUEST, Message.NO_DATA_FOUND);
  }
  return new mongoose.Types.ObjectId(target);
};
