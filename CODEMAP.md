# CODEMAP — 项目上下文索引

> 第五人格 · 密码机刷点推导工具（军工厂等 9 张地图）。纯前端 + Canvas，无框架、无构建；主题为 **Material Design 3（MD3）**，坐标数据与规则引擎完全数据驱动。

---

## 1. 文件职责划分

```
项目根目录
├── index.html            # DOM 骨架：Navigation Drawer(#sidebar) / Top App Bar(.status-panel) / Canvas / 右侧控制栏 / 页脚(三按钮)
├── style.css             # 全部样式（MD3 主题：语义 Token + 组件样式 + 响应式 + 减动效 + 新手指引）
├── app.js                # ★ 核心逻辑（ES Module）：fetch 加载、Canvas 渲染、缩放平移、点位勾选、联动渲染、DOM 更新
├── rule-engine.js        # ★ 刷点联动规则引擎（ES Module）：必刷/互斥/伴生/组合过滤，纯数据驱动
├── tour.js               # 新手指引（Onboarding Tour，7 步）：聚光灯遮罩（无目标步骤高亮气泡本体）+ 自动定位引导卡片 + 目标滚出视口时平滑滚动到目标 + 步骤切换内容切入动画 + 完成/跳过淡出动画 + step.link 链接 + localStorage 记忆
├── package.json          # npm 清单（devDependency: @material/material-color-utilities；脚本 npm run tokens）
├── README.md             # 项目说明（功能 / 快速开始 / 操作 / 目录结构 / 数据来源）
├── websiteicon.png       # 站点图标（favicon + 侧栏品牌图标：深色圆角衬底 + 提亮金色，生成自 scripts/generate_icon.js）
├── scripts/
│   ├── generate-m3-tokens.mjs  # MD3 Token 生成器（构建期运行，产出 src/styles/md3-tokens.css）
│   ├── analyze_icon.js         # favicon PNG 分析工具（颜色/透明度/主色）
│   └── generate_icon.js        # favicon 生成器（深色圆角衬底 + 提亮金色）
├── src/styles/
│   └── md3-tokens.css    # ★ 全局 MD3 设计 Token（自动生成：Dynamic Color 亮/暗 + Surface Container + Shape + Elevation + Typeface）
├── .claude/skills/
│   └── material-design-3-ui/   # 项目级 Agent Skill（MD3 设计/审查规范，SKILL.md + references/*）
├── maps/                 # ★ 地图资料统一收纳（运行期数据 + 底图 + 数据源 + 抽取工具）
│   ├── data/             # 9 张地图坐标 JSON（运行期由 app.js fetch 加载，bgImage 指向 maps/images/）
│   ├── images/           # 9 张地图底图 PNG（<地图名>_基本信息_无名称点.png）
│   ├── names/            # 名称点位 JSON（运行期由 app.js fetch 加载，text/door 标注）
│   ├── ciphers/          # 密码机刷点 JSON（抽取中间产物 + 汇总）
│   ├── raw/              # 原始 BWIKI 地图源码 txt（数据源）
│   └── scripts/          # 抽取/生成脚本（batch_extract_cipher.py / extract_named_points.py / generate_data_json.ps1）
├── assets/               # 其余美术资源（图标 + 密码机参考 SVG；地图底图已移至 maps/images/）
│   ├── icons/            # bilibili.svg / github.svg / 指南.svg / 地图.svg / 定位.svg（品牌与 UI 图标）
│   └── cipher/           # 密码机 6 态 SVG + 密码机.png/svg（已内联为 Path2D，仅作参考）
├── serve.js              # 本地服务器：Node 静态服务器（node serve.js）
└── 一键启动.bat           # 本地服务器：零依赖 PowerShell HttpListener（双击即用）
```

**运行方式**（二者选一，均需 HTTP，`app.js` 用 `fetch` + ES Module，`file://` 会被浏览器拦截）：
- 有 Node：`node serve.js` → http://localhost:8137
- 无 Node：双击 `一键启动.bat`
- 重新生成 MD3 Token：`npm run tokens [种子色]`（默认 `#c9a227` 金色）

---

## 1.5 MD3 主题体系（Theme / Token）

