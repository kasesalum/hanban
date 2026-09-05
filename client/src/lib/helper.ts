import { db } from "@/lib/firebase";
import { User } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { commands } from "@/lib/commands";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";

type Board = {
  objectID: string;
  id: string;
  name: string;
  urlName: string;
  ownerId: string;
  members: string[];
  privacy: string;
  pinned: boolean;
  createdAt: any;
};

type UserBoardsResponse = {
  boards: Board[];
  pinned: string[];
};

/**
 * A helper function that checks the validity of an email address.
 * It uses a regular expression to validate the format of the email.
 * Returns true if the email is valid, false otherwise.
 *
 * @param {string} email - The email address to validate.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * A helper function that retrieves the list of board IDs from a user object.
 * It checks if the user object exists and if it has a Boards property.
 * Returns an array of board IDs or an empty array if not available.
 *
 * @param {string} userID - The ID of the user whose boards are to be retrieved.
 * @returns {Promise<string[]>} - A Promise resolving to an array of board IDs.
 */
export async function getUserBoards(
  userId: string
): Promise<UserBoardsResponse> {
  console.log("Fetching boards for user:", userId);
  try {
    const res = await fetch(`${API_BASE}/api/user/boards?userId=${userId}`);
    const boards = await res.json();

    if (!res.ok) throw new Error("Failed to fetch boards");

    return {
      boards: boards.boards || [],
      pinned: boards.pinned || [],
    };
  } catch (err) {
    console.error(err);
    return { boards: [], pinned: [] };
  }
}

/** * A helper function that retrieves information about a specific board by its ID.
 * It fetches all documents from the "Boards" collection and filters them to find the one with the matching ID.
 * Returns the board data if found, or null if not found.
 *
 * @param {string} boardId - The ID of the board to retrieve.
 * @returns {Promise<any>} - A Promise resolving to the board data or null if not found.
 */
export async function getBoardInfo(boardId: string): Promise<any> {
  console.log("Fetching board info for board:", boardId);
  try {
    const res = await fetch(`${API_BASE}/api/board/${boardId}`);

    if (res.status === 404) {
      console.warn(`Board ${boardId} not found, removing from recentBoards`);
      const stored = localStorage.getItem("recentBoards");
      if (stored) {
        const recentBoards: string[] = JSON.parse(stored);
        const updated = recentBoards.filter((id) => id !== boardId);
        localStorage.setItem("recentBoards", JSON.stringify(updated));
      }
      return null;
    }

    if (!res.ok)
      throw new Error("Failed to fetch board info for ID: " + boardId);

    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

/** * A helper function that creates a new board for a user.
 * It adds a new document to the "Boards" collection with the specified board name and user ID.
 * Returns the ID of the newly created board or null if an error occurs.
 *
 * @param {string} userId - The ID of the user creating the board.
 * @param {string} boardName - The name of the new board.
 * @returns {Promise<string | null>} - A Promise resolving to the new board ID or null if creation fails.
 */
export async function createNewBoard(
  userId: string,
  boardName: string,
  privacy: "private" | "public",
  banner: { type: "preset" | "color" | "upload"; value: string } | null
): Promise<any> {
  try {
    const params = new URLSearchParams({
      userId: userId,
      title: boardName || "Untitled Board",
      privacy: privacy,
      banner: banner ? JSON.stringify(banner) : "",
    });
    console.log("Creating board with params:", params.toString());
    const res = await fetch(`${API_BASE}/api/user/createBoard`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        title: boardName || "Untitled Board",
        privacy,
        background: banner,
      }),
    });

    if (!res.ok) throw new Error("Failed to create new board");

    const data = await res.json();
    return data.boardId;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/** A helper function that pins a board for a user.
 * It updates the board document in the "Boards" collection to set the pinned state to true.
 * If the board is already pinned, it unpins it by setting pinned to false.
 *
 * @param {string} boardId - The ID of the board to pin or unpin.
 * @param {string} userId - The ID of the user performing the action.
 * @returns {Promise<boolean>} - A Promise of the pin status.
 */
export async function pinBoard(
  userId: string,
  boardId: string
): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      userId,
      boardId,
    });
    const res = await fetch(
      `${API_BASE}/api/user/pinBoard?${params.toString()}`
    );
    if (!res.ok) throw new Error("Failed to pin/unpin board");
    const data = await res.json();
    console.log("Pin/unpin response:", data);
    return data.pinned;
  } catch (error) {
    console.error("Error pinning/unpinning board:", error);
    return false;
  }
}

/**
 * Helper functions that keeps track of the user's 3 most recent boards.
 */

const LOCAL_STORAGE_KEY = "recentBoards";

export async function getRecentBoards(userId: string): Promise<string[]> {
  const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }

  try {
    const docRef = doc(db, "Users", userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return [];

    const boards = docSnap.data().RecentBoards;
    if (!boards || !Array.isArray(boards) || boards.length === 0) {
      return [];
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(boards));
    return boards;
  } catch (error) {
    console.error("Error fetching recent boards from Firestore:", error);
    return [];
  }
}

