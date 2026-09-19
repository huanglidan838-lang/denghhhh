# 邓海玲 2026 交互作品集

一个以三维个人工作空间为入口的交互式作品集，涵盖视觉设计、品牌设计、长图设计、AIGC、手作与摄影项目。

## 在线访问

[deng-hailing-portfolio-2026.meitu-1775.chatgpt.site](https://deng-hailing-portfolio-2026.meitu-1775.chatgpt.site/)

无需原托管域名的 GitHub Pages 备用入口：
[huanglidan838-lang.github.io/denghhhh](https://huanglidan838-lang.github.io/denghhhh/)

## 本地运行

需要 Node.js 22.13 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

## 检查与构建

```bash
pnpm lint
pnpm test
pnpm check:assets
pnpm check:bundle
```

## 技术栈

- React 19
- Three.js
- vinext / Vite
- TypeScript

> 主站由支持 vinext Worker 构建的托管环境提供；GitHub Actions 会同时生成并发布纯静态备用版本。
