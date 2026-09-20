import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEmptyHtml, sanitizeHtml } from "./htmlSanitize.js";

describe("isEmptyHtml", () => {
  it("treats empty markup as empty", () => {
    assert.equal(isEmptyHtml(""), true);
    assert.equal(isEmptyHtml("<p></p>"), true);
    assert.equal(isEmptyHtml("<p><br></p>"), true);
    assert.equal(isEmptyHtml("   "), true);
  });

  it("treats image-only HTML as content", () => {
    assert.equal(
      isEmptyHtml('<img src="https://example.com/shot.png" alt="">'),
      false
    );
  });

  it("treats text and text-plus-image as content", () => {
    assert.equal(isEmptyHtml("<p>hello</p>"), false);
    assert.equal(
      isEmptyHtml(
        '<p>hello</p><img src="https://example.com/shot.png" alt="">'
      ),
      false
    );
  });
});

describe("sanitizeHtml", () => {
  it("keeps https images", () => {
    const html =
      '<img src="https://firebasestorage.googleapis.com/v0/b/app/o/a.png?alt=media&token=abc" alt="shot">';
    const out = sanitizeHtml(html);
    assert.match(out, /<img src=/);
    assert.match(out, /https:\/\/firebasestorage\.googleapis\.com\//);
    assert.match(out, /alt="shot"/);
  });

  it("drops images without an http(s) src", () => {
    assert.equal(sanitizeHtml('<img src="javascript:alert(1)" alt="x">'), "");
    assert.equal(sanitizeHtml("<img alt='x'>"), "");
  });
});