- **依赖**：`@material/material-color-utilities@^0.3.0`（锁定 0.3.x；`0.4.0` 的 ESM 产物在纯 Node 下无法解析）。
- **构建期生成、运行时零依赖**：`scripts/generate-m3-tokens.mjs` 用 Dynamic Color 算法（种子色 `#c9a227`）生成静态 `src/styles/md3-tokens.css`；浏览器无 importmap、无打包器。
- **亮/暗方案**：`:root` 为暗色，`.md3-light` 为亮色。当前 `<html class="md3-light">` 默认亮色（白底）；右上角 `#themeToggle` 按钮切换深色（增删 `md3-light` class，`localStorage.idvTheme` 记忆）。切换时在 `<html>` 上临时加 `theme-transition` class，由 `html.theme-transition *` 统一全局颜色过渡（.3s `--ease-out`，约 320ms 后移除），避免各元素各自 150ms 过渡造成「已锁定」按钮等明度反差大的元素跳变；初始化加载不加该 class，避免首屏闪烁；`prefers-reduced-motion` 下该过渡被禁用。
- **核心 Token**：
  - 色彩 `--md-sys-color-*`：primary / on-primary / primary-container / secondary / tertiary / error / surface / on-surface / surface-variant / on-surface-variant / outline / outline-variant / **surface-container-(lowest|low|container|high|highest)** / surface-dim|bright / inverse-* 等
  - 字体 `--md-ref-typeface-plain`（Roboto/Noto Sans SC）、`--md-ref-typeface-brand`（style.css 覆盖为 Noto Serif SC 衬线，用于品牌标题）
  - 圆角 `--md-sys-shape-corner-{xs,sm,md,lg,xl,full}` = 4/8/12/16/28/9999px
  - 阴影 `--md-sys-elevation-level-0..5`
- **style.css 语义别名**：`--gold/--text/--muted/--panel/--bg/--blood` 等桥接到 MD3 Token，`--state-hover/--state-pressed` 用 `color-mix` 实现 MD3 State Layer。

## 1.6 UI 布局结构（PC 三区 + 悬浮抽屉）

```
.app (flex 行, 100vh)
├── .sidebar#sidebar          # Navigation Drawer（悬浮 Overlay，surface-container，端角 16px 圆角 + elevation-3）
│   ├── .brand                # 品牌标题（Noto Serif SC）
│   ├── .map-menu             # 地图导航列表（.map-item 56px 全药丸，active=secondary-container，aria-current=page）
│   └── #sidebarToggle        # 抽屉拉手（primary 色，吸附左缘）
├── #drawerBackdrop           # scrim 遮罩（点击收起）
├── .main
│   ├── .status-panel         # Top App Bar：扁平全宽 surface-container（无边框/圆角/阴影），负边距贴边
│   │   ├── .status-left      # 「剩余匹配刷点方案 N 组」（N 锁定=tertiary / 冲突=error）
│   │   └── .status-right     # 确认布局(Filled，锁定后文案「已锁定」) + 缩放(Icon ×3, aria-label) + 重置(Outlined，剩余 0 组时 .attention 红色脉冲)
│   ├── .workspace            # .map-frame（无框）> .map-wrap（深色底 #0a0907，12px 圆角；竖屏 aspect-ratio 跟随地图宽高比）> #mapCanvas + .map-title（左上角，仅地图名，点击调出左侧边栏，定位图标=assets/icons/定位.svg 内联）
│   ├── .brush-hint           # 操作提示（默认=左键/右键/悬停/滚轮/拖拽；.on 金色高亮 / .warn 红色胶囊=点亮 5 台上限拦截；竖屏 white-space:normal 换行）
│   └── .app-footer           # .footer-actions（三按钮：新手引导 / Bilibili Wiki / GitHub，均带图标居左）
└── .right-panel#rightPanel   # 右侧控制栏（surface-container-low，无左边框）
    ├── .panel-tools          # 顶部工具行（靠右）：快速确认 + 名称标注开关 + 「更多」开关 + 主题切换 + 说明小字
    │   ├── #autoConfirmToggle # 快速确认开关（MD3 Switch + 标签，aria-checked），开启后匹配唯一时延迟 500ms 自动 lockLayout（防抖，兼容双击/三击）
    │   ├── #nameToggle       # 名称标注开关（MD3 Switch：52×32 轨道 + 16px 手柄 + 标签，aria-checked，默认开启），控制地图名称标注层显隐
    │   ├── #proModeToggle    # 「更多」开关（MD3 Switch + 标签，aria-checked）：锁定后更多 4 态（含大小遗产）、简易 2 态（有电机/已点亮）；未锁定两模式均 3 态左键轮换
    │   ├── #themeToggle      # 深色模式切换（Icon Button，月亮/太阳 SVG）
    │   └── .tool-note       # 「快速」说明小字「快速：匹配唯一时自动锁定布局」（绝对定位，水平居中于整个右侧边栏，10.5px，on-surface-variant）
    ├── .panel#legendPanel    # 卡片（filled: surface-container-highest，无描边/阴影；竖屏 order:2 置于刷点方案之后）
    │   ├── .legend           # 状态图例（只读、无计数，风格与刷点方案一致）：无边框紧凑卡片 + 36px 状态色圆点、3 态并排（2/4 态 2 列）；未锁定 3 态（未知/无电机/有电机），锁定后更多 4 态 / 简易 2 态
    │   └── .linkage-legend   # 联动关系图例（只读：伴生/互斥/必刷，暗色圆底座 36px、去发光、无边框不可交互，分隔于状态图例下方）
    ├── .panel#presetPanel    # 卡片：刷点方案（.preset-chip 2 列网格；悬停 state-layer；点击直接确认布局 lockLayout，锁定后点击可切换锁定方案；筛选/锁定后显示 SVG 对勾/叉；is-filtered 降透明 / is-locked tertiary 文字；竖屏 order:1 置于图例之前）
    └── .panel#iconSizePanel  # 卡片：图标大小滑块（.icon-size-slider 无极 range 60%~160%，accent-color，两端小/大圆点 .icon-size-dot-sm/-lg；input 事件调节 ICON_PX/MARKER_R 等比缩放，主循环每帧自动重绘；竖屏随 right-panel 置于 footer 三按钮上方）
```

