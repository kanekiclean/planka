import {
  icon, on, toast, todayYmd, addDays, parseYmd, fmtLong, WD_SHORT, MONTHS_GEN, plural,
} from '../ui.js';
import * as store from '../store.js';
import {
  todoList, toggleTodo, openTodoSheet, addTodo, progressText,
} from '../todos.js';

export const tab = 'plan';

export default async function plan(el, [dateParam]) {
  const today = todayYmd();
  let sel = dateParam || today;
  const projects = await store.allProjects();

  async function render() {
    const all = await store.allTodos();
    const monday = addDays(sel, -((parseYmd(sel).getDay() + 6) % 7));
    const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const dayTodos = all.filter((t) => t.date === sel);
    const overdue = sel === today ? all.filter((t) => !t.done && t.date < today) : [];
    const d = parseYmd(sel);
    const rel = sel === today ? 'Сегодня' : sel === addDays(today, 1) ? 'Завтра' : sel === addDays(today, -1) ? 'Вчера' : '';

    const chips = week.map((ds) => {
      const list = all.filter((t) => t.date === ds);
      const done = list.filter((t) => t.done).length;
      const pct = list.length ? Math.round((done / list.length) * 100) : 0;
      const n = parseYmd(ds).getDate();
      return `<button class="dchip${ds === sel ? ' is-sel' : ''}${ds === today ? ' is-today' : ''}" data-act="sel" data-d="${ds}" aria-pressed="${ds === sel}" aria-label="${fmtLong(ds)}${list.length ? `, дел: ${list.length}, сделано ${done}` : ''}">
        <span class="dchip__wd">${WD_SHORT[week.indexOf(ds)]}</span>
        <span class="dchip__n">${n}</span>
        <span class="dchip__bar" aria-hidden="true">${list.length ? `<i style="width:${Math.max(pct, 8)}%"></i>` : ''}</span>
      </button>`;
    }).join('');

    el.innerHTML = `
      <header class="pad stack" style="--gap:10px;padding-top:calc(22px + var(--safe-t))">
        <div class="row between"><p class="eyebrow">План</p><a class="icon-btn" href="#/settings" aria-label="Настройки">${icon('gear')}</a></div>
        <h1 class="h1">Ежедневник</h1>
        <p class="small muted m0">Мелкие дела на конкретные дни. Отмечай выполненное — вечером ИИ учтёт это сам.</p>
      </header>
      <div class="pad stack" style="--gap:16px;margin-top:20px">
        <div class="daystrip">
          <button class="icon-sm" data-act="wk" data-n="-7" aria-label="Прошлая неделя">${icon('back')}</button>
          <div class="daystrip__days">${chips}</div>
          <button class="icon-sm" data-act="wk" data-n="7" aria-label="Следующая неделя">${icon('fwd')}</button>
        </div>
        <div class="row between" style="align-items:baseline">
          <h2 class="h2">${rel ? `${rel}, ` : ''}${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</h2>
          <span class="small muted">${progressText(dayTodos)}</span>
        </div>
        ${overdue.length ? `<div class="card p row between" style="--gap:12px">
          <span class="small">Хвосты с прошлых дней: <b>${overdue.length}</b></span>
          <button class="btn btn--ghost btn--sm" data-act="carry">Перенести на сегодня</button>
        </div>` : ''}
        <div class="card p">
          ${dayTodos.length ? todoList(dayTodos, projects) : `<p class="small muted m0" style="padding:6px 2px">${sel < today ? 'В этот день дел не было.' : 'Пока пусто. Добавь первое дело ниже.'}</p>`}
          <form class="todo-add" data-add>
            <label class="sr-only" for="new-todo">Новое дело</label>
            <input class="input" id="new-todo" maxlength="140" autocomplete="off" placeholder="Добавить дело на ${rel ? rel.toLowerCase() : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`}">
            <button class="add-btn" type="submit" aria-label="Добавить дело">${icon('plus', 22, 2.2)}</button>
          </form>
        </div>
        ${sel === today || sel === addDays(today, -1) ? `<a class="btn btn--ghost btn--block" href="#/ritual/${sel}">${icon('spark', 18)} Закрыть этот день</a>` : ''}
      </div>`;
  }

  on(el, 'click', '[data-act]', async (e, b) => {
    const act = b.dataset.act;
    if (act === 'sel') {
      sel = b.dataset.d;
      history.replaceState(null, '', `#/plan/${sel}`);
      await render();
    } else if (act === 'wk') {
      sel = addDays(sel, Number(b.dataset.n));
      history.replaceState(null, '', `#/plan/${sel}`);
      await render();
    } else if (act === 'todo-toggle') {
      const t = await toggleTodo(b.closest('[data-tid]'));
      if (t) {
        const list = await store.todosFor(sel);
        const counter = el.querySelector('.h2 + .small');
        if (counter) counter.textContent = progressText(list);
        if (t.done && list.every((x) => x.done)) toast(`Всё по плану на ${sel === today ? 'сегодня' : 'этот день'} — красота`);
      }
    } else if (act === 'todo-edit') {
      const all = await store.allTodos();
      const t = all.find((x) => x.id === b.closest('[data-tid]').dataset.tid);
      if (t) openTodoSheet(t, { projects, onChange: render });
    } else if (act === 'carry') {
      const over = await store.overdueTodos(today);
      for (const t of over) {
        t.date = today;
        await store.saveTodo(t);
      }
      toast(`Перенесено на сегодня: ${over.length} ${plural(over.length, 'дело', 'дела', 'дел')}`);
      await render();
    }
  });

  el.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-add]')) return;
    e.preventDefault();
    const input = el.querySelector('#new-todo');
    const text = input.value.trim();
    if (!text) return;
    await addTodo(text, sel);
    await render();
    const again = el.querySelector('#new-todo');
    if (again) again.focus();
  });

  await render();
}
