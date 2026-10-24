import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pageDrawScale } from "../../client/src/utils/pdfView.js";

describe("pageDrawScale", () => {
  it("fits the page to the pane at 100%", () => {
    assert.equal(pageDrawScale(400, 200, 100), 2);
  });

  it("doubles the page at 200% and halves it at 50%", () => {
    assert.equal(pageDrawScale(400, 200, 200), 4);
    assert.equal(pageDrawScale(400, 200, 50), 1);
  });

  it("stays at 1 when the pane or page width is missing", () => {
    assert.equal(pageDrawScale(0, 200, 150), 1);
    assert.equal(pageDrawScale(400, 0, 150), 1);
  });
});
