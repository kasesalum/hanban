import { readFile } from "fs/promises";
import { join, resolve } from "path";
import { db } from "../firebase.js";

const BATCH_LIMIT = 400;
const SUBCOLLECTIONS = ["comments", "activity", "cards"];

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return null;
  return process.argv[index + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }
}

function withoutId(doc) {
  const { id, ...data } = doc;
  return data;
}

async function restoreCollection(name, docs) {
  const ops = docs.map((doc) => ({
    ref: db.collection(name).doc(doc.id),
    data: withoutId(doc),
  }));
  await commitOps(ops);
}

async function main() {
  const dirArg = argValue("--dir");
  if (!dirArg) {
    console.error("Usage: node src/scripts/restoreFirestore.js --dir <backup-dir> --confirm [--boards-only]");
    process.exit(1);
  }
  if (!hasFlag("--confirm")) {
    console.error("Refusing to restore without --confirm");
    process.exit(1);
  }

  const dir = resolve(dirArg);
  const boardsOnly = hasFlag("--boards-only");
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
  const boards = JSON.parse(await readFile(join(dir, "boards.json"), "utf8"));

  const ops = [];
  for (const board of boards) {
    ops.push({
      ref: db.collection("Boards").doc(board.id),
      data: board.data || {},
    });
    const boardRef = db.collection("Boards").doc(board.id);
    for (const name of SUBCOLLECTIONS) {
      for (const doc of board[name] || []) {
        ops.push({
          ref: boardRef.collection(name).doc(doc.id),
          data: withoutId(doc),
        });
      }
    }
  }

  if (!boardsOnly) {
    const users = JSON.parse(await readFile(join(dir, "users.json"), "utf8"));
    const notifications = JSON.parse(
      await readFile(join(dir, "notifications.json"), "utf8")
    );
    await restoreCollection("Users", users);
    await restoreCollection("Notifications", notifications);
  }

  await commitOps(ops);
  console.log(`Restored backup from ${dir}`);
  console.log(JSON.stringify(manifest.counts || {}, null, 2));
  if (boardsOnly) console.log("Restored boards only");
}

main().catch((error) => {
  console.error("Restore failed:", error);
  process.exit(1);
});
