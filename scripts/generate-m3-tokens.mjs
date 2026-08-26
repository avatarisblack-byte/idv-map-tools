/**
 * 生成 MD3 全局设计 Token（src/styles/md3-tokens.css）
 * ---------------------------------------------------------------------
 * 用法：npm run tokens           # 使用默认种子色 #c9a227（现有主题金色）
 *       node scripts/generate-m3-tokens.mjs "#6750a4"   # 自定义种子色
 * ---------------------------------------------------------------------
 * 依赖 @material/material-color-utilities 的 Dynamic Color 能力，
 * 在「构建期」生成静态 CSS 变量；运行时无 importmap、无框架、无构建。
 */
import { argbFromHex, hexFromArgb, themeFromSourceColor } from '@material/material-color-utilities';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/styles/md3-tokens.css');
const SEED = process.argv[2] || '#c9a227';

/* MD3 ColorScheme 角色（camelCase → kebab-case 输出 --md-sys-color-*） */
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'outline', 'outlineVariant',
  'shadow', 'scrim',
  'inverseSurface', 'inverseOnSurface', 'inversePrimary'
];

/* Surface Container 层级：来自 neutral 调色板的官方 M3 色调 */
const SURFACE_TONES = {
  dark:  { dim: 6, bright: 24, lowest: 4, low: 10, container: 12, high: 17, highest: 22 },
  light: { dim: 87, bright: 98, lowest: 100, low: 96, container: 94, high: 92, highest: 90 }
};

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function colorBlock(obj, indent = '  ') {
  const lines = [];
  for (const role of ROLES) {
    const v = obj[role];
    if (v === undefined || v === null) continue;
    const hex = typeof v === 'number' ? hexFromArgb(v) : String(v);
    lines.push(`${indent}--md-sys-color-${kebab(role)}: ${hex};`);
  }
  return lines.join('\n');
}

function surfaceBlock(neutral, scheme, indent = '  ') {
  const t = SURFACE_TONES[scheme];
  const map = {
    'surface-dim': t.dim,
    'surface-bright': t.bright,
    'surface-container-lowest': t.lowest,
    'surface-container-low': t.low,
    'surface-container': t.container,
    'surface-container-high': t.high,
    'surface-container-highest': t.highest
  };
  const lines = [];
  for (const [name, tone] of Object.entries(map)) {
    lines.push(`${indent}--md-sys-color-${name}: ${hexFromArgb(neutral.tone(tone))};`);
  }
  return lines.join('\n');
}

const theme = themeFromSourceColor(argbFromHex(SEED));
const light = typeof theme.schemes.light.toJSON === 'function'
  ? theme.schemes.light.toJSON()
  : theme.schemes.light;
const dark = typeof theme.schemes.dark.toJSON === 'function'
  ? theme.schemes.dark.toJSON()
  : theme.schemes.dark;
const neutral = theme.palettes.neutral;

const TYPEFACE = [
  '  --md-ref-typeface-plain: "Roboto", "Noto Sans SC", "Noto Sans", system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;',
  '  --md-ref-typeface-brand: "Roboto", "Noto Sans SC", "Noto Sans", system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;'
].join('\n');

const SHAPE = [
  '  --md-sys-shape-corner-xs: 4px;',
  '  --md-sys-shape-corner-sm: 8px;',
  '  --md-sys-shape-corner-md: 12px;',
  '  --md-sys-shape-corner-lg: 16px;',
  '  --md-sys-shape-corner-xl: 28px;',
  '  --md-sys-shape-corner-full: 9999px;'
].join('\n');

const ELEVATION = [
  '  --md-sys-elevation-level-0: none;',
  '  --md-sys-elevation-level-1: 0px 1px 2px rgba(0, 0, 0, 0.30), 0px 1px 3px 1px rgba(0, 0, 0, 0.15);',
  '  --md-sys-elevation-level-2: 0px 1px 2px rgba(0, 0, 0, 0.30), 0px 2px 6px 2px rgba(0, 0, 0, 0.15);',
  '  --md-sys-elevation-level-3: 0px 1px 3px rgba(0, 0, 0, 0.30), 0px 4px 8px 3px rgba(0, 0, 0, 0.15);',
  '  --md-sys-elevation-level-4: 0px 2px 3px rgba(0, 0, 0, 0.30), 0px 6px 10px 4px rgba(0, 0, 0, 0.15);',
  '  --md-sys-elevation-level-5: 0px 4px 4px rgba(0, 0, 0, 0.30), 0px 8px 12px 6px rgba(0, 0, 0, 0.15);'
].join('\n');

const css = `/* =====================================================================
 * Material Design 3 — 全局设计 Token（自动生成，请勿手改）
 * ---------------------------------------------------------------------
 * 生成脚本：scripts/generate-m3-tokens.mjs  →  npm run tokens
 * 种子色 seed：${SEED}（现有主题金色 #c9a227）
 * 依赖：@material/material-color-utilities（Dynamic Color 调色板，构建期使用）
 * ===================================================================== */

:root {
  color-scheme: dark;

  /* ---- Dynamic Color（暗色方案，默认） ---- */
${colorBlock(dark)}
${surfaceBlock(neutral, 'dark')}

  /* ---- 字体栈（Typeface） ---- */
${TYPEFACE}

  /* ---- 圆角（Shape） ---- */
${SHAPE}

  /* ---- 阴影层级（Elevation Level 0–5） ---- */
${ELEVATION}
}

/* 亮色方案（可选：给 <html> 加 .md3-light 类启用） */
.md3-light {
  color-scheme: light;
${colorBlock(light)}
${surfaceBlock(neutral, 'light')}
}
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css, 'utf8');
console.log('✅ 已生成 ' + OUT);
console.log('   种子色: ' + SEED + ' → primary: ' + hexFromArgb(dark.primary));
