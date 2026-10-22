// Красивые карточки для отправки: итог дня, итог месяца, проект.
import { openSheet, esc, icon, toast, MONTHS, fmtLong, pts, daysWord } from './ui.js';
import { monthSceneDataUrl } from './covers.js';

const W = 1080;
const H = 1350;
const LIGHT = '#FFF8EC';

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('500 120px "Playfair Display"'),
      document.fonts.load('italic 500 40px "Playfair Display"'),
      document.fonts.load('800 120px Manrope'),
      document.fonts.load('600 40px Manrope'),
    ]);
  } catch {
    /* шрифты не критичны */
  }
}

function drawCover(ctx, img) {
  if (img) {
    const r = Math.max(W / img.width, H / img.height);
    const w = img.width * r;
    const h = img.height * r;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, cssVar('--accent') || '#F19A55');
    g.addColorStop(1, cssVar('--surface') || '#2B1D17');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(12,10,9,0.45)');
  g.addColorStop(0.3, 'rgba(12,10,9,0.15)');
  g.addColorStop(0.55, 'rgba(12,10,9,0.55)');
  g.addColorStop(1, 'rgba(12,10,9,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function eyebrow(ctx, text, x, y) {
  ctx.strokeStyle = LIGHT;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x + 56, y - 10);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = LIGHT;
  ctx.font = '700 28px Manrope, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText(text.toUpperCase(), x + 76, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function wrap(ctx, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxW && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderDay({ day, photo }) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  drawCover(ctx, await loadImage(photo));
  eyebrow(ctx, 'Планка', 72, 110);
  ctx.textAlign = 'right';
  ctx.font = '600 32px Manrope, sans-serif';
  ctx.fillText(fmtLong(day.date), W - 72, 110);
  ctx.textAlign = 'left';

  let y = 640;
  ctx.font = '600 38px Manrope, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText('Итог дня', 72, y);
  ctx.globalAlpha = 1;
  y += 200;
  ctx.font = '800 210px Manrope, sans-serif';
  ctx.fillText(`${day.pct}%`, 64, y);
  y += 64;
  ctx.font = '600 36px Manrope, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(`от моей нормы · ${pts(day.total)}`, 72, y);
  ctx.globalAlpha = 1;
  y += 80;
  ctx.font = '600 36px Manrope, sans-serif';
  for (const t of (day.tasks || []).slice(0, 4)) {
    const line = wrap(ctx, `— ${t.title}`, W - 144, 1)[0];
    ctx.fillText(line, 72, y);
    y += 52;
  }
  if (day.comment) {
    y += 20;
    ctx.font = 'italic 500 38px "Playfair Display", Georgia, serif';
    for (const l of wrap(ctx, day.comment, W - 144, 2)) {
      ctx.fillText(l, 72, y);
      y += 52;
    }
  }
  return c;
}

async function renderMonth({ month, stats }) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const m = Number(month.slice(5, 7)) - 1;
  drawCover(ctx, await loadImage(monthSceneDataUrl(m)));
  eyebrow(ctx, 'Планка · итоги месяца', 72, 110);
  ctx.fillStyle = LIGHT;
  ctx.font = '500 170px "Playfair Display", Georgia, serif';
  ctx.fillText(MONTHS[m], 64, 760);
  ctx.font = '600 40px Manrope, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(month.slice(0, 4), 72, 830);
  ctx.globalAlpha = 1;
  const items = [
    [daysWord(stats.closed), 'закрыто'],
    [`${stats.avg}%`, 'средний день'],
    [`${stats.best}%`, 'лучший день'],
  ];
  const colW = (W - 144) / 3;
  items.forEach(([v, l], i) => {
    const x = 72 + i * colW;
    ctx.font = '800 64px Manrope, sans-serif';
    ctx.fillText(v, x, 1010);
    ctx.font = '600 30px Manrope, sans-serif';
    ctx.globalAlpha = 0.8;
    ctx.fillText(l, x, 1056);
    ctx.globalAlpha = 1;
  });
  // календарь-пилюли
  const cw = (W - 144 - 6 * 14) / 7;
  stats.cells.forEach((cell, i) => {
    if (cell === 'blank') return;
    const x = 72 + (i % 7) * (cw + 14);
    const y = 1120 + Math.floor(i / 7) * 34;
    roundRect(ctx, x, y, cw, 22, 11);
    if (cell === 'full') {
      ctx.fillStyle = cssVar('--accent') || '#F19A55';
      ctx.fill();
    } else if (cell === 'part') {
      ctx.fillStyle = 'rgba(255,248,236,0.45)';
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,248,236,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  ctx.fillStyle = LIGHT;
  return c;
}

async function renderProject({ project, cover, pct }) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  drawCover(ctx, await loadImage(cover));
  eyebrow(ctx, 'Планка · проект', 72, 110);
  ctx.fillStyle = LIGHT;
  ctx.font = '500 104px "Playfair Display", Georgia, serif';
  const lines = wrap(ctx, project.title, W - 144, 3);
  let y = 1350 - 520 - (lines.length - 1) * 112;
  for (const l of lines) {
    ctx.fillText(l, 68, y);
    y += 112;
  }
  y += 10;
  roundRect(ctx, 72, y, W - 144, 14, 7);
  ctx.fillStyle = 'rgba(255,248,236,0.25)';
  ctx.fill();
  roundRect(ctx, 72, y, Math.max(14, ((W - 144) * pct) / 100), 14, 7);
  ctx.fillStyle = cssVar('--accent') || '#F19A55';
  ctx.fill();
  ctx.fillStyle = LIGHT;
  y += 76;
  ctx.font = '800 56px Manrope, sans-serif';
  ctx.fillText(`Готово ${pct}%`, 72, y);
  y += 70;
  ctx.font = '600 34px Manrope, sans-serif';
  const done = (project.progress && project.progress.done) || [];
  for (const d of done.slice(0, 3)) {
    ctx.fillText(wrap(ctx, `✓ ${d}`, W - 144, 1)[0], 72, y);
    y += 50;
  }
  return c;
}

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export async function openShare(kind, data) {
  await fontsReady();
  let canvas;
  try {
    if (kind === 'day') canvas = await renderDay(data);
    else if (kind === 'month') canvas = await renderMonth(data);
    else canvas = await renderProject(data);
  } catch (e) {
    console.error(e);
    toast('Не получилось нарисовать карточку', 'err');
    return;
  }
  const blob = await toBlob(canvas);
  const url = URL.createObjectURL(blob);
  const name = `planka-${kind}-${Date.now()}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const s = openSheet(`
    <div class="stack">
      <h2 class="h2">Карточка готова</h2>
      <img class="share-preview" src="${url}" alt="Превью карточки">
      <div class="stack" style="--gap:10px">
        ${canShare ? `<button class="btn btn--accent btn--block" data-act="share">${icon('share', 18)} Отправить</button>` : ''}
        <a class="btn ${canShare ? 'btn--ghost' : 'btn--accent'} btn--block" href="${url}" download="${esc(name)}">${icon('download', 18)} Сохранить картинку</a>
      </div>
    </div>`, { label: 'Карточка для отправки' });
  const btn = s.el.querySelector('[data-act="share"]');
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        await navigator.share({ files: [file], title: 'Планка' });
        s.close();
      } catch (e) {
        if (e && e.name !== 'AbortError') toast('Не получилось отправить — сохрани картинку', 'err');
      }
    });
  }
}
