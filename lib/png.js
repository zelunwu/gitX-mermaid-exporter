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

  function safeScaleLimit(width, height) {
    const sideLimit = Math.floor(32767 / Math.max(width, height));
    const areaLimit = Math.floor(Math.sqrt(128000000 / (width * height)));
    return Math.min(6, sideLimit, areaLimit);
  }

  function autoScale(width, height) {
    const clarityScale = Math.max(2, Math.ceil(3200 / width));
    return Math.min(6, clarityScale, safeScaleLimit(width, height));
  }

  function rasterPlan(options) {
    const sourceWidth = Math.max(1, Number(options.width) || 1);
    const sourceHeight = Math.max(1, Number(options.height) || 1);
    // GitHub's own viewBox is authoritative and includes branches that browser
    // geometry APIs can miss (for example long labelled/dashed Mermaid edges).
    // Computed content bounds are only a fallback for SVGs without a viewBox.
    const cropBox = options.viewBox || options.contentBox || null;
    const logicalWidth = sourceWidth;
    const logicalHeight = cropBox?.width > 0 && cropBox?.height > 0
      ? sourceWidth * cropBox.height / cropBox.width
      : sourceHeight;
    const limit = safeScaleLimit(logicalWidth, logicalHeight);
    if (limit < 1) {
      throw new Error("This diagram is too large for a single PNG even at 1×; export SVG instead");
    }
    const requested = options.scale === "auto" || options.scale == null
      ? autoScale(logicalWidth, logicalHeight)
      : Math.floor(Number(options.scale));
    if (!Number.isFinite(requested) || requested < 1 || requested > 6) {
      throw new Error("PNG scale must be Auto or an integer from 1× to 6×");
    }
    if (requested > limit) {
      throw new Error(`This diagram is too large for ${requested}× PNG; choose ${limit}× or lower`);
    }
    return {
      cropBox,
      scale: requested,
      ...dimensions(logicalWidth, logicalHeight, requested)
    };
  }

  function normalizeRootLayout(svg, width, height) {
    const pageLayoutProperties = [
      "margin", "margin-block", "margin-block-start", "margin-block-end",
      "margin-inline", "margin-inline-start", "margin-inline-end",
      "margin-top", "margin-right", "margin-bottom", "margin-left",
      "inset", "inset-block", "inset-inline", "top", "right", "bottom", "left",
      "position", "float", "clear",
      "width", "height", "inline-size", "block-size",
      "min-width", "min-height", "min-inline-size", "min-block-size",
      "max-width", "max-height", "max-inline-size", "max-block-size",
      "transform", "transform-origin", "translate", "rotate", "scale", "zoom"
    ];
    pageLayoutProperties.forEach((property) => svg.style.removeProperty(property));
    // The serialized root is now a standalone image, not a box in GitHub's page.
    // Attributes and the viewBox own its geometry; page centering must not shift pixels.
    svg.style.setProperty("display", "block");
    svg.style.setProperty("margin", "0");
    svg.style.setProperty("width", `${width}px`);
    svg.style.setProperty("height", `${height}px`);
  }

  function prepareSvg(serialized, document, plan) {
    const Parser = document.defaultView.DOMParser;
    const Serializer = document.defaultView.XMLSerializer;
    const parsed = new Parser().parseFromString(serialized, "image/svg+xml");
    if (parsed.querySelector("parsererror")) throw new Error("The rendered SVG could not be parsed for PNG export");
    const svg = parsed.documentElement;
    if (plan.cropBox) {
      const box = plan.cropBox;
      svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    }
    svg.setAttribute("width", String(plan.logicalWidth));
    svg.setAttribute("height", String(plan.logicalHeight));
    normalizeRootLayout(svg, plan.logicalWidth, plan.logicalHeight);
    return new Serializer().serializeToString(svg);
  }

  async function rasterize(serialized, options) {
    const { document, background } = options;
    const plan = rasterPlan(options);
    const rasterSvg = prepareSvg(serialized, document, plan);
    // A blob URL containing SVG foreignObject taints Chromium canvases. A local data URL
    // preserves the same serialized SVG without network access and remains origin-clean.
    const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rasterSvg)}`;
    const image = await loadImage(document.defaultView, imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = plan.pixelWidth;
    canvas.height = plan.pixelHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.setTransform(plan.scale, 0, 0, plan.scale, 0, 0);
    context.fillStyle = background || "rgb(255, 255, 255)";
    context.fillRect(0, 0, plan.logicalWidth, plan.logicalHeight);
    context.drawImage(image, 0, 0, plan.logicalWidth, plan.logicalHeight);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      scale: plan.scale,
      width: plan.pixelWidth,
      height: plan.pixelHeight
    };
  }

  function loadImage(view, url) {
    return new Promise((resolve, reject) => {
      const image = new view.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The GitHub SVG could not be converted to PNG"));
      image.src = url;
    });
  }

  return {
    autoScale, backgroundFor, dimensions, isTransparent, normalizeRootLayout,
    prepareSvg, rasterize, rasterPlan, safeScaleLimit
  };
});
