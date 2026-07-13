# upw 规范

upw 在 uni-app `pages.json` 基础上定义了一套扩展配置规范，用独立的 `.upw.json` 文件维护应用配置、页面配置、分包关系和平台条件差异。

## 目录结构

| 路径                      | 作用                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `app.upw.json`            | 应用级配置，保存 `$upw.homePath`、`globalStyle`、`tabBar`、`easycom`、`subPackages` 等字段。 |
| `pages/**/*.upw.json`     | 普通页面和分包页面配置。                                                                |
| `platforms/**/*.upw.json` | `path` 以 `platforms/` 开头的页面配置，只透传 uni-app 页面字段，不声明 `$upw`。         |

- `pages` 不写在 `app.upw.json` 中，页面列表由页面级 `.upw.json` 文件生成。
- 分包页仍写成页面级 `.upw.json`，通过 `$upw.subPackageName` 关联到 `app.upw.json` 中的分包。
- 页面文件名应与 `path` 最后一段一致，例如 `pages/index/index` 对应 `pages/index/index.upw.json`。
- `app.upw.json` 中的分包字段使用 `subPackages`；分包页面列表由页面级 `.upw.json` 文件生成，不写在 `subPackages[].pages` 中。
- UPW 不维护 uni-app app/page 字段白名单。除 UPW 明确消费或生成的字段外，其余字段按 uni-app 或平台扩展配置原样透传。

## 数据模型

```ts
interface AppUpw {
  $upw?: AppMeta;
  subPackages?: Subpackage[];
  [uniAppField: string]: unknown;
}

interface AppMeta {
  homePath: string;
  patches?: ConditionalPatch[];
}

interface Subpackage {
  name: string;
  root: string;
  [uniSubpackageField: string]: unknown;
}

interface PageUpw {
  $upw?: PageMeta;
  path: string;
  style?: Record<string, unknown>;
  [uniPageField: string]: unknown;
}

interface PageMeta extends ConditionMeta {
  subPackageName?: string;
  patches?: ConditionalPatch[];
}

interface ConditionMeta {
  conditions?: ConditionLayer[];
  when?: string[];
  unless?: string[];
}

type ConditionLayer = { when: string[]; unless?: never } | { unless: string[]; when?: never };

interface ConditionalPatch extends ConditionMeta {
  patch: Record<string, unknown>;
  children?: ConditionalChildPatch[];
}

interface ConditionalChildPatch extends ConditionMeta {
  patch: Record<string, unknown>;
}
```

`[uniAppField]`、`[uniPageField]` 和 `[uniSubpackageField]` 表示 uni-app 原本支持的字段。`$upw` 是 upw 扩展配置，不会写入最终的 `pages.json`。

## 条件模型

`PageMeta`、`ConditionalPatch` 和 `ConditionalChildPatch` 都使用同一套条件字段。

| 字段         | 类型               | 必填 | 说明                                                                                   |
| ------------ | ------------------ | ---- | -------------------------------------------------------------------------------------- |
| `when`       | `string[]`         | 否   | 简单 `#ifdef` 条件。数组内多个平台是或关系，例如 `["app-plus", "h5"]` 会输出为 OR 条件。 |
| `unless`     | `string[]`         | 否   | 简单 `#ifndef` 条件。数组内多个平台是或关系。                                          |
| `conditions` | `ConditionLayer[]` | 否   | 有顺序的条件层，最多两层，用于表达嵌套条件或保留 `#ifdef` / `#ifndef` 的外内层关系。   |

- 简单条件只写 `when` 或 `unless` 其中一个。
- 需要同时满足多层条件时，使用 `conditions`，例如 `[{ "when": ["mp-weixin"] }, { "unless": ["vue3"] }]`。
- `conditions` 中每一层只能写 `when` 或 `unless` 其中一个，不能同时写。
- `conditions` 存在时不能同时写 `when` / `unless`。
- 平台名会规范化为小写；生成 `pages.json` 条件注释时会输出为大写。

## 应用配置

`app.upw.json` 保存应用级配置。首页由 `$upw.homePath` 指定，分包声明在 `subPackages` 中。

```json
{
  "$upw": {
    "homePath": "pages/index/index"
  },
  "globalStyle": {
    "navigationBarTitleText": "Demo"
  },
  "subPackages": [
    {
      "name": "account",
      "root": "pages/account"
    }
  ]
}
```

### AppUpw

| 字段            | 类型           | 必填 | 说明                                                                             |
| --------------- | -------------- | ---- | -------------------------------------------------------------------------------- |
| `$upw`          | `AppMeta`      | 是   | 应用级 upw 扩展配置，用于声明首页路径和应用级 `patches`。                        |
| `subPackages`   | `Subpackage[]` | 否   | 分包声明。`pages` 由 UPW 根据页面级文件生成，不支持手写。                         |
| `[uniAppField]` | `unknown`      | 否   | uni-app `pages.json` 支持的应用级字段，例如 `globalStyle`、`tabBar`、`easycom`。 |

### AppMeta

| 字段      | 类型                 | 必填 | 说明                                       |
| --------- | -------------------- | ---- | ------------------------------------------ |
| `homePath` | `string`             | 是   | 应用首页路径，必须指向主包页面。           |
| `patches` | `ConditionalPatch[]` | 否   | 应用级条件补丁，用于按平台调整应用级字段。 |

