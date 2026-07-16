# uni-pages-weave

uni-pages-weave 是一个 uni-app `pages.json` 配置拆分工具。它把一个大型
`pages.json` 拆成可维护的 `.upw.json` 文件，并在开发或构建时重新生成
uni-app 需要的 `pages.json`。

`uni-pages-weave` 是 npm 包名，`upw` 是命令行工具名。

本文面向使用者，说明如何接入 upw、如何组织 `.upw.json` 文件，以及配置规则如何映射回 uni-app `pages.json`。

## 目录

- [快速开始](#快速开始)
- [它解决什么问题](#它解决什么问题)
- [生成后的文件职责](#生成后的文件职责)
- [常用命令](#常用命令)
- [配置速查](#配置速查)
- [常见场景](#常见场景)
- [完整规范](#完整规范)
- [条件编译](#条件编译)
- [限制和不支持的写法](#限制和不支持的写法)

## 快速开始

安装：

```sh
npm install -D uni-pages-weave
# yarn add -D uni-pages-weave
# pnpm add -D uni-pages-weave
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

开发时监听 `.upw.json` 文件并自动生成 `pages.json`：

```sh
npm exec -- upw watch
# yarn upw watch
# pnpm exec upw watch
```

## 它解决什么问题

uni-app 的 `pages.json` 同时承载应用配置、页面列表、分包关系、页面样式和平台条件差异。项目变大后，这个文件容易变成难维护的集中配置。

upw 把这些职责拆开：

- 应用级配置放在 `app.upw.json`。
- 每个页面使用自己的 `pages/**/*.upw.json`。
- 分包关系由页面 `$upw.subPackageName` 关联到 `app.upw.json` 中的分包声明。
- 平台差异使用 `$upw.when`、`$upw.unless`、`$upw.conditions` 和 `$upw.patches` 表达。
- `upw build` 会把这些文件重新合成为标准 `pages.json`。

upw 不接管 uni-app 的全部配置语义。除了 upw 明确消费或生成的字段，其它 app/page/subPackage 字段会按原样透传。

## 生成后的文件职责

假设项目中已有 `pages.json`，执行 `upw init` 后会得到类似结构：

```text
.
|-- pages.json
|-- app.upw.json
|-- pages/
|   |-- index/
|   |   `-- index.upw.json
|   `-- account/
|       `-- profile/
|           `-- profile.upw.json
`-- platforms/
    `-- ...
```

CLI 项目默认读写 `src/pages.json`，并在 `src` 下生成 upw 工作区；HBuilderX 项目默认读写项目根目录的 `pages.json`，并在根目录生成 upw 工作区。当 `src/pages.json` 和 `pages.json` 同时存在时，按 CLI 项目处理。

### `app.upw.json`

负责应用级配置和分包声明。

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

要点：

- `$upw.homePath` 必须指向主包首页。
- `pages` 不写在 `app.upw.json` 中，页面列表由页面级 `.upw.json` 文件生成。
- `subPackages` 只声明分包元信息，分包页面列表由页面文件生成。
- 普通 uni-app 应用级字段，例如 `globalStyle`、`tabBar`、`easycom`，会透传到最终 `pages.json`。

### `pages/**/*.upw.json`

负责单个页面配置。

```json
{
  "path": "pages/index/index",
  "style": {
    "navigationBarTitleText": "Home"
  }
}
```

分包页面通过 `$upw.subPackageName` 归入 `app.upw.json` 中同名分包：

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

要点：

- `path` 必填。
- 页面文件名应与 `path` 最后一段一致，例如 `pages/index/index` 对应 `pages/index/index.upw.json`。
- 普通 uni-app 页面字段会透传。
- 页面级 `$upw` 只保存 upw 元信息，不会写入最终 `pages.json`。

### `platforms/**/*.upw.json`

`path` 以 `platforms/` 开头的页面配置会按页面字段透传，不声明 `$upw`。这类文件适合保留 uni-app 生态中已有的 `platforms` 页面组织方式。

## 常用命令

### `upw init`

从当前 `pages.json` 生成 upw 工作区。

```sh
npm exec -- upw init
```

默认情况下，如果 upw 文件已经存在，`init` 不会覆盖。需要重新生成时使用：

```sh
npm exec -- upw init --force
```

| 参数          | 说明                                |
| ------------- | ----------------------------------- |
| `-f, --force` | 当 upw 工作区已存在时重新生成文件。 |

### `upw build`

从 upw 工作区生成 `pages.json`。

```sh
npm exec -- upw build
```

### `upw watch`

监听 upw 工作区，变化后自动生成 `pages.json`。

```sh
npm exec -- upw watch
```

### 通用参数

```sh
npm exec -- upw --help
npm exec -- upw --version
```

| 参数            | 说明             |
| --------------- | ---------------- |
| `-h, --help`    | 查看帮助信息。   |
| `-V, --version` | 查看当前版本号。 |

## 配置速查

### `$upw` 元信息

| 位置             | 字段                        | 说明                                        |
| ---------------- | --------------------------- | ------------------------------------------- |
| `app.upw.json`   | `$upw.homePath`             | 应用首页路径，必须指向主包页面。            |
| `app.upw.json`   | `$upw.patches`              | 应用级条件补丁，用于调整普通 app 输出字段。 |
| 页面 `.upw.json` | `$upw.subPackageName`       | 把页面归入 `app.upw.json` 中的同名分包。    |
| 页面 `.upw.json` | `$upw.when` / `$upw.unless` | 页面级简单条件。                            |
| 页面 `.upw.json` | `$upw.conditions`           | 页面级嵌套条件，最多两层。                  |
| 页面 `.upw.json` | `$upw.patches`              | 页面字段级条件补丁。                        |

### 条件字段

页面、应用 patch、页面 patch 都使用同一组条件字段。

```json
{
  "when": ["mp-weixin", "mp-alipay"]
}
```

```json
{
  "unless": ["h5"]
}
```

```json
{
  "conditions": [{ "when": ["mp-weixin"] }, { "unless": ["vue3"] }]
}
```

规则：

- `when` 表示 `#ifdef`。
- `unless` 表示 `#ifndef`。
- `conditions` 用于保留嵌套条件的外层到内层顺序。
- `conditions` 存在时不能同时写 `when` 或 `unless`。
- 每个 `conditions[]` 层只能写 `when` 或 `unless` 其中一个。
- 页面级条件最多支持两层。

### 补丁字段

字段差异写在 `$upw.patches` 中。`patch` 使用从当前配置文件根节点开始的字段路径。

| 字段                             | 说明                                 |
| -------------------------------- | ------------------------------------ |
| `when` / `unless` / `conditions` | 补丁生效条件，三者至少声明一种。     |
| `patch`                          | 要合并到应用或页面配置中的字段差异。 |
| `children`                       | 一层子条件补丁，只支持一层。         |

应用级 patch 不能修改 `$upw`、`pages`、`subPackages`。页面级 patch 不能修改 `$upw` 和 `path`。

## 常见场景

### 页面级条件

让页面只在指定平台生效：

```json
{
  "$upw": {
    "when": ["mp-weixin", "mp-alipay"]
  },
  "path": "pages/auth/login",
  "style": {
    "navigationBarTitleText": "Login"
  }
}
```

构建时会生成：

```json
{
  "pages": [
    // #ifdef MP-WEIXIN || MP-ALIPAY
    {
      "path": "pages/auth/login",
      "style": {
        "navigationBarTitleText": "Login"
      }
    }
    // #endif
  ]
}
```

### 页面字段差异

字段差异写在 `$upw.patches` 中，`patch` 使用从当前配置文件根节点开始的字段路径。

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

### 子条件差异

字段条件内还需要继续区分平台时，可以使用一层 `children`。

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
  "path": "pages/component/editor/editor"
}
```

`children` 只支持一层，`children[].patch` 同样使用从应用或页面根节点开始的完整路径。

## 完整规范

### 数据模型

```ts
interface AppUpw {
  $upw: AppMeta;
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

`[uniAppField]`、`[uniPageField]` 和 `[uniSubpackageField]` 表示 uni-app 原本支持的字段。`$upw` 是 upw 扩展配置，不会写入最终 `pages.json`。

### AppUpw

| 字段            | 类型           | 必填 | 说明                                                          |
| --------------- | -------------- | ---- | ------------------------------------------------------------- |
| `$upw`          | `AppMeta`      | 是   | 应用级 upw 元信息，用于声明首页路径和应用级 `patches`。       |
| `subPackages`   | `Subpackage[]` | 否   | 分包声明。`pages` 由页面级文件生成，不支持手写。              |
| `[uniAppField]` | `unknown`      | 否   | uni-app 应用级字段，例如 `globalStyle`、`tabBar`、`easycom`。 |

### AppMeta

| 字段       | 类型                 | 必填 | 说明                             |
| ---------- | -------------------- | ---- | -------------------------------- |
| `homePath` | `string`             | 是   | 应用首页路径，必须指向主包页面。 |
| `patches`  | `ConditionalPatch[]` | 否   | 应用级条件补丁。                 |

应用级 patch 允许修改或新增普通 app 输出字段。`$upw`、`pages`、`subPackages` 不能出现在应用级 patch 中。顶层 `homePath` 如果出现，会被视为普通 app 字段透传，不作为首页配置。

### Subpackage

| 字段                   | 类型      | 必填 | 说明                                                 |
| ---------------------- | --------- | ---- | ---------------------------------------------------- |
| `name`                 | `string`  | 是   | 分包名称，页面通过 `$upw.subPackageName` 引用。      |
| `root`                 | `string`  | 是   | 分包根目录。                                         |
| `[uniSubpackageField]` | `unknown` | 否   | uni-app 分包对象支持的其它字段；分包页面不写在这里。 |

从 `pages.json` 初始化时，如果原分包缺少 `name`，upw 会使用 `root` 作为分包名。

### PageUpw

| 字段             | 类型                      | 必填 | 说明                                    |
| ---------------- | ------------------------- | ---- | --------------------------------------- |
| `$upw`           | `PageMeta`                | 否   | 页面级 upw 元信息。                     |
| `path`           | `string`                  | 是   | 页面路径。                              |
| `style`          | `Record<string, unknown>` | 否   | 页面样式配置，按 uni-app 页面字段透传。 |
| `[uniPageField]` | `unknown`                 | 否   | uni-app 页面对象支持的其它字段。        |

### PageMeta

| 字段                             | 类型                 | 必填 | 说明                 |
| -------------------------------- | -------------------- | ---- | -------------------- |
| `subPackageName`                 | `string`             | 否   | 把页面归入同名分包。 |
| `when` / `unless` / `conditions` | 条件字段             | 否   | 页面级条件编译配置。 |
| `patches`                        | `ConditionalPatch[]` | 否   | 页面字段级条件补丁。 |

### ConditionalPatch

| 字段                             | 类型                      | 必填 | 说明                                 |
| -------------------------------- | ------------------------- | ---- | ------------------------------------ |
| `when` / `unless` / `conditions` | 条件字段                  | 是   | 补丁生效条件，三者至少声明一种。     |
| `patch`                          | `Record<string, unknown>` | 是   | 要合并到应用或页面配置中的字段差异。 |
| `children`                       | `ConditionalChildPatch[]` | 否   | 一层子条件补丁。                     |

页面级 patch 不能修改 `$upw` 和 `path`。这些字段由 upw 用于拆分、合并和定位页面。

### ConditionalChildPatch

| 字段                             | 类型                      | 必填 | 说明                                               |
| -------------------------------- | ------------------------- | ---- | -------------------------------------------------- |
| `when` / `unless` / `conditions` | 条件字段                  | 是   | 子补丁生效条件。                                   |
| `patch`                          | `Record<string, unknown>` | 是   | 子条件补丁，使用从应用或页面根节点开始的完整路径。 |

`ConditionalChildPatch` 不能继续声明 `children`。

## 条件编译

upw 支持把 `pages.json` 中常用的 uni-app 条件编译注释转换为 `$upw` 条件配置，并能在 `build` 时重新输出条件注释。

### 书写约束

- 只有格式完整的整行 `// #ifdef ...`、`// #ifndef ...` 和 `// #endif` 会被识别为条件编译指令。
- `#ifdef` / `#ifndef` 后的平台表达式支持单个 token，或多个平台 token 用 `||` 连接。
- 平台 token 支持字母、数字、下划线和短横线。
- 同一层条件数组内是或关系，嵌套条件层之间是同时满足关系。
- `//` 后、指令后、`||` 两侧的空格可以省略或保留。
- 块注释、属性行尾注释、缺少平台值、使用 `&&` 或单个 `|` 的注释不会进入 upw 条件编译流程，会作为普通 JSONC 注释处理。

`upw init` 不是 uni-app `pages.json` 的条件编译 lint。原始 `pages.json` 是否能在 uni-app 中正常工作，仍由 uni-app 编译环境决定。

### 页面条件

pages.json：

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    },
    // #ifndef MP-TOUTIAO
    {
      "path": "pages/component/cover-view/cover-view",
      "style": {
        "navigationBarTitleText": "cover-view"
      }
    }
    // #endif
  ]
}
```

对应 `pages/component/cover-view/cover-view.upw.json`：

```json
{
  "$upw": {
    "unless": ["mp-toutiao"]
  },
  "path": "pages/component/cover-view/cover-view",
  "style": {
    "navigationBarTitleText": "cover-view"
  }
}
```

### 嵌套页面条件

pages.json：

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    },
    // #ifdef APP-PLUS || MP-WEIXIN || H5
    // #ifndef VUE3
    {
      "path": "pages/component/editor/editor",
      "style": {
        "navigationBarTitleText": "editor"
      }
    }
    // #endif
    // #endif
  ]
}
```

对应页面文件：

```json
{
  "$upw": {
    "conditions": [{ "when": ["app-plus", "mp-weixin", "h5"] }, { "unless": ["vue3"] }]
  },
  "path": "pages/component/editor/editor",
  "style": {
    "navigationBarTitleText": "editor"
  }
}
```

`conditions` 会按原始注释顺序保存外层到内层关系。如果原始注释是 `#ifndef` 包住 `#ifdef`，则顺序也会对应变为 `[{ "unless": [...] }, { "when": [...] }]`。

### 分包页面条件

pages.json：

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    }
  ],
  "subPackages": [
    {
      "root": "pages/API",
      "pages": [
        {
          "path": "map/map"
        },
        // #ifdef APP-PLUS
        {
          "path": "map-search/map-search",
          "style": {
            "navigationBarTitleText": "map search"
          }
        }
        // #endif
      ]
    }
  ]
}
```

对应 `pages/API/map-search/map-search.upw.json`：

```json
{
  "$upw": {
    "subPackageName": "pages/API",
    "when": ["app-plus"]
  },
  "path": "pages/API/map-search/map-search",
  "style": {
    "navigationBarTitleText": "map search"
  }
}
```

分包没有声明 `name` 时，upw 会用分包 `root` 作为 `subPackageName`。

### 应用字段条件

pages.json：

```json
{
  "globalStyle": {
    "backgroundColorTop": "#F4F5F6",
    // #ifdef MP-360
    "mp-360": {
      "navigationStyle": "custom"
    },
    // #endif
    "h5": {
      "maxWidth": 1190
    }
  },
  "pages": [
    {
      "path": "pages/index/index"
    }
  ]
}
```

对应 `app.upw.json`：

```json
{
  "$upw": {
    "homePath": "pages/index/index",
    "patches": [
      {
        "when": ["mp-360"],
        "patch": {
          "globalStyle": {
            "mp-360": {
              "navigationStyle": "custom"
            }
          }
        }
      }
    ]
  },
  "globalStyle": {
    "backgroundColorTop": "#F4F5F6",
    "h5": {
      "maxWidth": 1190
    }
  }
}
```

普通 App 顶层字段也可以整体带条件，upw 会把该字段转换为应用级 `$upw.patches`。

### 页面字段条件

pages.json：

```json
{
  "pages": [
    {
      "path": "pages/order/index",
      "style": {
        "navigationBarTitleText": "Order",
        // #ifdef MP-ALIPAY
        "enablePullDownRefresh": true
        // #endif
      }
    }
  ]
}
```

对应页面文件：

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

如果字段条件位于页面条件内部，页面条件会保存在页面 `$upw` 条件上，不计入字段 patch 自身的相对条件层数。

### 数组项条件

数组项带条件时，upw 会把该条件下的完整数组值保存为对应字段的条件补丁。

pages.json：

```json
{
  "globalStyle": {
    "usingComponents": [
      {
        "name": "base-view"
      },
      // #ifdef MP-WEIXIN
      {
        "name": "wechat-view"
      }
      // #endif
    ]
  },
  "pages": [
    {
      "path": "pages/index/index"
    }
  ]
}
```

对应 `app.upw.json`：

```json
{
  "$upw": {
    "homePath": "pages/index/index",
    "patches": [
      {
        "when": ["mp-weixin"],
        "patch": {
          "globalStyle": {
            "usingComponents": [
              {
                "name": "base-view"
              },
              {
                "name": "wechat-view"
              }
            ]
          }
        }
      }
    ]
  },
  "globalStyle": {
    "usingComponents": [
      {
        "name": "base-view"
      }
    ]
  }
}
```

## 限制和不支持的写法

### 页面数组不能只有条件页面

生成 `pages.json` 时，每个页面数组需要至少保留一个无条件页面项。`app.upw.json` 中的 `$upw.homePath` 也应指向主包中的无条件页面。

```json
{
  "pages": [
    // #ifdef H5
    {
      "path": "pages/h5/index"
    }
    // #endif
  ]
}
```

### 条件不能包裹 upw 管理的顶层字段

普通 App 顶层字段可以带条件，并会转换为应用级 `$upw.patches`。但 `$upw`、`pages`、`subPackages` 是 upw 管理字段，不能作为 App 条件 patch 的目标。

```json
{
  // #ifdef H5
  "pages": [
    {
      "path": "pages/h5/index"
    }
  ],
  // #endif
  "subPackages": [
    {
      "root": "pages/account",
      "pages": [
        {
          "path": "profile/profile"
        }
      ]
    }
  ]
}
```

### 条件不能包裹整个分包对象

可以给分包里的页面项加条件，但不能给整个分包对象加条件。

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    }
  ],
  "subPackages": [
    // #ifdef H5
    {
      "root": "pages/account",
      "pages": [
        {
          "path": "profile/profile"
        }
      ]
    }
    // #endif
  ]
}
```

### 页面项条件最多两层

页面级 `$upw.conditions` 最多支持两层条件。

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    },
    // #ifdef H5
    // #ifdef MP-WEIXIN
    // #ifndef VUE3
    {
      "path": "pages/nested/index"
    }
    // #endif
    // #endif
    // #endif
  ]
}
```

### 字段级条件最多一层子条件

字段级条件最多转换为顶层 `patches[]` 加一层 `children`。如果字段位于条件页面内部，页面条件会保存在页面 `$upw` 条件上，不计入字段 patch 自身的相对条件层数。

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        // #ifdef H5
        // #ifdef MP-WEIXIN
        // #ifdef APP-PLUS
        "navigationBarTitleText": "nested"
        // #endif
        // #endif
        // #endif
      }
    }
  ]
}
```
