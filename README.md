# GVH 以图搜图助手 (Image Search Assistant)

通用多引擎以图搜图 Chrome 扩展：**鼠标悬停图片即可选择引擎搜索**，支持**框选截图自动上传识图**（Yandex / Google Lens）。引擎列表完全可自定义，纯本地处理、无任何追踪。

Multi-engine reverse image search Chrome extension: **hover any image to search with your chosen engine**, plus **drag-select screenshots auto-uploaded to Yandex / Google Lens**. Fully configurable engine list, all client-side, no tracking.

---

## ✨ 功能特性 / Features

| 功能 | 说明 |
|---|---|
| 🖱 悬停直搜 | 鼠标悬停网页图片，自动弹出引擎图标条，点击图标立即以该图搜索 |
| 📸 框选截图识图 | 快捷键或工具栏图标进入框选模式，截取屏幕任意区域自动上传识别 |
| 🔍 多引擎支持 | 内置 Google Lens / Yandex / Bing / Baidu / SauceNAO / Ascii2D / TinEye / Sogou |
| ⚙️ 引擎自定义 | 任意增删改引擎，支持自定义 URL 模板（`{%s}` 为图片地址占位） |
| 🔤 多语言 | 简体中文 / English 界面切换 |
| 🎨 界面定制 | 自定义每个引擎的图标与颜色、图标条尺寸与对齐位置 |
| 🧹 白名单 / 黑名单 | 指定网站禁用悬停搜索，或仅白名单网站启用 |
| 📋 复制截图 | 截图一键写入剪贴板（可同时上传识图） |
| 💾 自动保存 | 截图可选自动保存到下载目录的子文件夹 |
| ⏱ 状态气泡 | 搜索过程实时状态提示，跟随光标 |
| 🌐 断网可用配置 | 所有配置本地存储，纯前端运行 |

---

## 🚀 安装 / Installation

> Chrome 116+（Manifest V3）

### 方式一：从源码加载（开发者模式）

1. 下载本仓库并解压（或 `git clone`）
2. 打开 Chrome，访问 `chrome://extensions/`
3. 打开右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择本仓库文件夹
5. 安装完成，工具栏出现扩展图标

### 方式二：从 Release 安装

1. 前往本仓库 [Releases](https://github.com/GVHBOX/image-search-assistant/releases) 页面
2. 下载最新版本的 `.zip` 包并解压
3. 按「方式一」的第 2–5 步加载（Chrome 商店发布版可直接安装，非商店版本均需开发者模式）

---

## 📖 使用说明 / Usage

### 悬停搜索

鼠标移动到任意网页图片上，图片附近会浮出引擎图标条——点击任一引擎图标，立即在新标签页用该引擎搜索此图。

悬停条上有一个「**全部**」按钮（可开关）：点击后一次打开所有已启用的引擎。

### 框选截图识图

| 操作 | 方式 |
|---|---|
| 框选截图 | 快捷键 **`Alt+Y`**（macOS 亦为 `Alt+Y`），或点击工具栏图标 |
| 截取区域 | 鼠标拖拽框选屏幕任意区域，松开即自动上传 |
| 上传目标 | 默认 Yandex；可在设置中选择 Google，或开启「同时上传」一次发往两者 |
| 取消 | 按 `Esc`（即时模式）；确认模式下按 `Enter` 确认 / `Esc` 取消 |

框选截图识别结果会在新标签页打开，等待期间有跟随光标的状态气泡提示。

### 选项页

点击扩展图标 → **选项**，或右键扩展图标 → 选项。可配置：

- **引擎管理**：添加 / 编辑 / 删除 / 排序引擎，设置图标与颜色、启用状态
- **「同时搜索」按钮**：是否在悬停条显示「全部」按钮
- **上传引擎**：截图默认上传到 Yandex 或 Google，或「同时上传」
- **截图格式**：JPEG / PNG（PNG 时质量滑块不可用），质量可调
- **框选模式**：即时（松开即搜）/ 确认（Enter 确认）
- **自动保存**：截图自动保存到下载目录子文件夹（可自定义名称）
- **复制到剪贴板**：截图同时写入剪贴板
- **黑名单 / 白名单**：管理禁用或仅启用悬停搜索的网站
- **界面**：语言（中文/English）、主题、图标条尺寸、对齐位置、状态气泡开关
- **自定义图标**：为每个引擎上传本地图片作为图标（自动压缩至 48×48）
- **使用统计**：本地统计截图 / 搜索次数（仅存本地）

---

## 🔧 自定义引擎 / Custom Engines

每个引擎 = 一个 URL 模板，`{%s}` 会被替换为**编码后的图片地址**。

例如自定义一个搜图引擎：

```
名称：   Google Images
URL：    https://www.google.com/searchbyimage?image_url={%s}
图标：   G（或上传图片）
```

也可在选项页给引擎配置域名模板（适合某些需特殊处理的站点）。

---

## 🗂 权限说明 / Permissions

本扩展仅在**你主动触发搜索**时访问图片，不上传任何浏览数据、不注入广告。所需权限及其用途：

| 权限 | 用途 |
|---|---|
| `storage` | 本地保存你的配置、历史记录、使用统计 |
| `contextMenus` | 右键菜单中的截图搜图入口 |
| `activeTab` + `host_permissions` | 读取当前页图片、注入悬停条与框选遮罩 |
| `downloads` | 自动保存截图到下载目录 |
| `clipboardWrite` + `offscreen` | 将截图写入剪贴板（通过后台 offscreen 文档） |
| `notifications` | 搜索完成 / 失败时系统通知 |
| `declarativeNetRequestWithHostAccess` | 修正 Google / Yandex 上传请求头，避免被识别为异常而拒绝 |

所有数据均存储于浏览器本地（`chrome.storage`），无服务器、无跟踪。

---

## ❓ 常见问题 / FAQ

**Q：为什么 Google 识图有时失败？**
Google 对自动化上传有较严格的风控。扩展已通过 DNR 修正请求头并预置 cookie 预热，若仍失败请稍后重试；Yandex 通常更稳定。

**Q：悬停搜索在某些网站不生效？**
可能是该网站被加入了黑名单，或你开启了白名单模式。检查选项页 → 黑名单 / 白名单。

**Q：能离线使用吗？**
本扩展本身离线可用（配置、悬停条均本地），但识图需要联网访问对应搜索引擎。

**Q：数据会上传到服务器吗？**
不会。仅在你自己点击搜索时，将图片发送到所选搜索引擎（如 Yandex）进行识别；无任何中间服务器。

---

## 🧑💻 开发 / Development

```
git clone https://github.com/GVHBOX/image-search-assistant.git
```

结构说明：

```
background.js    # 后台 Service Worker：截图、上传、右键菜单、DNR 请求修正
content.js       # 内容脚本：悬停图标条、框选遮罩、状态气泡
content.css      # 内容脚本样式
defaults.js      # 共享默认配置（引擎列表、默认值），三个入口共用
i18n.js          # 中英文 i18n 字典
options.html/js  # 选项页
offscreen.js     # 离屏文档：剪贴板写入
manifest.json    # MV3 清单
icons/           # 扩展图标
```

加载修改后的代码：`chrome://extensions/` → 点击扩展卡片上的 **刷新** 按钮即可。

---

## 📄 许可证 / License

本项目仅供学习与个人使用。使用第三方搜索引擎（Google / Yandex / Bing / 百度等）时请遵守各站点的服务条款。
