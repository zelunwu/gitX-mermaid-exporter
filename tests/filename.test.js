/*
 * Copyright (c) 2026 Zelun Wu
 * SPDX-License-Identifier: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
  assert.equal(filename.makeFilename({}, 0, "exe"), "gitX-markdown-diagram-01.svg");
});
