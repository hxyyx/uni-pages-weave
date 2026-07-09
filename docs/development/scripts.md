# 开发脚本

本文记录仓库根目录的常用脚本。脚本通过 pnpm 运行：

```sh
pnpm run <script>
```

## 质量检查

| 脚本              | 说明                                    |
| ----------------- | --------------------------------------- |
| `pnpm run build`  | 构建所有 workspace 包。                 |
| `pnpm run lint`   | 对所有 workspace 包运行 ESLint。        |
| `pnpm run test`   | 顺序运行单元测试、集成测试和 e2e 测试。 |
| `pnpm run verify` | 运行 `build`、`lint` 和完整测试。       |

## 测试

| 脚本                        | 说明                                            |
| --------------------------- | ----------------------------------------------- |
| `pnpm run test:unit`        | 运行 `tests/unit/**/*.test.ts`。                |
| `pnpm run test:integration` | 运行集成测试入口 `tests/integration/test.mjs`。 |
| `pnpm run test:e2e`         | 运行 e2e 测试入口 `tests/e2e/test.mjs`。        |
| `pnpm run test:clear`       | 清理测试生成内容。                              |

## 格式化

| 脚本                    | 说明                           |
| ----------------------- | ------------------------------ |
| `pnpm run format`       | 使用 Prettier 写入格式化结果。 |
| `pnpm run format:check` | 检查格式化状态。               |

当前格式化范围是 `packages/*/src/**/*.{js,mjs,cjs,ts,tsx,json,md}`，不包含根 README 和 `docs/`。

## 版本与发布辅助

| 脚本                     | 说明                                            |
| ------------------------ | ----------------------------------------------- |
| `pnpm run release`       | 交互选择 SemVer 级别，统一版本，验证并发布。    |
| `pnpm run version:check` | 检查根包和所有非 private workspace 包版本一致。 |

发布细节见 [发布流程](./release.md)。
