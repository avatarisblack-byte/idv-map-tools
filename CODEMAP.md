# CODEMAP — 项目上下文索引

> 第五人格 · 密码机刷点推导工具（军工厂等 9 张地图）。纯前端 + Canvas，无框架、无构建，坐标数据与规则引擎完全数据驱动。

---

## 1. 文件职责划分

```
项目根目录
├── index.html          # DOM 骨架：左侧悬浮抽屉(#sidebar/#sidebarToggle) / 顶部状态栏(含 #confirmLayoutBtn/#statusBadge) / Canvas 容器 / 右侧全高控制栏 / 页脚(重启指引)
├── style.css           # 全部样式（哥特暗黑主题 + 抽屉/状态胶囊动效 + 响应式 + 减动效适配 + 新手指引）
├── app.js              # ★ 核心逻辑（ES Module）：fetch 加载、Canvas 渲染、缩放平移、点位勾选、联动渲染、DOM 更新
├── rule-engine.js      # ★ 刷点联动规则引擎（ES Module）：必刷/互斥/伴生/组合过滤，纯数据驱动
├── tour.js             # 新手指引（Onboarding Tour）：聚光灯遮罩 + 自动定位引导卡片 + step.link 链接 + localStorage 记忆
├── data/               # 9 张地图坐标 JSON（运行期由 app.js fetch 加载）
│   ├── 军工厂.json 圣心医院.json 红教堂.json 永眠镇.json 唐人街.json
│   └── 不归林.json 湖景村.json 月亮河公园.json 里奥的回忆.json
├── map_pic/            # 9 张地图底图 PNG（<地图名>_基本信息_无名称点.png）
├── codemachine_icon/   # 密码机 6 态 SVG 图标（配色语义来源，已内联为 Path2D，仅作参考）
├── serve.js            # 本地服务器 A：Node 静态服务器（node serve.js）
├── 一键启动.bat         # 本地服务器 B：零依赖 PowerShell HttpListener（双击即用，无需 Node/Python）
└── codemachine_Distribution/   # 数据源与抽取工具（BWIKI 原始 txt → 汇总 JSON → data/*.json）
    ├── maps_input/*.txt            # 各图 BWIKI 页面原始数据
    ├── batch_extract_cipher.py     # 原始抽取脚本
    ├── generate_data_json.ps1      # 汇总 JSON → data/*.json 的生成脚本
    └── output/*.json               # 原始抽取结果（含 _所有地图密码机汇总.json）
```

**运行方式**（二者选一，均需 HTTP，因为 `app.js` 用 `fetch` + ES Module，`file://` 会被浏览器拦截）：
- 有 Node：`node serve.js` → http://localhost:8137
- 无 Node：双击 `一键启动.bat`（内置 HttpListener 服务，自动开浏览器）

---

## 1.5 UI 布局结构（PC 端三区 + 悬浮抽屉）

```
.app (flex 行，height:100vh)
├── .sidebar#sidebar        # 左侧地图菜单 = 悬浮抽屉 Overlay（position:fixed，translateX(-100%) ↔ 0）
│   ├── .sidebar-scroll     # 内容滚动容器（brand / map-menu / sidebar-foot）
│   └── #sidebarToggle      # 贴边金色胶囊拉手（right:-30px、30×72px、top:50% 垂直居中，随抽屉 translateX 同步，SVG 左右折角箭头+金色发光）
├── #drawerBackdrop         # 遮罩层（z-index:90，点击收起抽屉）
├── .main (flex:1 列)
│   ├── .status-panel       # 顶部状态栏：剩余匹配刷点方案 X 组 → #statusBadge → 缩放/重置 → #linkageBar → #statusText
│   ├── .workspace          # 自适应画布区（.map-frame > .map-wrap > #mapCanvas）
│   ├── .brush-hint
│   └── .app-footer
└── .right-panel#rightPanel # 右侧全高通顶控制栏（状态图例 + 刷点方案）
```