应用级 patch 允许修改或新增普通 app 输出字段。UPW 只限制自身管理的字段：`$upw`、`pages`、`subPackages` 不支持出现在应用级 patch 中。顶层 `homePath` 如果出现，会被视为普通 app 字段透传，不作为首页配置。

```json
{
  "$upw": {
    "homePath": "pages/index/index",
    "patches": [
      {
        "when": ["mp-weixin"],
        "patch": {
          "globalStyle": {
            "navigationBarTitleText": "微信小程序"
          }
        }
      }
    ]
  },
  "globalStyle": {
    "navigationBarTitleText": "Demo"
  }
}
```

### Subpackage

| 字段                   | 类型      | 必填 | 说明                                                                                                               |
| ---------------------- | --------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `name`                 | `string`  | 是   | 分包名称，页面通过 `$upw.subPackageName` 引用。从 `pages.json` 初始化时，如果原分包缺少 `name`，会用 `root` 补齐。 |
| `root`                 | `string`  | 是   | 分包根目录。                                                                                                       |
| `[uniSubpackageField]` | `unknown` | 否   | uni-app 分包对象支持的其他字段；分包页面不写在这里。                                                               |

## 页面配置

普通页面只需要声明 `path` 和 uni-app 页面字段：

```json
{
  "path": "pages/index/index",
  "style": {
    "navigationBarTitleText": "Home"
  }
}
```

### PageUpw

| 字段             | 类型                      | 必填 | 说明                                       |
| ---------------- | ------------------------- | ---- | ------------------------------------------ |
| `$upw`           | `PageMeta`                | 否   | 页面级 upw 扩展配置。                      |
| `path`           | `string`                  | 是   | 页面路径，文件名应与 `path` 最后一段一致。 |
| `style`          | `Record<string, unknown>` | 否   | 页面样式配置，按 uni-app 页面字段透传。    |
| `[uniPageField]` | `unknown`                 | 否   | uni-app 页面对象支持的其他字段。           |

### PageMeta

| 字段                             | 类型                 | 必填 | 说明                                         |
| -------------------------------- | -------------------- | ---- | -------------------------------------------- |
| `subPackageName`                 | `string`             | 否   | 把页面归入 `app.upw.json` 中同名分包。       |
| `when` / `unless` / `conditions` | 条件字段             | 否   | 页面级条件编译配置。                         |
| `patches`                        | `ConditionalPatch[]` | 否   | 页面字段级条件补丁，用于按平台调整页面配置。 |

页面级平台条件写在 `$upw.when`、`$upw.unless` 或 `$upw.conditions` 中：

```json
{
  "$upw": {
    "conditions": [{ "when": ["app-plus", "mp-weixin"] }, { "unless": ["vue3"] }]
  },
  "path": "pages/component/editor/editor",
  "style": {
    "navigationBarTitleText": "editor"
  }
}
```

分包页面通过 `$upw.subPackageName` 关联分包：

```json
{
  "$upw": {
    "subPackageName": "account"
  },
  "path": "pages/account/profile/profile",
  "style": {
    "navigationBarTitleText": "Profile"
  }
}
```

## 条件补丁

字段差异写在 `$upw.patches` 中，`patch` 使用与当前配置文件相同的字段路径。

### ConditionalPatch

| 字段                             | 类型                      | 必填 | 说明                                                              |
| -------------------------------- | ------------------------- | ---- | ----------------------------------------------------------------- |
| `when` / `unless` / `conditions` | 条件字段                  | 是   | 补丁生效条件，三者至少声明一种；简单条件只写 `when` 或 `unless`。 |
| `patch`                          | `Record<string, unknown>` | 是   | 要合并到应用或页面配置中的字段差异。                              |
| `children`                       | `ConditionalChildPatch[]` | 否   | 一层子条件补丁，仅顶层 `patches[]` 项可以声明。                   |

```json
{
  "$upw": {
    "patches": [
      {
        "when": ["mp-alipay"],
        "patch": {
          "style": {
            "enablePullDownRefresh": true
          }
        }
      }
    ]
  },
  "path": "pages/order/index",
  "style": {
    "navigationBarTitleText": "Order"
  }
}
```

需要在一个字段条件内部继续区分平台时，可以使用一层 `children`：

```json
{
  "$upw": {
    "patches": [
      {
        "when": ["mp-weixin"],
        "patch": {
          "style": {
            "usingComponents": {
              "editor": "dynamicLib://editorLib/editor"
            }
          }
        },
        "children": [
          {
            "when": ["vue3"],
            "patch": {
              "style": {
                "usingComponents": {
                  "rich-editor": "dynamicLib://editorLib/rich-editor"
                }
              }
            }
          }
        ]
      }
    ]
  },
  "path": "pages/component/editor/editor",
  "style": {
    "navigationBarTitleText": "editor"
  }
}
```

### ConditionalChildPatch

| 字段                             | 类型                      | 必填 | 说明                                               |
| -------------------------------- | ------------------------- | ---- | -------------------------------------------------- |
| `when` / `unless` / `conditions` | 条件字段                  | 是   | 子补丁生效条件。                                   |
| `patch`                          | `Record<string, unknown>` | 是   | 子条件补丁，使用从应用或页面根节点开始的完整路径。 |

`ConditionalChildPatch` 不能继续声明 `children`，当前只支持一层嵌套条件。
