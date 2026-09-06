import { randomUUID } from "crypto";
import { getBucket } from "./firebase.js";

export const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const BUCKET_MISSING = /not found|does not exist/i;

export function extForContentType(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function decodeImagePayload(contentType, data) {
  if (!IMAGE_TYPES.has(contentType)) {
    const err = new Error("Use a JPG, PNG, GIF, or WebP image.");
    err.status = 400;
    throw err;
  }
  const buffer = Buffer.from(String(data || ""), "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    const err = new Error("Image must be under 5MB.");
    err.status = 400;
    throw err;
  }
  return buffer;
}

export async function uploadImageBuffer(path, contentType, buffer) {
  const bucket = getBucket();
  if (!bucket) {
    const err = new Error("Storage is not available.");
    err.status = 500;
    throw err;
  }

  const token = randomUUID();
  const file = bucket.file(path);
  try {
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (error?.code === 404 || BUCKET_MISSING.test(message)) {
      const err = new Error(
        "Firebase Storage is not enabled. In Firebase Console, open Storage and click Get started, then try again."
      );
      err.status = 503;
      throw err;
    }
    throw error;
  }

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { url, path };
}
