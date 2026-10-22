(function initPage(root, factory) {
  const api = factory();
  root.GitHubMermaidExporter = root.GitHubMermaidExporter || {};
  root.GitHubMermaidExporter.page = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function pageFactory() {
  "use strict";

  function findViewscreenFrames(document) {
    return Array.from(document.querySelectorAll(
      "iframe[src^='https://viewscreen.githubusercontent.com/']"
    ));
  }

  function createFrameMonitor(document, onChange) {
    let previous = [];
    let scheduled = false;
    const scan = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const current = findViewscreenFrames(document);
        const changed = current.length !== previous.length || current.some((frame, i) => frame !== previous[i]);
        if (changed) {
          previous = current;
          onChange(current.slice());
        }
      });
    };
    const observer = new document.defaultView.MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scan();
    return { scan, stop() { observer.disconnect(); } };
  }

  return { createFrameMonitor, findViewscreenFrames };
});
