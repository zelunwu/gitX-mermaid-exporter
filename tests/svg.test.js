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
const { JSDOM } = require("jsdom");
const svgApi = require("../lib/svg.js");

const SVG_NS = "http://www.w3.org/2000/svg";

function svgDocument(markup, bodyStyle = "background: rgb(255, 255, 255)") {
  return new JSDOM(`<!doctype html><html><body style="${bodyStyle}"><div class="mermaid">${markup}</div></body></html>`, {
    url: "https://viewscreen.githubusercontent.com/renderer"
  });
}

test("serializes the rendered SVG, viewBox, text, color, and computed style", () => {
  const dom = svgDocument(`<svg viewBox="-8 -4 208 108" width="100%" height="100%" style="color: rgb(9, 105, 218)">
    <style>.node { fill: rgb(255, 255, 255); }</style>
    <g class="node"><text>Private diagram text</text></g>
  </svg>`);
  const source = dom.window.document.querySelector("svg");
  source.getBoundingClientRect = () => ({ width: 416, height: 216 });
  const result = svgApi.serializeSvg(source);
  const parsed = new JSDOM(result.text, { contentType: "image/svg+xml" });
  const exported = parsed.window.document.documentElement;
  assert.equal(exported.namespaceURI, SVG_NS);
  assert.equal(exported.getAttribute("viewBox"), "-8 -4 208 108");
  assert.equal(exported.getAttribute("width"), "416");
  assert.equal(exported.getAttribute("height"), "216");
  assert.match(exported.textContent, /Private diagram text/);
  assert.match(exported.getAttribute("style") || "", /color/);
  assert.equal(result.width, 416);
  assert.equal(result.height, 216);
});

test("adds dimensions and viewBox when GitHub SVG omits them", () => {
  const dom = svgDocument(`<svg><path d="M0 0L10 10"/></svg>`);
  const source = dom.window.document.querySelector("svg");
  source.getBoundingClientRect = () => ({ width: 321.2, height: 123.4 });
  const result = svgApi.serializeSvg(source, { inlineStyles: false });
  assert.match(result.text, /width="322"/);
  assert.match(result.text, /height="124"/);
  assert.match(result.text, /viewBox="0 0 321.2 123.4"/);
});

test("uses a padded content box to avoid clipping when viewBox is absent", () => {
  const dom = svgDocument(`<svg><path d="M-5 -5L100 40"/></svg>`);
  const source = dom.window.document.querySelector("svg");
  source.getBBox = () => ({ x: -5, y: -5, width: 105, height: 45 });
  source.getBoundingClientRect = () => ({ width: 0, height: 0 });
  const result = svgApi.serializeSvg(source, { inlineStyles: false });
  assert.match(result.text, /viewBox="-11 -11 117 57"/);
  assert.equal(result.width, 117);
  assert.equal(result.height, 57);
});

test("never includes exporter UI nested in a source fixture", () => {
  const dom = svgDocument(`<svg viewBox="0 0 20 10"><g data-gme-ui="true"><text>SVG PNG 2×</text></g><text>Diagram</text></svg>`);
  const result = svgApi.serializeSvg(dom.window.document.querySelector("svg"), { inlineStyles: false });
  assert.doesNotMatch(result.text, /SVG PNG 2×/);
  assert.match(result.text, /Diagram/);
});
