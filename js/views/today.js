import {
  esc, icon, logo, on, arcSvg, blobUrl, todayYmd, addDays, parseYmd, fmtLong, WD_SHORT, pts, daysWord, plural,
} from '../ui.js';
import * as store from '../store.js';
import { themeFromSettings } from '../themes.js';
import { projectCover } from '../covers.js';
import { openShare } from '../share.js';
import { heroPhoto, shadeHero, openHeaderSheet } from '../header.js';
import { openDaySheet, openWeekSheet } from '../daysheet.js';
import {
  todoList, todoRow, toggleTodo, openTodoSheet, addTodo, progressText,
} from '../todos.js';

export const tab = 'today';

export async function projectCardHtml(p, mini = false) {
  const url = p.coverBlobId ? await blobUrl(p.coverBlobId) : '';
  const pct = store.projectPct(p);
  return `<a class="pcard${mini ? ' pcard--mini' : ''}" href="#/project/${p.id}">
    ${url ? `<img class="pcard__img" src="${url}" alt="">` : `<div class="pcard__svg">${projectCover(p.id)}</div>`}
    <div class="pcard__body">
      <span class="pcard__title">${esc(p.title)}</span>
      <div class="bar" role="img" aria-label="Готово ${pct}%"><i style="width:${pct}%"></i></div>
      <span class="tiny" style="opacity:.85">${p.done ? 'Завершён' : `Готово ${pct}%`}</span>
    </div>
  </a>`;
}

