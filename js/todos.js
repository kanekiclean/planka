// Мелкие дела ежедневника: строка дела, отметка, карточка редактирования.
import {
  esc, icon, on, openSheet, toast, addDays, fmtLong, todayYmd,
} from './ui.js';
import * as store from './store.js';

export function todoRow(t, projects = []) {
  const proj = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
  return `<div class="todo${t.done ? ' todo--done' : ''}" data-tid="${t.id}">
    <button class="todo__check" data-act="todo-toggle" aria-pressed="${!!t.done}" aria-label="${t.done ? 'Снять отметку' : 'Отметить выполненным'}: ${esc(t.text)}">
      <span class="box${t.done ? ' box--on' : ''}">${t.done ? icon('check', 14, 3) : ''}</span>
    </button>
    <button class="todo__text" data-act="todo-edit">
      <span class="todo__t">${esc(t.text)}</span>
      ${t.time || proj ? `<span class="todo__meta">${t.time ? `<span class="chip">${icon('clock', 12)} ${esc(t.time)}</span>` : ''}${proj ? `<span class="chip">${esc(proj.title)}</span>` : ''}</span>` : ''}
    </button>
  </div>`;
}

export function todoList(todos, projects) {
  return `<div class="todos" data-todos>${todos.map((t) => todoRow(t, projects)).join('')}</div>`;
}

export function progressText(todos) {
  const done = todos.filter((t) => t.done).length;
  return todos.length ? `${done} из ${todos.length}` : '';
}

// Отметка без перерисовки экрана — галочка ставится мгновенно.
export async function toggleTodo(row) {
  const all = await store.allTodos();
  const t = all.find((x) => x.id === row.dataset.tid);
  if (!t) return null;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  await store.saveTodo(t);
  row.classList.toggle('todo--done', t.done);
  const btn = row.querySelector('.todo__check');
  btn.setAttribute('aria-pressed', String(t.done));
  btn.setAttribute('aria-label', `${t.done ? 'Снять отметку' : 'Отметить выполненным'}: ${t.text}`);
  const box = btn.querySelector('.box');
  box.classList.toggle('box--on', t.done);
  box.innerHTML = t.done ? icon('check', 14, 3) : '';
  if (t.done) {
    row.classList.remove('pop');
    void row.offsetWidth;
    row.classList.add('pop');
  }
  return t;
}

export function openTodoSheet(todo, { projects = [], onChange } = {}) {
  const t = { ...todo };
  const active = projects.filter((p) => !p.done || p.id === t.projectId);
  const sh = openSheet(`
    <form class="stack" data-form>
      <h2 class="h2">Дело</h2>
      <div class="field"><label class="label" for="td-text">Что сделать</label>
        <input class="input" id="td-text" value="${esc(t.text)}" maxlength="140"></div>
      <div class="erow">
        <div class="field grow"><label class="label" for="td-date">День</label>
          <input class="input" id="td-date" type="date" value="${t.date}"></div>
        <div class="field grow"><label class="label" for="td-time">Время — по желанию</label>
          <input class="input" id="td-time" type="time" value="${esc(t.time || '')}"></div>
      </div>
      ${active.length ? `<div class="field"><label class="label" for="td-proj">Проект</label>
        <select class="select" id="td-proj"><option value="">Без проекта</option>${active.map((p) => `<option value="${p.id}" ${p.id === t.projectId ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></div>` : ''}
      <button class="btn btn--accent btn--block" type="submit">Сохранить</button>
      <div class="row" style="--gap:10px">
        <button class="btn btn--ghost btn--sm grow" type="button" data-td="tomorrow">${icon('fwd', 18)} На завтра</button>
        <button class="btn btn--ghost btn--sm grow" type="button" data-td="delete">${icon('trash', 18)} Удалить</button>
      </div>
    </form>`, { label: 'Дело' });
  const done = async (msg) => {
    sh.close();
    if (msg) toast(msg);
    if (onChange) onChange();
  };
  sh.el.querySelector('[data-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = sh.el.querySelector('#td-text').value.trim();
    if (!text) {
      toast('Напиши, что сделать');
      return;
    }
    t.text = text;
    t.date = sh.el.querySelector('#td-date').value || t.date;
    t.time = sh.el.querySelector('#td-time').value || '';
    const pj = sh.el.querySelector('#td-proj');
    t.projectId = pj && pj.value ? pj.value : null;
    await store.saveTodo(t);
    done(t.date !== todo.date ? `Перенесено на ${fmtLong(t.date).toLowerCase()}` : '');
  });
  on(sh.el, 'click', '[data-td]', async (e, b) => {
    if (b.dataset.td === 'tomorrow') {
      const tomorrow = addDays(todayYmd(), 1);
      t.date = t.date >= tomorrow ? addDays(t.date, 1) : tomorrow;
      t.done = false;
      await store.saveTodo(t);
      done(t.date === addDays(todayYmd(), 1) ? 'Перенесено на завтра' : `Перенесено на ${fmtLong(t.date).toLowerCase()}`);
    } else {
      await store.deleteTodo(t.id);
      done('Дело удалено');
    }
  });
}

export async function addTodo(text, date) {
  const t = store.newTodo({ text: text.trim().slice(0, 140), date });
  await store.saveTodo(t);
  return t;
}
