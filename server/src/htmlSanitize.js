const MAX_HTML_LENGTH = 20000;
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "div",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "a",
  "img",
]);
const VOID_TAGS = new Set(["br", "img"]);

export function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function looksLikeHtml(text) {
  return /<\/?[a-z][\s\S]*>/i.test(String(text || ""));
}

export function htmlToPlain(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmptyHtml(html) {
  if (htmlToPlain(html)) return false;
  return !/<img\b/i.test(String(html || ""));
}

export function textToHtml(text) {
  const escaped = escapeText(text).replace(/\n/g, "<br>");
  return escaped ? `<p>${escaped}</p>` : "";
}

export function safeHttpUrl(raw) {
  try {
    const url = new URL(decodeEntities(raw).trim());
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function getAttr(attrStr, name) {
  if (!attrStr) return "";
  const re = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const match = attrStr.match(re);
  if (!match) return "";
  return decodeEntities(match[1] || match[2] || match[3] || "");
}

export function sanitizeHtml(input) {
  const html = String(input || "")
    .substring(0, MAX_HTML_LENGTH)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

  const out = [];
  const stack = [];
  const re = /<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g;
  let last = 0;
  let match;

  while ((match = re.exec(html)) !== null) {
    out.push(escapeText(html.slice(last, match.index)));
    last = re.lastIndex;

    const tag = match[1].toLowerCase();
    const isClose = match[0].startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClose) {
      const index = stack.lastIndexOf(tag);
      if (index === -1) continue;
      while (stack.length > index) {
        out.push(`</${stack.pop()}>`);
      }
      continue;
    }

    if (tag === "br") {
      out.push("<br>");
      continue;
    }

    if (tag === "img") {
      const src = safeHttpUrl(getAttr(match[2], "src"));
      if (!src) continue;
      const alt = escapeText(getAttr(match[2], "alt"));
      out.push(`<img src="${src}" alt="${alt}">`);
      continue;
    }

    if (tag === "a") {
      const href = safeHttpUrl(getAttr(match[2], "href"));
      if (!href) continue;
      stack.push("a");
      out.push(
        `<a href="${href}" target="_blank" rel="noopener noreferrer">`
      );
      continue;
    }

    stack.push(tag);
    out.push(`<${tag}>`);
  }

  out.push(escapeText(html.slice(last)));
  while (stack.length) {
    out.push(`</${stack.pop()}>`);
  }
  return out.join("").trim();
}
