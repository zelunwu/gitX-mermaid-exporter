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

(function initDom(root, factory) {
  const api = factory();
  root.GitXMermaidExporter = root.GitXMermaidExporter || {};
  root.GitXMermaidExporter.dom = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function domFactory() {
  "use strict";

  function isOutermostSvg(svg) {
    let ancestor = svg.parentElement;
    while (ancestor) {
      if (ancestor.localName === "svg") return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  }

  function findDiagrams(document) {
    const preferred = Array.from(document.querySelectorAll(
      ".mermaid svg, svg[aria-roledescription], svg[id^='mermaid-']"
    )).filter(isOutermostSvg);
    const candidates = preferred.length
      ? preferred
      : Array.from(document.querySelectorAll("svg")).filter(isOutermostSvg);
    return [...new Set(candidates)].filter((svg) => svg.isConnected && !svg.closest("[data-gme-ui]"));
  }

  function createDiagramMonitor(document, onChange) {
    let diagrams = [];
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const next = findDiagrams(document);
        const changed = next.length !== diagrams.length || next.some((item, i) => item !== diagrams[i]);
        diagrams = next;
        onChange(diagrams.slice(), { changed });
      });
    };
    const observer = new document.defaultView.MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-color-mode", "data-dark-theme", "data-light-theme"]
    });
    schedule();
    return {
      scan: schedule,
      stop() { observer.disconnect(); },
      getDiagrams() { return diagrams.slice(); }
    };
  }

  return { createDiagramMonitor, findDiagrams, isOutermostSvg };
});
