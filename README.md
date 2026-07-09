# uni-pages-weave

## 简介

uni-pages-weave 是 uni-app `pages.json` 的多文件配置组织方案。

## 快速开始

安装 CLI：

```sh
npm install -D @uni-pages-weave/cli
# yarn add -D @uni-pages-weave/cli
# pnpm add -D @uni-pages-weave/cli
```

从现有 `pages.json` 初始化 upw 配置：

```sh
npm exec -- upw init
# yarn upw init
# pnpm exec upw init
```

生成 `pages.json`：

```sh
npm exec -- upw build
# yarn upw build
# pnpm exec upw build
```

开发时监听 upw 文件并自动生成 `pages.json`：

```sh
npm exec -- upw build --watch
# yarn upw build --watch
# pnpm exec upw build --watch
```

## CLI

`@uni-pages-weave/cli` 提供 `upw` 命令。

### 项目支持

支持 2 种目录结构的 uni-app 项目：

| 项目形态       | 读取和输出位置   |
| -------------- | ---------------- |
| CLI 项目       | `src/pages.json` |
| HBuilderX 项目 | `pages.json`     |

当 `src/pages.json` 和 `pages.json` 同时存在时，按 CLI 项目处理。

### `init`

从现有 `pages.json` 生成 upw 配置：

```sh
npm exec -- upw init
# yarn upw init
# pnpm exec upw init
```

`init` 会：

- 备份原文件为 `pages.json.bak`。
- 把应用配置、主包页面、分包页面拆成 upw 文件。
- 把应用首页路径记录为 `app.upw.json` 的 `homePath`。

初始化完成后的目录结构：

```text
.
├─ pages.json
├─ pages.json.bak
├─ app.upw.json
├─ pages/
│  ├─ index/
│  │  └─ index.upw.json
│  └─ account/
│     └─ profile/
│        └─ profile.upw.json
└─ platforms/
   └─ ...
```

`init` 会基于当前工作目录自动识别项目结构：CLI 项目默认在 `src` 目录下生成这些 upw 文件，HBuilderX 项目默认在项目根目录生成。

如果 upw 文件已存在，默认不会覆盖。需要重新生成时使用：

```sh
npm exec -- upw init --force
# yarn upw init --force
# pnpm exec upw init --force
```

参数：

| 参数          | 说明                                     |
| ------------- | ---------------------------------------- |
| `-f, --force` | 当 upw 工作区已存在时重新生成 upw 文件。 |

### `build`

从 upw 配置生成 `pages.json`：

```sh
npm exec -- upw build
# yarn upw build
# pnpm exec upw build
```

监听 upw 文件并在变化后生成 `pages.json`：

```sh
npm exec -- upw build --watch
# yarn upw build --watch
# pnpm exec upw build --watch
```

参数：

| 参数          | 说明                               |
| ------------- | ---------------------------------- |
| `-w, --watch` | 监听 upw 文件并生成 `pages.json`。 |

### 通用参数

```sh
npm exec -- upw --help
npm exec -- upw --version
# yarn upw --help
# yarn upw --version
# pnpm exec upw --help
# pnpm exec upw --version
```

| 参数            | 说明                |
| --------------- | ------------------- |
| `-h, --help`    | 查看帮助信息。      |
| `-V, --version` | 查看当前 CLI 版本。 |

## 相关文档

- [upw 规范](./docs/guide/upw-spec.md)
- [条件编译](./docs/guide/pages-json-conditions.md)
