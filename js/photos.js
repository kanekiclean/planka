// Фото дня: до трёх снимков на день, первый — обложка.
// Пока день не закрыт, фото лежат в черновике и переезжают в день при сохранении.
import * as db from './db.js';
import * as store from './store.js';
import {
  icon, blobUrl, compressImage, pickFiles, toast, openSheet, confirmSheet, fmtLong, WD_SHORT, parseYmd, addDays,
} from './ui.js';

export const MAX_PHOTOS = 3;
const draftKey = (date) => `dayPhotos:${date}`;

export async function dayPhotos(date, day) {
  const d = day === undefined ? await store.getDay(date) : day;
  if (d && Array.isArray(d.photos)) return d.photos.slice();
  return (await db.kvGet(draftKey(date))) || [];
}

async function setPhotos(date, ids) {
  const day = await store.getDay(date);
  if (day) {
    day.photos = ids;
    await store.putDay(day);
    await db.del('kv', draftKey(date));
  } else if (ids.length) await db.kvSet(draftKey(date), ids);
  else await db.del('kv', draftKey(date));
}

export const clearDraft = (date) => db.del('kv', draftKey(date));

export async function addPhotos(date) {
  const cur = await dayPhotos(date);
  const room = MAX_PHOTOS - cur.length;
  if (room <= 0) {
    toast(`На день — не больше ${MAX_PHOTOS} фото`);
    return null;
  }
  const files = await pickFiles({ multiple: true });
  if (!files.length) return null;
  if (files.length > room) toast(`Взял ${room} — на день до ${MAX_PHOTOS} фото`);
  const ids = [...cur];
  for (const f of files.slice(0, room)) {
    try {
      ids.push(await store.saveBlob(await compressImage(f, 1600, 0.82)));
    } catch {
      toast('Не получилось открыть фото', 'err');
    }
  }
  await setPhotos(date, ids);
  return ids;
}

async function removePhoto(date, id) {
  await setPhotos(date, (await dayPhotos(date)).filter((x) => x !== id));
  await store.deleteBlob(id);
}

async function makeCover(date, id) {
  const ids = await dayPhotos(date);
  await setPhotos(date, [id, ...ids.filter((x) => x !== id)]);
}

// Полоска превью с кнопкой «Добавить»: сама перерисовывается после изменений.
export async function mountPhotoStrip(host, date, onChange) {
  const render = async () => {
    const ids = await dayPhotos(date);
    const urls = await Promise.all(ids.map((id) => blobUrl(id)));
    host.innerHTML = `<div class="pstrip">
      ${ids.map((id, i) => `<button type="button" class="pthumb${i === 0 ? ' is-cover' : ''}" data-photo="${id}" aria-label="Фото ${i + 1}${i === 0 ? ', обложка' : ''}: открыть действия">
        <img src="${urls[i]}" alt="">${i === 0 && ids.length > 1 ? '<span class="pthumb__tag">обложка</span>' : ''}
      </button>`).join('')}
      ${ids.length < MAX_PHOTOS ? `<button type="button" class="pthumb pthumb--add" data-photo-add>${icon('camera', 22)}<span>${ids.length ? 'Ещё' : 'Добавить'}</span></button>` : ''}
    </div>`;
  };
  host.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-photo-add]');
    const th = e.target.closest('[data-photo]');
    if (add) {
      const r = await addPhotos(date);
      if (r) {
        await render();
        if (onChange) onChange(r);
      }
    } else if (th) {
      const changed = await photoActions(date, th.dataset.photo);
      if (changed) {
        await render();
        if (onChange) onChange(await dayPhotos(date));
      }
    }
  });
  await render();
}

function photoActions(date, id) {
  return new Promise((resolve) => {
    let result = false;
    let pending = false;
    (async () => {
      const ids = await dayPhotos(date);
      const url = await blobUrl(id);
      const sh = openSheet(`
        <div class="stack">
          <img class="gal__img" src="${url}" alt="Фото дня">
          <div class="stack" style="--gap:10px">
            ${ids[0] !== id ? `<button class="btn btn--ghost btn--block" data-a="cover">${icon('image', 18)} Сделать обложкой</button>` : '<p class="small muted m0" style="text-align:center">Это обложка дня — она попадёт в коллаж недели и на обложку месяца.</p>'}
            <button class="btn btn--ghost btn--block" data-a="del">${icon('trash', 18)} Удалить фото</button>
          </div>
        </div>`, { label: 'Фото дня', onClose: () => { if (!pending) resolve(result); } });
      sh.el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        if (b.dataset.a === 'cover') {
          await makeCover(date, id);
          result = true;
          sh.close();
        } else if (b.dataset.a === 'del') {
          pending = true;
          sh.close();
          const ok = await confirmSheet({ title: 'Удалить фото?', ok: 'Удалить', danger: true });
          if (ok) {
            await removePhoto(date, id);
            result = true;
          }
          resolve(result);
        }
      });
    })();
  });
}

