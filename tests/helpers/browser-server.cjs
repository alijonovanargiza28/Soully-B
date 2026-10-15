require("ts-node/register");
const fs = require("node:fs");
const path = require("node:path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const express = require("express");
const { ProductCollection } = require("../../src/libs/enums/product.enum");

(async () => {
  const directory = fs.mkdtempSync("/private/tmp/soully-browser-audit-");
  fs.mkdirSync(path.join(directory, "db"));
  const mongo = await MongoMemoryServer.create({
    binary: { version: "7.0.14", downloadDir: "/private/tmp/soully-mongodb-binaries" },
    instance: {
      dbPath: path.join(directory, "db"),
      dbName: "soully_browser_audit",
      ip: "127.0.0.1",
    },
  });
  Object.assign(process.env, {
    MONGO_URL: mongo.getUri(),
    SESSION_SECRET: "browser-test-only-session",
    SECRET_TOKEN: "browser-test-only-jwt",
    UPLOAD_ROOT: path.join(directory, "uploads"),
    NODE_ENV: "test",
  });
  await mongoose.connect(process.env.MONGO_URL);
  const { default: app, store } = require("../../src/app");
  const Product = require("../../src/schema/Product.model").default;
  const MemberService = require("../../src/models/Member.service").default;
  await new MemberService().processSignup({
    memberNick: "AuditAdmin",
    memberPassword: "test-only-password",
    memberPhone: "+998900000010",
  });
  const web = process.env.SOULLY_WEB_DIR || path.resolve(__dirname, "../../../Soully-web");
  const uploads = path.join(process.env.UPLOAD_ROOT, "products");
  fs.mkdirSync(uploads, { recursive: true });
  fs.copyFileSync(
    path.join(web, "public/img/weddingFlower.jpg"),
    path.join(uploads, "test-flower.jpg"),
  );
  for (const [index, category] of Object.values(ProductCollection).entries()) {
    await Product.create({
      productName: `Audit ${category.replaceAll("_", " ")}`,
      productCollection: category,
      productStatus: "PROCESS",
      productSize: "MEDIUM",
      productPrice: index + 10,
      productLeftCount: 20,
      productImages: ["uploads/products/test-flower.jpg"],
      productDesc: "Isolated browser-test fixture.",
    });
  }
  app.use(express.static("/private/tmp/soully-audit-build"));
  app.get("*", (_req, res) => res.sendFile("/private/tmp/soully-audit-build/index.html"));
  const server = app.listen(4303, "127.0.0.1", () =>
    console.info(
      "Isolated browser audit server: http://127.0.0.1:4303 | retained artifacts: " + directory,
    ),
  );
  process.on("SIGINT", async () => {
    server.close();
    await store.client.close();
    await mongoose.disconnect();
    await mongo.stop({ doCleanup: false, force: true });
    process.exit(0);
  });
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
