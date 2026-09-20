import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import userRoutes from "./routes/user.js";
import notificationRoutes from "./routes/notification.js";
import boardRoutes from "./routes/board.js";
import searchRoutes from "./routes/search.js";
import { startDeadlineNotifications } from "./deadlineNotifications.js";
import { isMailConfigured } from "./mailer.js";
import { localUploadRoot } from "./localUpload.js";

dotenv.config();

const app = express();
const imageUploadPath =
  /^\/api\/user\/avatar$|^\/api\/board\/[^/]+\/cards\/[^/]+\/images$/;
app.use((req, res, next) => {
  if (req.method === "POST" && imageUploadPath.test(req.path)) {
    return express.json({ limit: "8mb" })(req, res, next);
  }
  return express.json()(req, res, next);
});

console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log(
  isMailConfigured() ? "SMTP configured" : "SMTP not configured; emails skipped"
);
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use("/uploads", express.static(localUploadRoot()));

app.use("/api/user", notificationRoutes);
app.use("/api/user", userRoutes);
app.use("/api/board", boardRoutes);
app.use("/api/search", searchRoutes);

const port = process.env.PORT || 5050;
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  startDeadlineNotifications();
});
