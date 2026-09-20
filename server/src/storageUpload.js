import { randomUUID } from "crypto";
import { getBucket } from "./firebase.js";
import { publicBaseFromReq, saveLocalImage } from "./localUpload.js";

export { publicBaseFromReq } from "./localUpload.js";

export const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const BUCKET_MISSING = /not found|does not exist|billing account/i;

let cachedBackend;

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

async function resolveBackend() {
  if (cachedBackend) return cachedBackend;
  const bucket = getBucket();
  if (!bucket) {
    cachedBackend = "local";
    return cachedBackend;
  }
  try {
    const [exists] = await bucket.exists();
    cachedBackend = exists ? "firebase" : "local";
  } catch {
    cachedBackend = "local";
  }
  if (cachedBackend === "local") {
    console.warn(
      "Firebase Storage is not available; saving images under uploads/"
    );
  }
  return cachedBackend;
}

async function saveFirebaseImage(path, contentType, buffer) {
  const bucket = getBucket();
  if (!bucket) {
    const err = new Error("Storage is not available.");
    err.status = 500;
    throw err;
  }

  const token = randomUUID();
  const file = bucket.file(path);
  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { url, path };
}

export async function uploadImageBuffer(path, contentType, buffer, publicBase) {
  const backend = await resolveBackend();
  if (backend === "firebase") {
    try {
      return await saveFirebaseImage(path, contentType, buffer);
    } catch (error) {
      const message = String(error?.message || "");
      if (error?.code === 404 || BUCKET_MISSING.test(message)) {
        cachedBackend = "local";
        console.warn(
          "Firebase Storage upload failed; falling back to local uploads"
        );
      } else {
        throw error;
      }
    }
  }

  return saveLocalImage(path, contentType, buffer, publicBase);
}
