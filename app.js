/* =====================================================================
 * 第五人格 · 密码机刷点推导工具
 * 核心逻辑：Canvas 渲染、缩放平移、点位勾选、刷点联动规则引擎联动。
 * 坐标数据位于 data/*.json（fetch 异步加载）；联动规则由 rule-engine.js 推导。
 * ===================================================================== */

import { RuleEngine } from './rule-engine.js';
import { mountTour } from './tour.js';

'use strict';

/* ===================== 常量：状态定义 ===================== */
const STATE_ORDER = ['unknown', 'noCipher', 'hasCipher', 'small', 'big', 'finish'];
const STATE_META = {
  unknown:   { label: '未知',              short: '未知' },
  noCipher:  { label: '确认无密码机',       short: '无' },
  hasCipher: { label: '未破译',             short: '未' },
  small:     { label: '小遗产',   short: '小' },
  big:       { label: '大遗产',   short: '大' },
  finish:    { label: '已点亮',             short: '亮' }
};
/* 属于「有密码机」一族：用于组合过滤中「必须包含」 */
const HAS_FAMILY = ['hasCipher', 'small', 'big', 'finish'];

const STATE_COLORS = {
  unknown:   { c: '#8f8f8f', glow: null },
  noCipher:  { c: '#5b5b5b', glow: null },
  hasCipher: { c: '#8bc2ee', glow: 'rgba(139,194,238,0.55)' },
  small:     { c: '#5ee87a', glow: 'rgba(94,232,122,0.6)' },
  big:       { c: '#f03333', glow: 'rgba(240,51,51,0.75)' },
  finish:    { c: '#d6d024', glow: 'rgba(214,208,36,0.6)' }
};

/* 「未破译」统一蓝：可用/确定密码机标记的标准蓝 */
const CIPHER_BLUE = '#8bc2ee';

/* 抽屉拉手方向箭头（SVG 矢量图标）：左箭头=折叠，右箭头=拉出 */
const CHEVRON_LEFT_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M14 5 8 12l6 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON_RIGHT_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M10 5l6 7-6 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ===================== 地图清单（仅菜单名，坐标在 data/） ===================== */
const MAP_LIST = [
  '军工厂', '圣心医院', '红教堂', '永眠镇', '唐人街',
  '不归林', '湖景村', '月亮河公园', '里奥的回忆'
];
const DEFAULT_MAP = '军工厂';

/* ===================== 新手指引步骤定义 ===================== */
const TOUR_STEPS = [
  {
    target: '#sidebarToggle',
    title: '选择地图',
    text: '点击此处展开地图列表，选择或切换当前比赛的地图。'
  },
  {
    target: '#mapWrap',
    title: '地图交互与操作',
    text: '• 点击 / 右键点位：状态切换（左键轮换状态，右键/长按回退状态）\n• 鼠标滚轮：缩放地图视角\n• 按住拖拽：平移地图查看细节'
  },
  {
    target: ['#confirmLayoutBtn', '#resetBtn'],
    title: '确认布局（核心功能）',
    text: '这是推导的核心工具！当排查至方案唯一（剩余 1 组）时，点击「确认布局」即可锁定场上真实的 7 台密码机；遇到标记错误需要重新分析时，点击「重置」即可恢复。'
  },
  {
    target: '#legendPanel',
    title: '状态图例与过滤',
    text: '在此处实时查看各类密码机的数量统计；直接点击特定图例可快速切换或辅助筛选点位状态。'
  },
  {
    target: '.status-panel',
    title: '数据来源与开源项目',
    text: '• 数据致谢：本项目涉及的所有点位数据及地图资源均整合自 Bilibili 第五人格 Wiki。\n• 开源仓库：本项目已在 GitHub 完全开源，欢迎提交 Issue 交流反馈或给项目点个 Star 🌟！',
    link: { text: '前往 GitHub 仓库 →', href: 'https://github.com/avatarisblack-byte/idv-map-tools' }
  }
];
let tour = null;