- **状态胶囊 `#statusBadge`**：单元素统一承载「锁定(绿 🔒刷点X组) / 冲突(红 ⚠️无匹配方案)」，未触发时 `display:none` 不占位，顶部栏高度恒定、不遮挡地图。
- **顶部状态栏响应式**：`flex-wrap:wrap; gap:12px; justify-content:space-between`——宽屏左标题右按钮组两端对齐；窄屏按钮组自动降至第二行并靠左对齐（`.status-right` 取消 `margin-left:auto`，配 `flex-wrap`/`max-width:100%` 防超窄屏溢出）。
- **响应式**：`@media (max-width:768px)` 降级为单列流式（Header → Canvas 56vh → 底部卡片区）；抽屉逻辑 PC/移动端统一（Overlay 不挤压主布局）。
- **减动效**：`prefers-reduced-motion` 关闭抽屉位移/脉冲/按压缩放，Canvas 脉冲相位冻结。
- **新手指引 `tour.js`（共 5 步）**：首次访问自动触发（跳过/完成 → `localStorage.hasCompletedTour=true`，之后不再自动出现），页脚「🎓 新手引导」手动重启；聚光灯高亮 + 自动定位引导卡片（Top/Bottom/Left/Right）+ 上一步/下一步/跳过/完成 + 右上角进度（1/5 → 5/5），`Esc`/`←→` 快捷操作。**第 5 步「数据来源与开源项目」为最终页**（高亮顶部状态栏 `.status-panel`）：致谢 Bilibili 第五人格 Wiki、介绍 GitHub 开源仓库，并在卡片内渲染可点击链接按钮（`step.link: { text, href }`，`target="_blank"` 新窗口）跳转至 https://github.com/avatarisblack-byte/idv-map-tools；最终页仅保留【上一步】+【完成】。

---

## 2. 数据结构（data/*.json 示例）

```json
{
  "mapName": "军工厂",
  "bgImage": "map_pic/军工厂_基本信息_无名称点.png",
  "bgImageRemote": "https://patchwiki.biligame.com/images/dwrg/4/44/7kg6dzhfjvhvjvdxf7xg2zbpq6yzovs.png",
  "aspectW": 699,
  "aspectH": 600,
  "allPoints": [
    { "id": "p1", "name": "点位1", "x": 31.9, "y": 12 },
    { "id": "p6", "name": "点位6", "x": 38.05, "y": 81.33 }
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
| `allPoints[].x/.y` | **归一化百分比坐标（0~100）**，基于整张底图；Canvas 中换算为 `(x/100*aspectW, y/100*aspectH)` |
| `allPoints[].id` | `p1..pN`，按「跨组首次出现顺序」自动编号 |
| `presets[].points` | 该固定刷点组包含的点位 id（每局 7 台） |

> `rule-engine.js` 兼容 `groups` / `presets` 两种键名。

---

## 3. 模块接口：rule-engine.js ↔ app.js

### `rule-engine.js` 导出 `class RuleEngine`

```js
const engine = new RuleEngine(mapData);   // 构造时一次性推导全部关系

engine.filterGroups(selectedIds, excludedIds)  // → 匹配组 [{id,name,points:Set}]（必须有 sel，不能有 excl）
engine.isAlwaysSpawn(id)   // → bool   必刷点（出现在 100% 组）
engine.exclusionsOf(id)    // → Set    与 id 互斥的点（从未同组出现）
engine.companionsOf(id)    // → Set    与 id 伴生的点（id 出现则其必现）
engine.groupsOf(id)        // → group[]  id 所在的组
engine.groupNamesOf(id)    // → name[]   id 所在组名（用于 tooltip）
engine.alwaysSpawn         // → Set<pointId>（全局必刷点集合）
engine.stats               // → { pointCount, groupCount, alwaysSpawnCount, exclusionPairCount, cooccurrencePairCount }
```

### `app.js` 的调用点

| app.js 位置 | 调用 |
|---|---|
| `loadMap()` | `engine = new RuleEngine(data)` |
| `recompute()` | `engine.filterGroups(sel, excl)`、`engine.companionsOf(id)`、`engine.alwaysSpawn` |
| `drawMarker()` | `engine.isAlwaysSpawn(id)`、`engine.companionsOf(hoveredId)`、`engine.exclusionsOf(hoveredId)` |
| `buildTooltip()` | `engine.isAlwaysSpawn / companionsOf / exclusionsOf / groupNamesOf` |
| `updateStatus()` | `engine.alwaysSpawn`、`linkage.matched / companions` |

---

## 4. Canvas 状态管理逻辑

### 4.1 状态模型（三组变量）

```js
// ① 点位状态（唯一持久状态源）
pointStates = { [id]: 'unknown' | 'noCipher' | 'hasCipher' | 'small' | 'big' | 'finish' }

// ② 视图变换（缩放平移）
view = { scale, tx, ty }        // 屏幕 = 地图坐标 * scale + (tx, ty)
//   fitView(): 等比适配居中   clampView(): 边缘钳制   zoomAt(): 以光标为中心缩放

