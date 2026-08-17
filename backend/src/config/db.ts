import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(env.mongodbUri);
    console.log("[db] Connected to MongoDB");
  } catch (error) {
    console.error("[db] Failed to connect to MongoDB", error);
    throw error;
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB connection lost");
  });
}
