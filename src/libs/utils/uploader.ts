import { randomUUID } from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";
import { uploadRoot } from "../deployment";

const imageTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const makeUploader = (directory: "members" | "products") => {
  const destination = path.resolve(uploadRoot(), directory);
  fs.mkdirSync(destination, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination,
      filename: (_req, file, callback) =>
        callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, callback) => {
      if (imageTypes[path.extname(file.originalname).toLowerCase()] === file.mimetype)
        callback(null, true);
      else callback(new Error("Only JPG, JPEG and PNG images are allowed."));
    },
  });
};
export default makeUploader;
