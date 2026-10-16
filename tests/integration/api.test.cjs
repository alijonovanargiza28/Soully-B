require("ts-node/register");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const { ProductCollection } = require("../../src/libs/enums/product.enum");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
  "base64",
);
let mongo,
  app,
  store,
  admin,
  first,
  second,
  products = [];
const temp = fs.mkdtempSync("/private/tmp/soully-real-api-");

before(
  async () => {
    const dbPath = path.join(temp, "db");
    fs.mkdirSync(dbPath);
    mongo = await MongoMemoryServer.create({
      binary: { version: "7.0.14", downloadDir: "/private/tmp/soully-mongodb-binaries" },
      instance: { dbPath, dbName: "soully_audit", ip: "127.0.0.1" },
    });
    process.env.MONGO_URL = mongo.getUri();
    process.env.SESSION_SECRET = "isolated-test-session-secret";
    process.env.SECRET_TOKEN = "isolated-test-jwt-secret";
    process.env.UPLOAD_ROOT = path.join(temp, "uploads");
    process.env.NODE_ENV = "test";
    await mongoose.connect(process.env.MONGO_URL);
    ({ default: app, store } = require("../../src/app"));
    await Promise.all([
      require("../../src/schema/Product.model").default.init(),
      require("../../src/schema/Member.module").default.init(),
    ]);
    admin = request.agent(app);
    first = request.agent(app);
    second = request.agent(app);
  },
  { timeout: 180000 },
);

after(async () => {
  if (store?.client) await store.client.close();
  await mongoose.disconnect();
  if (mongo) await mongo.stop({ doCleanup: false, force: true });
  console.info(
    `Isolated real MongoDB and uploaded test artifacts retained at ${temp}. No existing database was used or deleted.`,
  );
});
function createProduct(fields = {}) {
  let call = admin.post("/admin/product/create").set("Accept", "application/json");
  for (const [key, value] of Object.entries({
    productName: "Audit flower",
    productCollection: "BOUQUET",
    productPrice: "20.50",
    productLeftCount: "20",
    productStatus: "PROCESS",
    ...fields,
  }))
    call = call.field(key, value);
  return call.attach("productImages", png, { filename: "rose.png", contentType: "image/png" });
}

