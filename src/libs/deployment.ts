import path from "path";
import { CookieOptions } from "express";

export function cookieOptions(): Pick<CookieOptions, "httpOnly" | "secure" | "sameSite" | "path"> {
  const sameSite = process.env.COOKIE_SAME_SITE || "lax";
  if (!["lax", "strict", "none"].includes(sameSite))
    throw new Error("COOKIE_SAME_SITE must be lax, strict or none.");
  const secure = process.env.NODE_ENV === "production";
  if (sameSite === "none" && !secure)
    throw new Error("SameSite=None requires production HTTPS cookies.");
  return { httpOnly: true, secure, sameSite: sameSite as "lax" | "strict" | "none", path: "/" };
}

export function allowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN;
  if (process.env.NODE_ENV === "production" && !configured)
    throw new Error("CORS_ORIGIN is required in production.");
  return [
    ...new Set(
      (configured || "http://localhost:3000,http://127.0.0.1:3000").split(",").map((value) => {
        const url = new URL(value.trim());
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        )
          throw new Error(
            "CORS_ORIGIN must contain exact HTTP(S) origins, not paths or wildcards.",
          );
        if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
          throw new Error("Production CORS_ORIGIN must use HTTPS.");
        return url.origin;
      }),
    ),
  ];
}

export function uploadRoot(): string {
  const configured = process.env.UPLOAD_ROOT;
  if (configured && !path.isAbsolute(configured))
    throw new Error("UPLOAD_ROOT must be an absolute path.");
  if (!configured && process.env.NODE_ENV === "production")
    throw new Error("UPLOAD_ROOT is required in production and must point to persistent storage.");
  return configured || path.resolve(__dirname, "../../uploads");
}

export function validateProductionEnvironment(): void {
  cookieOptions();
  if (process.env.NODE_ENV !== "production") return;
  if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGO_URL || ""))
    throw new Error("A valid MONGO_URL is required in production.");
  for (const key of ["SESSION_SECRET", "SECRET_TOKEN"]) {
    const value = process.env[key] || "";
    if (value.length < 32 || /replace|example|change-me/i.test(value))
      throw new Error(`${key} must be a unique random secret of at least 32 characters.`);
  }
  if (process.env.SESSION_SECRET === process.env.SECRET_TOKEN)
    throw new Error("Session and JWT secrets must be different.");
  allowedOrigins();
  uploadRoot();
}
