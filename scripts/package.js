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
