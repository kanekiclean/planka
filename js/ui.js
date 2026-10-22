import * as db from './db.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1, 12);
}
export const todayYmd = () => ymd(new Date());
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function fmtLong(s) {
  const d = parseYmd(s);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
export function fmtShort(s) {
  const d = parseYmd(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const pts = (n) => `${n} ${plural(n, 'очко', 'очка', 'очков')}`;
export const daysWord = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

const P = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  layers: '<path d="M12 4l8 4-8 4-8-4 8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  fwd: '<path d="M9 5l7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  spark: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  images: '<rect x="7" y="3" width="14" height="14" rx="3"/><path d="M3 8v10a3 3 0 0 0 3 3h10"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  list: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  quote: '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
  stat: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  share: '<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};

export function icon(name, size = 20, sw = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function logo() {
  return `<span class="logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M3 7h18" style="stroke:var(--accent)"/><path d="M7 20v-8M12 20v-10M17 20v-5" style="stroke:currentColor"/></svg><span>Планка</span></span>`;
}

export function toast(msg, kind = '') {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.setAttribute('role', 'status');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, kind === 'err' ? 4800 : 3000);
}

export function openSheet(html, { label = '', onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="sheet__handle" aria-hidden="true"></div>${html}</div>`;
  document.body.appendChild(back);
  document.body.classList.add('noscroll');
  const el = back.firstElementChild;
  let closed = false;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    if (closed) return;
    closed = true;
    back.classList.add('out');
    document.body.classList.remove('noscroll');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => back.remove(), 220);
    if (onClose) onClose();
  }
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  return { el, close };
}

export function confirmSheet({ title, text = '', ok = 'Да', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const s = openSheet(`
      <div class="stack">
        <h2 class="h2">${esc(title)}</h2>
        ${text ? `<p class="muted small m0">${esc(text)}</p>` : ''}
        <div class="stack" style="--gap:10px">
          <button class="btn btn--block ${danger ? 'btn--danger' : 'btn--accent'}" data-ok>${esc(ok)}</button>
          <button class="btn btn--block btn--ghost" data-close>Отмена</button>
        </div>
      </div>`, { label: title, onClose: () => { if (!done) resolve(false); } });
    s.el.querySelector('[data-ok]').addEventListener('click', () => {
      done = true;
      resolve(true);
      s.close();
    });
  });
}

export function promptSheet({ title, value = '', placeholder = '', ok = 'Сохранить', multiline = false }) {
  return new Promise((resolve) => {
    let done = false;
    const field = multiline
      ? `<textarea class="textarea" id="ps-in" rows="4" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input class="input" id="ps-in" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
    const s = openSheet(`
      <form class="stack" data-form>
        <label class="h2" for="ps-in">${esc(title)}</label>
        ${field}
        <button class="btn btn--accent btn--block" type="submit">${esc(ok)}</button>
      </form>`, { label: title, onClose: () => { if (!done) resolve(null); } });
    s.el.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      done = true;
      resolve(s.el.querySelector('#ps-in').value.trim());
      s.close();
    });
  });
}

export function on(root, type, selector, fn) {
  root.addEventListener(type, (e) => {
    const t = e.target.closest(selector);
    if (t && root.contains(t)) fn(e, t);
  });
}

export function debounce(fn, ms = 400) {
  let t = null;
  let lastArgs = [];
  const d = (...args) => {
    lastArgs = args;
    clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...lastArgs);
    }, ms);
  };
  // Сохранить отложенное прямо сейчас — только если что-то действительно ждёт.
  d.flush = () => {
    if (!t) return;
    clearTimeout(t);
    t = null;
    fn(...lastArgs);
  };
  d.cancel = () => {
    clearTimeout(t);
    t = null;
  };
  return d;
}

export function autosize(ta) {
  if (!ta) return;
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

export async function compressImage(file, max = 1600, quality = 0.82) {
  let src;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    src = await loadImg(URL.createObjectURL(file));
  }
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

export function pickFiles({ accept = 'image/*', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      resolve(Array.from(input.files || []));
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve([]);
      input.remove();
    });
    input.click();
  });
}

const urlCache = new Map();
export async function blobUrl(id) {
  if (!id) return '';
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await db.get('blobs', id);
  if (!rec) return '';
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(id, u);
  return u;
}

export function arcSvg(pct, w = 120, stroke = 10) {
  const r = w / 2 - stroke / 2 - 1;
  const cx = w / 2;
  const cy = r + stroke / 2 + 4;
  const h = cy + stroke / 2 + 1;
  const f = clamp(pct / 200, 0, 1);
  const a = Math.PI * (1 - f);
  const x = (cx + r * Math.cos(a)).toFixed(1);
  const y = (cy - r * Math.sin(a)).toFixed(1);
  const sx = (cx - r).toFixed(1);
  const ex = (cx + r).toFixed(1);
  return `<svg class="arc" width="${w}" height="${h.toFixed(0)}" viewBox="0 0 ${w} ${h.toFixed(1)}" role="img" aria-label="${Math.round(pct)}% от нормы">
    <path d="M ${sx} ${cy} A ${r} ${r} 0 0 1 ${ex} ${cy}" fill="none" style="stroke:rgb(var(--text-rgb) / .16)" stroke-width="${stroke}" stroke-linecap="round"/>
    ${f > 0.004 ? `<path d="M ${sx} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}" fill="none" style="stroke:var(--accent)" stroke-width="${stroke}" stroke-linecap="round"/>` : ''}
    <line x1="${cx}" y1="${(cy - r - stroke / 2 - 3).toFixed(1)}" x2="${cx}" y2="${(cy - r + stroke / 2 + 3).toFixed(1)}" style="stroke:var(--text)" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label ? esc(label) : ''}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}
