require("ts-node/register");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  cookieOptions,
  allowedOrigins,
  uploadRoot,
  validateProductionEnvironment,
} = require("../src/libs/deployment");

test("production configuration rejects unsafe cookies, origins, storage and secrets", () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      MONGO_URL: "mongodb://127.0.0.1:27017/test",
      SESSION_SECRET: "a".repeat(40),
      SECRET_TOKEN: "b".repeat(40),
      CORS_ORIGIN: "https://soully.example",
      UPLOAD_ROOT: "/srv/soully/uploads",
      COOKIE_SAME_SITE: "lax",
    });
    assert.doesNotThrow(validateProductionEnvironment);
    assert.deepEqual(cookieOptions(), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    process.env.COOKIE_SAME_SITE = "none";
    assert.equal(cookieOptions().sameSite, "none");
    process.env.NODE_ENV = "development";
    assert.throws(cookieOptions, /HTTPS/);
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SAME_SITE = "lax";
    process.env.CORS_ORIGIN = "http://localhost:3000";
    assert.throws(allowedOrigins, /HTTPS/);
    process.env.CORS_ORIGIN = "https://soully.example/path";
    assert.throws(allowedOrigins, /exact/);
    process.env.CORS_ORIGIN = "https://soully.example";
    delete process.env.UPLOAD_ROOT;
    assert.throws(uploadRoot, /persistent/);
    process.env.UPLOAD_ROOT = "relative/uploads";
    assert.throws(uploadRoot, /absolute/);
    process.env.UPLOAD_ROOT = "/srv/soully/uploads";
    process.env.SECRET_TOKEN = process.env.SESSION_SECRET;
    assert.throws(validateProductionEnvironment, /different/);
    process.env.SECRET_TOKEN = "short";
    assert.throws(validateProductionEnvironment, /32/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
