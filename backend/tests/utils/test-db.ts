import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer | null = null;

/** Spins up a real (in-memory) MongoDB instance and connects Mongoose to
 * it — these are integration tests against the actual services/models, not
 * mocks, per the project's testing standard (see coding-standards.md /
 * prior modules' own manual verification approach). */
export async function connectTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}
