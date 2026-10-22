(function githubContentScript() {
  "use strict";

  const API = globalThis.GitXMermaidExporter;
  const CHANNEL = "gitx-mermaid-exporter";
  const VIEWSCREEN_ORIGIN = "https://viewscreen.githubusercontent.com";
  const frames = new Map();
  const pendingExports = new Map();
  let previousUrl = location.href;

  function viewscreenFrames() { return API.page.findViewscreenFrames(document); }
  function context() { return API.filename.parseGitHubContext(location.href); }
  function postToFrame(frame, message) {
    frame.contentWindow?.postMessage({ source: CHANNEL, ...message }, VIEWSCREEN_ORIGIN);
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

  function diagramEntries(current) {
    const entries = [];
    let globalIndex = 1;
    current.forEach((frame) => {
      const count = frames.get(frame.contentWindow).count;
      for (let localIndex = 0; localIndex < count; localIndex += 1) {
        entries.push({ frame, localIndex, globalIndex });
        globalIndex += 1;
      }
    });
    return entries;
  }

  function waitForExport(requestId, frameWindows, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingExports.delete(requestId);
        reject(new Error("Timed out waiting for Mermaid downloads to start"));
      }, timeoutMs);
      pendingExports.set(requestId, {
        remaining: new Set(frameWindows),
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
    });
  }

  async function exportSelection(selections) {
    const requestId = crypto.randomUUID();
    const grouped = new Map();
    selections.forEach((selection) => {
      const list = grouped.get(selection.frame) || [];
      list.push({
        localIndex: selection.localIndex,
        globalIndex: selection.globalIndex,
        format: selection.format
      });
      grouped.set(selection.frame, list);
    });
    const completion = waitForExport(
      requestId,
      [...grouped.keys()].map((frame) => frame.contentWindow)
    );
    for (const [frame, items] of grouped) {
      postToFrame(frame, { type: "gme:export-selection", requestId, items, context: context() });
    }
    await completion;
  }

  function closePicker() {
    document.querySelector("[data-gme-picker]")?.remove();
  }

  function createPicker(entries) {
    closePicker();
    const overlay = document.createElement("div");
    overlay.dataset.gmePicker = "true";
    overlay.dataset.gmeUi = "true";
    overlay.innerHTML = `
      <section class="gme-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="gme-picker-title">
        <header><div><h2 id="gme-picker-title">Export Mermaid diagrams</h2><p>Choose diagrams and a format for each one.</p></div><button type="button" class="gme-picker-close" aria-label="Close">×</button></header>
        <div class="gme-picker-list"></div>
        <footer><button type="button" class="gme-picker-cancel">Cancel</button><button type="button" class="gme-picker-export">Export selected</button></footer>
      </section>`;
    const list = overlay.querySelector(".gme-picker-list");
    const rows = entries.map((entry) => {
      const row = document.createElement("label");
      row.className = "gme-picker-row";
      row.innerHTML = `<input type="checkbox" checked><span>Diagram ${entry.globalIndex}</span><select aria-label="Format for diagram ${entry.globalIndex}"><option value="svg">SVG</option><option value="png">PNG 2×</option></select>`;
      list.append(row);
      return { entry, row };
    });
    const cancel = () => closePicker();
    overlay.querySelector(".gme-picker-close").addEventListener("click", cancel);
    overlay.querySelector(".gme-picker-cancel").addEventListener("click", cancel);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) cancel(); });
    overlay.addEventListener("keydown", (event) => { if (event.key === "Escape") cancel(); });
    overlay.querySelector(".gme-picker-export").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const selections = rows.filter(({ row }) => row.querySelector("input").checked).map(({ entry, row }) => ({
        ...entry,
        format: row.querySelector("select").value
      }));
      if (!selections.length) {
        showToast("Select at least one diagram", true);
        return;
      }
      button.disabled = true;
      button.textContent = "Exporting…";
      try {
        await exportSelection(selections);
        closePicker();
        showToast(`Started ${selections.length} download${selections.length === 1 ? "" : "s"}`);
      } catch (error) {
        button.disabled = false;
        button.textContent = "Export selected";
        showToast(error.message || String(error), true);
      }
    });
    document.documentElement.append(overlay);
    overlay.querySelector(".gme-picker-export").focus();
  }

  async function openPicker() {
    const current = await waitForReadyFrames();
    const entries = diagramEntries(current);
    createPicker(entries);
    return entries.length;
  }

  function showToast(message, error = false) {
    document.querySelector("[data-gme-page-toast]")?.remove();
    const toast = document.createElement("div");
    toast.dataset.gmePageToast = "true";
    toast.textContent = message;
    toast.className = error ? "gme-page-toast gme-page-error" : "gme-page-toast";
    document.documentElement.append(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== VIEWSCREEN_ORIGIN || event.data?.source !== CHANNEL) return;
    const frame = viewscreenFrames().find((candidate) => candidate.contentWindow === event.source);
    if (!frame) return;
    if (event.data.type === "gme:ready") {
      frames.set(event.source, { count: Math.max(0, Number(event.data.count) || 0), ready: true });
      updateFrameContexts();
    } else if (event.data.type === "gme:export-complete") {
      const pending = pendingExports.get(event.data.requestId);
      if (!pending) return;
      pending.remaining.delete(event.source);
      if (!pending.remaining.size) {
        pendingExports.delete(event.data.requestId);
        pending.resolve();
      }
    } else if (event.data.type === "gme:error") {
      const pending = pendingExports.get(event.data.requestId);
      if (pending) {
        pendingExports.delete(event.data.requestId);
        pending.reject(new Error(event.data.error || "Mermaid export failed"));
      }
      showToast(event.data.error || "Mermaid export failed", true);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "gme:download-failed") {
      showToast(message.error || "Download interrupted", true);
      return false;
    }
    if (message?.type !== "gme:open-picker") return false;
    openPicker().then(
      (count) => sendResponse({ ok: true, count }),
      (error) => {
        showToast(error.message, true);
        sendResponse({ ok: false, error: error.message });
      }
    );
    return true;
  });

  API.page.createFrameMonitor(document, synchronize);
  window.addEventListener("popstate", () => { closePicker(); synchronize(); });
  document.addEventListener("turbo:load", () => { closePicker(); synchronize(); });
  document.addEventListener("pjax:end", () => { closePicker(); synchronize(); });
  setInterval(() => {
    if (location.href !== previousUrl) {
      previousUrl = location.href;
      closePicker();
      synchronize();
    }
  }, 1000);
  synchronize();
})();
