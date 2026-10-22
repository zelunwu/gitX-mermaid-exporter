"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const filename = require("../lib/filename.js");

test("parses repository and Markdown filename from a GitHub blob URL", () => {
  assert.deepEqual(
    filename.parseGitHubContext("https://github.com/acme/widgets/blob/main/docs/Architecture%20Map.md?plain=1"),
    { repository: "widgets", markdownFile: "Architecture Map" }
  );
});

test("generates stable indexed SVG and PNG filenames", () => {
  const context = { repository: "widgets", markdownFile: "Architecture Map" };
  assert.equal(filename.makeFilename(context, 2, "svg"), "widgets-Architecture-Map-diagram-02.svg");
  assert.equal(filename.makeFilename(context, 12, "png"), "widgets-Architecture-Map-diagram-12.png");
});

test("cleans unsafe, reserved, empty, and path-like names", () => {
  assert.equal(filename.sanitizeSegment(" a/b:c*?  diagram "), "a-b-c-diagram");
  assert.equal(filename.sanitizeSegment("CON"), "_CON");
  assert.equal(filename.sanitizeDownloadPath("../../private/repo.svg", "svg"), "repo.svg");
  assert.equal(filename.makeFilename({}, 0, "exe"), "github-markdown-diagram-01.svg");
});
