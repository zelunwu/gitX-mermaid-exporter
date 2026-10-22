"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const domApi = require("../lib/dom.js");
const pageApi = require("../lib/page.js");
const pngApi = require("../lib/png.js");

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("Viewscreen monitor detects delayed SVG and multiple diagrams", async () => {
  const fixture = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://viewscreen.githubusercontent.com/renderer"
  });
  const counts = [];
  const monitor = domApi.createDiagramMonitor(fixture.window.document, (diagrams) => counts.push(diagrams.length));
  await tick();
  const first = fixture.window.document.createElement("div");
  first.className = "mermaid";
  first.innerHTML = '<svg viewBox="0 0 100 50"></svg>';
  fixture.window.document.body.append(first);
  await tick();
  const second = first.cloneNode(true);
  fixture.window.document.body.append(second);
  await tick();
  assert.equal(domApi.findDiagrams(fixture.window.document).length, 2);
  assert.ok(counts.includes(0));
  assert.ok(counts.includes(1));
  assert.equal(counts.at(-1), 2);
  monitor.stop();
});

test("light and dark Viewscreen fixtures produce the visible background", () => {
  const light = new JSDOM('<html data-color-mode="light"><body style="background-color: rgb(255, 255, 255)"><svg></svg></body></html>');
  const dark = new JSDOM('<html data-color-mode="dark"><body style="background-color: rgb(13, 17, 23)"><svg></svg></body></html>');
  assert.equal(pngApi.backgroundFor(light.window.document.querySelector("svg")), "rgb(255, 255, 255)");
  assert.equal(pngApi.backgroundFor(dark.window.document.querySelector("svg")), "rgb(13, 17, 23)");
  assert.deepEqual(pngApi.dimensions(100.2, 50.2, 2), {
    logicalWidth: 100.2, logicalHeight: 50.2, pixelWidth: 201, pixelHeight: 101
  });
});

test("GitHub SPA navigation and iframe reload fixtures are rediscovered", async () => {
  const fixture = new JSDOM(`<!doctype html><html><body>
    <iframe src="https://viewscreen.githubusercontent.com/one"></iframe>
  </body></html>`, { url: "https://github.com/acme/repo/blob/main/one.md" });
  const snapshots = [];
  const monitor = pageApi.createFrameMonitor(fixture.window.document, (frames) => snapshots.push(frames.map((f) => f.src)));
  await tick();
  fixture.window.history.pushState({}, "", "/acme/repo/blob/main/two.md");
  const oldFrame = fixture.window.document.querySelector("iframe");
  const replacement = fixture.window.document.createElement("iframe");
  replacement.src = "https://viewscreen.githubusercontent.com/two";
  oldFrame.replaceWith(replacement);
  await tick();
  assert.equal(fixture.window.location.pathname, "/acme/repo/blob/main/two.md");
  assert.deepEqual(pageApi.findViewscreenFrames(fixture.window.document).map((f) => f.src), [
    "https://viewscreen.githubusercontent.com/two"
  ]);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots.at(-1), ["https://viewscreen.githubusercontent.com/two"]);
  monitor.stop();
});
