import admin from "firebase-admin";

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
