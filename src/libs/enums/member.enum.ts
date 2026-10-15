export enum MemberType {
  USER = "USER",
  SELLER = "SELLER",
}

export enum MemberStatus {
  ACTIVE = "ACTIVE",
  BLOCK = "BLOCK",
  DELETE = "DELETE",
}

// Read old shop accounts without rewriting persisted records. New accounts use SELLER.
export const sellerMemberTypes = [MemberType.SELLER, "RESTAURANT"];

export function normalizeMemberType(value: string): string {
  return value === "RESTAURANT" ? MemberType.SELLER : value;
}