// ③ 派生联动结果（每次状态变更后 recompute() 生成）
linkage = {
  sel:        Set,  // 已选（hasCipher/small/big/finish）
  excl:       Set,  // 排除（noCipher）
  matched:    [],   // engine.filterGroups 结果
  impossible: Set,  // 未知 && 不在任何匹配组 → 置灰
  companions: Set,  // 已选点的伴生点（未知）→ 伴生环
  deduced:    Set   // 唯一匹配组中未标记点 → 蓝圈
}

// ④ 瞬时态（悬停/预览）
hoveredId, previewIds, activeBrush, mapImage, engine, currentData
```

### 4.2 渲染循环

```
requestAnimationFrame(loop) → draw(now) 每帧执行：
  1) setTransform(dpr) + clearRect
  2) 绘制底图（save → translate(tx,ty) → scale(scale) → drawImage → restore）
  3) 遍历 allPoints → drawMarker(p, now)
```

`drawMarker` 渲染优先级（覆盖层互不冲突）：
1. 底环（按状态色；未知=虚线、无密码机=红、大遗产=脉冲红光）
2. 方案列表悬停预览环（未破译蓝，`previewIds`）
3. 图标（未知=灰+「?」，无密码机=红叉，其余=对应色密码机）
4. 编号角标（右下金圈）
5. **必刷星标**（左上未破译蓝★，`engine.isAlwaysSpawn`）
6. **置灰+斜杠**（`linkage.impossible`）
7. 外圈：选中蓝环 > 伴生蓝虚线环 > 悬浮伴生预览 > 推导蓝闪烁环（统一「未破译」蓝系）

### 4.3 交互 → 状态 → 联动链路

```
pointerdown(仅 button===0) → 进入拖拽平移/点击判定（右键不进入 dragging）
pointerup(未移动 && !suppressClick) → hitTest → applyPoint(id) → cycle/setState
contextmenu(右键/长按)  → cycle(id, -1) 并置 suppressClick=true（防止抬手被 pointerup 前进轮转抵消）
wheel                 → zoomAt
pointermove(未拖动)   → updateHover → buildTooltip（必刷/伴生/互斥/所在组）+ 悬浮预览
图例点击               → setBrush（画笔模式）
重置按钮               → resetAll
```

```
setState(id, state)
  → updateLegend()          // 图例计数
  → updateStatus()
      → linkage = recompute()          // sel/excl → filterGroups → impossible/companions/deduced
      → 更新：剩余组数 / #statusBadge（锁定=绿·冲突=红）/ #linkageBar / 方案列表(✓/✕)
  → 下一帧 draw() 自动按 linkage 重绘覆盖层
```

---

## 5. 关键约定与注意事项

- **必须 HTTP 访问**：`fetch` 加载 JSON + ES Module 导入，`file://` 下均被浏览器拦截。
- **坐标**：点位 `x/y` 为 0~100 百分比，Canvas 中映射到 `aspectW×aspectH` 底图空间；缩放时点位图标保持固定屏幕尺寸（仅位置随视图缩放）。
- **状态语义**：`hasCipher/small/big/finish` 归入「有密码机」一族（过滤「必须包含」），`noCipher` 为「排除包含」。
- **规则引擎零硬编码**：对任意合规地图 JSON 均生效；新增地图只需在 `data/` 放 JSON 并在 `app.js` 的 `MAP_LIST` 加名字。
- **图标来源**：密码机造型取自 `codemachine_icon/*.svg` 的 path，已在 `app.js` 内联为 `Path2D`（`CIPHER_BODY/CIPHER_ANTENNA/CIPHER_HALO`），配色沿用游戏语义（蓝=未破译 / 绿=小遗产 / 红=大遗产 / 黄=已点亮 / 灰=未知 / 红叉=无密码机）。
- **抽屉 Overlay**：左栏 `position:fixed` 脱离文档流，展开/收起只改 `transform`（0.3s `--ease-drawer`），不触发主区重排，因此无需 Canvas 重算；`resizeCanvas` 仅由 `window.resize` 兜底。
- **状态胶囊**：锁定/冲突共用 `#statusBadge`，由 `updateStatus()` 以 `textContent` + `className`（`lock`/`conflict`）切换，替代旧 `#lockBadge` / `#conflictBanner`。
- **必刷点**：`pointStates` 初始化/重置时，必刷点（`engine.isAlwaysSpawn`）默认 `hasCipher`；`cycle()` 用 `HAS_FAMILY` 顺序跳过「未知/无密码机」，`setState()` 拦截无效状态。
- **动效令牌**：`:root` 提供 `--ease-out / --ease-in-out / --ease-drawer`；仅动画 `transform/opacity/color/border/background/box-shadow`，禁用 `transition:all`。
