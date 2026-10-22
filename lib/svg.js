(function initSvg(root, factory) {
  const api = factory();
  root.GitXMermaidExporter = root.GitXMermaidExporter || {};
  root.GitXMermaidExporter.svg = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function svgFactory() {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  function parseViewBox(value) {
    const values = String(value || "").trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || values.some((item) => !Number.isFinite(item)) || values[2] <= 0 || values[3] <= 0) {
      return null;
    }
    return { x: values[0], y: values[1], width: values[2], height: values[3] };
  }

  function numericLength(value) {
    const match = String(value || "").trim().match(/^([0-9]+(?:\.[0-9]+)?)(?:px)?$/i);
    const number = match ? Number(match[1]) : 0;
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function geometryFor(source) {
    const viewBox = parseViewBox(source.getAttribute("viewBox"));
    const bounds = source.getBoundingClientRect?.() || { width: 0, height: 0 };
    let contentBox = null;
    if (!viewBox && typeof source.getBBox === "function") {
      try {
        const box = source.getBBox();
        if (box && box.width > 0 && box.height > 0) {
          const padding = 2;
          contentBox = {
            x: box.x - padding,
            y: box.y - padding,
            width: box.width + padding * 2,
            height: box.height + padding * 2
          };
        }
      } catch {
        // Detached or not-yet-rendered SVGs can reject getBBox(); rendered bounds remain a safe fallback.
      }
    }
    const effectiveViewBox = viewBox || contentBox;
    const width = bounds.width || numericLength(source.getAttribute("width")) || effectiveViewBox?.width || 1;
    const height = bounds.height || numericLength(source.getAttribute("height")) || effectiveViewBox?.height || 1;
    return { width: Math.max(1, width), height: Math.max(1, height), viewBox: effectiveViewBox, originalViewBox: viewBox };
  }

  function inlineComputedStyles(source, clone) {
    const view = source.ownerDocument?.defaultView;
    if (!view?.getComputedStyle) return;
    const sources = [source, ...source.querySelectorAll("*")];
    const clones = [clone, ...clone.querySelectorAll("*")];
    sources.forEach((element, index) => {
      const target = clones[index];
      const computed = view.getComputedStyle(element);
      for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex += 1) {
        const property = computed[propertyIndex];
        const value = computed.getPropertyValue(property);
        if (value) target.style.setProperty(property, value, computed.getPropertyPriority(property));
      }
    });
  }

  function serializeSvg(source, options = {}) {
    if (!source || source.namespaceURI !== SVG_NS) throw new Error("A rendered SVG element is required");
    const clone = source.cloneNode(true);
    if (clone.lookupNamespaceURI(null) !== SVG_NS) clone.setAttribute("xmlns", SVG_NS);
    if (clone.querySelector("[xlink\\:href]") && clone.lookupNamespaceURI("xlink") !== XLINK_NS) {
      clone.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", XLINK_NS);
    }
    if (options.inlineStyles !== false) inlineComputedStyles(source, clone);
    clone.querySelectorAll("[data-gme-ui]").forEach((element) => element.remove());

    const geometry = geometryFor(source);
    const width = source.getAttribute("width");
    const height = source.getAttribute("height");
    if (!numericLength(width)) clone.setAttribute("width", String(Math.ceil(geometry.width)));
    if (!numericLength(height)) clone.setAttribute("height", String(Math.ceil(geometry.height)));
    if (!clone.getAttribute("viewBox")) {
      const box = geometry.viewBox || { x: 0, y: 0, width: geometry.width, height: geometry.height };
      clone.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    }

    const Serializer = source.ownerDocument.defaultView.XMLSerializer;
    const body = new Serializer().serializeToString(clone);
    return {
      text: `<?xml version="1.0" encoding="UTF-8"?>\n${body}`,
      width: geometry.width,
      height: geometry.height,
      viewBox: geometry.viewBox
    };
  }

  function toSvgDataUrl(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  }

  return { geometryFor, parseViewBox, serializeSvg, toSvgDataUrl };
});
