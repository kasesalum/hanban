import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeObjectPath,
  deleteLocalPrefix,
  publicBaseFromReq,
  saveLocalImage,
} from "./localUpload.js";

describe("localUpload", () => {
  let previousDir;
  let dir;

  before(async () => {
    previousDir = process.env.UPLOAD_DIR;
    dir = await mkdtemp(join(tmpdir(), "hanban-uploads-"));
    process.env.UPLOAD_DIR = dir;
  });

  after(async () => {
    if (previousDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousDir;
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects path traversal", () => {
    assert.throws(() => assertSafeObjectPath("../secret.png"), /Invalid path/);
    assert.throws(() => assertSafeObjectPath("/abs.png"), /Invalid path/);
  });

  it("writes a file and returns a public URL", async () => {
    const saved = await saveLocalImage(
      "boards/b1/cards/c1/description/pic.jpg",
      "image/jpeg",
      Buffer.from("fake-image"),
      "http://localhost:5050"
    );
    assert.equal(
      saved.url,
      "http://localhost:5050/uploads/boards/b1/cards/c1/description/pic.jpg"
    );
    assert.equal(saved.path, "boards/b1/cards/c1/description/pic.jpg");
    const written = await readFile(join(dir, saved.path), "utf8");
    assert.equal(written, "fake-image");
  });

  it("builds a public base from the request host", () => {
    const req = {
      get: (name) => (name === "host" ? "localhost:5050" : undefined),
      protocol: "http",
    };
    assert.equal(publicBaseFromReq(req), "http://localhost:5050");
  });

  it("deletes a local prefix", async () => {
    await saveLocalImage(
      "boards/b1/cards/c2/comments/a.jpg",
      "image/jpeg",
      Buffer.from("x"),
      "http://localhost:5050"
    );
    await deleteLocalPrefix("boards/b1/cards/c2");
    await assert.rejects(
      readFile(join(dir, "boards/b1/cards/c2/comments/a.jpg"))
    );
  });
});
