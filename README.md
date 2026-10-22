# GitHub Mermaid Exporter

[中文](#中文) · [English](#english)

## 中文

一个小型 Chrome Manifest V3 扩展，直接导出 GitHub Viewscreen **已经渲染完成**的 Mermaid SVG。扩展不会解析 Markdown，也不会调用 Mermaid 重新排版，因此能保留页面当前的节点位置、连线、文字、颜色、`viewBox` 和主题计算样式。

### 功能

- 每张 GitHub Mermaid 图右上角提供 **SVG** 和 **PNG 2×** 按钮。
- 点击扩展工具栏图标，将当前页面中的所有 Mermaid 图依次导出为 SVG。
- 支持同页多图、延迟渲染、GitHub SPA 导航、Viewscreen iframe 重载和明暗主题变化。
- 文件名格式为 `仓库-Markdown文件-diagram-序号.svg|png`，缺失信息会安全降级。
- 下载无法启动或中途失败时，在页面/图内提示，并在扩展图标显示 `ERR`。

### 权限与隐私边界

扩展只申请：

- `downloads`：把本地生成的 SVG/PNG 交给 Chrome 下载管理器；
- `https://github.com/*`：识别当前仓库、Markdown 文件和页面内 Viewscreen iframe；
- `https://viewscreen.githubusercontent.com/*`：读取 GitHub 已渲染的 SVG，并显示单图导出按钮。

没有 `<all_urls>`、远程代码、CDN、遥测、分析、账号、外部 API 或上传逻辑。Markdown、SVG 和 private 仓库内容均只在浏览器本地处理；扩展复用浏览器现有的 GitHub 登录会话，不读取或保存凭据。

### 安装与使用

1. 下载并解压发布 ZIP，或使用仓库根目录。
2. 打开 `chrome://extensions`，启用“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择解压目录。
4. 打开含 Mermaid 图的 GitHub Markdown 页面。
5. 用图上的按钮导出单图，或点击扩展工具栏图标批量导出 SVG。

### 为什么结果可能不同于 Mermaid CLI

本扩展不运行 Mermaid。GitHub Viewscreen 使用 GitHub 当前部署的 Mermaid 版本、配置、字体、主题和安全策略完成排版，本扩展只是固化并导出该结果。Mermaid CLI 可能使用不同版本、字体、主题、容器尺寸或配置，所以节点位置、换行和连线可能不同；这种差异正是本扩展读取 GitHub 原生 SVG、而不是重新渲染的原因。

### 本地验证与打包

需要 Node.js 20+：

```sh
npm install
npm run verify
npm run package
```

发布包生成到 `dist/github-mermaid-exporter-v0.1.0.zip`，只包含扩展运行文件和许可证。项目不使用付费 GitHub Actions；测试和打包均在本地执行。

### 已知限制与人工验收

- 仅支持 `github.com`，暂不支持 GitHub Enterprise Server 或其他站点。
- GitHub 若改变 Viewscreen iframe 域名或 DOM 结构，选择器可能需要更新。
- 2× PNG 使用 SVG 的 `viewBox` 尺寸（缺失时使用实际渲染尺寸），并填充 Viewscreen 当前背景。极端超大图可能触及浏览器 Canvas 尺寸/内存上限。
- 自动 fixture 覆盖延迟 SVG、多图、明暗背景、仅 `viewBox`/缺失尺寸、SPA 导航和 iframe 替换。发布前仍需在用户已登录的真实 private GitHub 仓库中人工确认：单图 SVG、单图 PNG、批量导出、主题切换、导航后再次导出、文件可重开且不含扩展按钮。自动测试不会冒充这一项真实验收。

### Buy me a coffee / 请我喝咖啡

如果这个项目帮到了你，可以选择支持后续维护。微信、支付宝和 PayPal 收款码/链接将在后续补充：

- WeChat / 微信：`TODO`
- Alipay / 支付宝：`TODO`
- PayPal：`TODO`

## English

A small Chrome Manifest V3 extension that exports Mermaid SVGs **already rendered** by GitHub Viewscreen. It neither parses Markdown nor invokes Mermaid, so the export preserves the page's current node positions, edges, text, colors, `viewBox`, and computed theme styles.

### Features

- **SVG** and **PNG 2×** controls on each GitHub Mermaid diagram.
- The extension toolbar action exports every Mermaid diagram on the current page as SVG.
- Handles multiple diagrams, delayed rendering, GitHub SPA navigation, Viewscreen iframe reloads, and light/dark theme changes.
- Filenames use `repository-Markdown-file-diagram-index.svg|png`, with safe fallbacks.
- Visible in-page errors and an `ERR` action badge when a download cannot start or is interrupted.

### Permissions and privacy boundary

The extension requests only:

- `downloads`, to hand locally generated SVG/PNG data to Chrome's download manager;
- `https://github.com/*`, to identify page metadata and its Viewscreen iframes;
- `https://viewscreen.githubusercontent.com/*`, to read GitHub's rendered SVG and add per-diagram controls.

There is no `<all_urls>`, remote code, CDN, telemetry, analytics, account system, external API, or upload path. Markdown, SVG, and private-repository content stay in the browser. The extension reuses the browser's existing GitHub session and never reads or stores credentials.

### Install and use

1. Download and unzip the release ZIP, or use the repository root.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted directory.
4. Open a GitHub Markdown page containing Mermaid diagrams.
5. Use a diagram button for one export, or the extension toolbar action for all SVGs.

### Why this can differ from Mermaid CLI

This extension does not run Mermaid. GitHub Viewscreen lays out the diagram using GitHub's deployed Mermaid version, configuration, fonts, theme, container size, and security policy; the extension freezes that result. Mermaid CLI may use different versions, fonts, themes, dimensions, or configuration, producing different wrapping, node positions, and edges. That difference is exactly why this extension reads GitHub's native SVG instead of rerendering it.

### Local verification and packaging

Node.js 20+ is required:

```sh
npm install
npm run verify
npm run package
```

The release archive is written to `dist/github-mermaid-exporter-v0.1.0.zip` and contains only runtime extension files plus the license. This project uses local tests and packaging, not paid GitHub Actions.

### Known limitations and manual acceptance

- Only `github.com` is supported; GitHub Enterprise Server and other hosts are out of scope.
- A future GitHub change to the Viewscreen origin or DOM may require selector updates.
- PNG uses 2× the SVG `viewBox` dimensions (or rendered dimensions when absent) and the current Viewscreen background. Extremely large diagrams can hit browser Canvas memory/size limits.
- Automated fixtures cover delayed SVGs, multiple diagrams, dark/light backgrounds, viewBox-only or missing dimensions, SPA navigation, and iframe replacement. Before release, manually verify in a real, signed-in private GitHub repository: single SVG, single PNG, batch SVG, theme switching, export after navigation, reparsing the files, and absence of extension controls. Fixture coverage is not claimed as real private-GitHub acceptance.

### Buy me a coffee

If this project helps you, you can support future maintenance. WeChat, Alipay, and PayPal codes/links will be added later:

- WeChat: `TODO`
- Alipay: `TODO`
- PayPal: `TODO`

## License

[MIT](LICENSE)
