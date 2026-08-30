import nodemailer from "nodemailer";
import admin from "firebase-admin";

let transporter;
let warnedMissingConfig = false;

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter() {
  if (!isMailConfigured()) {
    if (!warnedMissingConfig) {
      console.warn("SMTP is not configured; emails will be skipped.");
      warnedMissingConfig = true;
    }
    return null;
  }

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export async function emailsForUids(uids = []) {
  const emails = [];
  for (const uid of uids) {
    try {
      const user = await admin.auth().getUser(uid);
      if (user.email) emails.push(user.email);
    } catch (error) {
      console.error(`Could not resolve email for ${uid}:`, error);
    }
  }
  return emails;
}

export function boardUrl(boardId, urlName) {
  const base = (process.env.FRONTEND_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  return `${base}/b/${boardId}/${urlName || "board"}`;
}

async function sendToAssignees({ uids, subject, text, html }) {
  const emails = await emailsForUids(uids);
  if (emails.length === 0) return true;
  if (!isMailConfigured()) return false;

  const results = await Promise.all(
    emails.map((to) => sendMail({ to, subject, text, html }))
  );
  return results.every(Boolean);
}

export async function notifyAssigneesAdded({
  boardId,
  boardName,
  urlName,
  card,
}) {
  const link = boardUrl(boardId, urlName);
  const deadlineLine = card.deadline
    ? `Deadline: ${card.deadline}`
    : "No deadline set";
  const subject = `You were added to “${card.title}” on ${boardName}`;
  const text = [
    `You were added to the task “${card.title}” on the board “${boardName}”.`,
    deadlineLine,
    `Open the board: ${link}`,
  ].join("\n");
  const html = `
    <p>You were added to the task <strong>${escapeHtml(card.title)}</strong> on the board <strong>${escapeHtml(boardName)}</strong>.</p>
    <p>${escapeHtml(deadlineLine)}</p>
    <p><a href="${link}">Open the board</a></p>
  `;

  return sendToAssignees({
    uids: card.assignees || [],
    subject,
    text,
    html,
  });
}

export async function notifyDeadline({
  kind,
  boardId,
  boardName,
  urlName,
  card,
}) {
  const link = boardUrl(boardId, urlName);
  const approaching = kind === "approaching";
  const subject = approaching
    ? `Deadline approaching: “${card.title}”`
    : `Deadline overdue: “${card.title}”`;
  const summary = approaching
    ? `The deadline for “${card.title}” on “${boardName}” is approaching (${card.deadline}).`
    : `The deadline for “${card.title}” on “${boardName}” is overdue (${card.deadline}).`;
  const text = `${summary}\nOpen the board: ${link}`;
  const html = `
    <p>${escapeHtml(summary)}</p>
    <p><a href="${link}">Open the board</a></p>
  `;

  return sendToAssignees({
    uids: card.assignees || [],
    subject,
    text,
    html,
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
