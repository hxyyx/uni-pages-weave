# 开发脚本

本文记录仓库根目录的常用脚本。脚本可通过 npm、yarn 或 pnpm 运行：

```sh
npm run <script>
# yarn <script>
# pnpm run <script>
```

## 质量检查

| 脚本     | npm               | yarn          | pnpm             | 说明                                    |
| -------- | ----------------- | ------------- | ---------------- | --------------------------------------- |
| `build`  | `npm run build`   | `yarn build`  | `pnpm run build` | 构建所有 workspace 包。                 |
| `lint`   | `npm run lint`    | `yarn lint`   | `pnpm run lint`  | 对所有 workspace 包运行 ESLint。        |
| `test`   | `npm run test`    | `yarn test`   | `pnpm run test`  | 顺序运行单元测试、集成测试和 e2e 测试。 |
| `verify` | `npm run verify`  | `yarn verify` | `pnpm run verify` | 运行 `build`、`lint` 和完整测试。       |

## 测试

| 脚本               | npm                        | yarn                   | pnpm                       | 说明                                            |
| ------------------ | -------------------------- | ---------------------- | -------------------------- | ----------------------------------------------- |
| `test:unit`        | `npm run test:unit`        | `yarn test:unit`       | `pnpm run test:unit`       | 运行 `tests/unit/**/*.test.ts`。                |
| `test:integration` | `npm run test:integration` | `yarn test:integration` | `pnpm run test:integration` | 运行集成测试入口 `tests/integration/test.mjs`。 |
| `test:e2e`         | `npm run test:e2e`         | `yarn test:e2e`        | `pnpm run test:e2e`        | 运行 e2e 测试入口 `tests/e2e/test.mjs`。        |
| `test:clear`       | `npm run test:clear`       | `yarn test:clear`      | `pnpm run test:clear`      | 清理测试生成内容。                              |

## 格式化

| 脚本           | npm                    | yarn               | pnpm                  | 说明                           |
| -------------- | ---------------------- | ------------------ | --------------------- | ------------------------------ |
| `format`       | `npm run format`       | `yarn format`      | `pnpm run format`     | 使用 Prettier 写入格式化结果。 |
| `format:check` | `npm run format:check` | `yarn format:check` | `pnpm run format:check` | 检查格式化状态。               |

当前格式化范围是 `packages/*/src/**/*.{js,mjs,cjs,ts,tsx,json,md}`，不包含根 README 和 `docs/`。

## 版本与发布辅助

| 脚本            | npm                     | yarn                | pnpm                   | 说明                                            |
| --------------- | ----------------------- | ------------------- | ---------------------- | ----------------------------------------------- |
| `release`       | `npm run release`       | `yarn release`      | `pnpm run release`     | 交互选择 SemVer 级别，统一版本，验证并发布。    |
| `version:check` | `npm run version:check` | `yarn version:check` | `pnpm run version:check` | 检查根包和所有非 private workspace 包版本一致。 |

发布细节见 [发布流程](./release.md)。
