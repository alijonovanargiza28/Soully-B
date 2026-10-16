import ConnectMongoDB from "connect-mongodb-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import session from "express-session";
import morgan from "morgan";
import multer from "multer";
import path from "path";
import mongoose from "mongoose";
import {
  allowedOrigins,
  cookieOptions,
  uploadRoot,
  validateProductionEnvironment,
} from "./libs/deployment";
import { MORGAN_FORMAT } from "./libs/config";
import router from "./router";
import routerAdmin from "./routerAdmin";

validateProductionEnvironment();

const MongoDBStore = ConnectMongoDB(session);
export const store = new MongoDBStore({
  uri: String(process.env.MONGO_URL),
  collection: "sessions",
});

/**1- ENTERANCE */
const app = express();
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadRoot()));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan(MORGAN_FORMAT));
const origins = allowedOrigins();
app.use(cors({ credentials: true, origin: origins }));
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    origin &&
    !origins.includes(origin) &&
    origin !== `${req.protocol}://${req.get("host")}`
  ) {
    res.status(403).json({ message: "This request origin is not allowed." });
    return;
  }
  next();
});
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
      ...cookieOptions(),
    },
  }),
);
app.use(function (req, res, next) {
  res.locals.member = req.session.member;
  next();
});

/** 3-Views */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/** 4- Routers*/
//BSSR: EJS
app.get("/health", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? "ok" : "unavailable" });
});
app.use("/admin", routerAdmin); //BSSR: EJS
app.use("/", router); // SPA: REACT

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (
    error instanceof multer.MulterError ||
    error.message === "Only JPG, JPEG and PNG images are allowed."
  ) {
    res.status(400).json({ message: error.message });
    return;
  }
  console.error("Request failed", error);
  res.status(500).json({ message: "Something went wrong" });
};
app.use(handleError);

export default app;
