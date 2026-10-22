(function initFilename(root, factory) {
  const api = factory();
  root.GitHubMermaidExporter = root.GitHubMermaidExporter || {};
  root.GitHubMermaidExporter.filename = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function filenameFactory() {
  "use strict";

  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function sanitizeSegment(value, fallback = "github") {
    let cleaned = typeof value === "string" ? value.normalize("NFKC") : "";
    cleaned = cleaned
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.\s-]+|[.\s-]+$/g, "")
      .slice(0, 80);
    if (!cleaned) cleaned = fallback;
    if (RESERVED.test(cleaned)) cleaned = `_${cleaned}`;
    return cleaned;
  }

  function parseGitHubContext(urlValue) {
    try {
      const url = new URL(urlValue);
      if (url.origin !== "https://github.com") return {};
      const parts = url.pathname.split("/").filter(Boolean).map(safeDecode);
      const repository = parts.length >= 2 ? parts[1] : undefined;
      const candidate = parts.length >= 3 ? parts.at(-1) : undefined;
      const markdownFile = candidate
        ? candidate.replace(/\.(md|markdown|mdown|mkdn)$/i, "")
        : undefined;
      return { repository, markdownFile };
    } catch {
      return {};
    }
  }

  function makeFilename(context = {}, index = 1, format = "svg") {
    const repository = sanitizeSegment(context.repository, "github");
    const markdownFile = sanitizeSegment(context.markdownFile, "markdown");
    const diagram = Number.isFinite(Number(index)) && Number(index) > 0
      ? Math.floor(Number(index))
      : 1;
    const extension = format === "png" ? "png" : "svg";
    return `${repository}-${markdownFile}-diagram-${String(diagram).padStart(2, "0")}.${extension}`;
  }

  function sanitizeDownloadPath(filename, format = "svg") {
    const extension = format === "png" ? "png" : "svg";
    if (typeof filename !== "string" || !filename.trim()) {
      return `github-markdown-diagram-01.${extension}`;
    }
    const leaf = filename.split(/[\\/]/).at(-1);
    const stem = leaf.replace(/\.[^.]*$/, "");
    return `${sanitizeSegment(stem, "github-markdown-diagram-01")}.${extension}`;
  }

  return { makeFilename, parseGitHubContext, sanitizeDownloadPath, sanitizeSegment };
});
