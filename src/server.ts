import "dotenv/config";
import mongoose from "mongoose";
import app, { store } from "./app";

async function start(): Promise<void> {
  const port = Number(process.env.PORT || 3003);
  try {
    for (const key of ["MONGO_URL", "SESSION_SECRET", "SECRET_TOKEN"]) {
      if (!process.env[key]) throw new Error(`${key} is required. See .env.example.`);
    }
    await mongoose.connect(process.env.MONGO_URL as string);
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== "isdbgrid")
      throw new Error(
        "Inventory transactions require MongoDB Atlas, a replica set, or a sharded cluster.",
      );
    app.listen(port, () => console.info(`Soully API: http://localhost:${port} | Admin: /admin`));
  } catch (error) {
    console.error("Soully startup failed", error);
    process.exitCode = 1;
    await mongoose.disconnect();
    await store.client.close();
  }
}
void start();
