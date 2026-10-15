import { Request } from "express";
import { Types } from "mongoose";
import { MemberStatus, MemberType } from "../enums/member.enum";
type ObjectId = Types.ObjectId;
export interface Member {
  _id: ObjectId;
  memberType: MemberType;
  memberNick: string;
  memberPhone: string;
  memberPassword?: string;
  memberAdress?: string;
  memberDesc?: string;
  memberImage?: string;
  memberStatus?: MemberStatus;
  memberPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberInput {
  memberType?: MemberType;
  memberNick: string;
  memberPhone: string;
  memberPassword: string;
  memberAdress?: string;
  memberDesc?: string;
  memberImage?: string;
  memberStatus?: string;
  memberPoints?: number;
}
export interface LoginInput {
  memberNick: string;
  memberPassword: string;
}

export interface MemberUpdateInput {
  _id: ObjectId;
  memberNick?: string;
  memberPhone?: string;
  memberPassword?: string;
  memberAdress?: string;
  memberDesc?: string;
  memberImage?: string;
  memberStatus?: string;
}

// Authentication middleware populates these fields only after verification.
declare global {
  namespace Express {
    interface Request {
      member?: Member;
    }
  }
}
declare module "express-session" {
  interface SessionData {
    member?: Member;
  }
}
export type ExtendedRequest = Request;
export type AdminRequest = Request;
