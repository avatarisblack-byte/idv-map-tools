/* =====================================================================
 * 新手指引 (Onboarding Tour)
 * ---------------------------------------------------------------------
 * 纯 DOM 实现（无框架依赖）：
 *   - 遮罩聚光灯（Spotlight）：高亮目标元素，其余区域半透明遮罩
 *   - 引导卡片（Popover）：自动计算 Top/Bottom/Left/Right 最佳弹出位置
 *   - 控制：上一步 / 下一步 / 跳过指引 / 完成 + 右上角进度
 *   - localStorage：完成或跳过后记录 hasCompletedTour = true，不再自动触发
 *   - 步骤字段：target / title / text，可选 link: { text, href }（或数组）渲染可点击链接
 *
 * 用法：
 *   import { mountTour } from './tour.js';
 *   const tour = mountTour({ steps });
 *   tour.start();            // 立即开始（首次访问自动触发）
 *   tour.restart();          // 手动重启指引
 *   tour.isCompleted();      // 是否已完成过
 * ===================================================================== */

const DEFAULT_STORAGE_KEY = 'hasCompletedTour';

export function mountTour({ steps = [], storageKey = DEFAULT_STORAGE_KEY } = {}) {
  if (!steps.length) {
    return { start() {}, restart() {}, isCompleted() { return true; } };
  }

  let current = 0;
  let active = false;

  /* ---------- 构建 DOM ---------- */
  const blocker = document.createElement('div');
  blocker.className = 'tour-blocker';

  const spotlight = document.createElement('div');
  spotlight.className = 'tour-spotlight';

  const popover = document.createElement('div');
  popover.className = 'tour-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'true');
  popover.setAttribute('aria-label', '新手指引');
  popover.setAttribute('tabindex', '-1');
  popover.innerHTML =
    '<div class="tour-progress"></div>' +
    '<h3 class="tour-title"></h3>' +
    '<div class="tour-body"></div>' +
    '<div class="tour-actions">' +
      '<button type="button" class="tour-btn tour-skip">跳过指引</button>' +
      '<span class="tour-spacer"></span>' +
      '<button type="button" class="tour-btn tour-prev">上一步</button>' +
      '<button type="button" class="tour-btn tour-next tour-primary">下一步</button>' +
      '<button type="button" class="tour-btn tour-finish tour-primary">完成</button>' +
    '</div>' +
    '<div class="tour-arrow"></div>';

  document.body.append(blocker, spotlight, popover);

  const titleEl = popover.querySelector('.tour-title');
  const bodyEl = popover.querySelector('.tour-body');
  const progressEl = popover.querySelector('.tour-progress');
  const arrowEl = popover.querySelector('.tour-arrow');
  const prevBtn = popover.querySelector('.tour-prev');
  const nextBtn = popover.querySelector('.tour-next');
  const finishBtn = popover.querySelector('.tour-finish');
  const skipBtn = popover.querySelector('.tour-skip');

  /* ---------- 常量 ---------- */
  const PAD = 8;      // 聚光灯外扩间距
  const GAP = 14;     // 弹窗与目标的间距
  const MARGIN = 12;  // 弹窗距视口边距

  /* ---------- 工具 ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function renderBody(text) {
    return text.split('\n').map(line => '<div class="tour-line">' + escapeHtml(line) + '</div>').join('');
  }

  /* 可点击链接：支持单个对象或数组 { text, href } */
  function renderLinks(link) {
    if (!link) return '';
    const links = Array.isArray(link) ? link : [link];
    return links
      .filter(l => l && l.href)
      .map(l =>
        '<div class="tour-line">' +
          '<a class="tour-link" href="' + escapeHtml(l.href) +
          '" target="_blank" rel="noopener noreferrer" aria-label="' + escapeHtml(l.text || l.href) + '（新窗口打开）">' +
            escapeHtml(l.text || l.href) +
          '</a>' +
        '</div>'
      )
      .join('');
  }

  /* 目标矩形：支持单个选择器或选择器数组（取并集） */
  function targetRect(step) {
    const sels = Array.isArray(step.target) ? step.target : [step.target];
    const rects = [];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) rects.push(r);
    }
    if (!rects.length) return null;
    const rect = {
      left: Math.min(...rects.map(r => r.left)),
      top: Math.min(...rects.map(r => r.top)),
      right: Math.max(...rects.map(r => r.right)),
      bottom: Math.max(...rects.map(r => r.bottom))
    };
    rect.width = rect.right - rect.left;
    rect.height = rect.bottom - rect.top;
    return rect;
  }

  /* ---------- 定位：聚光灯 ---------- */
  function positionSpotlight(rect) {
    if (!rect) { spotlight.style.display = 'none'; return; }
    spotlight.style.display = 'block';
    spotlight.style.left = (rect.left - PAD) + 'px';
    spotlight.style.top = (rect.top - PAD) + 'px';
    spotlight.style.width = (rect.width + PAD * 2) + 'px';
    spotlight.style.height = (rect.height + PAD * 2) + 'px';
  }

  /* ---------- 定位：引导卡片（自动选方向） ---------- */
  function positionPopover(rect) {
    const pw = popover.offsetWidth;
    const ph = popover.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!rect) {
      popover.style.left = Math.max(MARGIN, (vw - pw) / 2) + 'px';
      popover.style.top = Math.max(MARGIN, (vh - ph) / 2) + 'px';
      popover.dataset.placement = 'center';
      arrowEl.style.display = 'none';
      return;
    }

    const space = {
      top: rect.top - MARGIN,
      bottom: vh - rect.bottom - MARGIN,
      left: rect.left - MARGIN,
      right: vw - rect.right - MARGIN
    };
    // 选择可用空间最大的方向（同空间时优先 bottom → top → right → left）
    let placement = 'bottom';
    let best = -Infinity;
    for (const p of ['bottom', 'top', 'right', 'left']) {
      if (space[p] > best) { best = space[p]; placement = p; }
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let left, top;
    if (placement === 'bottom') {
      left = cx - pw / 2;
      top = rect.bottom + GAP;
    } else if (placement === 'top') {
      left = cx - pw / 2;
      top = rect.top - GAP - ph;
    } else if (placement === 'right') {
      left = rect.right + GAP;
      top = cy - ph / 2;
    } else { // left
      left = rect.left - GAP - pw;
      top = cy - ph / 2;
    }

    // 收敛到视口内
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - pw - MARGIN));
    top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - ph - MARGIN));

    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
    popover.dataset.placement = placement;

    positionArrow(placement, rect, left, top, pw, ph);
  }

  function positionArrow(placement, rect, popLeft, popTop, pw, ph) {
    if (placement === 'center') { arrowEl.style.display = 'none'; return; }
    const MIN = 16;
    if (placement === 'bottom' || placement === 'top') {
      const cx = rect.left + rect.width / 2;
      let x = cx - popLeft;
      x = Math.min(Math.max(x, MIN), pw - MIN);
      arrowEl.style.left = x + 'px';
      arrowEl.style.top = '';
      arrowEl.style.bottom = '';
    } else {
      const cy = rect.top + rect.height / 2;
      let y = cy - popTop;
      y = Math.min(Math.max(y, MIN), ph - MIN);
      arrowEl.style.top = y + 'px';
      arrowEl.style.left = '';
      arrowEl.style.right = '';
    }
    arrowEl.style.display = 'block';
  }

  function reposition() {
    if (!active) return;
    const rect = targetRect(steps[current]);
    positionSpotlight(rect);
    positionPopover(rect);
  }

  /* ---------- 步骤渲染 ---------- */
  function showStep(index) {
    current = index;
    const step = steps[index];
    const last = index === steps.length - 1;

    titleEl.textContent = step.title;
    bodyEl.innerHTML = renderBody(step.text || '') + renderLinks(step.link);
    progressEl.textContent = (index + 1) + '/' + steps.length;

    prevBtn.disabled = index === 0;
    nextBtn.style.display = last ? 'none' : '';
    finishBtn.style.display = last ? '' : 'none';
    skipBtn.style.display = last ? 'none' : '';

    // 待内容渲染完成后测量尺寸再定位
    requestAnimationFrame(() => {
      const rect = targetRect(step);
      positionSpotlight(rect);
      positionPopover(rect);
      popover.focus();
    });
  }

  /* ---------- 生命周期 ---------- */
  function start() {
    active = true;
    document.body.classList.add('tour-active');
    blocker.style.display = 'block';
    popover.style.display = 'block';
    showStep(0);
  }

  function complete() {
    try { localStorage.setItem(storageKey, 'true'); } catch (e) { /* ignore */ }
    active = false;
    document.body.classList.remove('tour-active');
    blocker.style.display = 'none';
    spotlight.style.display = 'none';
    popover.style.display = 'none';
  }

  function isCompleted() {
    try { return localStorage.getItem(storageKey) === 'true'; } catch (e) { return false; }
  }

  /* ---------- 事件绑定 ---------- */
  prevBtn.addEventListener('click', () => { if (current > 0) showStep(current - 1); });
  nextBtn.addEventListener('click', () => { if (current < steps.length - 1) showStep(current + 1); });
  finishBtn.addEventListener('click', complete);
  skipBtn.addEventListener('click', complete);

  document.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') { complete(); }
    else if (e.key === 'ArrowRight') { if (current < steps.length - 1) showStep(current + 1); }
    else if (e.key === 'ArrowLeft') { if (current > 0) showStep(current - 1); }
  });

  window.addEventListener('resize', reposition);
  document.addEventListener('scroll', reposition, true); // 捕获内部滚动（右侧面板等）

  return { start, restart: start, isCompleted };
}
