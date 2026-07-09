# 开发脚本

本文记录仓库根目录的常用脚本。脚本通过 npm 运行：

```sh
npm run <script>
```

## 质量检查

| 脚本             | 说明                                    |
| ---------------- | --------------------------------------- |
| `npm run build`  | 构建所有 workspace 包。                 |
| `npm run lint`   | 对所有 workspace 包运行 ESLint。        |
| `npm run test`   | 顺序运行单元测试、集成测试和 e2e 测试。 |
| `npm run verify` | 运行 `build`、`lint` 和完整测试。       |

## 测试

| 脚本                       | 说明                                            |
| -------------------------- | ----------------------------------------------- |
| `npm run test:unit`        | 运行 `tests/unit/**/*.test.ts`。                |
| `npm run test:integration` | 运行集成测试入口 `tests/integration/test.mjs`。 |
| `npm run test:e2e`         | 运行 e2e 测试入口 `tests/e2e/test.mjs`。        |
| `npm run test:clear`       | 清理测试生成内容。                              |

## 格式化

| 脚本                   | 说明                           |
| ---------------------- | ------------------------------ |
| `npm run format`       | 使用 Prettier 写入格式化结果。 |
| `npm run format:check` | 检查格式化状态。               |

当前格式化范围是 `packages/*/src/**/*.{js,mjs,cjs,ts,tsx,json,md}`，不包含根 README 和 `docs/`。

## 版本与发布辅助

| 脚本                      | 说明                                      |
| ------------------------- | ----------------------------------------- |
| `npm run changeset:add`   | 创建 changeset。                          |
| `npm run changelog`       | 根据 changeset 更新版本和 changelog。     |
| `npm run release:prepare` | 先运行 `verify`，再执行 `changelog`。     |
| `npm run release:publish` | 执行 `changeset publish`。                |
| `npm run release`         | 先运行 `verify`，再发布所有待发布包。     |
| `npm run release:package` | 交互式选择一个可发布 workspace 包并发布。 |

发布细节见 [发布流程](./release.md)。
