# 发布流程

仓库使用 changesets 收集变更说明，并通过自定义发布脚本统一管理版本。所有 workspace 包始终使用同一个版本号，并默认一起发布：

- `@uni-pages-weave/core`
- `@uni-pages-weave/cli`
- `@uni-pages-weave/vite`
- `@uni-pages-weave/webpack`

## 准备 changeset

有面向用户的变更时，先创建 changeset 风格的变更说明文件：

```sh
npm run changeset:add
```

脚本会在 `.changeset/` 下生成 Markdown 文件，并自动写入全部发布包。只需要编辑正文变更说明，不需要选择包，也不需要选择版本级别。

发布时如果没有 pending changeset，或变更说明正文为空，流程会中止。

## 快速发布

常规发布使用：

```sh
npm run release:quick
```

脚本会先运行完整验证，然后交互选择本次发布的 SemVer 级别：

- `patch`：修复或小改动。
- `minor`：向后兼容的新能力。
- `major`：破坏性变更。

选择后脚本会把所有 pending changeset 统一改成本次选择的版本级别，调用 changesets 插件生成日志内容，并聚合写入根目录 `CHANGELOG.md`。

## 准备发布

如果需要先生成版本和 changelog，人工确认后再发布：

```sh
npm run release:prepare
```

确认无误后运行：

```sh
npm run release:publish
```

## 默认发布命令

`release` 等同于快速发布：

```sh
npm run release
```

发布流程不提供单包选择入口，避免破坏所有包版本一致的约束。
