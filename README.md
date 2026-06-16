# 实用在线工具箱

免费在线工具箱：Markdown 转微信公众号文章、二维码生成器、JSON 格式化工具。
纯浏览器端运行，数据不上传服务器，无需注册。

## 功能

- **公众号排版** — 左边写 Markdown，右边实时预览公众号风格，一键复制到公众号编辑器
- **二维码生成** — 输入文字或链接，实时生成二维码，可下载 PNG
- **JSON 格式化** — 粘贴 JSON，一键格式化 / 压缩 / 校验，带语法高亮

## 部署到 GitHub Pages（免费）

### 方法一：GitHub 网页操作

1. 登录 [github.com](https://github.com)，点 `+` → `New repository`
2. 输入仓库名（如 `toolbox`），选 Public，点 Create repository
3. 把本文件夹的所有文件上传到仓库：
   - 在仓库页面点 `Add file` → `Upload files`
   - 把 `index.html`、`css/`、`js/` 拖进去
   - 点 `Commit changes`
4. 进入仓库 `Settings` → `Pages`
5. 在 `Branch` 下拉选择 `main`，点击 `Save`
6. 等 1-2 分钟，你会看到 `Your site is live at https://你的用户名.github.io/仓库名/`

### 方法二：命令行

```bash
cd 项目目录
git init
git add .
git commit -m "初始化工具箱"
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main
```

然后在 GitHub 仓库 `Settings` → `Pages` 中开启 Pages 即可。

## 如何开始赚钱

### 1. 放上你的收款码

打开 `index.html`，找到底部 `支持我们` 部分：
- 把两个 `donate-qr-placeholder` 框分别替换成你的微信收款码和支付宝收款码图片
- 把图片文件放在项目目录中，将 HTML 中的文字替换为 `<img src="你的图片路径">`

### 2. 推广渠道

- **知乎**：写一篇推荐 3 个实用在线工具类的文章，附上链接
- **V2EX / 小众软件**：发帖分享你的免费工具
- **公众号**：在文章里顺带推荐
- **GitHub**：在项目 README 写清楚功能，增加 Star 数会增加曝光

### 3. 进阶变现思路

- 在工具里加一个高级版按钮（如批量处理、大文件支持），需要付费/打赏解锁
- 用百度广告联盟（流量够的话）
- 把工具包装成浏览器扩展，上架 Chrome Web Store（可以设置价格或打赏）

## 技术说明

- 纯前端，零依赖
- 二维码生成：自实现的 QR 码生成器，支持 Version 1-10，纠错级别 M
- Markdown 解析：自实现，支持常用语法 + 微信公众号风格预览
- JSON 处理：原生 JSON 格式化 + 语法高亮

## 文件结构

```
toolbox/
  index.html    # 主页面
  css/
    style.css   # 样式表
  js/
    toolbox.js  # 所有 JS 逻辑（Markdown 解析 + QR 码生成 + JSON 处理 + UI）
```

## 许可

MIT
