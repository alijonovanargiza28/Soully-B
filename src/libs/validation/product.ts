import { ProductCollection, ProductSize, ProductStatus } from "../enums/product.enum";
import Errors, { HttpCode } from "../Errors";
import { ProductInput } from "../types/product";

export function validateProductInput(value: unknown, partial = false): Partial<ProductInput> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Errors(HttpCode.BAD_REQUEST, "Invalid product data.");
  const input = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const fail = (message: string): never => {
    throw new Errors(HttpCode.BAD_REQUEST, message);
  };
  for (const key of [
    "productName",
    "productCollection",
    "productPrice",
    "productLeftCount",
    "productSize",
    "productStatus",
    "productDesc",
  ]) {
    const raw = input[key];
    if (raw === undefined && partial) continue;
    if (key === "productName") {
      if (typeof raw !== "string" || raw.trim().length < 2 || raw.trim().length > 100)
        fail("Product name must contain 2–100 characters.");
      result[key] = (raw as string).trim();
    } else if (key === "productPrice" || key === "productLeftCount") {
      if ((typeof raw !== "string" && typeof raw !== "number") || String(raw).trim() === "")
        fail(`${key === "productPrice" ? "Price" : "Stock"} is required.`);
      const number = Number(raw);
      if (
        !Number.isFinite(number) ||
        number < 0 ||
        (key === "productLeftCount" && !Number.isSafeInteger(number))
      )
        fail(
          `${key === "productPrice" ? "Price must be a non-negative number" : "Stock must be a non-negative whole number"}.`,
        );
      result[key] = number;
    } else if (key === "productDesc") {
      if (raw !== undefined && (typeof raw !== "string" || raw.length > 2000))
        fail("Description must contain at most 2000 characters.");
      if (raw !== undefined) result[key] = (raw as string).trim();
    } else {
      const options =
        key === "productCollection"
          ? Object.values(ProductCollection)
          : key === "productSize"
            ? Object.values(ProductSize)
            : Object.values(ProductStatus);
      const normalized =
        key === "productCollection" && raw === "WEDDING" ? ProductCollection.WEDDING_BOUQUET : raw;
      const fallback =
        key === "productSize"
          ? ProductSize.MEDIUM
          : key === "productStatus"
            ? ProductStatus.PAUSE
            : undefined;
      const selected = normalized ?? fallback;
      if (typeof selected !== "string" || !(options as string[]).includes(selected))
        fail(
          `Select a valid ${key === "productCollection" ? "collection" : key === "productSize" ? "size" : "status"}.`,
        );
      result[key] = selected;
    }
  }
  if (partial && !Object.keys(result).length) fail("No editable product fields were provided.");
  return result as Partial<ProductInput>;
}
