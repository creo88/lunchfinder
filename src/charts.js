// Small SVG charts drawn at the container's real width so text never scales
// down on a phone. Every mark is focusable and carries a tooltip; every chart
// has a table twin (see app.js). Labels go in with textContent only.

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Bar path: 4px rounded data end on the right, square on the baseline.
function barPath(x, y, w, h, r = 4) {
  if (w <= 0) return '';
  const rr = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + h - rr}A${rr},${rr} 0 0 1 ${x + w - rr},${y + h}H${x}Z`;
}

function svgRoot(width, height, label) {
  return el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label });
}

function markTarget(node, tip, onTip) {
  node.setAttribute('tabindex', '0');
  node.setAttribute('aria-label', tip);
  node.classList.add('mark');
  node.addEventListener('pointermove', (e) => onTip(tip, e.clientX, e.clientY));
  node.addEventListener('pointerleave', () => onTip(null));
  node.addEventListener('focus', () => {
    const box = node.getBoundingClientRect();
    onTip(tip, box.left + box.width / 2, box.top);
  });
  node.addEventListener('blur', () => onTip(null));
}

// Horizontal bars for ordered stages (journey) or bands (age).
// rows: [{ label, value, valueText, tip }]
// On narrow screens labels sit above their bar instead of beside it.
const NARROW = 480;

export function horizontalBars(container, rows, { onTip, ariaLabel, track = false, max }) {
  const width = Math.max(260, container.clientWidth);
  const stacked = width < NARROW;
  const labelW = stacked ? 0 : Math.min(150, Math.round(width * 0.36));
  const valueW = 78;
  const rowH = stacked ? 44 : 34;
  const barH = 14;
  const height = rows.length * rowH + 4;
  const plotW = width - labelW - valueW;
  const top = Math.max(1, max ?? Math.max(...rows.map((r) => r.value)));
  const svg = svgRoot(width, height, ariaLabel);

  rows.forEach((row, i) => {
    const y = i * rowH + 4;
    const by = stacked ? y + 20 : y + (rowH - barH) / 2 - 2;
    const w = (plotW * row.value) / top;
    const g = el('g');
    g.append(el('text', { x: 0, y: stacked ? y + 12 : by + barH - 3, class: 'chart-label' }, row.label));
    if (track) g.append(el('rect', { x: labelW, y: by, width: plotW, height: barH, class: 'chart-track', rx: 2 }));
    g.append(el('path', { d: barPath(labelW, by, w, barH), class: `bar ramp-${Math.min(i, 3) + 1}` }));
    const value = el('text', { x: labelW + w + 8, y: by + barH - 3, class: 'chart-value' });
    value.append(el('tspan', { class: 'chart-value-strong' }, String(row.value)));
    if (row.valueText) value.append(el('tspan', { class: 'chart-value-soft', dx: 6 }, row.valueText));
    g.append(value);
    // Hit target: the whole row, bigger than the bar.
    const hit = el('rect', { x: 0, y, width, height: rowH, class: 'hit' });
    markTarget(hit, row.tip, onTip);
    g.append(hit);
    svg.append(g);
  });

  container.replaceChildren(svg);
}

// Dumbbell: start → end score per skill area, on a 0–100% axis.
export function dumbbell(container, areas, { onTip, ariaLabel }) {
  const width = Math.max(260, container.clientWidth);
  const stacked = width < NARROW;
  const labelW = stacked ? 0 : Math.min(160, Math.round(width * 0.38));
  const leftPad = stacked ? 24 : 0;
  const rightPad = 40;
  const rowH = stacked ? 46 : 32;
  const axisH = 22;
  const height = areas.length * rowH + axisH;
  const plotW = width - labelW - leftPad - rightPad;
  const sx = (v) => labelW + leftPad + plotW * v;
  const svg = svgRoot(width, height, ariaLabel);

  const grid = el('g');
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    grid.append(el('line', { x1: sx(v), x2: sx(v), y1: 0, y2: areas.length * rowH, class: 'chart-grid' }));
    grid.append(el('text', { x: sx(v), y: areas.length * rowH + 16, class: 'chart-tick', 'text-anchor': 'middle' }, `${v * 100}%`));
  }
  svg.append(grid);

  areas.forEach((a, i) => {
    const cy = stacked ? i * rowH + 32 : i * rowH + rowH / 2;
    const g = el('g');
    g.append(el('text', { x: 0, y: stacked ? i * rowH + 13 : cy + 4, class: 'chart-label' }, a.label));
    g.append(el('line', { x1: sx(a.pre), x2: sx(a.post), y1: cy, y2: cy, class: 'dumbbell-line' }));
    g.append(el('circle', { cx: sx(a.pre), cy, r: 5.5, class: 'dot dot-pre' }));
    g.append(el('circle', { cx: sx(a.post), cy, r: 5.5, class: 'dot dot-post' }));
    g.append(el('text', { x: sx(a.pre) - 10, y: cy + 4, class: 'chart-tick', 'text-anchor': 'end' }, `${Math.round(a.pre * 100)}`));
    g.append(el('text', { x: sx(a.post) + 10, y: cy + 4, class: 'chart-value-strong' }, `${Math.round(a.post * 100)}%`));
    const gain = Math.round(a.post * 100) - Math.round(a.pre * 100);
    const hit = el('rect', { x: 0, y: i * rowH, width, height: rowH, class: 'hit' });
    markTarget(hit, `${a.label}: ${Math.round(a.pre * 100)}% at the start, ${Math.round(a.post * 100)}% at the end (${gain >= 0 ? '+' : ''}${gain} pts)`, onTip);
    g.append(hit);
    svg.append(g);
  });

  container.replaceChildren(svg);
}
