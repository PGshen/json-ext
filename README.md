# JSON-Ext

JSON-Ext 是一个面向开发者的 Chrome 扩展，用于查看、编辑与分析 JSON 数据。  
当前项目基于 `React + TypeScript + Vite + Manifest V3`。

## 功能概览

- 双入口：支持接口 JSON 自动接管与独立工作台模式。
- 双栏联动：左侧源数据，右侧节点详情与操作面板。
- 多视图：树形、纯文本、表格三种展示模式。
- 节点操作：`Format`、`Minify`、`Escape`、`Unescape`、`JSONPath Filter`。
- 递归子视图：反转义后可继续进入子层 JSON 并面包屑返回。

## 技术栈

- `React 19`
- `TypeScript`
- `Vite 8`
- `Vitest + Testing Library`
- `jsonpath-plus`
- `Chrome Extension Manifest V3`

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

### 3. 代码检查与测试

```bash
npm run lint
npm run test
```

## 构建与加载扩展

### 1. 构建产物

```bash
npm run build
```

构建完成后，产物位于 `dist/` 目录。

### 2. 在 Chrome 中加载

1. 打开 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目的 `dist/` 目录

## 常用脚本

- `npm run dev`：启动 Vite 开发服务
- `npm run build`：类型检查并打包
- `npm run preview`：预览构建结果
- `npm run lint`：运行 ESLint
- `npm run test`：启动 Vitest（watch 模式）
- `npm run test:run`：运行一次性测试

## 项目结构

```text
json-ext/
  docs/                # PRD 与技术方案文档
  public/              # 扩展清单与静态资源
  src/
    extension/         # background/content 等扩展入口代码
    test/              # 测试初始化
    App.tsx            # 主应用组件
    popup.tsx          # 扩展弹窗页面
  index.html           # 主工作台入口
  popup.html           # popup 入口
  vite.config.ts       # 构建与多入口配置
```

## 文档

- 产品需求：`docs/PRD-JSON-Ext-浏览器插件.md`
- 技术方案：`docs/技术方案与开发节奏.md`
