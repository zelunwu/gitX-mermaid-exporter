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

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ["downloads"]);
assert.deepEqual(manifest.host_permissions, [
  "https://github.com/*",
  "https://viewscreen.githubusercontent.com/*"
]);
assert.ok(!JSON.stringify(manifest).includes("<all_urls>"));

const referenced = [
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])]),
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {})
];
for (const file of referenced) assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);

const expectedIcons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };
assert.deepEqual(manifest.icons, expectedIcons);
assert.deepEqual(manifest.action.default_icon, expectedIcons);
for (const [size, file] of Object.entries(expectedIcons)) {
  const png = fs.readFileSync(path.join(root, file));
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a", `${file} is not a PNG`);
  assert.equal(png.readUInt32BE(16), Number(size), `${file} has the wrong width`);
  assert.equal(png.readUInt32BE(20), Number(size), `${file} has the wrong height`);
}
console.log("manifest.json is valid and uses the expected minimal permissions");
