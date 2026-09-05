import admin from "firebase-admin";

const USER_CACHE_TTL_MS = 60_000;
let cachedUsers = [];
let cachedAt = 0;
let cacheValid = false;

function toSearchUser(user) {
  return {
    uid: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || "",
  };
}

async function listAuthUsers() {
  const now = Date.now();
  if (cacheValid && now - cachedAt < USER_CACHE_TTL_MS) {
    return cachedUsers;
  }

  const users = [];
  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const user of result.users) {
      if (!user.email) continue;
      users.push(toSearchUser(user));
    }
    pageToken = result.pageToken;
  } while (pageToken);

  cachedUsers = users;
  cachedAt = now;
  cacheValid = true;
  return users;
}

export async function searchUsers(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];

  const users = await listAuthUsers();
  const matches = [];
  for (const user of users) {
    const name = user.displayName.toLowerCase();
    const email = user.email.toLowerCase();
    if (name.includes(q) || email.includes(q)) {
      matches.push(user);
      if (matches.length >= 8) break;
    }
  }
  return matches;
}

export async function memberProfilesForUids(uids = []) {
  const unique = [...new Set((uids || []).filter(Boolean))];
  if (unique.length === 0) return [];

  const profiles = [];
  const seen = new Set();

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const result = await admin.auth().getUsers(chunk.map((uid) => ({ uid })));
      for (const user of result.users) {
        seen.add(user.uid);
        profiles.push({
          uid: user.uid,
          displayName: user.displayName || "",
          email: user.email || "",
        });
      }
    } catch (error) {
      console.error("Error resolving member profiles:", error);
    }

    for (const uid of chunk) {
      if (!seen.has(uid)) {
        seen.add(uid);
        profiles.push({ uid, displayName: "", email: "" });
      }
    }
  }

  return profiles;
}
