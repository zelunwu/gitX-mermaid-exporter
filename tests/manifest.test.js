"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../manifest.json");

test("Manifest V3 permission surface is intentionally minimal", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["downloads"]);
  assert.deepEqual(manifest.host_permissions, [
    "https://github.com/*",
    "https://viewscreen.githubusercontent.com/*"
  ]);
  assert.equal(JSON.stringify(manifest).includes("<all_urls>"), false);
});
