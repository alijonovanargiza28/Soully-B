import express from 'express';
import restaurantController from './controllers/restaurant.controller';
import makeUploader from './libs/utils/uploader';
import productController from './controllers/product.controller';
const routerAdmin = express.Router();
routerAdmin.get(
  "/",
  //restaurantController.verifyRestaurant,
  restaurantController.goHome,
);
routerAdmin
.get('/login', restaurantController.getLogin)
.post("/login", restaurantController.processLogin)
routerAdmin
.get('/signup', restaurantController.getSignup)
.post("/signup", makeUploader("members").single("memberImage"),restaurantController.processSignup)

routerAdmin
.get('/logout', restaurantController.logout)

// routerAdmin.get('/', (req, res) => {
//   res.send("Home");
// });

routerAdmin
.get('/check-me', restaurantController.checkAuthSession)

//Product
routerAdmin.get('/product/all', restaurantController.verifyRestaurant,
productController.getAllProducts)

routerAdmin.post("/product/create",
restaurantController.verifyRestaurant,
    makeUploader("products").array("productImages",5),
    productController.createNewProduct
    )
  
routerAdmin.post("/product/:id", 
  restaurantController.verifyRestaurant, 
  productController.updateChosenProduct)

//USER
routerAdmin.get("/user/all",
   restaurantController.verifyRestaurant,
   restaurantController.getUsers)
  
routerAdmin.post("/user/edit",
   restaurantController.verifyRestaurant,
   restaurantController.updateChosenUser)
  

export default routerAdmin;
