import mongoose, { Schema } from "mongoose";
import { MemberStatus, MemberType, normalizeMemberType } from "../libs/enums/member.enum";
const memberSchema = new Schema(
  {
    memberType: {
      type: String,
      enum: MemberType,
      get: normalizeMemberType,
      default: MemberType.USER,
    },
    memberStatus: {
      type: String,
      enum: MemberStatus,
      default: MemberStatus.ACTIVE,
    },
    memberNick: {
      type: String,
      index: { unique: true, sparse: true },
      required: true,
    },
    memberPhone: {
      type: String,
      index: { unique: true, sparse: true },
      required: true,
    },
    memberPassword: {
      type: String,
      select: false,
      required: true,
    },
    memberAdress: {
      type: String,
    },
    memberDesc: {
      type: String,
    },
    memberPoints: {
      type: Number,
      default: 0,
    },
    memberImage: {
      type: String,
    },
  },
  { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } },
);

export default mongoose.model("Member", memberSchema);
