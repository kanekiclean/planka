import {
  esc, icon, on, toast, busy, openSheet, confirmSheet, promptSheet, compressImage, pickFiles, uid, blobUrl,
  debounce, autosize, fmtShort, ymd,
} from '../ui.js';
import * as store from '../store.js';
import * as ai from '../ai.js';
import { projectCover } from '../covers.js';
import { openShare } from '../share.js';
import { readDocx } from '../docx.js';
import { sectionsToBlocks } from './projects.js';
import { shadeHero } from '../header.js';
import { themeFromSettings } from '../themes.js';

export const tab = 'projects';

const TYPES = {
  heading: 'Заголовок', text: 'Текст', photo: 'Фото', gallery: 'Галерея', checklist: 'Чек-лист',
  table: 'Таблица', stats: 'Плашки с цифрами', quote: 'Цитата',
};

function normalize(raw) {
  if (!raw || !raw.type) return null;
  const b = { id: uid(), type: raw.type };
  switch (raw.type) {
    case 'heading':
    case 'text':
    case 'quote':
      b.text = String(raw.text || '').trim().slice(0, 4000);
      return b.text ? b : null;
    case 'checklist':
      b.items = (raw.items || [])
        .map((i) => (typeof i === 'string' ? { text: i, done: false } : i))
        .filter((i) => i && i.text)
        .map((i) => ({ id: uid(), text: String(i.text).slice(0, 300), done: !!i.done }));
      return b.items.length ? b : null;
    case 'stats':
      b.items = (raw.items || []).filter((i) => i && (i.value || i.label)).slice(0, 3)
        .map((i) => ({ value: String(i.value || '').slice(0, 24), label: String(i.label || '').slice(0, 60) }));
      return b.items.length ? b : null;
    case 'table':
      b.rows = (raw.rows || []).map((r) => (r || []).map((c) => String(c ?? '').slice(0, 200)));
      return b.rows.length ? b : null;
    default:
      return null;
  }
}

