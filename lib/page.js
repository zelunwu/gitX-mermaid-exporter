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

(function initPage(root, factory) {
  const api = factory();
  root.GitXMermaidExporter = root.GitXMermaidExporter || {};
  root.GitXMermaidExporter.page = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function pageFactory() {
  "use strict";

  function findViewscreenFrames(document) {
    return Array.from(document.querySelectorAll(
      "iframe[src^='https://viewscreen.githubusercontent.com/']"
    ));
  }

  function createFrameMonitor(document, onChange) {
    let previous = [];
    let scheduled = false;
    const scan = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const current = findViewscreenFrames(document);
        const changed = current.length !== previous.length || current.some((frame, i) => frame !== previous[i]);
        if (changed) {
          previous = current;
          onChange(current.slice());
        }
      });
    };
    const observer = new document.defaultView.MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scan();
    return { scan, stop() { observer.disconnect(); } };
  }

  return { createFrameMonitor, findViewscreenFrames };
});