export async function addRecentBoard(
  userID: string,
  boardID: string
): Promise<void> {
  let boards: string[] = [];

  const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (localData) {
    try {
      boards = JSON.parse(localData);
    } catch {
      boards = [];
    }
  }

  boards = boards.filter((id) => id !== boardID);
  boards.unshift(boardID);
  if (boards.length > 5) boards = boards.slice(0, 5);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(boards));

  try {
    const docRef = doc(db, "Users", userID);
    await setDoc(docRef, { RecentBoards: boards }, { merge: true });
  } catch (error) {
    console.error("Error updating recent boards in Firestore:", error);
  }
}

export type BoardCardFields = {
  title: string;
  description?: string;
  assignees?: string[];
  label?: string;
  deadline?: string;
};

export async function createBoardCard(
  boardId: string,
  listId: string,
  fields: BoardCardFields
): Promise<{ card: any; lists: any[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/board/${boardId}/cards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listId,
        title: fields.title,
        description: fields.description || "",
        assignees: fields.assignees || [],
        label: fields.label || "",
        deadline: fields.deadline || "",
      }),
    });

    if (!res.ok) throw new Error("Failed to create card");
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export type BoardLabel = { id: string; name: string; color: string };

export async function updateBoardLabels(
  boardId: string,
  labels: BoardLabel[]
): Promise<{ labels: BoardLabel[]; lists: any[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/board/${boardId}/labels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels }),
    });
    if (!res.ok) throw new Error("Failed to update labels");
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export type MemberProfile = {
  uid: string;
  displayName?: string;
  email?: string;
};

export async function addBoardMember(
  boardId: string,
  email: string,
  addedBy?: string
): Promise<
  | { members: string[]; memberProfiles?: MemberProfile[] }
  | { error: string }
  | null
> {
  try {
    const res = await fetch(`${API_BASE}/api/board/${boardId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, addedBy }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Failed to add member" };
    return data;
  } catch (err) {
    console.error(err);
    return { error: "Failed to add member" };
  }
}

export async function removeBoardMember(
  boardId: string,
  uid: string
): Promise<
  | { members: string[]; lists?: any[]; memberProfiles?: MemberProfile[] }
  | { error: string }
  | null
> {
  try {
    const res = await fetch(`${API_BASE}/api/board/${boardId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Failed to remove member" };
    return data;
  } catch (err) {
    console.error(err);
    return { error: "Failed to remove member" };
  }
}

export async function moveBoardCard(
  boardId: string,
  cardId: string,
  listId: string
): Promise<{ card: any; lists: any[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/board/${boardId}/cards/${cardId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ listId }),
    });

    if (!res.ok) throw new Error("Failed to move card");
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function openBoard(
  id: string,
  user: User,
  router: ReturnType<typeof useRouter>
): Promise<void> {
  const board = await getBoardInfo(id);
  if (!board) return;

  await addRecentBoard(user.uid, id);

  const boardName = encodeURIComponent(board.urlName || "Untitled");
  router.push(`/b/${id}/${boardName}`);
}

/** A helper function that performs a global search for boards and users based on a query string.
 * It sends a GET request to the /api/search endpoint with the query as a URL parameter.
 * Returns an object containing arrays of matching boards and users.
 *
 * @param {string} query - The search query string.
 * @returns {Promise<{ boards: any[]; users: any[] }>} - A Promise resolving to an object with boards and users arrays.
 */
export async function globalSearch(query: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/search?q=${encodeURIComponent(
      query
    )}`
  );
  if (!res.ok) throw new Error("Search failed");
  const boards = await res.json();
  const boardResults = boards.map((b: any) => ({
    ...b,
    type: "board",
  }));

  const commandResults = commands.filter((cmd: { name: string }) =>
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  return [...boardResults, ...commandResults];
}

export type AppNotification = {
  id: string;
  userId: string;
  type:
    | "assignee_added"
    | "deadline_approaching"
    | "deadline_overdue"
    | "board_member_added";
  boardId: string;
  boardName: string;
  urlName: string;
  cardId: string;
  cardTitle: string;
  createdAt: string;
  read: boolean;
};

export async function getUserNotifications(
  userId: string
): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/user/notifications?userId=${encodeURIComponent(userId)}`
    );
    if (!res.ok) throw new Error("Failed to fetch notifications");
    const data = await res.json();
    return {
      notifications: data.notifications || [],
      unreadCount: data.unreadCount || 0,
    };
  } catch (err) {
    console.error(err);
    return { notifications: [], unreadCount: 0 };
  }
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/api/user/notifications/${notificationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}

export async function markAllNotificationsRead(
  userId: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/user/notifications/read-all`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch (err) {
    console.error(err);
    return false;
  }
}
