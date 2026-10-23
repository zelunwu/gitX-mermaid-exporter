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

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sources = ["service-worker.js", "lib", "content", "scripts", "tests"];
const required = [
  "Copyright (c) 2026 Zelun Wu",
  "SPDX-License-Identifier: MIT",
  "Permission is hereby granted, free of charge",
  "The above copyright notice and this permission notice",
  "THE SOFTWARE IS PROVIDED \"AS IS\"",
  "OUT OF OR IN CONNECTION WITH THE SOFTWARE"
];

function codeFiles(target) {
  const absolute = path.join(root, target);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return /\.(?:js|css)$/.test(target) ? [target] : [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    return entry.isDirectory() ? codeFiles(child) : /\.(?:js|css)$/.test(child) ? [child] : [];
  });
}

const missing = sources.flatMap(codeFiles).filter((file) => {
  const prefix = fs.readFileSync(path.join(root, file), "utf8").slice(0, 2048);
  return required.some((line) => !prefix.includes(line));
});

if (missing.length) {
  throw new Error(`Missing MIT license header:\n${missing.join("\n")}`);
}
console.log("All JavaScript and CSS files contain the MIT license header");
