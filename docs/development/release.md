# 发布流程

仓库使用 changesets 管理版本，workspace 包采用固定版本组：

- `@uni-pages-weave/core`
- `@uni-pages-weave/cli`
- `@uni-pages-weave/vite`
- `@uni-pages-weave/webpack`

## 准备 changeset

有面向用户的变更时，先创建 changeset：

```sh
npm run changeset:add
```

选择受影响的包和版本级别，并填写变更说明。

## 发布前检查

发布前运行完整验证：

```sh
npm run verify
```

该脚本会依次执行构建、lint、单元测试、集成测试和 e2e 测试。

## 生成版本变更

准备发布分支时运行：

```sh
npm run release:prepare
```

该脚本会先运行 `verify`，再通过 changesets 更新包版本和 changelog。

## 发布所有待发布包

确认版本变更无误后运行：

```sh
npm run release
```

`release` 会再次运行 `verify`，然后执行 `changeset publish`。

## 发布单个包

需要单独发布某个 workspace 包时：

```sh
npm run release:package
```

脚本会列出所有非 private workspace 包。选择包号后，它会先运行该包的构建，再执行：

```sh
npm publish --workspace <package-name> --access public --registry https://registry.npmjs.org/
```

这个路径适合补发单包；常规发布优先使用 changesets 流程。
