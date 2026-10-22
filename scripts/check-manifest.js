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
  ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])])
];
for (const file of referenced) assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
console.log("manifest.json is valid and uses the expected minimal permissions");
