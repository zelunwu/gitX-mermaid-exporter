(function initPng(root, factory) {
  const api = factory();
  root.GitXMermaidExporter = root.GitXMermaidExporter || {};
  root.GitXMermaidExporter.png = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis, function pngFactory() {
  "use strict";

  function isTransparent(color) {
    return !color || color === "transparent" || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(color);
  }

  function backgroundFor(source) {
    const view = source.ownerDocument.defaultView;
    let element = source;
    while (element) {
      const color = view.getComputedStyle(element).backgroundColor;
      if (!isTransparent(color)) return color;
      element = element.parentElement;
    }
    const mode = source.ownerDocument.documentElement.getAttribute("data-color-mode");
    return mode === "dark" ? "rgb(13, 17, 23)" : "rgb(255, 255, 255)";
  }

  function dimensions(width, height, scale = 2) {
    return {
      logicalWidth: Math.max(1, Number(width) || 1),
      logicalHeight: Math.max(1, Number(height) || 1),
      pixelWidth: Math.max(1, Math.ceil((Number(width) || 1) * scale)),
      pixelHeight: Math.max(1, Math.ceil((Number(height) || 1) * scale))
    };
  }

  async function rasterize(serialized, options) {
    const { document, width, height, background, scale = 2 } = options;
    const size = dimensions(width, height, scale);
    // A blob URL containing SVG foreignObject taints Chromium canvases. A local data URL
    // preserves the same serialized SVG without network access and remains origin-clean.
    const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    const image = await loadImage(document.defaultView, imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = size.pixelWidth;
    canvas.height = size.pixelHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = background || "rgb(255, 255, 255)";
    context.fillRect(0, 0, size.logicalWidth, size.logicalHeight);
    context.drawImage(image, 0, 0, size.logicalWidth, size.logicalHeight);
    return canvas.toDataURL("image/png");
  }

  function loadImage(view, url) {
    return new Promise((resolve, reject) => {
      const image = new view.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The GitHub SVG could not be converted to PNG"));
      image.src = url;
    });
  }

  return { backgroundFor, dimensions, isTransparent, rasterize };
});
