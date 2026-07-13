# 发布流程

仓库使用自定义发布脚本统一管理版本、发布 npm 包，并维护根目录 `CHANGELOG.md`。所有 `packages/*` 下 `private !== true` 的包都会作为发布包，发布版本以根目录 `package.json` 的 `version` 计算出的下一版本为准。

当前发布包包括：

- `@uni-pages-weave/core`
- `@uni-pages-weave/cli`

## npm 认证

发布使用 npm Granular Access Token。token 需要具备 `@uni-pages-weave` scope 或对应包的发布权限，并开启 Bypass 2FA。

通过 npm 全局或用户级配置提供 token，不读取 `NPM_TOKEN` 环境变量：

```sh
npm config set //registry.npmjs.org/:_authToken npm_xxx --location user
```

也可以直接编辑用户级 `.npmrc`，写入：

```ini
//registry.npmjs.org/:_authToken=npm_xxx
```

发布脚本会通过 `npm whoami --registry https://registry.npmjs.org/` 确认当前 npm 认证可用。

## 发布命令

运行：

```sh
npm run release
# yarn release
# pnpm run release
```

脚本会依次执行：

1. 扫描 `packages/*/package.json`，过滤 `private === true` 的包。
2. 校验发布包都属于 `@uni-pages-weave/*`，并配置了 npm registry 和 public access。
3. 运行无写入预检：格式检查、完整验证、版本同步检查。
4. 交互选择 `patch` / `minor` / `major`。
5. 根据根目录 `package.json.version` 计算下一版本。
6. 校验 npm 认证，并检查所有发布包的目标版本在 npm registry 中都不存在。
7. 快照根包和发布包的 `package.json`，进入可回滚发布准备阶段。
8. 将下一版本写入根包和所有发布包。
9. 同步发布包之间的非 `workspace:` 内部依赖版本；`workspace:*` 等 workspace 协议保持不变。
10. 创建根目录下的 `release-notes-<version>.md`。
11. 提示手动编辑该临时日志文件，回到终端按回车继续。
12. 重新构建发布产物，确保 `dist` 使用新版本号。
13. 运行版本同步检查。
14. 检查发布入口文件，并对 CLI bin 执行基础 smoke test。
15. 对每个发布包执行 `pnpm pack --dry-run`。
16. 逐个执行 `pnpm publish`。
17. 发布成功后读取临时日志，去掉 HTML 注释和空白。
18. 如果日志非空，将内容写入根目录 `CHANGELOG.md` 顶部。
19. 删除根目录下的 `release-notes-<version>.md`。

## 发布日志

临时日志文件为空时，本次版本认为没有重要改动，不更新 `CHANGELOG.md`。

临时日志非空时，脚本会按倒序把最新版本写在最上面：

```md
# Changelog

## 0.1.1

本次更新内容

## 0.1.0

历史内容
```

如果在 `pnpm publish` 开始前失败，脚本会恢复本次 release 改写的版本文件，并保留临时日志文件，方便修复后继续参考。

如果 `pnpm publish` 已经开始后失败，脚本不会自动回滚 npm 上已经发布的包，需要人工确认 npm registry 状态后继续处理。

## 注意事项

发布脚本不提供单包发布入口，避免破坏统一版本约束。发布前如果目标版本在任一发布包上已经存在，脚本会中止。
