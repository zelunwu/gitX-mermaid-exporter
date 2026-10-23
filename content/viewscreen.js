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

(function viewscreenContentScript() {
  "use strict";

  const API = globalThis.GitXMermaidExporter;
  const CHANNEL = "gitx-mermaid-exporter";
  const GITHUB_ORIGIN = "https://github.com";
  const toolbars = new Map();
  let pageContext = {};
  let pageStartIndex = 1;
  let diagrams = [];

  function notifyParent(message) {
    if (window.parent !== window) {
      window.parent.postMessage({ source: CHANNEL, ...message }, GITHUB_ORIGIN);
    }
  }

  function makeButton(label, title, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", () => action().catch(showError));
    return button;
  }

  function makeScaleSelect() {
    const select = document.createElement("select");
    select.className = "gme-scale";
    select.title = "PNG scale";
    select.setAttribute("aria-label", "PNG scale");
    select.innerHTML = `
      <option value="auto">Auto</option>
      <option value="1">1×</option><option value="2">2×</option><option value="3">3×</option>
      <option value="4">4×</option><option value="5">5×</option><option value="6">6×</option>`;
    return select;
  }

  function createToolbar(svg) {
    const toolbar = document.createElement("div");
    toolbar.className = "gme-toolbar";
    toolbar.dataset.gmeUi = "true";
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", "Export Mermaid diagram");
    const scale = makeScaleSelect();
    toolbar.append(
      makeButton("SVG", "Export this GitHub-rendered SVG", () => exportOne(svg, "svg", diagramIndex(svg))),
      makeButton("PNG", "Export this diagram as PNG", () => exportOne(svg, "png", diagramIndex(svg), scale.value)),
      scale
    );
    document.documentElement.append(toolbar);
    toolbars.set(svg, toolbar);
    return toolbar;
  }

  function diagramIndex(svg) {
    return Math.max(1, pageStartIndex + diagrams.indexOf(svg));
  }

  function positionToolbars() {
    for (const [svg, toolbar] of toolbars) {
      if (!svg.isConnected) {
        toolbar.remove();
        toolbars.delete(svg);
        continue;
      }
      const bounds = svg.getBoundingClientRect();
      toolbar.style.top = `${Math.max(6, bounds.top + window.scrollY + 6)}px`;
      toolbar.style.left = `${Math.max(6, bounds.left + window.scrollX + 6)}px`;
      const background = API.png.backgroundFor(svg);
      toolbar.dataset.theme = /rgb\((?:[0-9]|[1-8][0-9]),/.test(background) ? "dark" : "light";
    }
  }

  function reconcile(next) {
    diagrams = next;
    for (const [svg, toolbar] of toolbars) {
      if (!diagrams.includes(svg)) {
        toolbar.remove();
        toolbars.delete(svg);
      }
    }
    diagrams.forEach((svg) => {
      if (!toolbars.has(svg)) createToolbar(svg);
    });
    positionToolbars();
    notifyParent({ type: "gme:ready", count: diagrams.length });
  }

  async function exportOne(svg, format, index, scale = "auto") {
    if (!svg?.isConnected) throw new Error("GitHub's rendered Mermaid SVG is no longer available");
    const serialized = API.svg.serializeSvg(svg);
    const filename = API.filename.makeFilename(pageContext, index, format);
    const png = format === "png"
      ? await API.png.rasterize(serialized.text, {
          document,
          width: serialized.width,
          height: serialized.height,
          viewBox: serialized.viewBox,
          contentBox: serialized.contentBox,
          background: API.png.backgroundFor(svg),
          scale
        })
      : null;
    const dataUrl = png?.dataUrl || API.svg.toSvgDataUrl(serialized.text);
    const response = await chrome.runtime.sendMessage({
      type: "gme:download", format, filename, dataUrl
    });
    if (!response?.ok) throw new Error(response?.error || "Chrome could not start the download");
    showToast(`Download started: ${filename}${png ? ` (${png.scale}×, ${png.width}×${png.height})` : ""}`);
  }

  async function exportSelection(items, context) {
    if (context) pageContext = context;
    const current = API.dom.findDiagrams(document);
    if (!current.length) throw new Error("GitHub's rendered Mermaid SVG is not ready");
    for (const item of items) {
      const svg = current[item.localIndex];
      if (!svg) throw new Error(`Mermaid diagram ${item.globalIndex} is no longer available`);
      await exportOne(svg, item.format === "png" ? "png" : "svg", item.globalIndex, item.scale);
    }
  }

  function showToast(message, error = false) {
    document.querySelector(".gme-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = `gme-toast${error ? " gme-error" : ""}`;
    toast.dataset.gmeUi = "true";
    toast.textContent = message;
    document.documentElement.append(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function showError(error, requestId) {
    const message = error?.message || String(error);
    console.error("gitX Mermaid Exporter:", error);
    showToast(message, true);
    notifyParent({ type: "gme:error", error: message, requestId });
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== GITHUB_ORIGIN || event.source !== window.parent || event.data?.source !== CHANNEL) return;
    if (event.data.type === "gme:context") {
      pageContext = event.data.context || {};
      pageStartIndex = Math.max(1, Number(event.data.startIndex) || 1);
    }
    if (event.data.type === "gme:ping") notifyParent({ type: "gme:ready", count: diagrams.length });
    if (event.data.type === "gme:export-selection") {
      const requestId = event.data.requestId;
      exportSelection(Array.isArray(event.data.items) ? event.data.items : [], event.data.context).then(
        () => notifyParent({ type: "gme:export-complete", requestId }),
        (error) => showError(error, requestId)
      );
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "gme:download-failed") showError(new Error(message.error || "Download interrupted"));
  });

  const monitor = API.dom.createDiagramMonitor(document, reconcile);
  window.addEventListener("resize", positionToolbars);
  window.addEventListener("scroll", positionToolbars, { passive: true });
  window.addEventListener("load", monitor.scan);
})();
