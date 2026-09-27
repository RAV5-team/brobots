// Read-only аудит стилей секции «dev» для Figma MCP (инструмент use_figma).
// Ничего не меняет в файле: только обходит узлы и считает частоты.
// Результат: палитра, типографика, радиусы, тени, отступы auto layout.
// Запуск в Claude Code: попросите выполнить этот скрипт через use_figma
// для fileKey sd1kJRdpW6RBFzSi1ztXYK и сохранить вывод в apps/web/docs/design/audit.json.

const ROOT_ID = '15935:2';
const root = await figma.getNodeByIdAsync(ROOT_ID);
if (!root) throw new Error('Node ' + ROOT_ID + ' not found');

const colors = {}, texts = {}, radii = {}, effects = {}, gaps = {}, pads = {};
const layout = { auto: 0, none: 0 };

const hex = (c) =>
  '#' + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const add = (m, k) => { m[k] = (m[k] || 0) + 1; };
const paintKey = (p) => {
  if (p.type !== 'SOLID') return p.type;
  const o = p.opacity !== undefined && p.opacity < 1 ? '@' + p.opacity.toFixed(2) : '';
  return hex(p.color) + o;
};
const visiblePaints = (arr) => (Array.isArray(arr) ? arr.filter((p) => p.visible !== false) : []);

function walk(n) {
  if (n.visible === false) return;

  if (n.type !== 'TEXT' && 'fills' in n) visiblePaints(n.fills).forEach((p) => add(colors, 'fill ' + paintKey(p)));
  if ('strokes' in n) visiblePaints(n.strokes).forEach((p) => add(colors, 'stroke ' + paintKey(p)));

  if (n.type === 'TEXT') {
    const segs = n.getStyledTextSegments(['fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'fills']);
    for (const s of segs) {
      const lh = s.lineHeight.unit === 'AUTO' ? 'auto'
        : s.lineHeight.value + (s.lineHeight.unit === 'PERCENT' ? '%' : 'px');
      const ls = s.letterSpacing.value ? ' ls ' + s.letterSpacing.value + (s.letterSpacing.unit === 'PERCENT' ? '%' : 'px') : '';
      add(texts, s.fontName.family + ' ' + s.fontName.style + ' ' + s.fontSize + '/' + lh + ls);
      visiblePaints(s.fills).forEach((p) => add(colors, 'text ' + paintKey(p)));
    }
  }

  if ('cornerRadius' in n && typeof n.cornerRadius === 'number' && n.cornerRadius > 0) add(radii, n.cornerRadius);

  if ('effects' in n && n.effects.length) {
    const e = n.effects.filter((x) => x.visible !== false).map((x) => ({
      type: x.type, radius: x.radius, offset: x.offset, spread: x.spread,
      color: x.color ? hex(x.color) + '@' + x.color.a.toFixed(2) : undefined,
    }));
    if (e.length) add(effects, JSON.stringify(e));
  }

  if ('layoutMode' in n) {
    if (n.layoutMode === 'NONE') layout.none++;
    else {
      layout.auto++;
      add(gaps, n.itemSpacing);
      add(pads, [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].join(' '));
    }
  }

  if ('children' in n) n.children.forEach(walk);
}

// Только экраны: подписи шагов и прочие элементы доски в токены не попадают.
root.findAll(n => n.type === 'FRAME' && n.name.startsWith('экран · ')).forEach(walk);

const top = (m, k) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, k);
return {
  layout,
  colors: top(colors, 60),
  typography: top(texts, 40),
  radii: top(radii, 20),
  gaps: top(gaps, 20),
  paddings: top(pads, 30),
  effects: top(effects, 15),
};
