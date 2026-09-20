import { isEmptyHtml } from "@/components/boards/richTextEditor";

describe("isEmptyHtml", () => {
  it("treats empty markup as empty", () => {
    expect(isEmptyHtml("")).toBe(true);
    expect(isEmptyHtml("<p></p>")).toBe(true);
    expect(isEmptyHtml("<p><br></p>")).toBe(true);
    expect(isEmptyHtml("   ")).toBe(true);
  });

  it("treats image-only HTML as content", () => {
    expect(
      isEmptyHtml('<img src="https://example.com/shot.png" alt="">')
    ).toBe(false);
  });

  it("treats text and text-plus-image as content", () => {
    expect(isEmptyHtml("<p>hello</p>")).toBe(false);
    expect(
      isEmptyHtml(
        '<p>hello</p><img src="https://example.com/shot.png" alt="">'
      )
    ).toBe(false);
  });
});
