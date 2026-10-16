require("ts-node/register");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
let mongo, app, store;
const temp = fs.mkdtempSync("/private/tmp/soully-production-test-");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
  "base64",
);
before(
  async () => {
    fs.mkdirSync(path.join(temp, "db"));
    mongo = await MongoMemoryServer.create({
      binary: { version: "7.0.14", downloadDir: "/private/tmp/soully-mongodb-binaries" },
      instance: {
        dbPath: path.join(temp, "db"),
        dbName: "production_cookie_test",
        ip: "127.0.0.1",
      },
    });
    Object.assign(process.env, {
      NODE_ENV: "production",
      MONGO_URL: mongo.getUri(),
      SESSION_SECRET: "production-test-session-" + "a".repeat(32),
      SECRET_TOKEN: "production-test-token-" + "b".repeat(32),
      UPLOAD_ROOT: path.join(temp, "uploads"),
      CORS_ORIGIN: "https://soully.example",
      COOKIE_SAME_SITE: "lax",
      TRUST_PROXY: "1",
    });
    await mongoose.connect(process.env.MONGO_URL);
    ({ default: app, store } = require("../../src/app"));
    await require("../../src/schema/Member.module").default.init();
  },
  { timeout: 180000 },
);
after(async () => {
  if (store?.client) await store.client.close();
  await mongoose.disconnect();
  if (mongo) await mongo.stop({ doCleanup: false, force: true });
  console.info(
    `Isolated production test artifacts retained at ${temp}; existing data was not used.`,
  );
});
function https(call) {
  return call
    .set("Host", "soully.example")
    .set("Origin", "https://soully.example")
    .set("X-Forwarded-Proto", "https");
}
function assertSecure(cookie) {
  assert.match(cookie, /; HttpOnly/i);
  assert.match(cookie, /; Secure/i);
  assert.match(cookie, /; SameSite=Lax/i);
  assert.match(cookie, /; Path=\//i);
}
test(
  "production HTTPS proxy, cookies, CORS, uploads and health use real MongoDB",
  { timeout: 180000 },
  async (t) => {
    await t.test("health and exact CORS origins", async () => {
      assert.equal((await request(app).get("/health")).status, 200);
      const cors = await https(request(app).get("/health"));
      assert.equal(cors.headers["access-control-allow-origin"], "https://soully.example");
      assert.equal(cors.headers["access-control-allow-credentials"], "true");
      assert.equal(
        (
          await request(app)
            .post("/member/login")
            .set("Origin", "https://untrusted.example")
            .send({})
        ).status,
        403,
      );
    });
    await t.test(
      "member signup, cookie authentication and logout retain secure flags",
      async () => {
        const response = await https(request(app).post("/member/signup")).send({
          memberNick: "ProductionTestUser",
          memberPhone: "+998900001101",
          memberPassword: "TestPassword123",
        });
        assert.equal(response.status, 201, response.text);
        const cookie = response.headers["set-cookie"].find((value) =>
          value.startsWith("accessToken="),
        );
        assertSecure(cookie);
        assert.equal(
          (await https(request(app).get("/member/detail")).set("Cookie", cookie.split(";")[0]))
            .status,
          200,
        );
        const logout = await https(request(app).post("/member/logout")).set(
          "Cookie",
          cookie.split(";")[0],
        );
        assertSecure(logout.headers["set-cookie"][0]);
        assert.match(logout.headers["set-cookie"][0], /^accessToken=;/);
      },
    );
    await t.test("admin session, image storage and logout work behind HTTPS proxy", async () => {
      const response = await https(request(app).post("/admin/signup"))
        .field("memberNick", "ProductionTestShop")
        .field("memberPhone", "+998900001102")
        .field("memberPassword", "TestPassword123")
        .attach("memberImage", png, "shop.png");
      assert.equal(response.status, 302, response.text);
      const cookie = response.headers["set-cookie"].find((value) =>
        value.startsWith("connect.sid="),
      );
      assertSecure(cookie);
      assert.equal(
        (await https(request(app).get("/admin/product/all")).set("Cookie", cookie.split(";")[0]))
          .status,
        200,
      );
      const Member = require("../../src/schema/Member.module").default;
      const shop = await Member.findOne({ memberNick: "ProductionTestShop" });
      assert.ok(
        fs.existsSync(
          path.join(process.env.UPLOAD_ROOT, "members", path.basename(shop.memberImage)),
        ),
      );
      assert.equal((await request(app).get("/" + shop.memberImage)).status, 200);
      const logout = await https(request(app).get("/admin/logout")).set(
        "Cookie",
        cookie.split(";")[0],
      );
      assertSecure(logout.headers["set-cookie"][0]);
    });
  },
);