// Фото за период: [{ id, date, day }], свежие сначала, обложка дня — первой.
export async function photosBetween(from, to, days) {
  const list = days || (await store.allDays());
  const byDate = new Map(list.map((d) => [d.date, d]));
  const out = [];
  for (let ds = to; ds >= from; ds = addDays(ds, -1)) {
    const d = byDate.get(ds);
    const ids = d ? d.photos || [] : await dayPhotos(ds, null);
    ids.forEach((id) => out.push({ id, date: ds, day: d && d.closed ? d : null }));
  }
  return out;
}

// Обложка месяца — главное фото самого сильного дня с фото.
export async function monthCoverUrl(monthDays) {
  const best = monthDays.filter((d) => d.closed && d.photos && d.photos.length).sort((a, b) => b.pct - a.pct)[0];
  return best ? blobUrl(best.photos[0]) : '';
}

export const photoLabel = (it) => `${WD_SHORT[(parseYmd(it.date).getDay() + 6) % 7]}${it.day ? ` · ${it.day.pct}%` : ''}`;

// Просмотр фото с перелистыванием.
export async function openGallery(items, start = 0, { onOpenDay } = {}) {
  if (!items.length) return;
  let i = Math.max(0, Math.min(start, items.length - 1));
  const urls = await Promise.all(items.map((it) => blobUrl(it.id)));
  const sh = openSheet(`
    <div class="stack" style="--gap:14px">
      <div class="gal" data-gal>
        <img class="gal__img" data-img alt="">
        ${items.length > 1 ? `<button class="gal__nav gal__nav--prev" data-go="-1" aria-label="Предыдущее фото">${icon('back', 22)}</button>
        <button class="gal__nav gal__nav--next" data-go="1" aria-label="Следующее фото">${icon('fwd', 22)}</button>` : ''}
      </div>
      <div class="row between">
        <div class="stack" style="--gap:2px"><b class="small" data-cap></b><span class="tiny muted" data-count></span></div>
        ${onOpenDay ? '<button class="btn btn--ghost btn--sm" data-open>Открыть день</button>' : ''}
      </div>
      ${items.length > 1 ? `<div class="gal__thumbs">${items.map((it, k) => `<button data-k="${k}" aria-label="Фото ${k + 1}"><img src="${urls[k]}" alt=""></button>`).join('')}</div>` : ''}
    </div>`, { label: 'Фото' });
  const show = () => {
    const it = items[i];
    sh.el.querySelector('[data-img]').src = urls[i];
    sh.el.querySelector('[data-img]').alt = `Фото за ${fmtLong(it.date)}`;
    sh.el.querySelector('[data-cap]').textContent = fmtLong(it.date) + (it.day ? ` · ${it.day.pct}%` : '');
    sh.el.querySelector('[data-count]').textContent = items.length > 1 ? `${i + 1} из ${items.length}` : '';
    sh.el.querySelectorAll('.gal__thumbs button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };
  const go = (d) => {
    i = (i + d + items.length) % items.length;
    show();
  };
  sh.el.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    const t = e.target.closest('[data-k]');
    if (g) go(Number(g.dataset.go));
    else if (t) {
      i = Number(t.dataset.k);
      show();
    } else if (e.target.closest('[data-open]')) {
      sh.close();
      onOpenDay(items[i].date);
    }
  });
  const gal = sh.el.querySelector('[data-gal]');
  let x0 = null;
  gal.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  gal.addEventListener('pointerup', (e) => {
    if (x0 == null || items.length < 2) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  });
  const onKey = (e) => {
    if (!sh.el.isConnected) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };
  document.addEventListener('keydown', onKey);
  show();
}
