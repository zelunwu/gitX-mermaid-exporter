(function githubContentScript() {
  "use strict";

  const API = globalThis.GitHubMermaidExporter;
  const VIEWSCREEN_ORIGIN = "https://viewscreen.githubusercontent.com";
  const frames = new Map();
  const pendingBatches = new Map();
  let previousUrl = location.href;

  function viewscreenFrames() { return API.page.findViewscreenFrames(document); }
  function context() { return API.filename.parseGitHubContext(location.href); }
  function postToFrame(frame, message) {
    frame.contentWindow?.postMessage({ source: "github-mermaid-exporter", ...message }, VIEWSCREEN_ORIGIN);
  }

  function updateFrameContexts() {
    let startIndex = 1;
    viewscreenFrames().forEach((frame) => {
      const state = frames.get(frame.contentWindow) || { count: 0, ready: false };
      postToFrame(frame, { type: "gme:context", context: context(), startIndex });
      startIndex += Math.max(1, state.count);
    });
  }

  function synchronize() {
    const current = viewscreenFrames();
    current.forEach((frame) => {
      if (!frames.has(frame.contentWindow)) frames.set(frame.contentWindow, { count: 0, ready: false });
      postToFrame(frame, { type: "gme:ping" });
      if (!frame.dataset.gmeListening) {
        frame.dataset.gmeListening = "true";
        frame.addEventListener("load", () => {
          frames.set(frame.contentWindow, { count: 0, ready: false });
          postToFrame(frame, { type: "gme:ping" });
        });
      }
    });
    for (const frameWindow of frames.keys()) {
      if (!current.some((frame) => frame.contentWindow === frameWindow)) frames.delete(frameWindow);
    }
    updateFrameContexts();
  }

  async function waitForReadyFrames(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      synchronize();
      const current = viewscreenFrames();
      if (current.length && current.every((frame) => {
        const state = frames.get(frame.contentWindow);
        return state?.ready && state.count > 0;
      })) return current;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Timed out waiting for GitHub to render the Mermaid diagrams");
  }

  function waitForBatch(requestId, frameWindows, total, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingBatches.delete(requestId);
        reject(new Error("Timed out waiting for Mermaid downloads to start"));
      }, timeoutMs);
      pendingBatches.set(requestId, {
        remaining: new Set(frameWindows),
        resolve: () => { clearTimeout(timer); resolve(total); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
    });
  }

  async function exportAll() {
    const current = await waitForReadyFrames();
    const requestId = crypto.randomUUID();
    let startIndex = 1;
    let total = 0;
    const frameWindows = current.map((frame) => frame.contentWindow);
    current.forEach((frame) => { total += frames.get(frame.contentWindow).count; });
    const completion = waitForBatch(requestId, frameWindows, total);
    current.forEach((frame) => {
      const count = frames.get(frame.contentWindow).count;
      postToFrame(frame, { type: "gme:export-all", requestId, startIndex, context: context() });
      startIndex += count;
    });
    showToast(`Starting ${total} Mermaid SVG download${total === 1 ? "" : "s"}…`);
    await completion;
    return total;
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
      frames.set(event.source, { count: Math.max(0, Number(event.data.count) || 0), ready: true });
      updateFrameContexts();
    } else if (event.data.type === "gme:export-complete") {
      const batch = pendingBatches.get(event.data.requestId);
      if (!batch) return;
      batch.remaining.delete(event.source);
      if (!batch.remaining.size) {
        pendingBatches.delete(event.data.requestId);
        batch.resolve();
      }
    } else if (event.data.type === "gme:error") {
      const batch = pendingBatches.get(event.data.requestId);
      if (batch) {
        pendingBatches.delete(event.data.requestId);
        batch.reject(new Error(event.data.error || "Mermaid export failed"));
      }
      showToast(event.data.error || "Mermaid export failed", true);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "gme:download-failed") {
      showToast(message.error || "Download interrupted", true);
      return false;
    }
    if (message?.type !== "gme:export-all") return false;
    exportAll().then(
      (count) => sendResponse({ ok: true, count }),
      (error) => {
        showToast(error.message, true);
        sendResponse({ ok: false, error: error.message });
      }
    );
    return true;
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
