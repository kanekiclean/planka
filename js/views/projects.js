import {
  icon, on, toast, busy, openSheet, compressImage, pickFiles, uid,
} from '../ui.js';
import * as store from '../store.js';
import * as ai from '../ai.js';
import { projectCardHtml } from './today.js';

export const tab = 'projects';

export function sectionsToBlocks(sections) {
  const out = [];
  for (const sec of sections) {
    out.push({ id: uid(), type: 'heading', text: sec.title });
    if (sec.items.length) out.push({ id: uid(), type: 'checklist', items: sec.items.map((t) => ({ id: uid(), text: t, done: false })) });
  }
  return out;
}

function newProjectSheet(s) {
  let cover = null;
  const sh = openSheet(`
    <form class="stack" data-form>
      <h2 class="h2">Новый проект</h2>
      <div class="field"><label class="label" for="np-title">Название</label>
        <input class="input" id="np-title" maxlength="80" placeholder="Например: Диплом или Айдентика кофейни"></div>
      <div class="field"><label class="label" for="np-desc">О чём он — по желанию</label>
        <textarea class="textarea" id="np-desc" rows="3" placeholder="Пара фраз — так ИИ точнее предложит структуру"></textarea></div>
      <div class="field"><span class="label">Обложка</span>
        <img data-cover-preview hidden alt="Обложка проекта" style="border-radius:18px;max-height:200px;object-fit:cover;width:100%">
        <button type="button" class="btn btn--ghost btn--block" data-act="cover">${icon('image', 18)} <span data-cover-label>Выбрать фото</span></button></div>
      ${s.apiKey ? `<label class="row card p" style="--gap:12px;cursor:pointer">
        <input type="checkbox" id="np-ai" checked style="width:22px;height:22px;flex:none;accent-color:var(--accent)">
        <span class="stack" style="--gap:2px"><b class="small">ИИ предложит структуру</b><span class="tiny muted">Разделы и шаги — потом всё можно поменять</span></span>
      </label>` : ''}
      <button class="btn btn--accent btn--block" type="submit">Создать</button>
    </form>`, { label: 'Новый проект' });

  sh.el.querySelector('[data-act="cover"]').addEventListener('click', async () => {
    const [f] = await pickFiles();
    if (!f) return;
    cover = await compressImage(f);
    const img = sh.el.querySelector('[data-cover-preview]');
    img.src = URL.createObjectURL(cover);
    img.hidden = false;
    sh.el.querySelector('[data-cover-label]').textContent = 'Заменить фото';
  });

  sh.el.querySelector('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = sh.el.querySelector('#np-title').value.trim();
    if (!title) {
      toast('Назови проект');
      return;
    }
    const desc = sh.el.querySelector('#np-desc').value.trim();
    const btn = sh.el.querySelector('[type="submit"]');
    const aiBox = sh.el.querySelector('#np-ai');
    busy(btn, true, aiBox && aiBox.checked ? 'ИИ думает над структурой…' : 'Создаю…');
    const p = store.newProject({ title, desc });
    if (cover) p.coverBlobId = await store.saveBlob(cover);
    if (aiBox && aiBox.checked) {
      try {
        p.blocks = sectionsToBlocks(await ai.suggestStructure({ title, desc }));
      } catch (err) {
        toast(ai.aiErrorText(err), 'err');
      }
    }
    if (desc) p.blocks.unshift({ id: uid(), type: 'text', text: desc });
    await store.saveProject(p);
    sh.close();
    location.hash = `#/project/${p.id}`;
  });
}

export default async function projects(el, [mode]) {
  const s = await store.getSettings();
  const list = await store.allProjects();
  const active = list.filter((p) => !p.done);
  const done = list.filter((p) => p.done);
  const cards = await Promise.all(active.map((p) => projectCardHtml(p)));
  const doneCards = await Promise.all(done.map((p) => projectCardHtml(p)));

  el.innerHTML = `
    <header class="pad stack" style="--gap:10px;padding-top:calc(22px + var(--safe-t))">
      <div class="row between"><p class="eyebrow">Проекты</p><a class="icon-btn" href="#/settings" aria-label="Настройки">${icon('gear')}</a></div>
      <h1 class="h1">Большие дела</h1>
      <p class="small muted m0">У каждого проекта своя страница: тексты, фото, таблицы и чек-листы. ИИ подскажет структуру и посчитает прогресс.</p>
    </header>
    <div class="pad" style="margin-top:22px">
      <div class="pgrid">
        <button class="pcard pcard--new" data-act="new">${icon('plus', 24)}<span>Новый проект</span></button>
        ${cards.join('')}
      </div>
    </div>
    ${done.length ? `<section class="pad stack" style="--gap:12px;margin-top:34px" aria-label="Завершённые проекты"><h2 class="eyebrow">Завершённые</h2><div class="pgrid">${doneCards.join('')}</div></section>` : ''}`;

  on(el, 'click', '[data-act="new"]', () => newProjectSheet(s));
  if (mode === 'new') {
    history.replaceState(null, '', '#/projects');
    setTimeout(() => newProjectSheet(s), 60);
  }
}
