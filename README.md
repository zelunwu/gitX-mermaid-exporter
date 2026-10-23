# gitX-mermaid-exporter

## Buy me a coffee

If gitX-mermaid-exporter saves you time, you can support its continued maintenance:

| Alipay | WeChat Pay | PayPal |
| :---: | :---: | :---: |
| <img src="docs/support/alipay.jpg" alt="Alipay donation QR code" width="220"> | <img src="docs/support/wechat.jpg" alt="WeChat Pay donation QR code" width="220"> | <img src="docs/support/paypal_code.jpg" alt="PayPal donation QR code" width="220"> |

## What it does

gitX-mermaid-exporter is a small Chrome Manifest V3 extension that exports Mermaid diagrams **already rendered by GitHub Viewscreen**. It does not parse Markdown or invoke Mermaid again, so exports preserve GitHub's current node positions, edges, text, colors, `viewBox`, and computed theme styles.

- Compact SVG and PNG controls appear at the upper-left of each rendered diagram, away from GitHub's own upper-right controls. PNG scale can be Auto or 1×–6×.
- Clicking the extension toolbar icon opens a picker. Choose exactly which diagrams to export and select SVG, PNG Auto, or a manual PNG scale for each one; nothing downloads until you confirm.
- Multiple diagrams, delayed rendering, GitHub SPA navigation, Viewscreen iframe reloads, and light/dark theme changes are supported.
- Filenames use `repository-Markdown-file-diagram-index.svg|png`, with safe fallbacks.
- Download and rendering failures are shown in the page and on the extension action badge instead of failing silently.

## Permissions and privacy

The extension requests only:

- `downloads`, to pass locally generated SVG/PNG data to Chrome's download manager;
- `https://github.com/*`, to identify page metadata and its Viewscreen frames;
- `https://viewscreen.githubusercontent.com/*`, to read GitHub's rendered SVG and add per-diagram controls.

There is no `<all_urls>`, remote code, CDN, telemetry, analytics, account system, external API, or upload path. Markdown, SVG, PNG, and private-repository content stay in the browser. The extension reuses the browser's existing GitHub session and never reads or stores credentials.

## Install and use

1. Download and unzip `gitX-mermaid-exporter-v0.3.3.zip`, or use the repository root. A packed `.crx` is also attached to releases for Chrome environments that permit off-store CRX installation.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted directory.
4. Open a GitHub Markdown page containing Mermaid diagrams.
5. Use the upper-left diagram controls for a single export, or click the extension toolbar icon to open the multi-diagram format picker.

## Why exports can differ from Mermaid CLI

This extension does not run Mermaid. GitHub Viewscreen lays out the diagram using GitHub's deployed Mermaid version, configuration, fonts, theme, container size, and security policy; the extension freezes that result. Mermaid CLI may use different versions, fonts, themes, dimensions, or configuration, producing different wrapping, node positions, and edges. That difference is why this extension reads GitHub's native SVG instead of rerendering it.

## Local verification and packaging

Node.js 20+ is required:

```sh
npm install
npm run verify
npm run test:chromium
npm run package
npm run package:crx
```

The local ZIP and CRX are written to `dist/` and contain only runtime extension files plus the license. CRX packaging retains its signing key under the ignored `dist/.keys/` directory; the private `.pem` is never committed or published. Tests and packaging run locally; the project does not depend on paid GitHub Actions.

## Known limitations and manual acceptance

- Only `github.com` is supported; GitHub Enterprise Server and other hosts are out of scope.
- Standard consumer Chrome builds may block CRX installation outside the Chrome Web Store; use the ZIP with **Load unpacked** when that platform policy applies.
- A future GitHub change to the Viewscreen origin or DOM may require selector updates.
- PNG crops to the rendered SVG content bounds, preserves its aspect ratio, and fills the current Viewscreen background. Auto scale targets a readable output width while respecting Canvas side and pixel limits; manual 1×–6× choices report a clear error if the requested size is unsafe.
- Automated fixtures cover SVG `foreignObject` labels, delayed SVGs, multiple diagrams, mixed-format picker exports, dark/light backgrounds, viewBox-only or missing dimensions, SPA navigation, and iframe replacement.
- Before release, manually verify in a real signed-in private GitHub repository: individual SVG and PNG, picker selection and mixed formats, theme switching, export after navigation, reparsing exported files, and absence of extension controls. Fixture coverage is not claimed as real private-GitHub acceptance.

## License

[MIT](LICENSE)
