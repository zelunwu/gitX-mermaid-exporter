"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const runtimeFiles = require("./runtime-files.js");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const dist = path.join(root, "dist");
const staging = path.join(dist, ".crx-source");
const generatedCrx = `${staging}.crx`;
const generatedKey = `${staging}.pem`;
const keyDirectory = path.join(dist, ".keys");
const signingKey = path.join(keyDirectory, "gitx-mermaid-exporter.pem");
const output = path.join(dist, `gitX-mermaid-exporter-v${manifest.version}.crx`);

function chromiumCandidates() {
  const explicit = [process.env.CHROME_BIN, process.env.CHROMIUM_BIN].filter(Boolean);
  const system = [
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium", "/usr/bin/chromium-browser"
  ];
  const playwrightRoot = path.join(os.homedir(), ".cache", "ms-playwright");
  const cached = fs.existsSync(playwrightRoot)
    ? fs.readdirSync(playwrightRoot)
      .filter((name) => name.startsWith("chromium-") && !name.includes("headless"))
      .sort().reverse()
      .map((name) => path.join(playwrightRoot, name, "chrome-linux64", "chrome"))
    : [];
  return [...explicit, ...system, ...cached];
}

const chromium = chromiumCandidates().find((candidate) => fs.existsSync(candidate));
if (!chromium) throw new Error("Compatible Chrome or Chromium not found; set CHROME_BIN");

fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(keyDirectory, { recursive: true });
fs.rmSync(staging, { recursive: true, force: true });
fs.rmSync(generatedCrx, { force: true });
fs.rmSync(generatedKey, { force: true });
fs.rmSync(output, { force: true });
fs.mkdirSync(staging);

for (const item of runtimeFiles) {
  fs.cpSync(path.join(root, item), path.join(staging, item), { recursive: true });
}

const args = ["--headless=new", "--no-sandbox", `--pack-extension=${staging}`];
if (fs.existsSync(signingKey)) args.push(`--pack-extension-key=${signingKey}`);
const result = spawnSync(chromium, args, { encoding: "utf8" });
if (result.status !== 0 || !fs.existsSync(generatedCrx)) {
  throw new Error(result.stderr || result.stdout || "Chromium did not create a CRX package");
}
if (!fs.existsSync(signingKey)) {
  if (!fs.existsSync(generatedKey)) throw new Error("Chromium did not create a signing key");
  fs.renameSync(generatedKey, signingKey);
}
fs.renameSync(generatedCrx, output);
fs.rmSync(staging, { recursive: true, force: true });
console.log(output);
console.log(`Signing key retained locally at ${signingKey}`);
