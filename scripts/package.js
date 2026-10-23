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
const archiver = require("archiver");
const runtimeFiles = require("./runtime-files.js");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const dist = path.join(root, "dist");
const output = path.join(dist, `gitX-mermaid-exporter-v${manifest.version}.zip`);
fs.mkdirSync(dist, { recursive: true });
fs.rmSync(output, { force: true });

const stream = fs.createWriteStream(output);
const archive = archiver("zip", { zlib: { level: 9 } });
stream.on("close", () => console.log(output));
archive.on("warning", (error) => {
  if (error.code !== "ENOENT") throw error;
});
archive.on("error", (error) => { throw error; });
archive.pipe(stream);
for (const item of runtimeFiles) {
  const source = path.join(root, item);
  if (fs.statSync(source).isDirectory()) archive.directory(source, item);
  else archive.file(source, { name: item });
}
archive.finalize();