---

## 2. 数据结构（maps/data/*.json 示例）

```json
{
  "mapName": "军工厂",
  "bgImage": "maps/images/军工厂_基本信息_无名称点.png",
  "bgImageRemote": "https://patchwiki.biligame.com/images/dwrg/4/44/7kg6dzhfjvhvjvdxf7xg2zbpq6yzovs.png",
  "aspectW": 699,
  "aspectH": 600,
  "allPoints": [
    { "id": "p1", "name": "点位1", "x": 31.9, "y": 12 }
  ],
  "presets": [
    { "id": "group1", "name": "第1组", "points": ["p1", "p2", "p3", "p4", "p5", "p6", "p7"] }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `mapName` | 地图名（菜单名 = 文件名） |
| `bgImage` / `bgImageRemote` | 底图本地路径 / 远程回退 URL |
| `aspectW` / `aspectH` | 底图原始像素尺寸（Canvas 适配用） |
| `allPoints[].x/.y` | **归一化百分比坐标（0~100）**；Canvas 换算 `(x/100*aspectW, y/100*aspectH)` |
| `allPoints[].id` | `p1..pN`，按「跨组首次出现顺序」自动编号 |
| `presets[].points` | 该固定刷点组包含的点位 id（每局 7 台） |

> `rule-engine.js` 兼容 `groups` / `presets` 两种键名。

### 名称标注数据（maps/names/<地图名>_名称点位.json）

数组，每项 `{ name, type, x, y }`；`x/y` 同为 0~100 百分比，与 `allPoints` 坐标一致。
- `type`：`text`（区域/建筑名）、`door`（大门/小门）、`chair`（椅子编号）、`box`/`component1`（二层标记）等。
- `app.js` 仅保留 `text` 与 `door` 两类；再过滤图例说明文字——含「地下室 / 椅子数目 / 刷点」关键词，或纯圈数字（①-⑳ 与顿号）组合。加载失败静默降级为空数组。

---

## 3. 模块接口：rule-engine.js ↔ app.js

### `rule-engine.js` 导出 `class RuleEngine`

```js
const engine = new RuleEngine(mapData);   // 构造时一次性推导全部关系
engine.filterGroups(selectedIds, excludedIds)  // → 匹配组 [{id,name,points:Set}]
engine.isAlwaysSpawn(id)   // → bool   必刷点
engine.exclusionsOf(id)    // → Set    互斥点
engine.companionsOf(id)    // → Set    伴生点
engine.groupsOf(id)        // → group[]
engine.groupNamesOf(id)    // → name[]
engine.alwaysSpawn         // → Set<pointId>
engine.stats               // → { pointCount, groupCount, alwaysSpawnCount, exclusionPairCount, cooccurrencePairCount }
```

### `app.js` 调用点

| 位置 | 调用 |
|---|---|
| `loadMap()` | `engine = new RuleEngine(data)` |
| `recompute()` | `engine.filterGroups / companionsOf / alwaysSpawn` |
| `drawMarker()` | `engine.isAlwaysSpawn / companionsOf / exclusionsOf` |
| `buildTooltip()` | `engine.isAlwaysSpawn / companionsOf / exclusionsOf / groupNamesOf` |
| `updateStatus()` | `engine.alwaysSpawn`、`linkage.matched/companions` |

---

## 4. Canvas 状态管理逻辑

### 4.1 状态模型

```js
pointStates = { [id]: 'unknown' | 'noCipher' | 'hasCipher' | 'small' | 'big' | 'finish' }  // 唯一持久状态源
view = { scale, tx, ty }        // 屏幕 = 地图坐标 * scale + (tx, ty)；fitView/clampView/zoomAt
linkage = { sel, excl, matched, impossible, companions, deduced }   // 派生联动结果
hoveredId / previewIds / activeBrush / mapImage / engine / currentData  // 瞬时态
```

### 4.2 渲染循环

```
requestAnimationFrame(loop) → draw(now)：
  1) setTransform(dpr) + clearRect
  2) 底图（save → translate(tx,ty) → scale(scale) → drawImage → restore）
  3) drawNameMarks()：名称标注层（#nameToggle 开启时；屏幕恒定字号 13px、globalAlpha 0.62 半透明，text=暖白 #f5efe4 / door=品牌金 #ecc246，绘制在密码机标记下层）
  4) 遍历 allPoints → drawMarker(p, now)
