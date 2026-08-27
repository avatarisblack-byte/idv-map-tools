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
  let savedScrollTop = 0;   // 进入指引前的滚动位置（结束时恢复）
  let scrolling = false;      // 平滑滚动进行中（临时关闭 spotlight/popover 过渡，避免闪烁）
  let scrollEndTimer = null;  // scrollend 兜底定时器

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
    if (!step.target) return null;
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

  /* 平滑滚动到目标（竖屏长页面下，确保目标进入视口、聚光灯能框选） */
  function finishScroll() {
    if (!scrolling) return;
    scrolling = false;
    clearTimeout(scrollEndTimer);
    spotlight.style.transition = '';
    popover.style.transition = '';
    reposition();
  }

  /* 滚动静止后收尾：每次滚动事件都重置计时器，真正停稳才恢复过渡 */
  function scheduleFinish() {
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(finishScroll, 120);
  }

  function scrollTargetIntoView(step) {
    if (!step.target) return false;
    const rect = targetRect(step);
    if (!rect) return false;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    // 目标已基本在视口内则无需滚动。注意：横屏页面 overflow:hidden 根本滚不动，
    // 若按「是否在视口中心」判断会误触发滚动，导致聚光灯定位被推迟到 120ms 后才执行。
    const inView = rect.top >= -MARGIN && rect.left >= -MARGIN &&
                   rect.bottom <= vh + MARGIN && rect.right <= vw + MARGIN;
    if (inView) return false;
    const sels = Array.isArray(step.target) ? step.target : [step.target];
    const el = sels.map(s => document.querySelector(s)).find(Boolean);
    if (!el) return false;
    // 平滑滚动期间关闭 spotlight/popover 过渡，让其紧贴目标，避免与滚动叠加造成闪烁
    scrolling = true;
    spotlight.style.transition = 'none';
    popover.style.transition = 'none';
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    scheduleFinish();  // 滚动静止 120ms 后收尾（scrollend 仍为即时路径）
    return true;
  }

  /* ---------- 定位：聚光灯 ---------- */
  function positionSpotlight(rect) {
    if (!rect) {
      // 无目标（居中气泡）步骤：聚光灯直接高亮整个提示气泡。
      // 用「居中公式 + offsetWidth/offsetHeight」而非 getBoundingClientRect，
      // 避免气泡 left/top 过渡期间取到插值位置导致亮区偏移。
      const pw = popover.offsetWidth;
      const ph = popover.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = Math.max(MARGIN, (vw - pw) / 2);   // 与 positionPopover 居中公式一致
      const cy = Math.max(MARGIN, (vh - ph) / 2);
      spotlight.style.display = 'block';
      spotlight.style.left = (cx - PAD) + 'px';
      spotlight.style.top = (cy - PAD) + 'px';
      spotlight.style.width = (pw + PAD * 2) + 'px';
      spotlight.style.height = (ph + PAD * 2) + 'px';
      return;
    }
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
    positionPopover(rect);
    positionSpotlight(rect);
  }

  /* ---------- 步骤渲染 ---------- */
  function showStep(index) {
    current = index;
    const step = steps[index];
    const last = index === steps.length - 1;

    titleEl.textContent = step.title;
    bodyEl.innerHTML = renderBody(step.text || '') + renderLinks(step.link);
    progressEl.textContent = (index + 1) + '/' + steps.length;

    // 每次切换重播内容切入动画（移除类 → 强制重排 → 加回类）
    popover.classList.remove('tour-switching');
    void popover.offsetWidth;
    popover.classList.add('tour-switching');

    prevBtn.disabled = index === 0;
    nextBtn.style.display = last ? 'none' : '';
    finishBtn.style.display = last ? '' : 'none';
    skipBtn.style.display = last ? 'none' : '';

    // 先平滑滚动到目标（竖屏长页面下确保框选得到）
    const willScroll = scrollTargetIntoView(step);
    if (willScroll) {
      // 滚动中：定位交给 scroll 事件的 reposition 实时跟随，避免定位到旧位置
      requestAnimationFrame(() => {
        if (scrolling) { popover.focus(); return; }
        const rect = targetRect(step);
        positionPopover(rect);
        positionSpotlight(rect);
        popover.focus();
      });
    } else {
      // 无需滚动：同步定位，文字、切入动画与聚光灯过渡在同一帧发生，消除「文字先变、框后到」
      const rect = targetRect(step);
      positionPopover(rect);
      positionSpotlight(rect);
      popover.focus();
    }
  }

  /* ---------- 生命周期 ---------- */
  function start() {
    savedScrollTop = (document.scrollingElement || document.documentElement).scrollTop;
    active = true;
    document.body.classList.remove('tour-closing');
    document.body.classList.add('tour-active');
    blocker.style.display = 'block';
    popover.style.display = 'block';

    // 首次显示：临时禁用位移过渡，避免 popover/spotlight 从上次关闭时的残留位置「飞来」；
    // 入场只保留淡入动画（tour-pop-in / tour-spot-in），定位完成后恢复过渡供步骤间平滑移动。
    popover.style.transition = 'none';
    spotlight.style.transition = 'none';

    showStep(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        popover.style.transition = '';
        spotlight.style.transition = '';
      });
    });
  }

  function complete() {
    if (!active) return;
    active = false;
    try { localStorage.setItem(storageKey, 'true'); } catch (e) { /* ignore */ }
    scrolling = false;
    clearTimeout(scrollEndTimer);
    // 先恢复滚动位置（遮罩尚在，避免淡出后页面跳动）
    (document.scrollingElement || document.documentElement).scrollTop = savedScrollTop;
    // 播放淡出动画，结束后再隐藏
    document.body.classList.remove('tour-active');
    document.body.classList.add('tour-closing');
    popover.style.pointerEvents = 'none';
    setTimeout(() => {
      document.body.classList.remove('tour-closing');
      blocker.style.display = 'none';
      spotlight.style.display = 'none';
      popover.style.display = 'none';
      popover.style.pointerEvents = '';
    }, 200);
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
  document.addEventListener('scroll', () => {
    reposition();
    if (scrolling) scheduleFinish();  // 滚动中持续重置静止计时，停稳后才恢复过渡
  }, true); // 捕获内部滚动（右侧面板等）
  document.addEventListener('scrollend', finishScroll);  // 平滑滚动结束后恢复过渡并最终定位

  return { start, restart: start, isCompleted };
}
