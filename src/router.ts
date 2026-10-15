import express from "express";
import memberController from "./controllers/member.controller";
import occasionController from "./controllers/occasion.controller";
import orderController from "./controllers/order.controller";
import productController from "./controllers/product.controller";
import makeUploader from "./libs/utils/uploader";
const router = express.Router();

//MEMBER
router.get("/member/seller", memberController.getSeller);
// Compatibility for older clients; the response uses SELLER.
router.get("/member/restaurant", memberController.getSeller);

router.post("/member/login", memberController.Login);

router.post(
  "/member/signup",
  makeUploader("members").single("memberImage"),
  memberController.Signup,
);

router.post("/member/logout", memberController.logout);

router.get("/member/detail", memberController.verifyAuth, memberController.getMemberDetail);

router.post(
  "/member/update",
  memberController.verifyAuth,
  makeUploader("members").single("memberImage"),
  memberController.updateMember,
);

router.get("/member/top-users", memberController.getTopUsers);

// PRODUCT

router.get("/product/all", productController.getProducts);

router.get("/product/:id", memberController.retrieveAuth, productController.getProduct);

router.get("/occasion/all", occasionController.getOccasions);
// ORDER

router.post("/order/create", memberController.verifyAuth, orderController.createOrder);

router.get("/order/all", memberController.verifyAuth, orderController.getMyOrders);

router.post("/order/update", memberController.verifyAuth, orderController.updateOrder);

export default router;
