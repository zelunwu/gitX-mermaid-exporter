# Chrome Web Store Listing

## Product details

- **Name:** gitX Mermaid Exporter
- **Primary language:** English
- **Category:** Developer Tools
- **Homepage:** https://github.com/zelunwu/gitX-mermaid-exporter
- **Support:** https://github.com/zelunwu/gitX-mermaid-exporter/issues
- **Privacy policy:** https://github.com/zelunwu/gitX-mermaid-exporter/blob/main/PRIVACY.md

### Short description

Export Mermaid diagrams exactly as rendered by GitHub Viewscreen.

### Detailed description

Export Mermaid diagrams from GitHub Markdown pages without rerunning Mermaid or changing their layout.

gitX Mermaid Exporter reads the SVG already rendered by GitHub Viewscreen, preserving the current node positions, edges, text, colors, viewBox, and light or dark theme. Export one diagram from its upper-left controls, or use the extension toolbar to choose multiple diagrams and formats before downloading.

Features:

- Export the current GitHub-rendered diagram as native SVG.
- Export an adaptively cropped PNG using Auto or a manual 1x-6x scale.
- Select individual diagrams and formats for a batch export.
- Handle multiple diagrams, delayed rendering, SPA navigation, iframe reloads, and theme changes.
- Generate safe filenames from the repository, Markdown filename, and diagram index.
- Work with public and private GitHub repositories through the user's existing browser session.

All processing stays in the browser. The extension does not upload Markdown, SVG, PNG, repository content, or usage data. It contains no telemetry, analytics, advertising, account system, remote service, CDN, or remote code.

This is an independent extension and is not affiliated with or endorsed by GitHub or the Mermaid project.

## Privacy practices

### Single purpose

Export Mermaid diagrams already rendered on GitHub Markdown pages as SVG or PNG files, individually or in user-selected batches.

### Permission justifications

**downloads**

Saves SVG and PNG files generated locally after the user explicitly requests an export.

**Host permission: `https://github.com/*`**

Discovers GitHub Viewscreen diagram frames, reads current-page repository and Markdown filename metadata for local filenames, and displays the user-initiated export picker.

**Host permission: `https://viewscreen.githubusercontent.com/*`**

Reads Mermaid SVGs already rendered by GitHub Viewscreen and adds per-diagram export controls. Diagram content is processed locally and is not transmitted externally.

### Data handling disclosure

The extension handles website content and the current GitHub page URL locally to provide its export feature. It does not collect data on a developer-operated server, transmit data to third parties, retain browsing activity, sell data, use data for advertising, or allow human access to repository content.

Certify in the dashboard that data use is limited to the disclosed single purpose, is not sold or transferred, is not used for unrelated purposes or creditworthiness, and complies with the Chrome Web Store User Data Policy.

## Distribution

- **Visibility:** Public
- **Regions:** All regions, unless the developer chooses exclusions

## Reviewer notes

1. Open the extension's public repository homepage, which contains a Mermaid diagram under **Live demo**.
2. Wait for GitHub Viewscreen to render the diagram.
3. Use the upper-left SVG or PNG controls to export a single diagram.
4. Click the extension toolbar icon to open the picker, choose diagrams/formats, and confirm the batch export.
5. Confirm that downloaded SVG/PNG files open normally and contain no extension controls.

No account, setup, API key, external service, or payment is required. Private-repository support reuses the reviewer's existing GitHub browser session and is not required to verify the public demo.

## Graphic assets

- Store icon: `icons/icon-128.png`
- Screenshot: `docs/chrome-web-store/screenshot-1280x800.png`
- Small promotional tile: `docs/chrome-web-store/promo-440x280.png`
