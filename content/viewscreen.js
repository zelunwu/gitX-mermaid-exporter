(function viewscreenContentScript() {
  "use strict";

  const API = globalThis.GitHubMermaidExporter;
  const GITHUB_ORIGIN = "https://github.com";
  const toolbars = new Map();
  let pageContext = {};
  let diagrams = [];

  function notifyParent(message) {
    if (window.parent !== window) {
      window.parent.postMessage({ source: "github-mermaid-exporter", ...message }, GITHUB_ORIGIN);
    }
  }

  function makeButton(label, title, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", () => action().catch(showError));
    return button;
  }

  function createToolbar(svg) {
    const toolbar = document.createElement("div");
    toolbar.className = "gme-toolbar";
    toolbar.dataset.gmeUi = "true";
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", "Export Mermaid diagram");
    toolbar.append(
      makeButton("SVG", "Export this GitHub-rendered SVG", () => exportOne(svg, "svg", diagramIndex(svg))),
      makeButton("PNG 2×", "Export this diagram as a 2× PNG", () => exportOne(svg, "png", diagramIndex(svg)))
    );
    document.documentElement.append(toolbar);
    toolbars.set(svg, toolbar);
    return toolbar;
  }

  function diagramIndex(svg) {
    return Math.max(1, diagrams.indexOf(svg) + 1);
  }

  function positionToolbars() {
    for (const [svg, toolbar] of toolbars) {
      if (!svg.isConnected) {
        toolbar.remove();
        toolbars.delete(svg);
        continue;
      }
      const bounds = svg.getBoundingClientRect();
      toolbar.style.top = `${Math.max(6, bounds.top + window.scrollY + 6)}px`;
      toolbar.style.left = `${Math.max(6, bounds.right + window.scrollX - toolbar.offsetWidth - 6)}px`;
      const background = API.png.backgroundFor(svg);
      toolbar.dataset.theme = /rgb\((?:[0-9]|[1-8][0-9]),/.test(background) ? "dark" : "light";
    }
  }

  function reconcile(next) {
    diagrams = next;
    for (const [svg, toolbar] of toolbars) {
      if (!diagrams.includes(svg)) {
        toolbar.remove();
        toolbars.delete(svg);
      }
    }
    diagrams.forEach((svg) => {
      if (!toolbars.has(svg)) createToolbar(svg);
    });
    positionToolbars();
    notifyParent({ type: "gme:ready", count: diagrams.length });
  }

  async function exportOne(svg, format, index) {
    if (!svg?.isConnected) throw new Error("GitHub's rendered Mermaid SVG is no longer available");
    const serialized = API.svg.serializeSvg(svg);
    const filename = API.filename.makeFilename(pageContext, index, format);
    const dataUrl = format === "png"
      ? await API.png.rasterize(serialized.text, {
          document,
          width: serialized.width,
          height: serialized.height,
          background: API.png.backgroundFor(svg),
          scale: 2
        })
      : API.svg.toSvgDataUrl(serialized.text);
    const response = await chrome.runtime.sendMessage({
      type: "gme:download", format, filename, dataUrl
    });
    if (!response?.ok) throw new Error(response?.error || "Chrome could not start the download");
    showToast(`Download started: ${filename}`);
  }

  async function exportAll(startIndex, context) {
    if (context) pageContext = context;
    const current = API.dom.findDiagrams(document);
    if (!current.length) throw new Error("GitHub's rendered Mermaid SVG is not ready");
    for (let index = 0; index < current.length; index += 1) {
      await exportOne(current[index], "svg", startIndex + index);
    }
  }

  function showToast(message, error = false) {
    document.querySelector(".gme-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = `gme-toast${error ? " gme-error" : ""}`;
    toast.dataset.gmeUi = "true";
    toast.textContent = message;
    document.documentElement.append(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function showError(error) {
    const message = error?.message || String(error);
    console.error("GitHub Mermaid Exporter:", error);
    showToast(message, true);
    notifyParent({ type: "gme:error", error: message });
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== GITHUB_ORIGIN || event.source !== window.parent || event.data?.source !== "github-mermaid-exporter") return;
    if (event.data.type === "gme:context") pageContext = event.data.context || {};
    if (event.data.type === "gme:ping") notifyParent({ type: "gme:ready", count: diagrams.length });
    if (event.data.type === "gme:export-all") {
      exportAll(Math.max(1, Number(event.data.startIndex) || 1), event.data.context).catch(showError);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "gme:download-failed") showError(new Error(message.error || "Download interrupted"));
  });

  const monitor = API.dom.createDiagramMonitor(document, reconcile);
  window.addEventListener("resize", positionToolbars);
  window.addEventListener("scroll", positionToolbars, { passive: true });
  window.addEventListener("load", monitor.scan);
})();
