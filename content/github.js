(function githubContentScript() {
  "use strict";

  const API = globalThis.GitHubMermaidExporter;
  const VIEWSCREEN_ORIGIN = "https://viewscreen.githubusercontent.com";
  const frames = new Map();
  let previousUrl = location.href;

  function viewscreenFrames() {
    return API.page.findViewscreenFrames(document);
  }

  function context() {
    return API.filename.parseGitHubContext(location.href);
  }

  function postToFrame(frame, message) {
    frame.contentWindow?.postMessage({ source: "github-mermaid-exporter", ...message }, VIEWSCREEN_ORIGIN);
  }

  function synchronize() {
    const current = viewscreenFrames();
    current.forEach((frame) => {
      if (!frames.has(frame.contentWindow)) frames.set(frame.contentWindow, { count: 1 });
      postToFrame(frame, { type: "gme:context", context: context() });
      postToFrame(frame, { type: "gme:ping" });
      if (!frame.dataset.gmeListening) {
        frame.dataset.gmeListening = "true";
        frame.addEventListener("load", () => {
          frames.set(frame.contentWindow, { count: 1 });
          postToFrame(frame, { type: "gme:context", context: context() });
          postToFrame(frame, { type: "gme:ping" });
        });
      }
    });
    for (const frameWindow of frames.keys()) {
      if (!current.some((frame) => frame.contentWindow === frameWindow)) frames.delete(frameWindow);
    }
  }

  function showToast(message, error = false) {
    document.querySelector("[data-gme-page-toast]")?.remove();
    const toast = document.createElement("div");
    toast.dataset.gmePageToast = "true";
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
      padding: "10px 12px", borderRadius: "6px", color: "white",
      background: error ? "#cf222e" : "#1f883d", font: "13px system-ui"
    });
    document.documentElement.append(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== VIEWSCREEN_ORIGIN || event.data?.source !== "github-mermaid-exporter") return;
    const frame = viewscreenFrames().find((candidate) => candidate.contentWindow === event.source);
    if (!frame) return;
    if (event.data.type === "gme:ready") {
      frames.set(event.source, { count: Math.max(1, Number(event.data.count) || 1) });
      postToFrame(frame, { type: "gme:context", context: context() });
    } else if (event.data.type === "gme:error") {
      showToast(event.data.error || "Mermaid export failed", true);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "gme:export-all") return false;
    synchronize();
    const current = viewscreenFrames();
    if (!current.length) {
      const error = "No GitHub Viewscreen Mermaid diagrams found on this page";
      showToast(error, true);
      sendResponse({ ok: false, error });
      return false;
    }
    let startIndex = 1;
    let total = 0;
    current.forEach((frame) => {
      const count = Math.max(1, frames.get(frame.contentWindow)?.count || 1);
      postToFrame(frame, { type: "gme:export-all", startIndex, context: context() });
      startIndex += count;
      total += count;
    });
    showToast(`Starting ${total} Mermaid SVG download${total === 1 ? "" : "s"}…`);
    sendResponse({ ok: true, count: total });
    return false;
  });

  API.page.createFrameMonitor(document, synchronize);
  window.addEventListener("popstate", synchronize);
  document.addEventListener("turbo:load", synchronize);
  document.addEventListener("pjax:end", synchronize);
  setInterval(() => {
    if (location.href !== previousUrl) {
      previousUrl = location.href;
      synchronize();
    }
  }, 1000);
  synchronize();
})();
