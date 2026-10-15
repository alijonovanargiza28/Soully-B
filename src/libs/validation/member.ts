import Errors, { HttpCode } from "../Errors";
export function validateCredentials(
  input: { memberNick: string; memberPassword: string; memberPhone?: string },
  signup = false,
): void {
  if (
    typeof input.memberNick !== "string" ||
    !input.memberNick.trim() ||
    input.memberNick.trim().length > 40
  )
    throw new Errors(HttpCode.BAD_REQUEST, "Username is required and cannot exceed 40 characters.");
  input.memberNick = input.memberNick.trim();
  if (
    typeof input.memberPassword !== "string" ||
    !input.memberPassword ||
    Buffer.byteLength(input.memberPassword) > 72 ||
    (signup && input.memberPassword.length < 6)
  )
    throw new Errors(HttpCode.BAD_REQUEST, "Password must contain 6–72 bytes for signup.");
  if (
    signup &&
    (typeof input.memberPhone !== "string" || !/^[+0-9() -]{7,20}$/.test(input.memberPhone))
  )
    throw new Errors(HttpCode.BAD_REQUEST, "Enter a valid phone number (7–20 characters).");
}
export function validateProfile(input: Record<string, unknown>): void {
  for (const [key, limit] of [
    ["memberNick", 40],
    ["memberPhone", 20],
    ["memberAdress", 300],
    ["memberDesc", 1000],
  ] as const) {
    const value = input[key];
    if (
      value !== undefined &&
      (typeof value !== "string" ||
        value.length > limit ||
        (["memberNick", "memberPhone"].includes(key) && !value.trim()))
    )
      throw new Errors(HttpCode.BAD_REQUEST, `Invalid ${key}.`);
  }
  if (input.memberPhone !== undefined && !/^[+0-9() -]{7,20}$/.test(String(input.memberPhone)))
    throw new Errors(HttpCode.BAD_REQUEST, "Enter a valid phone number.");
}
