<p align="center">
  <img src="websiteicon.png" alt="第五人格 · 密码机刷点推导工具" width="128" />
</p>

<h1 align="center">第五人格 · 密码机刷点推导工具</h1>

<p align="center">
  <strong>在线访问：</strong> <a href="https://idv-map-tools.vercel.app">idv-map-tools.vercel.app</a>
</p>

纯前端、Canvas 驱动的《第五人格》密码机（电机）刷点推导工具。内置 9 张地图的坐标数据与刷点规则，通过点位排查快速锁定每局密码机的真实布局。

## 功能特性

- **9 张地图**：军工厂、圣心医院、红教堂、永眠镇、唐人街、不归林、湖景村、月亮河公园、里奥的回忆
- **点位状态标记**：未知 / 无电机 / 有电机（简易模式 3 态推导），锁定后可标记 小遗产 / 大遗产 / 已点亮
- **简易 / 更多双模式**：简易模式聚焦「标记 → 推导 → 确认」主线；「更多」模式解锁全部 6 态
- **规则引擎联动**：自动推导「必刷点 · 伴生 · 互斥」，实时过滤匹配的刷点组，附联动关系图例（伴生/互斥/必刷）
- **确认布局**：排查至方案唯一时，一键锁定场上真实的 7 台密码机
- **快速确认**：开启后匹配唯一时自动锁定布局（500ms 防抖，兼容连续点击）
- **新手指引**：3 步引导 + 开源致谢（聚光灯 + 自动定位卡片，竖屏自动滚动到目标）
- **图标大小调节**：无极滑块调节地图点位图标大小
- **主题切换**：Material Design 3 亮 / 暗双主题（本地记忆）
- **名称标注**：地图区域 / 大门名称标注层开关

## 快速开始

项目为纯静态站点（无框架、无构建），但必须通过 HTTP 访问——`app.js` 使用 `fetch` 加载 JSON 数据并依赖 ES Module，直接双击 `index.html`（`file://` 协议）会被浏览器拦截。

**方式一：Node.js**

```bash
node serve.js
```

访问 <http://localhost:8137>

**方式二：零依赖（Windows）**

双击 `一键启动.bat`（内置 PowerShell HttpListener，无需安装 Node）。

## 操作说明

| 操作 | 功能 |
| --- | --- |
| 左键点击点位 | 切换状态（简易模式：未知 → 有电机 → 无电机） |
| 右键 / 长按 | 状态回退 |
| 点击左上角地图名 | 打开地图菜单 |
| 悬停 | 查看联动关系 |
| 滚轮 | 缩放地图 |
| 拖拽 | 平移地图 |

## 项目结构

```
├── index.html              # 页面骨架
├── style.css               # 全部样式（MD3 主题）
├── app.js                  # 核心逻辑：Canvas 渲染、交互、联动
├── rule-engine.js          # 刷点规则引擎（纯数据驱动）
├── tour.js                 # 新手指引
├── serve.js                # Node 静态服务器
├── 一键启动.bat             # 零依赖 PowerShell 服务器
├── websiteicon.png         # 站点图标（favicon + 侧栏品牌图标）
├── maps/                   # 地图资料：坐标 JSON / 底图 PNG / 名称标注
├── assets/                 # 图标与密码机参考资源
├── scripts/                # MD3 Token 生成 + favicon 处理脚本
└── src/styles/             # 生成的 MD3 设计 Token
```

## 主题与设计

基于 **Material Design 3**（MD3）语义 Token 体系，采用 Google Dynamic Color 算法从种子色（默认 `#c9a227` 金色）生成亮 / 暗主题色板（`src/styles/md3-tokens.css`）。

重新生成 MD3 Token：

```bash
npm install                                    # 安装依赖
npm run tokens                                 # 使用默认种子色 #c9a227
node scripts/generate-m3-tokens.mjs "#6750a4"  # 自定义种子色
```

## 数据来源与致谢

所有点位数据与地图资源整合自 [Bilibili 第五人格 Wiki](https://wiki.biligame.com/dwrg/)。

## 开源

项目已在 GitHub 完全开源，欢迎提交 Issue 交流反馈或给项目点个 Star：

<https://github.com/avatarisblack-byte/idv-map-tools>