export default async function project(el, [id]) {
  let p = await store.getProject(id);
  if (!p) {
    el.innerHTML = `<div class="pad empty" style="padding-top:120px"><h1 class="h2">Проект не найден</h1><a class="btn btn--ghost" href="#/projects">К проектам</a></div>`;
    return;
  }
  const s = await store.getSettings();
  let editing = false;
  const urls = {};
  let deleted = false;
  const saveSoon = debounce(() => { if (!deleted) store.saveProject(p); }, 500);

  async function preload() {
    for (const bid of store.projectBlobIds(p)) if (!urls[bid]) urls[bid] = await blobUrl(bid);
  }

  const findBlock = (node) => {
    const host = node.closest('[data-bid]');
    return host ? p.blocks.find((b) => b.id === host.dataset.bid) : null;
  };

  // ——— Просмотр ———
  function viewBlock(b, n) {
    switch (b.type) {
      case 'heading':
        return `<div class="b-heading"><span class="b-heading__num" aria-hidden="true">${String(n).padStart(2, '0')}</span><h2 class="b-heading__text">${esc(b.text || 'Без названия')}</h2></div>`;
      case 'text':
        return b.text ? `<p class="b-text">${esc(b.text)}</p>` : '';
      case 'quote':
        return b.text ? `<blockquote class="b-quote">${esc(b.text)}</blockquote>` : '';
      case 'photo':
        return urls[b.blobId] ? `<figure class="b-photo m0"><img src="${urls[b.blobId]}" alt="${esc(b.caption || 'Фото')}" loading="lazy">${b.caption ? `<figcaption class="b-caption">${esc(b.caption)}</figcaption>` : ''}</figure>` : '';
      case 'gallery': {
        const ids = (b.blobIds || []).filter((x) => urls[x]);
        if (!ids.length) return '';
        return `<figure class="m0"><div class="b-gallery">${ids.map((x) => `<img src="${urls[x]}" alt="" loading="lazy">`).join('')}</div>${b.caption ? `<figcaption class="b-caption">${esc(b.caption)}</figcaption>` : ''}</figure>`;
      }
      case 'checklist': {
        const items = (b.items || []).filter((i) => i.text);
        if (!items.length) return '';
        const doneN = items.filter((i) => i.done).length;
        return `<div class="stack" style="--gap:4px"><ul class="b-check">${items.map((it) => `<li><button data-act="check" data-bid="${b.id}" data-iid="${it.id}" aria-pressed="${!!it.done}"><span class="box">${it.done ? icon('check', 14, 3) : ''}</span><span class="t">${esc(it.text)}</span></button></li>`).join('')}</ul><span class="tiny muted">Сделано ${doneN} из ${items.length}</span></div>`;
      }
      case 'table': {
        const rows = b.rows || [];
        if (!rows.length) return '';
        return `<div class="b-table"><table><thead><tr>${rows[0].map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      case 'stats': {
        const items = (b.items || []).filter((i) => i.value || i.label);
        return items.length ? `<div class="b-stats">${items.map((i) => `<div class="b-stat"><span class="b-stat__v">${esc(i.value)}</span><span class="b-stat__l">${esc(i.label)}</span></div>`).join('')}</div>` : '';
      }
      default:
        return '';
    }
  }

  function viewHtml() {
    if (!p.blocks.length) {
      return `<div class="card p-lg stack" style="--gap:10px"><h2 class="h3">Страница пока пустая</h2><p class="small muted m0">Добавь первый блок: текст, фото, таблицу, чек-лист — или загрузи документ Word, и ИИ соберёт из него страницу.</p></div>`;
    }
    let n = 0;
    return `<div class="blocks">${p.blocks.map((b) => {
      if (b.type === 'heading') n += 1;
      return viewBlock(b, n);
    }).join('')}</div>`;
  }

  // ——— Редактор ———
  function editFields(b) {
    switch (b.type) {
      case 'heading':
        return `<input class="input input--serif" data-f="text" value="${esc(b.text)}" placeholder="Заголовок раздела" aria-label="Заголовок">`;
      case 'text':
        return `<textarea class="textarea" data-f="text" rows="3" placeholder="Текст" aria-label="Текст">${esc(b.text)}</textarea>`;
      case 'quote':
        return `<textarea class="textarea" data-f="text" rows="2" placeholder="Цитата или главная мысль" aria-label="Цитата">${esc(b.text)}</textarea>`;
      case 'photo':
        return `${urls[b.blobId] ? `<img src="${urls[b.blobId]}" alt="" style="border-radius:16px;max-height:260px;object-fit:cover;width:100%">` : ''}
          <input class="input" data-f="caption" value="${esc(b.caption || '')}" placeholder="Подпись — по желанию" aria-label="Подпись к фото">
          <button class="btn btn--ghost btn--sm" data-act="photo-replace">${icon('image', 18)} Заменить фото</button>`;
      case 'gallery':
        return `<div class="ethumbs">${(b.blobIds || []).map((x) => `<div class="ethumb"><img src="${urls[x] || ''}" alt=""><button data-act="gal-del" data-id="${x}" aria-label="Убрать фото">${icon('close', 16, 2.2)}</button></div>`).join('')}</div>
          <button class="btn btn--ghost btn--sm" data-act="gal-add">${icon('plus', 18)} Добавить фото</button>
          <input class="input" data-f="caption" value="${esc(b.caption || '')}" placeholder="Подпись — по желанию" aria-label="Подпись к галерее">`;
      case 'checklist':
        return `${(b.items || []).map((it) => `<div class="erow" data-iid="${it.id}">
            <button class="icon-sm" data-act="item-toggle" aria-pressed="${!!it.done}" aria-label="${it.done ? 'Снять отметку' : 'Отметить сделанным'}"><span class="box${it.done ? ' box--on' : ''}">${it.done ? icon('check', 14, 3) : ''}</span></button>
            <input class="input" data-item="${it.id}" value="${esc(it.text)}" placeholder="Пункт" aria-label="Пункт чек-листа">
            <button class="icon-sm" data-act="item-del" aria-label="Удалить пункт">${icon('close', 16)}</button>
          </div>`).join('')}
          <button class="btn btn--ghost btn--sm" data-act="item-add">${icon('plus', 18)} Пункт</button>`;
      case 'table':
        return `<div class="etable"><table>${(b.rows || []).map((r, ri) => `<tr>${r.map((c, ci) => `<td><input data-cell="${ri}:${ci}" value="${esc(c)}" aria-label="Строка ${ri + 1}, столбец ${ci + 1}"${ri === 0 ? ' style="font-weight:700"' : ''}></td>`).join('')}</tr>`).join('')}</table></div>
          <div class="row wrap" style="--gap:8px">
            <button class="btn btn--ghost btn--sm" data-act="row-add">+ строка</button>
            <button class="btn btn--ghost btn--sm" data-act="col-add">+ столбец</button>
            <button class="btn btn--ghost btn--sm" data-act="row-del">− строка</button>
            <button class="btn btn--ghost btn--sm" data-act="col-del">− столбец</button>
          </div>`;
      case 'stats':
        return `${(b.items || []).map((it, i) => `<div class="erow">
            <input class="input" data-stat="${i}:value" value="${esc(it.value)}" placeholder="42%" style="max-width:110px" aria-label="Число">
            <input class="input" data-stat="${i}:label" value="${esc(it.label)}" placeholder="Подпись" aria-label="Подпись">
            <button class="icon-sm" data-act="stat-del" data-i="${i}" aria-label="Удалить плашку">${icon('close', 16)}</button>
          </div>`).join('')}
          ${(b.items || []).length < 3 ? `<button class="btn btn--ghost btn--sm" data-act="stat-add">${icon('plus', 18)} Плашка</button>` : ''}`;
      default:
        return '';
    }
  }

  function editorHtml() {
    if (!p.blocks.length) return '<div class="card p small muted">Блоков пока нет — нажми «Блок», чтобы добавить первый.</div>';
    return `<p class="tiny muted m0">Тяни за точки слева, чтобы поменять блоки местами.</p>
      <div class="eblocks" data-list>${p.blocks.map((b) => `<div class="card eblock" data-bid="${b.id}">
        <div class="eblock__bar">
          <button class="grip" data-grip aria-label="Перетащить блок «${TYPES[b.type]}»">${icon('grip', 20)}</button>
          <span class="eblock__type">${TYPES[b.type]}</span><span class="grow"></span>
          <button class="icon-sm" data-act="up" aria-label="Выше">${icon('up', 18)}</button>
          <button class="icon-sm" data-act="down" aria-label="Ниже">${icon('down', 18)}</button>
          <button class="icon-sm" data-act="del-block" aria-label="Удалить блок">${icon('trash', 18)}</button>
        </div>
        <div class="stack">${editFields(b)}</div>
      </div>`).join('')}</div>`;
  }

  function plaqueHtml() {
    const pr = p.progress;
    const pct = store.projectPct(p);
    return `<section class="card p-lg plaque" aria-label="Прогресс проекта">
      <div class="row between">
        <div class="stack" style="--gap:4px">
          <span class="small muted">${pr ? 'По оценке ИИ' : 'По чек-листам'}</span>
          <span class="big-num" style="font-size:38px">Готово ${pct}%</span>
        </div>
        <span style="color:var(--accent)">${icon('spark', 28, 1.6)}</span>
      </div>
      <div class="bar bar--theme" role="img" aria-label="Готово ${pct}%"><i style="width:${pct}%"></i></div>
      ${pr && pr.left && pr.left.length ? `<div class="stack" style="--gap:6px"><span class="label">Осталось</span><ul class="small">${pr.left.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${pr && pr.next ? `<p class="small m0"><b>Следующий шаг:</b> ${esc(pr.next)}</p>` : ''}
      ${s.apiKey ? `<button class="btn btn--ghost btn--sm" data-act="analyze">${icon('spark', 18)} ${pr ? 'Обновить оценку' : 'Оценить прогресс с ИИ'}</button>` : ''}
      ${pr ? `<span class="tiny muted">Оценка от ${fmtShort(ymd(new Date(pr.at)))}</span>` : ''}
    </section>`;
  }

  function timelineHtml() {
    const acts = (p.activity || []).slice(-12).reverse();
    if (!acts.length) return '';
    return `<section class="stack" style="--gap:10px;margin-top:10px" aria-label="Из вечерних записей">
      <h2 class="eyebrow">Из вечерних записей</h2>
      <ul class="timeline">${acts.map((a) => `<li><span class="d">${fmtShort(a.date)}</span><span class="grow">${esc(a.title)}</span><b style="color:var(--accent)">+${a.points || ''}</b></li>`).join('')}</ul>
    </section>`;
  }

  async function render() {
    await preload();
    const cover = p.coverBlobId ? urls[p.coverBlobId] : '';
    el.innerHTML = `
      <div class="hero" style="--hero-h:400px;--overlap:110px">
        ${cover ? `<img class="hero__img" src="${cover}" alt="">` : `<div class="hero__svg">${projectCover(p.id)}</div>`}
        <div class="hero__top">
          <a class="icon-btn" href="#/projects" aria-label="К проектам">${icon('back')}</a>
          <button class="icon-btn" data-act="menu" aria-label="Меню проекта">${icon('more')}</button>
        </div>
        <div class="hero__content" style="top:auto;bottom:128px">
          <p class="eyebrow">${p.done ? 'Завершённый проект' : 'Проект'}</p>
          <h1 class="ptitle hero__title">${esc(p.title)}</h1>
        </div>
      </div>
      <div class="pad stack over" style="--gap:22px">
        ${plaqueHtml()}
        <div class="row" style="--gap:10px">
          <button class="btn ${editing ? 'btn--accent' : 'btn--ghost'} btn--sm grow" data-act="toggle-edit">${editing ? `${icon('check', 18)} Готово` : `${icon('edit', 18)} Редактировать`}</button>
          <button class="btn btn--ghost btn--sm grow" data-act="add">${icon('plus', 18)} Блок</button>
        </div>
        ${editing ? editorHtml() : viewHtml()}
        ${timelineHtml()}
      </div>`;
    el.querySelectorAll('.eblock textarea').forEach(autosize);
    if (cover) shadeHero(el.querySelector('.hero'), cover, themeFromSettings(await store.getSettings()), [0.45, 0.78]);
  }

  async function commit() {
    if (deleted) return;
    saveSoon.flush();
    await store.saveProject(p);
    await render();
  }

  async function addFiles(multiple) {
    const files = await pickFiles({ multiple });
    if (!files.length) return [];
    toast(files.length > 1 ? `Сжимаю ${files.length} фото…` : 'Сжимаю фото…');
    const ids = [];
    for (const f of files.slice(0, 12)) ids.push(await store.saveBlob(await compressImage(f)));
    return ids;
  }

  function focusBlock(bid) {
    requestAnimationFrame(() => {
      const node = el.querySelector(`[data-bid="${bid}"]`);
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = node.querySelector('input, textarea');
      if (input) setTimeout(() => input.focus({ preventScroll: true }), 300);
    });
  }

  async function addBlock(type) {
    let b;
    if (type === 'photo') {
      const [bid] = await addFiles(false);
      if (!bid) return;
      b = { id: uid(), type: 'photo', blobId: bid, caption: '' };
    } else if (type === 'gallery') {
      const ids = await addFiles(true);
      if (!ids.length) return;
      b = { id: uid(), type: 'gallery', blobIds: ids, caption: '' };
    } else if (type === 'checklist') b = { id: uid(), type, items: [{ id: uid(), text: '', done: false }] };
    else if (type === 'table') b = { id: uid(), type, rows: [['Колонка 1', 'Колонка 2'], ['', '']] };
    else if (type === 'stats') b = { id: uid(), type, items: [{ value: '', label: '' }] };
    else b = { id: uid(), type, text: '' };
    p.blocks.push(b);
    editing = true;
    await commit();
    focusBlock(b.id);
  }

  async function importWord() {
    const [file] = await pickFiles({ accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    if (!file) return;
    const wait = openSheet(`<div class="loading" style="min-height:220px"><div class="breath" aria-hidden="true"></div><p class="h3" role="status">${s.apiKey ? 'Собираю страницу из документа…' : 'Читаю документ…'}</p></div>`, { label: 'Импорт' });
    try {
      const parsed = await readDocx(file);
      let blocks = [];
      if (s.apiKey && parsed.text.trim()) {
        try {
          blocks = (await ai.importDoc({ text: parsed.text, title: p.title })).map(normalize).filter(Boolean);
        } catch (err) {
          toast(`${ai.aiErrorText(err)} Вставляю документ как есть.`, 'err');
        }
      }
      if (!blocks.length) blocks = parsed.blocks.map(normalize).filter(Boolean);
      if (!blocks.length) throw new Error('empty');
      p.blocks.push(...blocks);
      wait.close();
      await commit();
      toast(`Добавлено блоков: ${blocks.length}`);
    } catch (err) {
      wait.close();
      toast('Не получилось прочитать файл. Нужен .docx из Word или Google Docs.', 'err');
    }
  }

  async function aiStructure(btn) {
    busy(btn, true, 'ИИ думает…');
    try {
      const headings = p.blocks.filter((b) => b.type === 'heading').map((b) => b.text).join(', ');
      const sections = await ai.suggestStructure({ title: p.title, desc: `${p.desc || ''}${headings ? `\nУже есть разделы: ${headings}. Предложи недостающие.` : ''}` });
      p.blocks.push(...sectionsToBlocks(sections));
      return true;
    } catch (err) {
      toast(ai.aiErrorText(err), 'err');
      return false;
    }
  }

  function openAddSheet() {
    const sh = openSheet(`
      <div class="stack">
        <h2 class="h2">Добавить блок</h2>
        <div class="addgrid">
          <button data-add="heading">${icon('heading')} Заголовок<span>Новый раздел</span></button>
          <button data-add="text">${icon('text')} Текст<span>Абзац, заметки</span></button>
          <button data-add="photo">${icon('image')} Фото<span>Одно большое</span></button>
          <button data-add="gallery">${icon('images')} Галерея<span>Несколько фото</span></button>
          <button data-add="checklist">${icon('list')} Чек-лист<span>Что сделать</span></button>
          <button data-add="table">${icon('table')} Таблица<span>Строки и столбцы</span></button>
          <button data-add="stats">${icon('stat')} Плашки<span>Ключевые цифры</span></button>
          <button data-add="quote">${icon('quote')} Цитата<span>Главная мысль</span></button>
          <button class="wide" data-add="docx">${icon('doc')} Импорт из Word<span>${s.apiKey ? 'ИИ соберёт из документа красивую страницу' : 'Разделы, списки и таблицы из .docx'}</span></button>
          ${s.apiKey ? `<button class="wide" data-add="ai">${icon('spark')} ИИ: предложи структуру<span>Разделы и шаги для этого проекта</span></button>` : ''}
        </div>
      </div>`, { label: 'Добавить блок' });
    on(sh.el, 'click', '[data-add]', async (e, b) => {
      const type = b.dataset.add;
      if (type === 'docx') {
        sh.close();
        importWord();
      } else if (type === 'ai') {
        if (await aiStructure(b)) {
          sh.close();
          await commit();
        }
      } else {
        sh.close();
        addBlock(type);
      }
    });
  }

  function openMenu() {
    const sh = openSheet(`
      <div class="stack" style="--gap:10px">
        <h2 class="h2">${esc(p.title)}</h2>
        <button class="btn btn--ghost btn--block" data-m="share">${icon('share', 18)} Поделиться карточкой</button>
        <button class="btn btn--ghost btn--block" data-m="cover">${icon('image', 18)} ${p.coverBlobId ? 'Сменить обложку' : 'Поставить обложку'}</button>
        <button class="btn btn--ghost btn--block" data-m="rename">${icon('edit', 18)} Переименовать</button>
        <button class="btn btn--ghost btn--block" data-m="done">${icon('check', 18)} ${p.done ? 'Вернуть в работу' : 'Отметить завершённым'}</button>
        <button class="btn btn--ghost btn--block" data-m="delete">${icon('trash', 18)} Удалить проект</button>
      </div>`, { label: 'Меню проекта' });
    on(sh.el, 'click', '[data-m]', async (e, b) => {
      const m = b.dataset.m;
      sh.close();
      if (m === 'share') {
        openShare('project', { project: p, cover: p.coverBlobId ? urls[p.coverBlobId] : '', pct: store.projectPct(p) });
      } else if (m === 'cover') {
        const [bid] = await addFiles(false);
        if (!bid) return;
        if (p.coverBlobId) await store.deleteBlob(p.coverBlobId);
        p.coverBlobId = bid;
        await commit();
      } else if (m === 'rename') {
        const t = await promptSheet({ title: 'Название проекта', value: p.title });
        if (t) {
          p.title = t.slice(0, 80);
          await commit();
        }
      } else if (m === 'done') {
        p.done = !p.done;
        await commit();
        toast(p.done ? 'Проект завершён — красота' : 'Проект снова в работе');
      } else if (m === 'delete') {
        const ok = await confirmSheet({ title: 'Удалить проект?', text: 'Страница, фото и заметки пропадут насовсем.', ok: 'Удалить', danger: true });
        if (!ok) return;
        deleted = true;
        saveSoon.cancel();
        await store.deleteProject(p);
        toast('Проект удалён');
        location.hash = '#/projects';
      }
    });
  }

  // ——— Ввод текста без перерисовки, чтобы не терять фокус ———
  el.addEventListener('input', (e) => {
    const t = e.target;
    const b = findBlock(t);
    if (!b) return;
    if (t.dataset.f) b[t.dataset.f] = t.value;
    else if (t.dataset.item) {
      const it = b.items.find((x) => x.id === t.dataset.item);
      if (it) it.text = t.value;
    } else if (t.dataset.cell) {
      const [ri, ci] = t.dataset.cell.split(':').map(Number);
      b.rows[ri][ci] = t.value;
    } else if (t.dataset.stat) {
      const [i, k] = t.dataset.stat.split(':');
      b.items[Number(i)][k] = t.value;
    } else return;
    saveSoon();
  });

  // ——— Перетаскивание блоков ———
  el.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('[data-grip]');
    if (!grip) return;
    const item = grip.closest('.eblock');
    const list = grip.closest('[data-list]');
    if (!item || !list) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const grab = e.clientY - item.getBoundingClientRect().top;
    item.classList.add('dragging');
    const move = (ev) => {
      const y = ev.clientY;
      const sibs = Array.from(list.children).filter((c) => c !== item);
      const target = sibs.find((sib) => {
        const r = sib.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      if (target) {
        if (item.nextElementSibling !== target) list.insertBefore(item, target);
      } else if (list.lastElementChild !== item) list.appendChild(item);
      item.style.transform = 'none';
      const natural = item.getBoundingClientRect().top;
      item.style.transform = `translateY(${y - grab - natural}px)`;
      if (y < 90) window.scrollBy(0, -14);
      else if (y > window.innerHeight - 150) window.scrollBy(0, 14);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      item.style.transform = '';
      const order = Array.from(list.children).map((n) => n.dataset.bid);
      p.blocks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      saveSoon();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });

  on(el, 'click', '[data-act]', async (e, btn) => {
    const act = btn.dataset.act;
    const b = findBlock(btn);
    const idx = b ? p.blocks.indexOf(b) : -1;
    switch (act) {
      case 'menu': openMenu(); break;
      case 'add': openAddSheet(); break;
      case 'toggle-edit':
        editing = !editing;
        await commit();
        break;
      case 'analyze':
        busy(btn, true, 'ИИ читает проект…');
        try {
          saveSoon.flush();
          p.progress = await ai.analyzeProject(p);
          await commit();
          toast('Прогресс обновлён');
        } catch (err) {
          busy(btn, false);
          toast(ai.aiErrorText(err), 'err');
        }
        break;
      case 'check': {
        const blk = p.blocks.find((x) => x.id === btn.dataset.bid);
        const it = blk && blk.items.find((x) => x.id === btn.dataset.iid);
        if (it) {
          it.done = !it.done;
          await commit();
        }
        break;
      }
      case 'up':
      case 'down': {
        const j = act === 'up' ? idx - 1 : idx + 1;
        if (idx < 0 || j < 0 || j >= p.blocks.length) break;
        [p.blocks[idx], p.blocks[j]] = [p.blocks[j], p.blocks[idx]];
        await commit();
        focusBlock(b.id);
        break;
      }
      case 'del-block': {
        const ok = await confirmSheet({ title: `Удалить блок «${TYPES[b.type]}»?`, ok: 'Удалить', danger: true });
        if (!ok) break;
        if (b.type === 'photo' && b.blobId) await store.deleteBlob(b.blobId);
        if (b.type === 'gallery') for (const x of b.blobIds || []) await store.deleteBlob(x);
        p.blocks.splice(idx, 1);
        await commit();
        break;
      }
      case 'photo-replace': {
        const [bid] = await addFiles(false);
        if (!bid) break;
        if (b.blobId) await store.deleteBlob(b.blobId);
        b.blobId = bid;
        await commit();
        break;
      }
      case 'gal-add': {
        const ids = await addFiles(true);
        b.blobIds = [...(b.blobIds || []), ...ids];
        await commit();
        break;
      }
      case 'gal-del':
        b.blobIds = (b.blobIds || []).filter((x) => x !== btn.dataset.id);
        await store.deleteBlob(btn.dataset.id);
        await commit();
        break;
      case 'item-add': {
        const it = { id: uid(), text: '', done: false };
        b.items.push(it);
        await commit();
        const input = el.querySelector(`[data-item="${it.id}"]`);
        if (input) input.focus();
        break;
      }
      case 'item-del': {
        const iid = btn.closest('[data-iid]').dataset.iid;
        b.items = b.items.filter((x) => x.id !== iid);
        await commit();
        break;
      }
      case 'item-toggle': {
        const iid = btn.closest('[data-iid]').dataset.iid;
        const it = b.items.find((x) => x.id === iid);
        it.done = !it.done;
        await commit();
        break;
      }
      case 'row-add':
        b.rows.push(new Array(b.rows[0] ? b.rows[0].length : 2).fill(''));
        await commit();
        break;
      case 'row-del':
        if (b.rows.length > 1) b.rows.pop();
        await commit();
        break;
      case 'col-add':
        b.rows = b.rows.map((r, i) => [...r, i === 0 ? `Колонка ${r.length + 1}` : '']);
        await commit();
        break;
      case 'col-del':
        if (b.rows[0] && b.rows[0].length > 1) b.rows = b.rows.map((r) => r.slice(0, -1));
        await commit();
        break;
      case 'stat-add':
        if (b.items.length < 3) b.items.push({ value: '', label: '' });
        await commit();
        break;
      case 'stat-del':
        b.items.splice(Number(btn.dataset.i), 1);
        await commit();
        break;
      default:
        break;
    }
  });

  window.addEventListener('hashchange', () => { if (!deleted) saveSoon.flush(); }, { once: true });
  await render();
}
