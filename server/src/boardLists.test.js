import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasCardPatchFields } from "./boardLists.js";

describe("hasCardPatchFields", () => {
  it("accepts a labels array payload", () => {
    assert.equal(hasCardPatchFields({ labels: ["Bug"] }), true);
  });

  it("accepts a singular label payload", () => {
    assert.equal(hasCardPatchFields({ label: "Bug" }), true);
  });

  it("rejects actorId alone as missing fields", () => {
    assert.equal(hasCardPatchFields({ actorId: "x" }), false);
  });
});