/* ===================== 密码机图标 Path2D（72x72 viewBox） ===================== */
const CIPHER_BODY = new Path2D(
  'M 48.83,22.89 c -0.51,0.01 -1.02,0.03 -1.53,0.06 c -0.11,-1.41 -2.85,-2.81 -1.92,-4.09 ' +
  'c 1.63,-1.9 3.31,-3.76 5.04,-5.57 c 0.36,0.53 0.45,1.12 0.28,1.76 c -0.68,1.11 -1.21,2.28 -1.58,3.5 ' +
  'c 0.15,1.69 1.94,3.17 -0.29,4.34 Z M 21.34,15.34 c 6.67,2.98 4.06,5.94 6.14,9.53 c 1.28,2.06 -5.39,-0.24 -5.7,-2.28 ' +
  'c 2.94,-3.77 1.4,-3.44 -0.44,-7.25 Z M 36.73,24.1 c 0.16,2.6 -0.26,5.56 2.27,7.19 c 2.32,1.36 5.41,0.47 7.98,0.79 ' +
  'c 2.44,0.42 3.74,1.88 3.89,4.38 c 0.51,7.11 -9.38,3.27 -12.57,6.07 c 0.91,0.41 1.87,0.66 2.9,0.75 c 0.36,0.24 0.48,0.57 0.37,0.98 ' +
  'c -1.79,0.95 -3.65,1.76 -5.6,2.45 c -1.18,0.79 -1.05,1.23 0.42,1.29 c 1.27,0 4.63,-1.57 5.53,-0.27 c 1.22,2.18 -4.09,1.69 -5.03,2.14 ' +
  'c -1.25,0.01 -5.97,1.46 -6.83,0.53 c -0.8,-0.76 -1.13,-1.68 -0.99,-2.75 c 1.82,-0.77 3.61,-1.67 5.34,-2.72 c 0.7,-1.27 0.36,-2.05 -1.03,-2.35 ' +
  'c -2.2,0.47 -4.41,0.51 -6.62,0.12 c -2.26,-2.55 -3.81,-5.49 -4.63,-8.8 c -0.79,-0.5 -1.48,-1.88 -0.27,-2.36 c 0.14,-0.24 0.36,-0.36 0.65,-0.37 ' +
  'c 3.39,0.32 6.77,0.25 10.14,-0.2 c 2.51,-2.16 -1.44,-2.14 -0.18,-4.08 c 1.51,-1.64 1.56,-3.3 4.26,-2.79 Z M 37.24,34.78 c -0.23,1.01 -0.97,3.44 0.53,3.79 ' +
  'c 2.06,1.09 10.07,0.94 9.94,-2 c -0.06,-0.98 -0.54,-1.64 -1.43,-1.99 c -1.3,-0.13 -8.86,-0.36 -9.04,0.2 Z M 25.19,35.14 c 0.87,1.53 1.73,3.06 2.59,4.59 ' +
  'c 1.38,0.63 4.93,0.7 6.06,-0.39 c 1.07,-6.56 -4.24,-4.64 -8.65,-4.2 Z M 46.2,52.8 c -1.76,0.1 -3.5,0.3 -5.24,0.6 c -3.16,0.2 -2.68,1.23 -4.66,2.88 ' +
  'c -0.93,-4.16 -3.8,-0.67 -6,-2.9 c 2.16,-0.32 4.32,-0.69 6.51,-1.1 c 3.26,-0.67 6.5,-1.43 9.71,-2.28 c 2.14,0.01 -0.01,2.02 -0.32,2.8 Z'
);
const CIPHER_ANTENNA = new Path2D(
  'M 47.3,22.95 c 0.51,-0.03 1.02,-0.05 1.53,-0.06 c -0.1,0.91 -0.56,1.61 -1.39,2.09 ' +
  'c -0.94,0.47 -1.87,0.94 -2.79,1.42 c -0.67,-2.25 0.21,-3.4 2.65,-3.45 Z'
);
const CIPHER_HALO = new Path2D(
  'M 39,31.29 c 1.9,-0.83 5.34,-0.29 7.42,-0.19 c 0.42,0.2 0.61,0.53 0.56,0.98 c -2.57,-0.32 -5.66,0.57 -7.98,-0.79 Z ' +
  'M 37.24,34.78 c 0.37,-0.13 0.74,-0.13 1.11,-0.01 c -0.11,1.26 -0.3,2.53 -0.58,3.8 c -1.5,-0.35 -0.76,-2.78 -0.53,-3.79 Z ' +
  'M 46.2,52.8 c 2.14,2.1 -4.71,0.73 -5.24,0.6 c 1.74,-0.3 3.48,-0.5 5.24,-0.6 Z'
);

/* ===================== 应用状态 ===================== */
let currentData = null;      // 当前地图数据
let engine = null;           // 刷点联动规则引擎
let linkage = null;          // 最近一次推导结果
let pointStates = {};        // id -> state key
let activeBrush = null;      // null = 循环模式
let mapImage = null;         // 底图 Image
let previewIds = new Set();  // 方案列表悬停预览点位
let hoveredId = null;        // 当前悬停的点位
let layoutLocked = false;    // 是否已锁定全局布局（点击「确认布局」后）
let lockedGroup = null;      // 锁定时的唯一刷点组

const view = { scale: 1, tx: 0, ty: 0 };
const MIN_SCALE = 0.15;
const MAX_SCALE = 10;
const MARKER_R = 16;
const ICON_PX = 24;

let imgW = 0, imgH = 0;

/* ===================== DOM 引用 ===================== */
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const mapWrap = document.getElementById('mapWrap');
const mapTooltip = document.getElementById('mapTooltip');
const mapLoading = document.getElementById('mapLoading');
const mapTitleText = document.getElementById('mapTitleText');
const brushHint = document.getElementById('brushHint');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const confirmLayoutBtn = document.getElementById('confirmLayoutBtn');

