# Privacy Policy

Last updated: October 23, 2026

gitX Mermaid Exporter has one purpose: export Mermaid diagrams already rendered on GitHub Markdown pages as SVG or PNG files.

## Data the extension accesses

When the extension runs on a supported GitHub page, it may access:

- the current `github.com` page URL and visible repository/file metadata, solely to discover diagrams and create useful filenames;
- Mermaid SVG elements already rendered inside GitHub's `viewscreen.githubusercontent.com` frames;
- the rendered diagram's dimensions, styles, colors, text, theme background, and geometry needed to reproduce the visible result.

This can include content from a private GitHub repository when the user is already signed in and opens that repository in Chrome. The extension does not read passwords, authentication cookies, access tokens, or other login credentials.

## How data is used

The accessed data is used only inside the browser to:

- display export controls and the current-page export picker;
- serialize the selected rendered SVG;
- rasterize a selected SVG into PNG when requested;
- generate a local filename and pass the resulting file to Chrome's download manager.

## Collection, transmission, and retention

The extension does not transmit GitHub URLs, Markdown, SVG, PNG, repository content, or usage information to the developer or any third party. It has no developer-operated server, remote API, telemetry, analytics, advertising, account system, or remote code.

Diagram content is processed transiently in the browser and is not retained by the extension. Files explicitly exported by the user remain in the download location selected through Chrome. The extension does not use local storage, synchronized storage, cookies, or an external database.

## Sharing and sale

The extension does not sell, share, disclose, or transfer user data. It does not use user data for advertising, profiling, creditworthiness, lending, or any purpose unrelated to exporting the diagrams selected by the user. No human can access repository content through the extension.

## Permissions

- `downloads` is used only to save locally generated SVG and PNG files after a user requests an export.
- `https://github.com/*` is used to discover GitHub Viewscreen diagram frames, read current-page repository/file metadata, and display the export picker.
- `https://viewscreen.githubusercontent.com/*` is used to read GitHub's already-rendered Mermaid SVG and display per-diagram export controls.

The extension does not request `<all_urls>` or access sites outside these two GitHub origins.

## Limited Use

Use of data is limited to the extension's prominently disclosed, user-facing export feature. The extension's handling of user data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes

If the extension's data practices change, this policy and the Chrome Web Store disclosures will be updated before those changes are released.

## Contact

Questions or privacy concerns can be submitted through the project's public issue tracker:

https://github.com/zelunwu/gitX-mermaid-exporter/issues
