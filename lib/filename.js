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

(function initFilename(root, factory) {
  const api = factory();
  root.GitXMermaidExporter = root.GitXMermaidExporter || {};
  root.GitXMermaidExporter.filename = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function filenameFactory() {
  "use strict";

  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function sanitizeSegment(value, fallback = "github") {
    let cleaned = typeof value === "string" ? value.normalize("NFKC") : "";
    cleaned = cleaned
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.\s-]+|[.\s-]+$/g, "")
      .slice(0, 80);
    if (!cleaned) cleaned = fallback;
    if (RESERVED.test(cleaned)) cleaned = `_${cleaned}`;
    return cleaned;
  }

  function parseGitHubContext(urlValue) {
    try {
      const url = new URL(urlValue);
      if (url.origin !== "https://github.com") return {};
      const parts = url.pathname.split("/").filter(Boolean).map(safeDecode);
      const repository = parts.length >= 2 ? parts[1] : undefined;
      const candidate = parts.length >= 3 ? parts.at(-1) : undefined;
      const markdownFile = candidate
        ? candidate.replace(/\.(md|markdown|mdown|mkdn)$/i, "")
        : undefined;
      return { repository, markdownFile };
    } catch {
      return {};
    }
  }

  function makeFilename(context = {}, index = 1, format = "svg") {
    const repository = sanitizeSegment(context.repository, "gitX");
    const markdownFile = sanitizeSegment(context.markdownFile, "markdown");
    const diagram = Number.isFinite(Number(index)) && Number(index) > 0
      ? Math.floor(Number(index))
      : 1;
    const extension = format === "png" ? "png" : "svg";
    return `${repository}-${markdownFile}-diagram-${String(diagram).padStart(2, "0")}.${extension}`;
  }

  function sanitizeDownloadPath(filename, format = "svg") {
    const extension = format === "png" ? "png" : "svg";
    if (typeof filename !== "string" || !filename.trim()) {
      return `gitX-markdown-diagram-01.${extension}`;
    }
    const leaf = filename.split(/[\\/]/).at(-1);
    const stem = leaf.replace(/\.[^.]*$/, "");
    return `${sanitizeSegment(stem, "gitX-markdown-diagram-01")}.${extension}`;
  }

  return { makeFilename, parseGitHubContext, sanitizeDownloadPath, sanitizeSegment };
});
