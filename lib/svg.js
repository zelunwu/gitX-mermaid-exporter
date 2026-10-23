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

  function unionBox(left, right) {
    if (!left) return right;
    if (!right) return left;
    const x = Math.min(left.x, right.x);
    const y = Math.min(left.y, right.y);
    const farX = Math.max(left.x + left.width, right.x + right.width);
    const farY = Math.max(left.y + left.height, right.y + right.height);
    return { x, y, width: farX - x, height: farY - y };
  }

  function visualDescendantBox(source) {
    const view = source.ownerDocument?.defaultView;
    const matrix = source.getScreenCTM?.();
    if (!matrix || !view?.DOMPoint) return null;
    let inverse;
    try {
      inverse = matrix.inverse();
    } catch {
      return null;
    }
    let result = null;
    for (const element of source.querySelectorAll("*:not(style):not(defs)")) {
      if (element.closest("[data-gme-ui]") || element.closest("defs")) continue;
      const rect = element.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      const points = [
        new view.DOMPoint(rect.left, rect.top),
        new view.DOMPoint(rect.right, rect.top),
        new view.DOMPoint(rect.right, rect.bottom),
        new view.DOMPoint(rect.left, rect.bottom)
      ].map((point) => point.matrixTransform(inverse));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      result = unionBox(result, {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      });
    }
    return result;
  }

  function geometryFor(source) {
    const viewBox = parseViewBox(source.getAttribute("viewBox"));
    const bounds = source.getBoundingClientRect?.() || { width: 0, height: 0 };
    let contentBox = null;
    if (typeof source.getBBox === "function") {
      try {
        const box = unionBox(source.getBBox(), visualDescendantBox(source));
        if (box && box.width > 0 && box.height > 0) {
          const padding = Math.max(6, Math.min(24, Math.min(box.width, box.height) * 0.02));
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
    return {
      width: Math.max(1, width),
      height: Math.max(1, height),
      viewBox: effectiveViewBox,
      originalViewBox: viewBox,
      contentBox
    };
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
      viewBox: geometry.viewBox,
      contentBox: geometry.contentBox
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

  return { geometryFor, parseViewBox, serializeSvg, toSvgDataUrl, unionBox, visualDescendantBox };
});
