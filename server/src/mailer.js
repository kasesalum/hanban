import nodemailer from "nodemailer";
import admin from "firebase-admin";
import {
  createInboxNotifications,
  loadPrefsForUids,
  shouldSendEmail,
} from "./notifications.js";

const MAIL_ATTEMPTS = 3;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) return false;

  for (let attempt = 1; attempt <= MAIL_ATTEMPTS; attempt++) {
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
      console.error(
        `Error sending email to ${to} (attempt ${attempt}/${MAIL_ATTEMPTS}):`,
        error
      );
      if (attempt < MAIL_ATTEMPTS) {
        await sleep(400 * attempt);
      }
    }
  }
  return false;
}

export async function emailsForUids(uids = []) {
  const unique = [...new Set((uids || []).filter(Boolean))];
  if (unique.length === 0) return [];

  const emails = [];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const result = await admin.auth().getUsers(chunk.map((uid) => ({ uid })));
      for (const user of result.users) {
        if (user.email) emails.push(user.email);
      }
      for (const missing of result.notFound || []) {
        console.error(`Could not resolve email for ${missing.uid}`);
      }
    } catch (error) {
      console.error("Could not resolve emails:", error);
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapEmail({ heading, bodyHtml, link }) {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">${escapeHtml(heading)}</h2>
      ${bodyHtml}
      <p style="margin: 24px 0 0;">
        <a href="${link}" style="display: inline-block; padding: 10px 16px; background: #111827; color: #fff; text-decoration: none; border-radius: 6px;">Open</a>
      </p>
    </div>
  `;
}

function truncate(value, max = 140) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function notificationCopy({ type, boardName, card, extra, link }) {
  const title = card?.title || "Untitled";
  const board = boardName || "Untitled board";
  const deadlineLine = card?.deadline
    ? `Deadline: ${card.deadline}`
    : "No deadline set";

  if (type === "assignee_added") {
    const heading = `You were added to “${title}”`;
    return {
      subject: `You were added to “${title}” on ${board}`,
      heading,
      text: [
        `You were added to the task “${title}” on the board “${board}”.`,
        deadlineLine,
        `Open the board: ${link}`,
      ].join("\n"),
      html: wrapEmail({
        heading,
        link,
        bodyHtml: `
          <p>You were added to the task <strong>${escapeHtml(title)}</strong> on the board <strong>${escapeHtml(board)}</strong>.</p>
          <p>${escapeHtml(deadlineLine)}</p>
        `,
      }),
    };
  }

  if (type === "board_member_added") {
    const heading = `You were added to “${board}”`;
    return {
      subject: heading,
      heading,
      text: [`You were added to the board “${board}”.`, `Open the board: ${link}`].join(
        "\n"
      ),
      html: wrapEmail({
        heading,
        link,
        bodyHtml: `<p>You were added to the board <strong>${escapeHtml(board)}</strong>.</p>`,
      }),
    };
  }

  if (type === "deadline_approaching" || type === "deadline_overdue") {
    const approaching = type === "deadline_approaching";
    const heading = approaching
      ? `Deadline approaching: “${title}”`
      : `Deadline overdue: “${title}”`;
    const summary = approaching
      ? `The deadline for “${title}” on “${board}” is approaching (${card?.deadline || ""}).`
      : `The deadline for “${title}” on “${board}” is overdue (${card?.deadline || ""}).`;
    return {
      subject: heading,
      heading,
      text: `${summary}\nOpen the board: ${link}`,
      html: wrapEmail({
        heading,
        link,
        bodyHtml: `<p>${escapeHtml(summary)}</p>`,
      }),
    };
  }

  if (type === "comment_added") {
    const preview = truncate(extra?.commentPreview || "");
    const heading = `New comment on “${title}”`;
    return {
      subject: heading,
      heading,
      text: [
        `A new comment was added to “${title}” on “${board}”.`,
        preview ? `“${preview}”` : "",
        `Open the board: ${link}`,
      ]
        .filter(Boolean)
        .join("\n"),
      html: wrapEmail({
        heading,
        link,
        bodyHtml: `
          <p>A new comment was added to <strong>${escapeHtml(title)}</strong> on <strong>${escapeHtml(board)}</strong>.</p>
          ${preview ? `<p>${escapeHtml(`“${preview}”`)}</p>` : ""}
        `,
      }),
    };
  }

  if (type === "deadline_changed") {
    const nextDeadline = extra?.deadline ? String(extra.deadline) : "";
    const heading = `Due date updated on “${title}”`;
    const summary = nextDeadline
      ? `The due date for “${title}” on “${board}” was changed to ${nextDeadline}.`
      : `The due date for “${title}” on “${board}” was removed.`;
    return {
      subject: heading,
      heading,
      text: `${summary}\nOpen the board: ${link}`,
      html: wrapEmail({
        heading,
        link,
        bodyHtml: `<p>${escapeHtml(summary)}</p>`,
      }),
    };
  }

  if (type === "card_completed") {
    const heading = `“${title}” was marked complete`;
    const summary = `“${title}” on “${board}” was marked complete.`;
    return {
      subject: heading,
      heading,
      text: `${summary}\nOpen the board: ${link}`,
      html: wrapEmail({
        heading,
        link,
        bodyHtml: `<p>${escapeHtml(summary)}</p>`,
      }),
    };
  }

  const heading = `Update on “${title}”`;
  return {
    subject: heading,
    heading,
    text: `${heading} on “${board}”.\nOpen the board: ${link}`,
    html: wrapEmail({
      heading,
      link,
      bodyHtml: `<p>${escapeHtml(heading)} on <strong>${escapeHtml(board)}</strong>.</p>`,
    }),
  };
}

export async function notifyUsers({
  type,
  userIds = [],
  actorId,
  boardId,
  boardName,
  urlName,
  card,
  extra,
}) {
  const recipients = [
    ...new Set((userIds || []).filter((uid) => uid && uid !== actorId)),
  ];
  if (recipients.length === 0) return { notified: 0 };

  await createInboxNotifications({
    type,
    userIds: recipients,
    boardId,
    boardName,
    urlName,
    card,
    extra,
  });

  if (!isMailConfigured()) return { notified: recipients.length };

  const prefsByUid = await loadPrefsForUids(recipients);
  const emailUids = recipients.filter((uid) =>
    shouldSendEmail(prefsByUid.get(uid), type)
  );
  if (emailUids.length === 0) return { notified: recipients.length };

  const emails = await emailsForUids(emailUids);
  if (emails.length === 0) return { notified: recipients.length };

  const link = boardUrl(boardId, urlName);
  const copy = notificationCopy({
    type,
    boardName,
    card,
    extra,
    link,
  });

  await Promise.all(
    emails.map((to) =>
      sendMail({
        to,
        subject: copy.subject,
        text: copy.text,
        html: copy.html,
      })
    )
  );

  return { notified: recipients.length };
}
