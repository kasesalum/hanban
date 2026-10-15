import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../firebase.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SUBCOLLECTIONS = ["comments", "activity", "cards"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function stamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function serializeValue(value) {
  if (value == null) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    if (typeof value.path === "string" && typeof value.id === "string" && value.parent) {
      return { __type: "DocumentReference", path: value.path };
    }
    const out = {};
    for (const [key, next] of Object.entries(value)) {
      out[key] = serializeValue(next);
    }
    return out;
  }
  return value;
}

function nestedCardCount(lists) {
  return (lists || []).reduce(
    (sum, list) => sum + ((list.cards || []).length || 0),
    0
  );
}

async function dumpCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...serializeValue(doc.data()),
  }));
}

async function dumpSubcollection(boardRef, name) {
  const snap = await boardRef.collection(name).get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...serializeValue(doc.data()),
  }));
}

async function main() {
  const outDir = join(ROOT, "backups", `firestore-${stamp()}`);
  await mkdir(outDir, { recursive: true });

  const users = await dumpCollection("Users");
  const notifications = await dumpCollection("Notifications");
  const boardsSnap = await db.collection("Boards").get();

  let comments = 0;
  let activity = 0;
  let cards = 0;
  let nestedCards = 0;

  const boards = [];
  for (const doc of boardsSnap.docs) {
    const data = serializeValue(doc.data());
    nestedCards += nestedCardCount(data.lists);
    const record = { id: doc.id, data };
    for (const name of SUBCOLLECTIONS) {
      record[name] = await dumpSubcollection(doc.ref, name);
    }
    comments += record.comments.length;
    activity += record.activity.length;
    cards += record.cards.length;
    boards.push(record);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    counts: {
      boards: boards.length,
      nestedCards,
      cardDocs: cards,
      comments,
      activity,
      users: users.length,
      notifications: notifications.length,
    },
  };

  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(join(outDir, "users.json"), JSON.stringify(users, null, 2));
  await writeFile(
    join(outDir, "notifications.json"),
    JSON.stringify(notifications, null, 2)
  );
  await writeFile(join(outDir, "boards.json"), JSON.stringify(boards, null, 2));

  console.log(`Backup written to ${outDir}`);
  console.log(JSON.stringify(manifest.counts, null, 2));
}

main().catch((error) => {
  console.error("Backup failed:", error);
  process.exit(1);
});
