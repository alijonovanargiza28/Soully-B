import { Request } from "express";
import { promises as fs } from "fs";
import Errors, { HttpCode, Message } from "../Errors";
import { Member } from "../types/member";
export function requireMember(request: Request): Member {
  if (!request.member) throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
  return request.member;
}
export function uploadedFiles(request: Request): Express.Multer.File[] {
  return Array.isArray(request.files) ? request.files : [];
}
export function memberImagePath(file: Express.Multer.File): string {
  return `uploads/members/${file.filename}`;
}

export async function discardNewMemberUpload(request: Request): Promise<void> {
  if (request.file) await fs.unlink(request.file.path).catch(() => undefined);
}
