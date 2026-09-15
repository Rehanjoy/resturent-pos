import { Readable } from "node:stream";
import mongoose, { Types } from "mongoose";
import { AppError } from "../utils/app-error";

const BUCKET_NAME = "menuMedia";

export interface StoredMenuImage {
  id: string;
  contentType: string;
  length: number;
  filename: string;
}

function bucket(): mongoose.mongo.GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) throw new AppError("Image storage is not ready. Try again.", 503, "MEDIA_STORAGE_UNAVAILABLE");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
}

function hasValidSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export async function storeMenuImage(restaurantId: string, file: Express.Multer.File): Promise<StoredMenuImage> {
  if (!hasValidSignature(file.buffer, file.mimetype)) {
    throw new AppError("Choose a valid JPG, PNG, or WebP image.", 400, "INVALID_IMAGE_FILE");
  }

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "dish-image";
  const upload = bucket().openUploadStream(`${Date.now()}-${safeName}`, {
    metadata: { contentType: file.mimetype, restaurantId: new Types.ObjectId(restaurantId), purpose: "menu-item" },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(file.buffer).pipe(upload).once("error", reject).once("finish", () => resolve());
  });

  return { id: upload.id.toString(), contentType: file.mimetype, length: file.size, filename: safeName };
}

export async function findMenuImage(id: string): Promise<mongoose.mongo.GridFSFile> {
  if (!Types.ObjectId.isValid(id)) throw new AppError("Image not found.", 404, "MEDIA_NOT_FOUND");
  const image = await bucket().find({ _id: new Types.ObjectId(id), "metadata.purpose": "menu-item" }).next();
  if (!image) throw new AppError("Image not found.", 404, "MEDIA_NOT_FOUND");
  return image;
}

export function openMenuImage(id: string): mongoose.mongo.GridFSBucketReadStream {
  return bucket().openDownloadStream(new Types.ObjectId(id));
}
