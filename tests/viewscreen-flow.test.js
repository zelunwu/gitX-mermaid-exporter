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
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const filename = require("../lib/filename.js");
const domApi = require("../lib/dom.js");
const svgApi = require("../lib/svg.js");
const pngApi = require("../lib/png.js");

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function decodeSvgDataUrl(dataUrl) {
  return Buffer.from(dataUrl.split(",")[1], "base64").toString("utf8");
}

test("local Viewscreen fixture exercises single SVG, PNG, and multi-diagram batch flows", async () => {
  const fixture = new JSDOM(`<!doctype html><html data-color-mode="dark"><body style="background: rgb(13, 17, 23)">
    <div class="mermaid"><svg viewBox="0 0 120 60"><text>First private fixture</text></svg></div>
    <div class="mermaid"><svg viewBox="0 0 80 40"><text>Second private fixture</text></svg></div>
  </body></html>`, {
    url: "https://viewscreen.githubusercontent.com/renderer",
    runScripts: "outside-only"
  });
  const downloads = [];
  const runtimeListeners = [];
  fixture.window.GitXMermaidExporter = {
    filename,
    dom: domApi,
    svg: svgApi,
    png: {
      ...pngApi,
      rasterize: async () => ({
        dataUrl: "data:image/png;base64,iVBORw0KGgo=", scale: 4, width: 480, height: 240
      })
    }
  };
  fixture.window.chrome = {
    runtime: {
      sendMessage: async (message) => {
        downloads.push(message);
        return { ok: true, downloadId: downloads.length };
      },
      onMessage: { addListener(listener) { runtimeListeners.push(listener); } }
    }
  };
  fixture.window.console.error = () => {};
  fixture.window.eval(fs.readFileSync(path.join(__dirname, "../content/viewscreen.js"), "utf8"));
  await tick();

  fixture.window.dispatchEvent(new fixture.window.MessageEvent("message", {
    origin: "https://github.com",
    source: fixture.window,
    data: {
      source: "gitx-mermaid-exporter",
      type: "gme:context",
      startIndex: 5,
      context: { repository: "secret-repo", markdownFile: "Design" }
    }
  }));

  const buttons = fixture.window.document.querySelectorAll(".gme-toolbar button");
  assert.equal(buttons.length, 4);
  buttons[0].click();
  buttons[1].click();
  await tick();
  assert.equal(downloads[0].format, "svg");
  assert.equal(downloads[1].format, "png");
  assert.equal(downloads[0].filename, "secret-repo-Design-diagram-05.svg");

  const exportedSvg = decodeSvgDataUrl(downloads[0].dataUrl);
  const reparsed = new JSDOM(exportedSvg, { contentType: "image/svg+xml" });
  assert.match(reparsed.window.document.documentElement.textContent, /First private fixture/);
  assert.equal(exportedSvg.includes("gme-toolbar"), false);
  assert.equal(exportedSvg.includes("PNG 2×"), false);

  fixture.window.dispatchEvent(new fixture.window.MessageEvent("message", {
    origin: "https://github.com",
    source: fixture.window,
    data: {
      source: "gitx-mermaid-exporter",
      type: "gme:export-selection",
      requestId: "fixture-request",
      items: [
        { localIndex: 0, globalIndex: 3, format: "svg", scale: "auto" },
        { localIndex: 1, globalIndex: 4, format: "svg", scale: "auto" }
      ],
      context: { repository: "secret-repo", markdownFile: "Design" }
    }
  }));
  await tick();
  await tick();
  assert.equal(downloads.length, 4);
  assert.equal(downloads[2].filename, "secret-repo-Design-diagram-03.svg");
  assert.equal(downloads[3].filename, "secret-repo-Design-diagram-04.svg");

  runtimeListeners[0]({ type: "gme:download-failed", error: "disk full" });
  assert.match(fixture.window.document.querySelector(".gme-error").textContent, /disk full/);
  fixture.window.close();
});
