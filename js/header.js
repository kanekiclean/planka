// Шапка: какое фото показывать и насколько затемнить его под текст,
// чтобы надписи читались на любом снимке.
import { blobUrl, openSheet, pickFiles, compressImage, toast, icon } from './ui.js';
import * as store from './store.js';
import {
  contrast, fromHex, toHex, mix, lum, paletteFromImage, applyTheme, themeFromSettings,
} from './themes.js';

export async function heroPhoto(s, theme) {
  if (s.header && s.header.blobId) {
    const u = await blobUrl(s.header.blobId);
    if (u) return u;
  }
  if (theme.blobId) {
    const u = await blobUrl(theme.blobId);
    if (u) return u;
  }
  return theme.photo;
}

const shadeCache = new Map();

function load(src) {
  return new Promise((resolve) => {
    const i = new Image();
    if (/^https?:/.test(src) && !src.startsWith(location.origin)) i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

// Насколько закрыть фото цветом фона, чтобы текст темы читался (контраст ≥ 4.5).
// Берём худший случай: самые «мешающие» пиксели в зоне, где лежит текст.
export async function heroShade(src, theme, zone = [0.15, 0.55]) {
  const key = `${src}|${theme.bg}|${theme.text}|${zone.join()}`;
  if (shadeCache.has(key)) return shadeCache.get(key);
  let shade = 0.55;
  try {
    const img = await load(src);
    if (img && img.naturalWidth) {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 32;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      ctx.drawImage(img, w * 0.08, h * zone[0], w * 0.84, h * (zone[1] - zone[0]), 0, 0, 48, 32);
      const d = ctx.getImageData(0, 0, 48, 32).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) {
        const rgb = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
        px.push({ rgb, l: lum(rgb) });
      }
      const lightText = lum(fromHex(theme.text)) > lum(fromHex(theme.bg));
      px.sort((a, b) => (lightText ? b.l - a.l : a.l - b.l));
      const worst = px.slice(0, Math.max(1, Math.round(px.length * 0.25)));
      const ref = toHex([0, 1, 2].map((k) => worst.reduce((a, p) => a + p.rgb[k], 0) / worst.length));
      shade = 0.9;
      for (let a = 0.12; a <= 0.9; a += 0.04) {
        if (contrast(theme.text, mix(ref, theme.bg, a)) >= 4.5) {
          shade = a;
          break;
        }
      }
    }
  } catch {
    /* фото без доступа к пикселям — оставляем среднее затемнение */
  }
  shadeCache.set(key, shade);
  return shade;
}

export function applyShade(heroEl, shade) {
  if (!heroEl) return;
  heroEl.style.setProperty('--sh0', Math.min(0.92, shade + 0.06).toFixed(2));
  heroEl.style.setProperty('--sh1', shade.toFixed(2));
  heroEl.style.setProperty('--sh2', Math.min(0.95, shade + 0.2).toFixed(2));
}

export async function shadeHero(heroEl, src, theme, zone) {
  applyShade(heroEl, await heroShade(src, theme, zone));
}

// Своя шапка: фото из галереи, по желанию — цвета приложения под него.
export function openHeaderSheet(onDone) {
  store.getSettings().then((s) => {
    const hasOwn = !!((s.header && s.header.blobId) || s.themeId === 'custom');
    const sh = openSheet(`
      <div class="stack">
        <h2 class="h2">Шапка</h2>
        <p class="small muted m0">Поставь любое своё фото. Текст поверх него подстроится, чтобы читался.</p>
        <label class="row card p" style="--gap:12px;cursor:pointer">
          <input type="checkbox" id="hdr-colors" ${s.themeId === 'custom' || !s.header ? 'checked' : ''} style="width:22px;height:22px;flex:none;accent-color:var(--accent)">
          <span class="stack" style="--gap:2px"><b class="small">Подобрать цвета под фото</b><span class="tiny muted">Акцент, фон и карточки возьмутся из снимка</span></span>
        </label>
        <button class="btn btn--accent btn--block" data-h="pick">${icon('image', 18)} Выбрать фото</button>
        ${hasOwn ? '<button class="btn btn--ghost btn--block" data-h="reset">Вернуть фото темы</button>' : ''}
      </div>`, { label: 'Шапка' });

    sh.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      if (b.dataset.h === 'pick') {
        const colors = sh.el.querySelector('#hdr-colors').checked;
        const [f] = await pickFiles();
        if (!f) return;
        toast('Готовлю фото…');
        const blob = await compressImage(f, 2000, 0.86);
        const blobId = await store.saveBlob(blob);
        const cur = await store.getSettings();
        const old = [cur.header && cur.header.blobId, cur.customTheme && cur.customTheme.blobId].filter(Boolean);
        if (colors) {
          const pal = await paletteFromImage(blob);
          await store.saveSettings({
            customTheme: { ...pal, blobId }, header: null,
            baseThemeId: cur.themeId !== 'custom' ? cur.themeId : cur.baseThemeId, themeId: 'custom',
          });
          for (const id of old) await store.deleteBlob(id);
        } else {
          const prevHeader = cur.header && cur.header.blobId;
          await store.saveSettings({ header: { blobId } });
          if (prevHeader) await store.deleteBlob(prevHeader);
        }
        applyTheme(themeFromSettings(await store.getSettings()));
        sh.close();
        toast('Шапка обновлена');
        if (onDone) onDone();
      } else if (b.dataset.h === 'reset') {
        const cur = await store.getSettings();
        const prevHeader = cur.header && cur.header.blobId;
        const patch = { header: null };
        if (cur.themeId === 'custom') patch.themeId = cur.baseThemeId || 'evening';
        await store.saveSettings(patch);
        if (prevHeader) await store.deleteBlob(prevHeader);
        applyTheme(themeFromSettings(await store.getSettings()));
        sh.close();
        if (onDone) onDone();
      }
    });
  });
}