let cw = 0, ch = 0;
const dpr = Math.max(1, window.devicePixelRatio || 1);

/* ===================== 工具 ===================== */
function pointNum(id) { return id.replace('p', ''); }

/* ===================== 图标绘制 ===================== */
function drawCipherTo(c, px) {
  const s = px / 72;
  c.save();
  c.scale(s, s);
  c.translate(-36, -36);
  c.fill(CIPHER_BODY);
  c.fill(CIPHER_ANTENNA);
  c.globalAlpha *= 0.22;
  c.fill(CIPHER_HALO);
  c.restore();
}

function drawCipherIcon(x, y, px, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  drawCipherTo(ctx, px);
  ctx.restore();
}

function drawCross(x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,59,48,0.7)';
  ctx.shadowBlur = 6;
  const k = r * 0.62;
  ctx.beginPath();
  ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k);
  ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
  ctx.stroke();
  ctx.restore();
}

function drawSlash(x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,59,48,0.6)';
  ctx.shadowBlur = 5;
  const k = r * 0.78;
  ctx.beginPath();
  ctx.moveTo(x - k, y + k);
  ctx.lineTo(x + k, y - k);
  ctx.stroke();
  ctx.restore();
}

function drawBadge(x, y, num) {
  const bx = x + MARKER_R * 0.55, by = y + MARKER_R * 0.55;
  ctx.beginPath();
  ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = '#c9a227';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#120e08';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, bx, by + 0.5);
}

