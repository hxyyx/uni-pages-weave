# Scripts

本文面向维护者，说明根目录 npm 脚本、`scripts/` 目录下维护脚本的职责，以及发布流程。

## 脚本总览

根目录脚本可通过 npm、yarn 或 pnpm 运行：

```sh
npm run <script>
# yarn <script>
# pnpm run <script>
```

| 类别     | 脚本                                                              | 用途                         |
| -------- | ----------------------------------------------------------------- | ---------------------------- |
| 本地检查 | `build`、`lint`、`verify`                                         | 构建、lint、发布前完整预检。 |
| 测试     | `test`、`test:unit`、`test:integration`、`test:e2e`、`test:clear` | 运行和清理测试。             |
| 格式化   | `format`、`format:check`                                          | 写入或检查 Prettier 格式。   |
| 发布辅助 | `package:check`、`pack:dry`、`smoke:cli`、`release`               | 校验和发布当前包。           |

## 本地开发检查

| 脚本     | npm              | yarn          | pnpm              | 说明                                                      |
| -------- | ---------------- | ------------- | ----------------- | --------------------------------------------------------- |
| `build`  | `npm run build`  | `yarn build`  | `pnpm run build`  | 构建当前包的 `dist` 产物。                                |
| `lint`   | `npm run lint`   | `yarn lint`   | `pnpm run lint`   | 对 `src` 和 `scripts` 运行 ESLint。                       |
| `verify` | `npm run verify` | `yarn verify` | `pnpm run verify` | 运行构建、lint、包元数据检查、CLI smoke 和 dry-run 打包。 |

`verify` 是发布前的主检查脚本；如果只是验证测试矩阵，使用 `test`。

## 测试与格式化

| 脚本               | npm                        | yarn                    | pnpm                        | 说明                                            |
| ------------------ | -------------------------- | ----------------------- | --------------------------- | ----------------------------------------------- |
| `test`             | `npm run test`             | `yarn test`             | `pnpm run test`             | 顺序运行单元测试、集成测试和 e2e 测试。         |
| `test:unit`        | `npm run test:unit`        | `yarn test:unit`        | `pnpm run test:unit`        | 运行 `tests/unit/**/*.test.ts`。                |
| `test:integration` | `npm run test:integration` | `yarn test:integration` | `pnpm run test:integration` | 运行集成测试入口 `tests/integration/test.mjs`。 |
| `test:e2e`         | `npm run test:e2e`         | `yarn test:e2e`         | `pnpm run test:e2e`         | 运行 e2e 测试入口 `tests/e2e/test.mjs`。        |
| `test:clear`       | `npm run test:clear`       | `yarn test:clear`       | `pnpm run test:clear`       | 清理测试生成内容。                              |
| `format`           | `npm run format`           | `yarn format`           | `pnpm run format`           | 使用 Prettier 写入格式化结果。                  |
| `format:check`     | `npm run format:check`     | `yarn format:check`     | `pnpm run format:check`     | 检查格式化状态。                                |

当前格式化范围是 `src/**/*.{js,mjs,cjs,ts,tsx,json,md}` 和 `scripts/**/*.mjs`，不包含根 README 和 `docs/`。

## 发布前检查

| 脚本            | npm                     | yarn                 | pnpm                     | 说明                                            |
| --------------- | ----------------------- | -------------------- | ------------------------ | ----------------------------------------------- |
| `package:check` | `npm run package:check` | `yarn package:check` | `pnpm run package:check` | 检查单包发布元数据、入口文件和 workspace 残留。 |
| `smoke:cli`     | `npm run smoke:cli`     | `yarn smoke:cli`     | `pnpm run smoke:cli`     | 检查 `upw --version` 和 `upw --help`。          |
| `pack:dry`      | `npm run pack:dry`      | `yarn pack:dry`      | `pnpm run pack:dry`      | 执行 `pnpm pack --dry-run`。                    |
| `release`       | `npm run release`       | `yarn release`       | `pnpm run release`       | 交互选择 SemVer 级别，验证并发布当前包。        |

## 脚本文件职责

| 文件                | 职责                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `check-package.mjs` | 校验单包发布元数据、入口文件、`files` 配置、CLI bin 和 workspace 残留。 |
| `release.mjs`       | 管理版本号、发布预检、临时发布日志、CHANGELOG 更新和 npm 发布。         |

## 发布流程

仓库使用自定义发布脚本管理版本、发布 npm 包，并维护根目录 `CHANGELOG.md`。当前仓库是单包结构，发布版本以根目录 `package.json` 的 `version` 计算出的下一版本为准。

当前发布包包括：

- `uni-pages-weave`

### npm 认证

发布使用 npm Granular Access Token。token 需要具备 `uni-pages-weave` 包的发布权限，并开启 Bypass 2FA。

通过 npm 全局或用户级配置提供 token，不读取 `NPM_TOKEN` 环境变量：

```sh
npm config set //registry.npmjs.org/:_authToken npm_xxx --location user
```

也可以直接编辑用户级 `.npmrc`，写入：

```ini
//registry.npmjs.org/:_authToken=npm_xxx
```

发布脚本会通过 `npm whoami --registry https://registry.npmjs.org/` 确认当前 npm 认证可用。

### 发布命令

运行：

```sh
npm run release
# yarn release
# pnpm run release
```

脚本会依次执行：

1. 校验根包名、发布状态、CLI bin、npm registry 和 public access。
2. 运行无写入预检：格式检查和 `pnpm run verify`。
3. 交互选择 `patch` / `minor` / `major`。
4. 根据根目录 `package.json.version` 计算下一版本。
5. 校验 npm 认证，并检查目标版本在 npm registry 中不存在。
6. 快照根包 `package.json`，进入可回滚发布准备阶段。
7. 将下一版本写入根包。
8. 创建根目录下的 `release-notes-<version>.md`。
9. 提示手动编辑该临时日志文件，回到终端按回车继续。
10. 重新构建发布产物，确保 `dist` 使用新版本号。
11. 运行包元数据检查和 CLI smoke test。
12. 执行 `pnpm pack --dry-run`。
13. 执行 `pnpm publish --access public --registry https://registry.npmjs.org/ --no-git-checks`。
14. 发布成功后读取临时日志，去掉 HTML 注释和空白。
15. 如果日志非空，将内容写入根目录 `CHANGELOG.md` 顶部。
16. 删除根目录下的 `release-notes-<version>.md`。

## 失败恢复和注意事项

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

发布脚本不提供单包发布入口，避免破坏统一版本约束。发布前如果目标版本在 npm registry 上已经存在，脚本会中止。
