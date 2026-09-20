import { mkdir, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

export function localUploadRoot() {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

export function publicBaseFromReq(req) {
  const fromEnv = String(process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = req?.get?.("x-forwarded-host") || req?.get?.("host");
  if (!host) return `http://localhost:${process.env.PORT || 5050}`;
  const proto = req?.get?.("x-forwarded-proto") || req?.protocol || "http";
  return `${proto}://${host}`;
}

export function assertSafeObjectPath(objectPath) {
  const normalized = String(objectPath || "").replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    const err = new Error("Invalid path");
    err.status = 400;
    throw err;
  }
  return normalized;
}

export async function saveLocalImage(objectPath, _contentType, buffer, publicBase) {
  const safePath = assertSafeObjectPath(objectPath);
  const abs = join(localUploadRoot(), safePath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  const encoded = safePath.split("/").map(encodeURIComponent).join("/");
  const base = String(publicBase || "").replace(/\/$/, "") ||
    `http://localhost:${process.env.PORT || 5050}`;
  return { url: `${base}/uploads/${encoded}`, path: safePath };
}

export async function deleteLocalPrefix(prefix) {
  const safe = assertSafeObjectPath(String(prefix || "").replace(/\/+$/, ""));
  await rm(join(localUploadRoot(), safe), { recursive: true, force: true });
}
