三条铁律

### 1. 代码零注释

源码里不写注释、不写 docstring，名字起清楚就行。
例外只有两种：工具指令（`# noqa` 这类）、被运行时真正读取的字符串。
整理存量代码时，已有注释属于清除对象。

### 2. 界面不加说明字

界面只写「它是什么」和「出了什么问题」，不写「怎么用」。
禁止解释性与引导性文字，例如「点击这里进入自定义界面」「该字段显示在列表的来源列」。

允许出现的只有五类：

- 字段名
- 必填标记 `*`
- 出错时的具体原因
- 禁用态的原因
- 空状态文案

需要示范格式时用 placeholder，不要额外加一行说明。

### 3. 非源码一律进 `.ai/`

报告、备份、脚本、截图、数据导出、临时中间物，全部进 `.ai/`。
允许留在根目录的只有：源码（`app/`、`main.py`、`tests/`）、资源（`assets/`）、
仓库元文件（`README.md`、`LICENSE`、`pyproject.toml`、`happycrate.spec`、
`happycrate.bat`、`.gitignore`、`.gitattributes`、`AGENTS.md`）、运行时数据（`data/`）、构建产物（`dist/`、`build/`）。

`.ai/reports/` 里的成品报告对工具可见（gitignore 已放行），交付时用原生
Windows 路径（`D:\...`）引用，不要用 `/d/...` 这种 shell 风格路径。
`.ai/` 其余子目录（tmp、backups、extracted 等）仍是纯工作区，不进版本库。