test("real MongoDB + Express feature integration", { timeout: 180000 }, async (t) => {
  await t.test("protected routes reject anonymous requests", async () => {
    assert.equal(
      (await request(app).get("/admin/product/all").set("Accept", "application/json")).status,
      401,
    );
    assert.equal((await request(app).get("/member/detail")).status, 401);
    assert.equal((await request(app).post("/order/create").send([])).status, 401);
    assert.equal((await request(app).get("/admin")).status, 302);
  });
  await t.test("untrusted cross-origin mutations are rejected", async () => {
    const response = await request(app)
      .post("/member/login")
      .set("Origin", "https://untrusted.example")
      .send({});
    assert.equal(response.status, 403);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  });
  await t.test("real admin signup persists a shop account and session", async () => {
    const response = await admin
      .post("/admin/signup")
      .field("memberNick", "SoullyAuditAdmin")
      .field("memberPhone", "+998900000001")
      .field("memberPassword", "Audit12345")
      .attach("memberImage", png, "admin.png");
    assert.equal(response.status, 302, response.text);
    assert.equal((await admin.get("/admin")).status, 200);
    assert.equal((await admin.get("/admin/user/all")).status, 200);
  });
  await t.test("SELLER role and legacy shop accounts retain login and route access", async () => {
    const Member = require("../../src/schema/Member.module").default;
    const shop = await Member.findOne({ memberNick: "SoullyAuditAdmin" });
    assert.equal(shop.memberType, "SELLER");
    assert.equal((await request(app).get("/member/seller")).body.memberType, "SELLER");
    await Member.collection.updateOne({ _id: shop._id }, { $set: { memberType: "RESTAURANT" } });
    assert.equal(
      (await admin.get("/admin/check-me").set("Accept", "application/json")).body.member.memberType,
      "SELLER",
    );
    for (const route of ["/member/seller", "/member/restaurant"]) {
      const response = await request(app).get(route);
      assert.equal(response.status, 200);
      assert.equal(response.body.memberType, "SELLER");
    }
    const legacy = request.agent(app);
    assert.equal(
      (
        await legacy
          .post("/admin/login")
          .send({ memberNick: "SoullyAuditAdmin", memberPassword: "Audit12345" })
      ).status,
      302,
    );
    assert.equal((await legacy.get("/admin/product/all")).status, 200);
    assert.equal(
      (
        await legacy
          .post("/member/login")
          .send({ memberNick: "SoullyAuditAdmin", memberPassword: "Audit12345" })
      ).body.member.memberType,
      "SELLER",
    );
    assert.equal((await legacy.get("/member/detail")).body.memberType, "SELLER");
    assert.equal((await Member.collection.findOne({ _id: shop._id })).memberType, "RESTAURANT");
    await Member.collection.updateOne({ _id: shop._id }, { $set: { memberType: "SELLER" } });
  });
  await t.test(
    "every enum category, including both wedding categories, saves and serves its uploaded image",
    async () => {
      for (const [index, category] of Object.values(ProductCollection).entries()) {
        const response = await createProduct({
          productName: `Audit ${category}`,
          productCollection: category,
          productPrice: String(index + 1),
        });
        assert.equal(response.status, 201, `${category}: ${response.text}`);
        assert.equal(response.body.data.productCollection, category);
        assert.match(response.body.data.productImages[0], /^uploads\/products\/[\w-]+\.png$/);
        const image = await request(app).get("/" + response.body.data.productImages[0]);
        assert.equal(image.status, 200);
        assert.match(image.headers["content-type"], /image\/png/);
        products.push(response.body.data);
      }
    },
  );
  await t.test(
    "All defaults, exact pagination, category/search/sorting and page validation use MongoDB",
    async () => {
      const all = await request(app).get("/product/all");
      assert.equal(all.status, 200);
      assert.equal(all.body.result.length, 8);
      assert.equal(all.body.pagination.total, products.length);
      assert.equal(all.body.pagination.totalPages, Math.ceil(products.length / 8));
      const page2 = await request(app).get("/product/all?page=2&limit=8");
      assert.equal(page2.status, 200);
      assert.equal(
        page2.body.result.some((p) => all.body.result.some((q) => q._id === p._id)),
        false,
      );
      for (const category of Object.values(ProductCollection)) {
        const response = await request(app)
          .get("/product/all")
          .query({ productCollection: category });
        assert.equal(response.body.pagination.total, 1, category);
        assert.equal(response.body.result[0].productCollection, category);
      }
      const legacyWedding = await request(app).get("/product/all?productCollection=WEDDING");
      assert.equal(legacyWedding.body.result[0].productCollection, "WEDDING_BOUQUET");
      const sorted = await request(app).get("/product/all?order=productPrice&limit=100");
      assert.deepEqual(
        sorted.body.result.map((p) => p.productPrice),
        products.map((p) => p.productPrice).sort((a, b) => a - b),
      );
      assert.equal(
        (await request(app).get("/product/all?search=WEDDING")).body.pagination.total,
        2,
      );
      assert.equal(
        (await request(app).get("/product/all?search=missing-flower")).body.pagination.total,
        0,
      );
      assert.equal((await request(app).get("/product/all?page=0")).status, 400);
      assert.equal((await request(app).get("/product/all?productCollection=INVALID")).status, 400);
    },
  );
  await t.test(
    "validation and duplicate errors are clear and failed uploads leave no orphan files",
    async () => {
      const directory = path.join(process.env.UPLOAD_ROOT, "products");
      const before = fs.readdirSync(directory).length;
      for (const fields of [
        { productCollection: "INVALID" },
        { productPrice: "-1" },
        { productLeftCount: "1.5" },
        { productName: " " },
        { productStatus: "ACTIVE" },
      ]) {
        const response = await createProduct(fields);
        assert.equal(response.status, 400, response.text);
        assert.ok(response.body.message);
      }
      const duplicate = await createProduct({ productName: products[0].productName });
      assert.equal(duplicate.status, 409);
      assert.match(duplicate.body.message, /already exists/);
      assert.equal(fs.readdirSync(directory).length, before);
      const badFile = await admin
        .post("/admin/product/create")
        .attach("productImages", Buffer.from("<script/>"), "bad.svg");
      assert.equal(badFile.status, 400);
      assert.equal(
        (await admin.post("/admin/product/create").send({ productName: "No image" })).status,
        400,
      );
    },
  );
  await t.test(
    "legacy wedding payload maps to canonical enum; admin editing and status work",
    async () => {
      const wedding = await createProduct({
        productName: "Audit legacy wedding",
        productCollection: "WEDDING",
      });
      assert.equal(wedding.status, 201);
      assert.equal(wedding.body.data.productCollection, "WEDDING_BOUQUET");
      const id = wedding.body.data._id;
      assert.equal((await request(app).get(`/product/${id}`)).status, 200);
      const edit = await admin
        .post(`/admin/product/${id}`)
        .send({ productPrice: "33.5", productLeftCount: "12", productDesc: "Updated flowers" });
      assert.equal(edit.status, 200);
      assert.equal(edit.body.data.productPrice, 33.5);
      assert.equal(
        (await admin.post(`/admin/product/${id}`).send({ productStatus: "PAUSE" })).status,
        200,
      );
      assert.equal((await request(app).get(`/product/${id}`)).status, 404);
      assert.equal(
        (await admin.post(`/admin/product/${id}`).send({ productStatus: "PROCESS" })).status,
        200,
      );
      const special = await createProduct({ productName: "Audit [Rose]" });
      assert.equal(special.status, 201);
      assert.equal(
        (await request(app).get("/product/all").query({ search: "[" })).body.pagination.total,
        1,
      );
    },
  );
  await t.test(
    "signup, phone-free login, HttpOnly cookies and role injection protection",
    async () => {
      for (const [agent, name, phone] of [
        [first, "AuditUserOne", "+998900000002"],
        [second, "AuditUserTwo", "+998900000003"],
      ]) {
        const response = await agent.post("/member/signup").send({
          memberNick: name,
          memberPhone: phone,
          memberPassword: "Audit12345",
          memberType: "SELLER",
          memberPoints: 999,
        });
        assert.equal(response.status, 201, response.text);
        assert.equal(response.body.member.memberType, "USER");
        assert.equal(response.body.member.memberPoints, 0);
        assert.ok(response.headers["set-cookie"].some((cookie) => cookie.includes("HttpOnly")));
      }
      assert.equal((await first.post("/member/logout")).status, 200);
      assert.equal((await first.get("/member/detail")).status, 401);
      assert.equal(
        (
          await first
            .post("/member/login")
            .send({ memberNick: "AuditUserOne", memberPassword: "wrong" })
        ).status,
        401,
      );
      const login = await first
        .post("/member/login")
        .send({ memberNick: "AuditUserOne", memberPassword: "Audit12345" });
      assert.equal(login.status, 200, login.text);
      assert.equal(login.body.member.memberPassword, undefined);
      const invalidLogin = await first
        .post("/member/login")
        .send({ memberNick: "AuditUserOne", memberPassword: "bad-password" });
      assert.match(invalidLogin.body.message, /password/i);
      assert.equal(
        (
          await request(app)
            .post("/member/signup")
            .send({ memberNick: "Bad", memberPhone: "x", memberPassword: "x" })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "profile fields and real uploaded image update without role or password injection",
    async () => {
      const response = await first
        .post("/member/update")
        .field("memberNick", "AuditUserOne")
        .field("memberPhone", "+998900000002")
        .field("memberDesc", "")
        .field("memberType", "SELLER")
        .attach("memberImage", png, "profile.png");
      assert.equal(response.status, 200, response.text);
      assert.equal(response.body.memberType, "USER");
      assert.match(response.body.memberImage, /^uploads\/members\/[\w-]+\.png$/);
      assert.equal((await request(app).get("/" + response.body.memberImage)).status, 200);
      assert.equal((await first.get("/member/detail")).status, 200);
    },
  );
  await t.test(
    "orders use catalog prices, enforce ownership/state, and award points once",
    async () => {
      const product = products[0];
      const created = await first
        .post("/order/create")
        .send([{ productId: product._id, itemQuantity: 2, itemPrice: 0.01 }]);
      assert.equal(created.status, 201, created.text);
      assert.equal(created.body.result.orderTotal, product.productPrice * 2 + 5);
      const id = created.body.result._id;
      assert.equal(
        (await second.post("/order/update").send({ orderId: id, orderStatus: "PROCESS" })).status,
        400,
      );
      const attempts = await Promise.all([
        first.post("/order/update").send({ orderId: id, orderStatus: "PROCESS" }),
        first.post("/order/update").send({ orderId: id, orderStatus: "PROCESS" }),
      ]);
      assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 400]);
      assert.equal((await first.get("/member/detail")).body.memberPoints, 1);
      const own = await first.get("/order/all?orderStatus=PROCESS");
      assert.equal(own.status, 200);
      assert.equal(own.body.result.length, 1);
      assert.equal(own.body.result[0].orderItems.length, 1);
      assert.equal((await second.get("/order/all?orderStatus=PROCESS")).body.result.length, 0);
      assert.equal(
        (await first.post("/order/update").send({ orderId: id, orderStatus: "FINISH" })).status,
        200,
      );
      assert.equal((await first.post("/order/create").send([])).status, 400);
      assert.equal(
        (
          await first
            .post("/order/create")
            .send([{ productId: product._id, itemQuantity: 100, itemPrice: 1 }])
        ).status,
        400,
      );
    },
  );
  await t.test(
    "best sellers rank purchased quantities and exclude pending, cancelled, unsold and inactive products",
    async () => {
      const Product = require("../../src/schema/Product.model").default;
      const Order = require("../../src/schema/Order.model").default;
      const OrderItem = require("../../src/schema/OrderItem.model").default;
      const Member = require("../../src/schema/Member.module").default;
      const member = await Member.findOne({ memberNick: "AuditUserOne" });
      const catalog = [];
      for (let i = 0; i < 4; i++)
        catalog.push(
          await Product.create({
            productName: `Sales regression ${i}`,
            productCollection: "BOUQUET",
            productStatus: i === 3 ? "PAUSE" : "PROCESS",
            productPrice: 10,
            productLeftCount: 100,
            productViews: i === 2 ? 999999 : 0,
          }),
        );
      async function line(product, quantity, status) {
        const order = await Order.create({
          memberId: member._id,
          orderTotal: quantity * 10,
          orderDelivery: 0,
          orderStatus: status,
        });
        await OrderItem.create({
          orderId: order._id,
          productId: product._id,
          itemQuantity: quantity,
          itemPrice: 10,
        });
        return order;
      }
      const completed = await line(catalog[0], 200, "PROCESS");
      await line(catalog[0], 300, "FINISH");
      await line(catalog[1], 700, "FINISH");
      await line(catalog[0], 9000, "PAUSE");
      await line(catalog[0], 9000, "DELETE");
      await line(catalog[3], 9000, "FINISH");
      await OrderItem.create({
        orderId: new mongoose.Types.ObjectId(),
        productId: catalog[0]._id,
        itemQuantity: 9000,
        itemPrice: 10,
      });
      const response = await request(app).get("/product/all?order=productSold&limit=100");
      assert.equal(response.status, 200);
      assert.equal(response.body.result[0]._id, String(catalog[1]._id));
      assert.equal(response.body.result[0].productSold, 700);
      assert.equal(response.body.result[1]._id, String(catalog[0]._id));
      assert.equal(response.body.result[1].productSold, 500);
      assert.ok(
        !response.body.result.some((p) =>
          [String(catalog[2]._id), String(catalog[3]._id)].includes(p._id),
        ),
      );
      const page = await request(app).get("/product/all?order=productSold&limit=1&page=2");
      assert.equal(page.body.result[0]._id, String(catalog[0]._id));
      assert.equal(page.body.pagination.total, response.body.pagination.total);
      assert.equal(page.body.pagination.totalPages, response.body.pagination.total);
      const filtered = await request(app).get(
        "/product/all?order=productSold&search=Sales%20regression",
      );
      assert.equal(filtered.body.pagination.total, 2);
      await Order.updateOne({ _id: completed._id }, { $set: { orderStatus: "FINISH" } });
      const after = await request(app).get(
        "/product/all?order=productSold&search=Sales%20regression",
      );
      assert.equal(
        after.body.result.find((p) => p._id === String(catalog[0]._id)).productSold,
        500,
      );
    },
  );
  await t.test(
    "blocked members lose token access; admin login/logout and stale sessions are enforced",
    async () => {
      const Member = require("../../src/schema/Member.module").default;
      const user = await Member.findOne({ memberNick: "AuditUserOne" });
      assert.equal(
        (
          await admin
            .post("/admin/user/edit")
            .send({ _id: String(user._id), memberStatus: "BLOCK" })
        ).status,
        200,
      );
      assert.equal((await first.get("/member/detail")).status, 401);
      assert.equal(
        (
          await first
            .post("/member/login")
            .send({ memberNick: "AuditUserOne", memberPassword: "Audit12345" })
        ).status,
        403,
      );
      assert.equal((await admin.get("/admin/logout")).status, 302);
      assert.equal(
        (await admin.get("/admin/product/all").set("Accept", "application/json")).status,
        401,
      );
      assert.equal(
        (
          await admin
            .post("/admin/login")
            .send({ memberNick: "SoullyAuditAdmin", memberPassword: "Audit12345" })
        ).status,
        302,
      );
      assert.equal((await admin.get("/admin/product/all")).status, 200);
      await Member.updateOne(
        { memberNick: "SoullyAuditAdmin" },
        { $set: { memberStatus: "BLOCK" } },
      );
      assert.equal(
        (await admin.get("/admin/product/all").set("Accept", "application/json")).status,
        401,
      );
    },
  );
});
