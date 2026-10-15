import { Types } from "mongoose";
import { ViewGroup } from "../enums/view.enum";
type ObjectId = Types.ObjectId;

export interface View {
  _id: ObjectId;
  viewGroup: ViewGroup;
  memberId: ObjectId;
  viewRefId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewInput {
  memberId: ObjectId;
  viewRefId: ObjectId;
  viewGroup: ViewGroup;
}
