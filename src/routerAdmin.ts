import express from "express";
import productController from "./controllers/product.controller";
import sellerController from "./controllers/seller.controller";
import makeUploader from "./libs/utils/uploader";

const routerAdmin = express.Router();

// HOME
routerAdmin.get("/", sellerController.verifySeller, sellerController.goHome);

// AUTH
routerAdmin.get("/login", sellerController.getLogin);

routerAdmin.post("/login", sellerController.processLogin);

routerAdmin.get("/signup", sellerController.getSignup);

routerAdmin.post(
  "/signup",
  makeUploader("members").single("memberImage"),
  sellerController.processSignup,
);

routerAdmin.get("/logout", sellerController.logout);

routerAdmin.get("/check-me", sellerController.verifySeller, sellerController.checkAuthSession);

// PRODUCT
routerAdmin.get("/product/all", sellerController.verifySeller, productController.getAllProducts);

routerAdmin.post(
  "/product/create",
  sellerController.verifySeller,
  makeUploader("products").array("productImages", 5),
  productController.createNewProduct,
);

routerAdmin.post(
  "/product/:id",
  sellerController.verifySeller,
  makeUploader("products").array("productImages", 5),
  productController.updateChosenProduct,
);

// USER
routerAdmin.get("/user/all", sellerController.verifySeller, sellerController.getUsers);

routerAdmin.post("/user/edit", sellerController.verifySeller, sellerController.updateChosenUser);

export default routerAdmin;