```

### 4.3 交互 → 状态 → 联动链路

```
pointerdown → 拖拽平移/点击判定；pointerup → hitTest → applyPoint(id) → cycle（未锁定 3 态；锁定后更多 4 态 / 简易 2 态）
contextmenu（右键/长按）→ cycle(id, -1)；wheel → zoomAt；pointermove → updateHover → buildTooltip
重置 → resetAll；刷点方案点击 → lockLayout（锁定后再次点击可切换锁定方案）；锁定/重置/更多开关切换 → buildLegend 重建图例；图标大小滑块 → 调节 ICON_PX/MARKER_R（等比缩放）
setState → updateStatus() → recompute() → filterGroups → 更新剩余组数 / linkageBar / 方案列表 / 确认按钮态 → 下一帧 draw()
```

---

## 5. 关键约定与注意事项

- **必须 HTTP 访问**：`fetch` 加载 JSON + ES Module 导入，`file://` 下被浏览器拦截。
- **坐标**：`x/y` 为 0~100 百分比；缩放时点位图标保持固定屏幕尺寸。
- **状态语义**：`hasCipher/small/big/finish` 归「有密码机」（必须包含），`noCipher` 为「排除」；未锁定阶段仅操作 3 态（未知/无电机/有电机）推导，锁定后才可操作 `small/big/finish`（遗产/破译完成）；`finish`（已点亮）最多 5 台——点亮 5 台即可开门逃生，超限在 `setState` 拦截。
- **规则引擎零硬编码**：新增地图只需 `maps/data/` 放 JSON + `app.js` 的 `MAP_LIST` 加名。
- **图标**：密码机造型内联为 `Path2D`（`CIPHER_BODY/CIPHER_ANTENNA/CIPHER_HALO`）。
- **MD3 合规要点**（依 `.claude/skills/material-design-3-ui`）：
  - Top App Bar / 卡片 / 抽屉用 **surface-container 语义角色**，不用描边圆角盒或装饰阴影；
  - 按钮按语义用 Filled（主行动）/ Outlined / Text / Icon，**全药丸 40px**；图例是 Filter Chip（**8px 圆角流式**，非药丸）；
  - 阴影仅保留 drawer / tooltip / popover 等悬浮层；
  - 状态层用 `color-mix`（on-surface 8%/12%）。
- **无障碍**：全局 `:focus-visible` 主色焦点环；图标按钮带 `aria-label`；地图菜单 `aria-current=page`；`prefers-reduced-motion` 关闭动效；全局去除移动端点击高亮色块（`-webkit-tap-highlight-color: transparent`）与 iOS 长按系统菜单（`-webkit-touch-callout: none`），不触及 :active/:hover 等自定义交互反馈。
- **新手指引**：3 步（选择地图 → 标记电机：单击有电机/双击没电机 → 确认布局）+ 第 4 步「数据来源与开源」居中气泡（`noCount` 不计入进度、显示「致谢」），目标滚出视口才自动平滑滚动到目标板块（横屏 `overflow:hidden` 一屏显示、不滚动）、结束恢复原滚动位置，完成/跳过写 `localStorage.hasCompletedTour=true`。步骤切换重播标题/正文「切入动画」（`.tour-switching`，延迟 0.08s 让聚光灯先动、文字后浮现），完成/跳过先播「淡出动画」（`body.tour-closing`）再隐藏；滚动收尾用「静止去抖（120ms）」替代固定 700ms 兜底，避免长滚动中提前恢复过渡造成拖尾。
- **动效令牌**：`--ease-out / --ease-in-out / --ease-drawer`；仅动画 `transform/opacity/color/border/background/box-shadow`。
