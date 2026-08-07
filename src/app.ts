import cors from "cors";
import express from "express";
import path from "path";
import router from "./router";
import routerAdmin from "./routerAdmin";
import morgan from "morgan";
import { MORGAN_FORMAT } from "./libs/config";
import cookieParser from "cookie-parser";
import session from "express-session";
import ConnectMongoDB from "connect-mongodb-session";
import { T } from "./libs/types/common";

const MongoDBStore = ConnectMongoDB(session);
const store = new MongoDBStore({
  uri: String(process.env.MONGO_URL),
  collection: "sessions",
});

/**1- ENTERANCE */
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static("./uploads"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan(MORGAN_FORMAT));
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
/**2 - Session */
app.use(
  session({
    secret: String(process.env.SESSION_SECRET),
    store: store,

    resave: false,

    saveUninitialized: false,

    cookie: {
      maxAge: 1000 * 3600 * 3,
      httpOnly: true,
    },
  }),
);
app.use(function (req, res, next) {
  const sessionInstance = req.session as T;
  res.locals.member = sessionInstance.member;
  next();
});

/** 3-Views */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/** 4- Routers*/
//BSSR: EJS
app.use("/admin", routerAdmin); //BSSR: EJS
app.use("/", router); // SPA: REACT

export default app;
