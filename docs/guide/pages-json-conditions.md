# pages.json 条件编译支持

upw 支持把 `pages.json` 中的 uni-app 条件编译注释转换为 `$upw` 条件配置，并能在 `build` 时重新输出条件注释。

## 书写约束

- 条件指令只支持 `// #ifdef ...`、`// #ifndef ...` 和 `// #endif`。
- 条件指令必须单独占一整行，不能写成块注释，也不能写在属性行尾。
- 条件表达式只支持 `||`，不支持 `&&` 或单个 `|`。
- 同一层条件数组内是或关系；嵌套条件层之间是同时满足关系。

## 支持的写法

### 页面只在指定平台生效

pages.json：

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    },
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

对应 `pages/auth/login.upw.json`：

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

### 页面排除指定平台

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

### 页面使用嵌套条件

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

对应 `pages/component/editor/editor.upw.json`：

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

`conditions` 会按原始注释顺序保存外层到内层关系。如果原始注释是 `#ifndef` 包住 `#ifdef`，会得到：

```json
{
  "$upw": {
    "conditions": [{ "unless": ["vue3"] }, { "when": ["mp-weixin"] }]
  },
  "path": "pages/component/editor/editor",
  "style": {
    "navigationBarTitleText": "editor"
  }
}
```

### 分包页面带条件

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
    "subpackageName": "pages/API",
    "when": ["app-plus"]
  },
  "path": "pages/API/map-search/map-search",
  "style": {
    "navigationBarTitleText": "map search"
  }
}
```

分包没有声明 `name` 时，upw 会用分包 `root` 作为 `subpackageName`。

### 应用字段带条件

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
  "homePath": "pages/index/index",
  "globalStyle": {
    "backgroundColorTop": "#F4F5F6",
    "h5": {
      "maxWidth": 1190
    }
  },
  "$upw": {
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
  }
}
```

### 页面字段带条件

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

对应 `pages/order/index.upw.json`：

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

### 页面条件内再声明字段条件

pages.json：

```json
{
  "pages": [
    {
      "path": "pages/index/index"
    },
    // #ifdef APP-PLUS || MP-WEIXIN || H5 || MP-BAIDU
    {
      "path": "pages/component/editor/editor",
      "style": {
        "navigationBarTitleText": "editor",
        // #ifdef MP-BAIDU
        "usingComponents": {
          "editor": "dynamicLib://editorLib/editor"
        }
        // #endif
      }
    }
    // #endif
  ]
}
```

对应 `pages/component/editor/editor.upw.json`：

```json
{
  "$upw": {
    "when": ["app-plus", "mp-weixin", "h5", "mp-baidu"],
    "patches": [
      {
        "when": ["mp-baidu"],
        "patch": {
          "style": {
            "usingComponents": {
              "editor": "dynamicLib://editorLib/editor"
            }
          }
        }
      }
    ]
  },
  "path": "pages/component/editor/editor",
  "style": {
    "navigationBarTitleText": "editor"
  }
}
```

页面自身的条件保存在页面 `$upw.when` / `$upw.unless` / `$upw.conditions` 上；页面内部字段条件保存在 `$upw.patches` 上。

### 字段条件内再声明一层子条件

pages.json：

```json
{
  "pages": [
    {
      "path": "pages/component/editor/editor",
      "style": {
        "navigationBarTitleText": "editor",
        // #ifdef MP-WEIXIN
        "usingComponents": {
          "editor": "dynamicLib://editorLib/editor",
          // #ifdef VUE3
          "rich-editor": "dynamicLib://editorLib/rich-editor"
          // #endif
        }
        // #endif
      }
    }
  ]
}
```

对应 `pages/component/editor/editor.upw.json`：

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

`children` 只支持一层，`children[].patch` 使用从页面或应用根节点开始的完整路径。

## 不支持的写法

以下写法是合法条件编译形式，但不能转换成当前 upw 配置。

### 条件包裹顶层属性

```json
{
  // #ifdef H5
  "globalStyle": {
    "backgroundColorTop": "#F4F5F6"
  },
  // #endif
  "pages": [
    {
      "path": "pages/component/view/view"
    }
  ]
}
```

顶层属性本身不能带条件；可以把条件写到属性内部的完整成员上。

### 条件包裹分包对象

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

可以给分包里的页面项加条件，但不能给整个分包对象加条件。

### 页面项条件超过两层

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

页面级 `$upw.conditions` 最多支持两层条件。

### 字段级条件超过一层子条件

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

字段级条件最多转换为顶层 `patches[]` 加一层 `children`。
