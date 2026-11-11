import "server-only";
import { MongoClient, type Collection } from "mongodb";
import type { WorkspaceData } from "@/app/lib/workspace";
import { normalizeMongoSetting } from "./mongodb-settings";

type StoredWorkspace = {
  _id: "personal";
  data: WorkspaceData;
  updatedAt: string;
  revision?: string;
};

type MongoGlobal = typeof globalThis & {
  yinxwrldMongoClient?: Promise<MongoClient>;
};

export async function getWorkspaceCollection(): Promise<Collection<StoredWorkspace>> {
  const uri = normalizeMongoSetting(process.env.MONGODB_URI, "MONGODB_URI");
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  const globalWithMongo = globalThis as MongoGlobal;
  if (!globalWithMongo.yinxwrldMongoClient) {
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
    const connection = client.connect();
    globalWithMongo.yinxwrldMongoClient = connection;
    connection.catch(async () => {
      if (globalWithMongo.yinxwrldMongoClient === connection) {
        delete globalWithMongo.yinxwrldMongoClient;
      }
      await client.close().catch(() => undefined);
    });
  }

  const client = await globalWithMongo.yinxwrldMongoClient;
  const database = normalizeMongoSetting(process.env.MONGODB_DB, "MONGODB_DB") || "yinxwrld";
  return client.db(database).collection<StoredWorkspace>("workspace");
}
