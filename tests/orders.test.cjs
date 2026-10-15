require("ts-node/register");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const OrderService = require("../src/models/Order.service").default;
const OrderModel = require("../src/schema/Order.model").default;
const ProductModel = require("../src/schema/Product.model").default;
const OrderItemModel = require("../src/schema/OrderItem.model").default;
const MemberService = require("../src/models/Member.service").default;
const { shapeIntoMongooseObjectId } = require("../src/libs/config");
const member = { _id: new mongoose.Types.ObjectId() };

test("rejects malformed IDs and empty orders", async () => {
  assert.throws(() => shapeIntoMongooseObjectId("invalid"), { code: 400 });
  await assert.rejects(new OrderService().createOrder(member, []), { code: 400 });
});

test("order totals use catalog prices rather than submitted prices", async (t) => {
  const id = new mongoose.Types.ObjectId();
  let recorded;
  t.mock.method(ProductModel, "find", () => ({
    lean: () => ({ exec: async () => [{ _id: id, productPrice: 20, productLeftCount: 5 }] }),
  }));
  t.mock.method(OrderModel, "create", async (input) => ({
    ...input,
    _id: new mongoose.Types.ObjectId(),
  }));
  t.mock.method(OrderItemModel, "insertMany", async (items) => {
    recorded = items;
  });
  const order = await new OrderService().createOrder(member, [
    { productId: id, itemQuantity: 2, itemPrice: 0.01 },
  ]);
  assert.equal(order.orderTotal, 45);
  assert.equal(recorded[0].itemPrice, 20);
});

test("updates match owner and previous state and cannot award points twice", async (t) => {
  let filter;
  let points = 0;
  t.mock.method(OrderModel, "findOneAndUpdate", (query) => {
    filter = query;
    return { exec: async () => (points ? null : { orderStatus: "PROCESS" }) };
  });
  t.mock.method(MemberService.prototype, "addUserPoint", async () => {
    points++;
  });
  const service = new OrderService();
  const input = { orderId: String(new mongoose.Types.ObjectId()), orderStatus: "PROCESS" };
  await service.updateOrder(member, input);
  assert.equal(String(filter.memberId), String(member._id));
  assert.equal(filter.orderStatus, "PAUSE");
  await assert.rejects(service.updateOrder(member, input), { code: 400 });
  assert.equal(points, 1);
});
