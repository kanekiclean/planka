// Темы: у каждой своё фото в шапке и палитра, вытащенная из этого фото.
export const THEMES = {
  evening: {
    id: 'evening', name: 'Тёплый вечер', mode: 'dark', photo: 'img/themes/evening.webp', pos: '60% 50%',
    bg: '#1A100C', surface: '#2B1D17', text: '#F2E8E3', muted: '#C9B8B1', accent: '#F19A55', onAccent: '#1A100C',
  },
  fog: {
    id: 'fog', name: 'Туман', mode: 'dark', photo: 'img/themes/fog.webp', pos: '41% 50%',
    bg: '#171213', surface: '#272022', text: '#F2E8E6', muted: '#C8B9B6', accent: '#D68671', onAccent: '#171213',
  },
  lavender: {
    id: 'lavender', name: 'Лаванда', mode: 'dark', photo: 'img/themes/lavender.webp', pos: '45% 50%',
    bg: '#140E1B', surface: '#231A2D', text: '#EDE7F3', muted: '#C1B7CD', accent: '#B98FE6', onAccent: '#140E1B',
  },
  pine: {
    id: 'pine', name: 'Хвоя', mode: 'dark', photo: 'img/themes/pine.webp', pos: '40% 50%',
    bg: '#101614', surface: '#1D2523', text: '#E3F2EE', muted: '#B1C9C2', accent: '#86CBA1', onAccent: '#101614',
  },
  sea: {
    id: 'sea', name: 'Море', mode: 'light', photo: 'img/themes/sea.webp', pos: '50% 50%',
    bg: '#F4EFE6', surface: '#FBFAF6', text: '#122B30', muted: '#405E64', accent: '#17788A', onAccent: '#FFFFFF',
  },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const toHex = (rgb) => `#${rgb.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const rgbStr = (h) => fromHex(h).map((v) => Math.round(v * 255)).join(' ');

function lum([r, g, b]) {
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
  const x = lum(fromHex(a));
  const y = lum(fromHex(b));
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHls(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, l, 0];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, l, s];
}
function hlsToRgb(h, l, s) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const hls = (h, l, s) => toHex(hlsToRgb(h, l, s));

function mix(a, b, t) {
  const x = fromHex(a);
  const y = fromHex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export function applyTheme(t) {
  const root = document.documentElement;
  const st = root.style;
  st.setProperty('--bg', t.bg);
  st.setProperty('--bg-rgb', rgbStr(t.bg));
  st.setProperty('--surface', t.surface);
  st.setProperty('--surface-rgb', rgbStr(t.surface));
  st.setProperty('--surface-2', mix(t.surface, t.text, t.mode === 'light' ? 0.05 : 0.07));
  st.setProperty('--text', t.text);
  st.setProperty('--text-rgb', rgbStr(t.text));
  st.setProperty('--muted', t.muted);
  st.setProperty('--accent', t.accent);
  st.setProperty('--accent-rgb', rgbStr(t.accent));
  st.setProperty('--on-accent', t.onAccent);
  root.dataset.scheme = t.mode;
  root.style.colorScheme = t.mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.bg);
}

export function themeFromSettings(s) {
  if (s.themeId === 'custom' && s.customTheme) return s.customTheme;
  return THEMES[s.themeId] || THEMES.evening;
}

function kmeans(px, k = 6, iters = 18) {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let c = Array.from({ length: k }, () => px[Math.floor(rnd() * px.length)].slice());
  let lab = new Array(px.length).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < px.length; i++) {
      let best = 0;
      let bd = Infinity;
      for (let j = 0; j < k; j++) {
        const d = (px[i][0] - c[j][0]) ** 2 + (px[i][1] - c[j][1]) ** 2 + (px[i][2] - c[j][2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      lab[i] = best;
    }
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < px.length; i++) {
      const s = sums[lab[i]];
      s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3] += 1;
    }
    c = c.map((old, j) => (sums[j][3] ? [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]] : old));
  }
  const counts = new Array(k).fill(0);
  lab.forEach((l) => { counts[l] += 1; });
  lab = null;
  return c.map((rgb, j) => {
    const [h, l, s] = rgbToHls(...rgb);
    return { rgb, h, l, s, n: counts[j] / px.length };
  });
}

// Своя тема: палитра из фото пользователя.
export async function paletteFromImage(blob) {
  const bmp = await createImageBitmap(blob);
  const W = 64;
  const H = Math.max(1, Math.round((64 * bmp.height) / bmp.width));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]);
  const cl = kmeans(px);
  const avgL = cl.reduce((a, q) => a + q.l * q.n, 0);
  const acc = cl.reduce((best, q) => {
    const score = (q.s ** 1.5) * Math.sqrt(q.n) * (q.l > 0.25 && q.l < 0.85 ? 1 : 0.2);
    return score > best.score ? { q, score } : best;
  }, { q: cl[0], score: -1 }).q;
  const dom = cl.reduce((best, q) => (q.n * (0.4 + q.s) > best.n * (0.4 + best.s) ? q : best), cl[0]);
  const light = avgL > 0.62;
  const as = Math.max(acc.s, 0.5);
  let t;
  if (!light) {
    const bg = hls(dom.h, 0.075, Math.min(0.35, dom.s * 0.6 + 0.08));
    let al = 0.64;
    let accent = hls(acc.h, al, Math.min(0.85, as));
    while (contrast(accent, bg) < 6 && al < 0.86) {
      al += 0.02;
      accent = hls(acc.h, al, Math.min(0.85, as));
    }
    t = {
      mode: 'dark', bg,
      surface: hls(dom.h, 0.13, Math.min(0.3, dom.s * 0.5 + 0.08)),
      text: hls(dom.h, 0.92, 0.3), muted: hls(dom.h, 0.74, 0.16),
      accent, onAccent: bg,
    };
  } else {
    const bg = hls(dom.h, 0.93, Math.min(0.4, dom.s * 0.5 + 0.1));
    let al = 0.45;
    let accent = hls(acc.h, al, Math.min(0.8, as));
    while ((contrast(accent, '#FFFFFF') < 4.6 || contrast(accent, bg) < 3.2) && al > 0.18) {
      al -= 0.02;
      accent = hls(acc.h, al, Math.min(0.8, as));
    }
    t = {
      mode: 'light', bg,
      surface: hls(dom.h, 0.975, 0.4),
      text: hls(acc.h, 0.13, 0.45), muted: hls(acc.h, 0.32, 0.22),
      accent, onAccent: '#FFFFFF',
    };
  }
  return { id: 'custom', name: 'Своё фото', pos: '50% 50%', ...t };
}