export default async function today(el) {
  const s = await store.getSettings();
  const theme = themeFromSettings(s);
  const photo = await heroPhoto(s, theme);
  const now = new Date();
  const todayStr = todayYmd();
  const days = await store.allDays();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const yesterday = addDays(todayStr, -1);
  const late = now.getHours() < 5 && !(byDate.get(yesterday) || {}).closed && !(byDate.get(todayStr) || {}).closed;
  const focus = late ? yesterday : todayStr;
  const day = byDate.get(focus);
  const closed = !!(day && day.closed);
  const norm = await store.normFor(todayStr, days);
  const streak = store.streak(days, todayStr);
  const projects = (await store.allProjects()).filter((p) => !p.done).slice(0, 8);

  const wd = (parseYmd(todayStr).getDay() + 6) % 7;
  const monday = addDays(todayStr, -wd);
  const week = Array.from({ length: 7 }, (_, i) => {
    const ds = addDays(monday, i);
    const d = byDate.get(ds);
    return { ds, pct: d && d.closed ? d.pct : null, future: ds > todayStr, isToday: ds === todayStr };
  });

  const hour = now.getHours();
  const hello = s.name ? `Привет, ${esc(s.name)}!` : 'Привет!';

  const card = closed ? `
    <section class="glass p-lg stack today-card" aria-label="Итог дня">
      <div class="row between" style="align-items:flex-end">
        <div class="stack" style="--gap:4px">
          <span class="small muted">${late ? 'Итог вчерашнего дня' : 'Итог дня'}</span>
          <span class="big-num">${day.pct}%</span>
          <span class="small muted">${pts(day.total)} · норма ${day.norm}</span>
        </div>
        ${arcSvg(day.pct, 132, 11)}
      </div>
      ${day.comment ? `<p class="comment">${esc(day.comment)}</p>` : ''}
      ${(day.tasks || []).length ? `<div>${day.tasks.slice(0, 4).map((t) => `<div class="mini-task"><span>${esc(t.title)}</span><b>+${store.taskPoints(t)}</b></div>`).join('')}</div>` : ''}
      <div class="row" style="--gap:10px">
        <a class="btn btn--ghost btn--sm grow" href="#/ritual/${day.date}">Открыть день</a>
        <button class="btn btn--ghost btn--sm" data-act="share">${icon('share', 18)} Поделиться</button>
      </div>
    </section>` : `
    <section class="glass p-lg stack" aria-label="День">
      <h2 class="h2">${late ? 'Вчерашний день ещё открыт' : hour < 17 ? 'День в самом разгаре' : 'Пора закрыть день'}</h2>
      <p class="small muted m0">${late ? 'Расскажи, что успел вчера, — и спать.' : 'Вечером в паре строк расскажи, что успел, — ИИ оценит день относительно твоей нормы.'}</p>
      <div class="row" style="--gap:8px">
        <span class="chip">Норма ${pts(norm)}</span>
        ${streak ? `<span class="chip chip--accent">${icon('flame', 14)} ${daysWord(streak)} подряд</span>` : ''}
      </div>
      <a class="btn btn--accent btn--block" href="#/ritual/${focus}">Закрыть день</a>
    </section>`;

  const maxPct = 150;
  const weekHtml = week.map((w) => {
    const h = w.pct == null ? 0 : Math.round((Math.min(w.pct, maxPct) / maxPct) * 96);
    const cls = w.future ? 'week__bar--future' : w.pct == null ? 'week__bar--empty' : w.pct >= 100 ? 'week__bar--hit' : '';
    return `<button class="week__col" data-day="${w.ds}" aria-label="${fmtLong(w.ds)}${w.pct == null ? '' : `: ${w.pct}%`}">
      <span class="week__val">${w.pct == null ? '' : `${w.pct}%`}</span>
      <span class="week__track"><span class="week__bar ${cls}" style="height:${Math.max(h, 6)}px"></span></span>
      <span class="week__day${w.isToday ? ' week__day--today' : ''}">${WD_SHORT[week.indexOf(w)]}</span>
    </button>`;
  }).join('');
  const closedThisWeek = week.filter((w) => w.pct != null);
  const weekAvg = closedThisWeek.length ? Math.round(closedThisWeek.reduce((a, w) => a + w.pct, 0) / closedThisWeek.length) : null;

  const todayTodos = await store.todosFor(todayStr);
  const allProjects = await store.allProjects();
  const planHtml = `
      <section class="pad stack" style="--gap:12px" aria-label="План на сегодня">
        <div class="row between"><h2 class="eyebrow">План на сегодня</h2><span class="row" style="--gap:12px"><span class="small muted" data-plan-count>${progressText(todayTodos)}</span><a class="link small" href="#/plan">Весь план</a></span></div>
        <div class="card p">
          ${todayTodos.length ? todoList(todayTodos, allProjects) : '<p class="small muted m0" style="padding:4px 2px 2px">Пока пусто. Добавь пару дел — вечером ИИ учтёт, что выполнено.</p>'}
          <form class="todo-add" data-add>
            <label class="sr-only" for="today-todo">Новое дело на сегодня</label>
            <input class="input" id="today-todo" maxlength="140" autocomplete="off" placeholder="Добавить дело на сегодня">
            <button class="add-btn" type="submit" aria-label="Добавить дело">${icon('plus', 22, 2.2)}</button>
          </form>
        </div>
      </section>`;

  const projHtml = projects.length
    ? `<div class="hscroll">${(await Promise.all(projects.map((p) => projectCardHtml(p, true)))).join('')}<a class="pcard pcard--mini pcard--new" href="#/projects/new">${icon('plus', 22)}<span>Новый проект</span></a></div>`
    : `<div class="pad"><div class="card p-lg stack" style="--gap:12px">
        <h3 class="h3">Соберите большое дело на одной странице</h3>
        <p class="small muted m0">Диплом, ремонт, айдентика кофейни — тексты, фото, таблицы и чек-листы в одном месте. ИИ подскажет структуру и посчитает прогресс.</p>
        <a class="btn btn--ghost btn--sm" href="#/projects/new">${icon('plus', 18)} Создать проект</a>
      </div></div>`;

  el.innerHTML = `
    <div class="hero" style="--hero-h:390px;--overlap:150px">
      <img class="hero__img" src="${photo}" alt="" style="object-position:${theme.pos || '50% 50%'}">
      <div class="hero__top">${logo()}<div class="row" style="--gap:8px"><button class="icon-btn" data-act="header" aria-label="Сменить шапку">${icon('image')}</button><a class="icon-btn" href="#/settings" aria-label="Настройки">${icon('gear')}</a></div></div>
      <div class="hero__content">
        <p class="eyebrow">${fmtLong(todayStr)}</p>
        <h1 class="h1 hero__title">${hello}</h1>
      </div>
    </div>
    <div class="pad over">${card}</div>
    <div class="sections">
      ${planHtml}
      <section class="pad stack" style="--gap:12px" aria-label="Эта неделя">
        <div class="row between">
          <h2 class="eyebrow">Эта неделя</h2>
          ${weekAvg != null ? `<button class="link small" data-act="week" style="background:none;border:0;padding:0">${icon('spark', 14)} Разбор · ${weekAvg}%</button>` : ''}
        </div>
        <div class="card p">
          <div class="week"><span class="week__norm" aria-hidden="true"></span>${weekHtml}</div>
          <p class="tiny muted m0" style="margin-top:12px">Нажми на день — откроется его разбор. Пунктир — твоя норма, ${pts(norm)} в день. ${closedThisWeek.length ? `Закрыто ${closedThisWeek.length} ${plural(closedThisWeek.length, 'день', 'дня', 'дней')} из 7.` : ''}</p>
        </div>
      </section>
      <section class="stack" style="--gap:12px" aria-label="Проекты">
        <div class="pad row between"><h2 class="eyebrow">Проекты</h2>${projects.length ? '<a class="link small" href="#/projects">Все</a>' : ''}</div>
        ${projHtml}
      </section>
    </div>`;

  on(el, 'click', '[data-act="share"]', () => openShare('day', { day, photo }));
  on(el, 'click', '[data-day]', (e, b) => openDaySheet(b.dataset.day));
  on(el, 'click', '[data-act="week"]', () => openWeekSheet(monday));
  const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  on(el, 'click', '[data-act="todo-toggle"]', async (e, b) => {
    await toggleTodo(b.closest('[data-tid]'));
    const list = await store.todosFor(todayStr);
    const c = el.querySelector('[data-plan-count]');
    if (c) c.textContent = progressText(list);
  });
  on(el, 'click', '[data-act="todo-edit"]', async (e, b) => {
    const t = (await store.allTodos()).find((x) => x.id === b.closest('[data-tid]').dataset.tid);
    if (t) openTodoSheet(t, { projects: allProjects, onChange: rerender });
  });
  el.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-add]')) return;
    e.preventDefault();
    const input = el.querySelector('#today-todo');
    if (!input.value.trim()) return;
    const t = await addTodo(input.value, todayStr);
    input.value = '';
    const card = e.target.closest('.card');
    let list = card.querySelector('[data-todos]');
    if (!list) {
      card.querySelector('p.muted')?.remove();
      card.insertAdjacentHTML('afterbegin', todoList([], allProjects));
      list = card.querySelector('[data-todos]');
    }
    list.insertAdjacentHTML('beforeend', todoRow(t, allProjects));
    const c = el.querySelector('[data-plan-count]');
    if (c) c.textContent = progressText(await store.todosFor(todayStr));
    input.focus();
  });
  on(el, 'click', '[data-act="header"]', () => openHeaderSheet(() => window.dispatchEvent(new HashChangeEvent('hashchange'))));
  shadeHero(el.querySelector('.hero'), photo, theme, [0.15, 0.55]);
}
