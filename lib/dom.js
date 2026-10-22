(function initDom(root, factory) {
  const api = factory();
  root.GitHubMermaidExporter = root.GitHubMermaidExporter || {};
  root.GitHubMermaidExporter.dom = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function domFactory() {
  "use strict";

  function findDiagrams(document) {
    const preferred = Array.from(document.querySelectorAll(
      ".mermaid svg, svg[aria-roledescription], svg[id^='mermaid-']"
    ));
    const candidates = preferred.length
      ? preferred
      : Array.from(document.querySelectorAll("svg")).filter((svg) => !svg.closest("[data-gme-ui]"));
    return [...new Set(candidates)].filter((svg) => svg.isConnected && !svg.closest("[data-gme-ui]"));
  }

  function createDiagramMonitor(document, onChange) {
    let diagrams = [];
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const next = findDiagrams(document);
        const changed = next.length !== diagrams.length || next.some((item, i) => item !== diagrams[i]);
        diagrams = next;
        onChange(diagrams.slice(), { changed });
      });
    };
    const observer = new document.defaultView.MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-color-mode", "data-dark-theme", "data-light-theme"]
    });
    schedule();
    return {
      scan: schedule,
      stop() { observer.disconnect(); },
      getDiagrams() { return diagrams.slice(); }
    };
  }

  return { createDiagramMonitor, findDiagrams };
});