/* 必刷点：未破译蓝星标（左上角） */
function drawStarBadge(x, y) {
  const cx = x - MARKER_R * 0.5, cy = y - MARKER_R * 0.55;
  const R = 7, r = 2.9;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rad = (i % 2 === 0) ? R : r;
    const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = CIPHER_BLUE;
  ctx.shadowColor = 'rgba(74,168,255,0.9)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,80,140,0.95)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawCompanionRing(x, y, strong) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, MARKER_R + 6, 0, Math.PI * 2);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = strong ? 'rgba(139,194,238,0.95)' : 'rgba(139,194,238,0.5)';
  ctx.lineWidth = 2;
  if (strong) { ctx.shadowColor = 'rgba(74,168,255,0.7)'; ctx.shadowBlur = 10; }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawSelectedRing(x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, MARKER_R + 6, 0, Math.PI * 2);
  ctx.strokeStyle = CIPHER_BLUE;
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(74,168,255,0.8)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function drawDeducedRing(x, y, now) {
  const pulse = 0.5 + 0.5 * Math.sin(now / 180);
  ctx.beginPath();
  ctx.arc(x, y, MARKER_R + 8 + pulse * 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(74,168,255,' + (0.55 + 0.45 * pulse).toFixed(3) + ')';
  ctx.lineWidth = 2.2;
  ctx.shadowColor = 'rgba(74,168,255,0.9)';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/* ===================== 画布尺寸 ===================== */
function resizeCanvas() {
  const rect = mapWrap.getBoundingClientRect();
  cw = rect.width;
  ch = rect.height;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}

/* ===================== 视图（缩放平移） ===================== */
function fitView() {
  if (!currentData) return;
  imgW = currentData.aspectW;
  imgH = currentData.aspectH;
  const s = Math.min(cw / imgW, ch / imgH) * 0.96;
  view.scale = s;
  view.tx = (cw - imgW * s) / 2;
  view.ty = (ch - imgH * s) / 2;
}

function clampView() {
  if (!currentData) return;
  const w = imgW * view.scale, h = imgH * view.scale;
  const m = 40;
  if (w <= cw) view.tx = (cw - w) / 2;
  else view.tx = Math.min(m, Math.max(cw - w - m, view.tx));
  if (h <= ch) view.ty = (ch - h) / 2;
  else view.ty = Math.min(m, Math.max(ch - h - m, view.ty));
}

function zoomAt(mx, my, factor) {
  const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const f = ns / view.scale;
  view.tx = mx - (mx - view.tx) * f;
  view.ty = my - (my - view.ty) * f;
  view.scale = ns;
  clampView();
}

/* ===================== 坐标换算 ===================== */
function pointMapPos(p) {
  return { x: (p.x / 100) * imgW, y: (p.y / 100) * imgH };
}
function mapToScreen(mx, my) {
  return { x: mx * view.scale + view.tx, y: my * view.scale + view.ty };
}
function eventXY(e) {
  // 优先用 offsetX/Y（相对 canvas 自身），与页面布局/UI 层变化解耦，保证命中判定稳定
  if (typeof e.offsetX === 'number' && typeof e.offsetY === 'number') {
    return { x: e.offsetX, y: e.offsetY };
  }
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function hitTest(sx, sy) {
  if (!currentData) return null;
  let best = null, bestD = 1e9;
  for (const p of currentData.allPoints) {
    if (layoutLocked && lockedGroup && !lockedGroup.points.has(p.id)) continue;
    const mp = pointMapPos(p);
    const sp = mapToScreen(mp.x, mp.y);
    const d = Math.hypot(sp.x - sx, sp.y - sy);
    if (d < MARKER_R + 9 && d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/* ===================== 渲染 ===================== */
function draw(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (!currentData || !mapImage) return;

  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.scale, view.scale);
  ctx.drawImage(mapImage, 0, 0, imgW, imgH);
  ctx.restore();

  for (const p of currentData.allPoints) drawMarker(p, now);
}

function drawMarker(p, now) {
  const mp = pointMapPos(p);
  const sp = mapToScreen(mp.x, mp.y);
  if (sp.x < -60 || sp.x > cw + 60 || sp.y < -60 || sp.y > ch + 60) return;

  const id = p.id;

  // 已锁定布局：仅渲染场上真实存在的 7 台密码机，按当前确定态着色（无推导/调试提示）
  if (layoutLocked) {
    if (!lockedGroup || !lockedGroup.points.has(id)) return;
    const meta = STATE_COLORS[pointStates[id]] || STATE_COLORS.hasCipher;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, MARKER_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.strokeStyle = meta.c;
    ctx.lineWidth = 1.8;
    if (meta.glow) { ctx.shadowColor = meta.glow; ctx.shadowBlur = 10; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawCipherIcon(sp.x, sp.y, ICON_PX, meta.c, 1);
    drawBadge(sp.x, sp.y, pointNum(id));
    ctx.restore();
    return;
  }

  const st = pointStates[id];
  const color = STATE_COLORS[st].c;
  const glow = STATE_COLORS[st].glow;
  const isUnknown = st === 'unknown';
  const isNo = st === 'noCipher';
  const isBig = st === 'big';
  const isSelected = HAS_FAMILY.includes(st);

  const isImpossible = isUnknown && linkage && linkage.impossible.has(id);
  const isCompanion = isUnknown && linkage && linkage.companions.has(id);
  const isDeduced = linkage && linkage.deduced.has(id);
  const isAlways = !!(engine && engine.isAlwaysSpawn(id));
  const preview = previewIds.has(id);

  // 悬浮预览（伴生/互斥）
  let hovComp = false, hovExcl = false;
  if (hoveredId && hoveredId !== id && isUnknown && engine) {
    if (!engine.isAlwaysSpawn(id) && engine.companionsOf(hoveredId).has(id)) hovComp = true;
    if (engine.exclusionsOf(hoveredId).has(id)) hovExcl = true;
  }

  const dim = isImpossible ? 0.35 : (hovExcl ? 0.5 : 1);

  ctx.save();
  ctx.globalAlpha = dim;

  // 底环
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, MARKER_R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  if (isImpossible || hovExcl) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(130,130,130,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (isNo) {
    ctx.strokeStyle = 'rgba(255,59,48,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (isUnknown) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = isBig ? 12 + 5 * Math.sin(now / 170) : 10; }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 方案列表悬停预览（使用「未破译」蓝，与其余确定态高亮一致）
  if (preview) {
    ctx.strokeStyle = CIPHER_BLUE;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(74,168,255,0.8)';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // 图标
  if (isImpossible) {
    drawCipherIcon(sp.x, sp.y, ICON_PX, '#8a8a8a', 0.5);
  } else if (isNo) {
    drawCipherIcon(sp.x, sp.y, ICON_PX, '#5b5b5b', 0.35);
    drawCross(sp.x, sp.y, MARKER_R * 0.95, '#ff3b30');
  } else if (isUnknown) {
    drawCipherIcon(sp.x, sp.y, ICON_PX, color, 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = 'bold ' + (MARKER_R * 0.85) + 'px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', sp.x, sp.y + 1);
  } else {
    drawCipherIcon(sp.x, sp.y, ICON_PX, color, 1);
  }

  // 编号角标
  drawBadge(sp.x, sp.y, pointNum(id));

  ctx.restore();

  // ---- 覆盖层（不受置灰影响） ----
  if (isImpossible) drawSlash(sp.x, sp.y, MARKER_R, '#ff3b30');
  if (isAlways) drawStarBadge(sp.x, sp.y);

  // 外圈高亮（按优先级取其一）
  if (isSelected) drawSelectedRing(sp.x, sp.y);
  else if (isCompanion) drawCompanionRing(sp.x, sp.y, true);
  else if (hovComp) drawCompanionRing(sp.x, sp.y, false);
  else if (isDeduced) drawDeducedRing(sp.x, sp.y, now);
}

/* ===================== 交互 ===================== */
function applyPoint(id) {
  if (activeBrush) setState(id, activeBrush);
  else cycle(id, 1);
}
function cycle(id, dir) {
  // 锁定布局下仅在确定态（未破译/小遗产/大遗产/已点亮）间轮转；
  // 必刷点同样跳过「未知 / 确认无密码机」
  const order = (layoutLocked || (engine && engine.isAlwaysSpawn(id))) ? HAS_FAMILY : STATE_ORDER;
  const idx = order.indexOf(pointStates[id]);
  const start = idx === -1 ? 0 : idx;
  const next = order[(start + dir + order.length) % order.length];
  setState(id, next);
}
function setState(id, state) {
  // 必刷点拦截：不允许进入「未知 / 确认无密码机」状态
  if (engine && engine.isAlwaysSpawn(id) && (state === 'unknown' || state === 'noCipher')) return;
  // 锁定布局拦截：移除「未知 / 确认无密码机」中间态
  if (layoutLocked && (state === 'unknown' || state === 'noCipher')) return;
  pointStates[id] = state;
  updateLegend();
  updateStatus();
}

/* ===================== 规则引擎联动推导 ===================== */
function recompute() {
  const sel = [], excl = [];
  for (const id in pointStates) {
    const st = pointStates[id];
    if (HAS_FAMILY.includes(st)) sel.push(id);
    else if (st === 'noCipher') excl.push(id);
  }

  const matched = engine.filterGroups(sel, excl);

  // 不可能点位：仍为未知、且不在任何匹配组中
  const impossible = new Set();
  for (const p of currentData.allPoints) {
    if (pointStates[p.id] !== 'unknown') continue;
    let inAny = false;
    for (const g of matched) if (g.points.has(p.id)) { inAny = true; break; }
    if (!inAny) impossible.add(p.id);
  }

  // 伴生高亮：已选点的伴生点（排除必刷点与已选点，仅未知）
  const companions = new Set();
  for (const id of sel) {
    for (const b of engine.companionsOf(id)) {
      if (b !== id && !engine.alwaysSpawn.has(b) && pointStates[b] === 'unknown') companions.add(b);
    }
  }

  // 推导：唯一匹配组中尚未标记的点
  const deduced = new Set();
  if (matched.length === 1) {
    for (const pid of matched[0].points) {
      if (pointStates[pid] === 'unknown') deduced.add(pid);
    }
  }

  return { sel: new Set(sel), excl: new Set(excl), matched, impossible, companions, deduced };
}

function reasonFor(preset) {
  for (const id in pointStates) {
    const st = pointStates[id];
    if (st === 'noCipher' && preset.points.includes(id)) return '点位' + pointNum(id) + '无密码机';
    if (HAS_FAMILY.includes(st) && !preset.points.includes(id)) return '缺点位' + pointNum(id);
  }
  return null;
}

/* ===================== 确认布局（全局布局锁定状态机） ===================== */
function updateConfirmLayoutBtn() {
  if (!confirmLayoutBtn) return;
  if (layoutLocked) {
    confirmLayoutBtn.disabled = true;
    confirmLayoutBtn.classList.remove('is-ready');
    confirmLayoutBtn.classList.add('is-locked');
    confirmLayoutBtn.textContent = '🔒 布局已锁定';
  } else {
    const unique = !!(linkage && linkage.matched.length === 1);
    confirmLayoutBtn.classList.remove('is-locked');
    confirmLayoutBtn.classList.toggle('is-ready', unique);
    confirmLayoutBtn.disabled = !unique;
    confirmLayoutBtn.textContent = '确认布局';
  }
}

function confirmLayout() {
  if (layoutLocked) return;
  if (!linkage || linkage.matched.length !== 1) return;
  layoutLocked = true;
  lockedGroup = linkage.matched[0];
  // 唯一方案内尚未标记的点位：确定为「未破译」密码机（移除未知/不存在中间态）
  for (const pid of lockedGroup.points) {
    if (pointStates[pid] === 'unknown' || pointStates[pid] === 'noCipher') {
      pointStates[pid] = 'hasCipher';
    }
  }
  activeBrush = null;
  brushHint.textContent = '布局已锁定：点击密码机 / 图例可切换 未破译 · 小遗产 · 大遗产 · 已点亮；点击右上角【重置】解除锁定';
  brushHint.classList.add('on');
  updateLegend();
  updateConfirmLayoutBtn();
  updateStatus();
}

/* ===================== DOM 更新 ===================== */
function updateStatus() {
  if (!currentData || !engine) return;
  linkage = recompute();
  const matched = linkage.matched;

  const countEl = document.getElementById('remainingCount');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const bar = document.getElementById('linkageBar');

  if (layoutLocked) {
    countEl.textContent = '7';
    countEl.classList.add('locked');
    countEl.classList.remove('conflict');
    statusBadge.textContent = '🔒 布局已确认';
    statusBadge.className = 'status-badge lock';
    statusText.textContent = '已锁定唯一布局：点击密码机 / 图例可切换状态（未破译 · 小遗产 · 大遗产 · 已点亮）；点击右上角【重置】解除锁定';
    const stCount = { hasCipher: 0, small: 0, big: 0, finish: 0 };
    if (lockedGroup) for (const pid of lockedGroup.points) {
      const s = pointStates[pid];
      if (stCount[s] !== undefined) stCount[s]++;
    }
    bar.innerHTML = '锁定方案：<b>' + (lockedGroup ? lockedGroup.name : '—') + '</b>　未破译 <b>' + stCount.hasCipher + '</b> · 小遗产 <b>' + stCount.small + '</b> · 大遗产 <b>' + stCount.big + '</b> · 已点亮 <b>' + stCount.finish + '</b>';
    updatePresetList();
    updateConfirmLayoutBtn();
    return;
  }

  countEl.textContent = matched.length;
  countEl.classList.toggle('locked', matched.length === 1);
  countEl.classList.toggle('conflict', matched.length === 0);

  if (matched.length === 1) {
    statusBadge.textContent = '🔒 刷点' + matched[0].name;
    statusBadge.className = 'status-badge lock';
    statusText.textContent = '已锁定唯一方案，未标记点位已高亮为「推导密码机」';
  } else if (matched.length === 0) {
    statusBadge.textContent = '⚠️ 无匹配方案';
    statusBadge.className = 'status-badge conflict';
    statusText.textContent = '标记存在矛盾，请复查点位状态';
  } else {
    statusBadge.textContent = '';
    statusBadge.className = 'status-badge';
    statusText.textContent = '继续标记点位以缩小范围（还剩 ' + matched.length + ' 组候选）';
  }

  // 联动信息条
  let html = '匹配组：<b>' + (matched.length ? matched.map(g => g.name).join('、') : '无') + '</b>';
  if (engine.alwaysSpawn.size) {
    html += '　<span class="star">★</span>必刷点：<b>' + [...engine.alwaysSpawn].map(id => pointNum(id) + '号').join('、') + '</b>';
  }
  html += '　已选 <b>' + linkage.sel.size + '</b> · 排除 <b>' + linkage.excl.size + '</b>';
  if (linkage.companions.size) {
    html += '　<span style="color:' + CIPHER_BLUE + '">伴生</span>：<b>' + [...linkage.companions].map(id => pointNum(id) + '号').join('、') + '</b>';
  }
  bar.innerHTML = html;

  updatePresetList();
  updateConfirmLayoutBtn();
}

function buildLegend() {
  const container = document.getElementById('legend');
  STATE_ORDER.forEach(s => {
    const meta = STATE_META[s];
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'legend-item';
    item.dataset.state = s;
    item.innerHTML =
      '<canvas class="legend-canvas" width="26" height="26"></canvas>' +
      '<span class="legend-label">' + meta.label + '</span>' +
      '<span class="legend-count">0</span>';
    item.addEventListener('click', () => setBrush(s));
    container.appendChild(item);
    paintLegendSwatch(item.querySelector('.legend-canvas'), s);
  });
}

function paintLegendSwatch(cv, state) {
  const c = cv.getContext('2d');
  const S = 26;
  c.clearRect(0, 0, S, S);
  c.save();
  c.translate(S / 2, S / 2);
  if (state === 'noCipher') {
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = '#5b5b5b';
    drawCipherTo(c, 20);
    c.restore();
    c.strokeStyle = '#ff3b30';
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-7, -7); c.lineTo(7, 7);
    c.moveTo(7, -7); c.lineTo(-7, 7);
    c.stroke();
  } else {
    c.globalAlpha = state === 'unknown' ? 0.45 : 1;
    c.fillStyle = STATE_COLORS[state].c;
    drawCipherTo(c, 20);
  }
  c.restore();
}

function updateLegend() {
  const counts = {};
  STATE_ORDER.forEach(s => { counts[s] = 0; });
  if (currentData) {
    // 锁定布局下仅统计场上 7 台真实密码机（隐藏非确定态计数）
    const pts = (layoutLocked && lockedGroup)
      ? currentData.allPoints.filter(p => lockedGroup.points.has(p.id))
      : currentData.allPoints;
    pts.forEach(p => { counts[pointStates[p.id]]++; });
  }
  STATE_ORDER.forEach(s => {
    const el = document.querySelector('.legend-item[data-state="' + s + '"]');
    if (!el) return;
    el.querySelector('.legend-count').textContent = counts[s];
    el.classList.toggle('brush-active', activeBrush === s);
    el.classList.toggle('is-disabled', layoutLocked && (s === 'unknown' || s === 'noCipher'));
  });
}

function setBrush(state) {
  // 锁定布局下仅允许设置确定态（未破译/小遗产/大遗产/已点亮）
  if (layoutLocked && (state === 'unknown' || state === 'noCipher')) return;
  activeBrush = (activeBrush === state) ? null : state;
  if (activeBrush) {
    brushHint.textContent = '画笔模式：「' + STATE_META[activeBrush].label + '」— 点击点位直接标记（再次点击图例取消）';
    brushHint.classList.add('on');
  } else {
    brushHint.textContent = '点击点位 = 状态轮换（右键 / 长按 = 回退）· 悬停查看联动关系';
    brushHint.classList.remove('on');
  }
  updateLegend();
}

function buildPresetList() {
  const container = document.getElementById('presetList');
  container.innerHTML = '';
  currentData.presets.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'preset-chip';
    chip.dataset.group = p.id;
    chip.innerHTML =
      '<div class="preset-head">' +
        '<span class="preset-name">刷点' + p.name + '</span>' +
        '<span class="preset-count">' + p.points.length + ' 台</span>' +
      '</div>' +
      '<div class="preset-status"></div>';
    chip.addEventListener('mouseenter', () => { previewIds = new Set(p.points); });
    chip.addEventListener('mouseleave', () => { previewIds = new Set(); });
    container.appendChild(chip);
  });
}

function updatePresetList() {
  const matchedIds = new Set(linkage.matched.map(g => g.id));
  currentData.presets.forEach(p => {
    const chip = document.querySelector('.preset-chip[data-group="' + p.id + '"]');
    if (!chip) return;
    const isIn = matchedIds.has(p.id);
    chip.classList.toggle('is-active', isIn);
    chip.classList.toggle('is-filtered', !isIn);
    chip.classList.toggle('is-locked', linkage.matched.length === 1 && isIn);
    const status = chip.querySelector('.preset-status');
    if (isIn) {
      status.textContent = '✓ 匹配';
      status.className = 'preset-status ok';
    } else {
      status.textContent = '✕ 排除（' + (reasonFor(p) || '矛盾') + '）';
      status.className = 'preset-status no';
    }
  });
}

/* ===================== 地图菜单 ===================== */
function buildMenu() {
  const container = document.getElementById('mapMenu');
  MAP_LIST.forEach(name => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-item';
    btn.dataset.map = name;
    btn.textContent = name;
    btn.addEventListener('click', () => loadMap(name));
    container.appendChild(btn);
  });
}
function setActiveMenu(name) {
  document.querySelectorAll('.map-item').forEach(el => {
    el.classList.toggle('active', el.dataset.map === name);
  });
}

/* ===================== 数据加载 ===================== */
function showLoading(on) { mapLoading.classList.toggle('hidden', !on); }
function showError(msg) {
  mapLoading.textContent = msg;
  mapLoading.style.animation = 'none';
  mapLoading.classList.remove('hidden');
}

async function loadMap(name) {
  showLoading(true);
  mapLoading.textContent = '加载地图数据…';
  mapLoading.style.animation = '';
  setActiveMenu(name);

  try {
    const res = await fetch('data/' + encodeURIComponent(name) + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    currentData = data;
    engine = new RuleEngine(data);   // 初始化规则引擎（自动推导必刷/互斥/伴生）
    pointStates = {};
    data.allPoints.forEach(p => { pointStates[p.id] = engine.isAlwaysSpawn(p.id) ? 'hasCipher' : 'unknown'; });
    previewIds = new Set();
    hoveredId = null;
    layoutLocked = false;
    lockedGroup = null;
    activeBrush = null;
    brushHint.textContent = '点击点位 = 状态轮换（右键 / 长按 = 回退）· 悬停查看联动关系';
    brushHint.classList.remove('on');
    imgW = data.aspectW;
    imgH = data.aspectH;

    mapTitleText.textContent = data.mapName + ' · ' + data.allPoints.length + ' 点位 / ' + data.presets.length + ' 组';
    document.title = data.mapName + ' · 密码机刷点推导工具';

    buildPresetList();
    updateLegend();
    updateStatus();

    await loadImage(data);
    fitView();
    showLoading(false);
  } catch (err) {
    showError('加载失败：请通过 HTTP 服务器访问（如双击「一键启动.bat」或 `npx serve`）。\n详情：' + err.message);
  }
}

function loadImage(data) {
  return new Promise(resolve => {
    const img = new Image();
    let triedRemote = false;
    img.onload = () => { mapImage = img; resolve(); };
    img.onerror = () => {
      if (!triedRemote && data.bgImageRemote) {
        triedRemote = true;
        img.src = data.bgImageRemote;
      } else {
        mapImage = null;
        resolve();
      }
    };
    img.src = data.bgImage;
  });
}

/* ===================== 侧边栏抽屉（悬浮 Overlay） ===================== */
function setSidebarCollapsed(collapsed) {
  sidebar.classList.toggle('is-collapsed', collapsed);
  drawerBackdrop.classList.toggle('show', !collapsed);
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
  sidebarToggle.innerHTML = collapsed ? CHEVRON_RIGHT_SVG : CHEVRON_LEFT_SVG;
  sidebarToggle.title = collapsed ? '打开地图菜单' : '收起地图菜单';
}

function bindSidebarToggle() {
  sidebarToggle.addEventListener('click', () => {
    setSidebarCollapsed(!sidebar.classList.contains('is-collapsed'));
  });

  // 点击遮罩层（或地图区域）自动收起抽屉
  drawerBackdrop.addEventListener('click', () => {
    setSidebarCollapsed(true);
  });
}

/* ===================== 事件绑定 ===================== */
let dragging = false, moved = false;
let suppressClick = false;          // 本次按压已由右键/长按回退处理，松开不再前进轮转
let lastX = 0, lastY = 0, downX = 0, downY = 0;

function bindEvents() {
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;   // 仅主键（左键/触摸）进入点击/拖拽；右键仅用于状态回退
    canvas.setPointerCapture(e.pointerId);
    dragging = true; moved = false;
    suppressClick = false;
    lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY;
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', e => {
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      view.tx += dx; view.ty += dy;
      lastX = e.clientX; lastY = e.clientY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) moved = true;
      clampView();
    } else {
      updateHover(e);
    }
  });

  canvas.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('dragging');
    if (!moved && !suppressClick) {
      const pos = eventXY(e);
      const p = hitTest(pos.x, pos.y);
      if (p) applyPoint(p.id);
    }
  });

  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    canvas.classList.remove('dragging');
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const pos = eventXY(e);
    const p = hitTest(pos.x, pos.y);
    if (p) {
      cycle(p.id, -1);
      suppressClick = true;   // 已回退，抬手时不再前进轮转（覆盖触屏长按）
    }
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const pos = eventXY(e);
    zoomAt(pos.x, pos.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  canvas.addEventListener('mouseleave', () => {
    hoveredId = null;
    mapTooltip.classList.add('hidden');
  });

  document.getElementById('zoomInBtn').addEventListener('click', () => zoomAt(cw / 2, ch / 2, 1.25));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomAt(cw / 2, ch / 2, 1 / 1.25));
  document.getElementById('zoomFitBtn').addEventListener('click', () => { fitView(); });
  confirmLayoutBtn.addEventListener('click', confirmLayout);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
}

function updateHover(e) {
  const pos = eventXY(e);
  const p = hitTest(pos.x, pos.y);
  hoveredId = p ? p.id : null;
  if (p) {
    canvas.style.cursor = 'pointer';
    mapTooltip.innerHTML = buildTooltip(p);
    mapTooltip.classList.remove('hidden');
    mapTooltip.style.left = Math.min(pos.x + 14, cw - 220) + 'px';
    mapTooltip.style.top = (pos.y - 12) + 'px';
  } else {
    canvas.style.cursor = '';
    mapTooltip.classList.add('hidden');
  }
}

function buildTooltip(p) {
  const id = p.id;
  if (layoutLocked) {
    const meta = STATE_META[pointStates[id]] || STATE_META.hasCipher;
    return '<b>' + p.name + '</b> · ' + meta.label + '（已锁定布局）';
  }
  const lines = [];
  lines.push('<b>' + p.name + '</b> · ' + STATE_META[pointStates[id]].label);
  if (engine.isAlwaysSpawn(id)) lines.push('<span class="tt-star">★ 必刷点（100% 组均出现）</span>');
  const comps = [...engine.companionsOf(id)].filter(b => b !== id && !engine.isAlwaysSpawn(b));
  if (comps.length) lines.push('<span class="tt-com">伴生：' + comps.map(b => pointNum(b) + '号').join('、') + '</span>');
  const excs = [...engine.exclusionsOf(id)];
  if (excs.length) lines.push('<span class="tt-exc">互斥：' + excs.map(b => pointNum(b) + '号').join('、') + '</span>');
  lines.push('<span class="tt-grp">所在组：' + engine.groupNamesOf(id).join('、') + '</span>');
  return lines.join('<br>');
}

function resetAll() {
  if (!currentData) return;
  layoutLocked = false;
  lockedGroup = null;
  activeBrush = null;
  currentData.allPoints.forEach(p => { pointStates[p.id] = engine.isAlwaysSpawn(p.id) ? 'hasCipher' : 'unknown'; });
  brushHint.textContent = '点击点位 = 状态轮换（右键 / 长按 = 回退）· 悬停查看联动关系';
  brushHint.classList.remove('on');
  updateLegend();
  updateStatus();
}

/* ===================== 主循环 ===================== */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(now) {
  // 减少动态效果：冻结 Canvas 脉冲相位，让推导蓝圈/大遗产光晕静止
  draw(prefersReducedMotion ? 0 : now);
  requestAnimationFrame(loop);
}

/* ===================== 启动 ===================== */
function initTour() {
  tour = mountTour({ steps: TOUR_STEPS });
  const restartBtn = document.getElementById('restartTourBtn');
  if (restartBtn) restartBtn.addEventListener('click', () => tour.restart());
  // 首次访问且未完成过指引时，自动触发
  if (!tour.isCompleted()) {
    requestAnimationFrame(() => requestAnimationFrame(() => tour.start()));
  }
}

async function init() {
  buildMenu();
  buildLegend();
  bindEvents();
  bindSidebarToggle();
  resizeCanvas();
  fitView();
  await loadMap(DEFAULT_MAP);
  requestAnimationFrame(loop);
  initTour();
}

window.addEventListener('resize', () => {
  resizeCanvas();
  clampView();
});

init();
