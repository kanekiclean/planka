import {
  esc, icon, on, toast, busy, arcSvg, autosize, uid, fmtLong, todayYmd, addDays, openSheet, confirmSheet, pts,
} from '../ui.js';
import * as store from '../store.js';
import * as ai from '../ai.js';

export const tab = null;

const FB = { lower: 'Завысил', ok: 'В точку', higher: 'Занизил' };
const PHRASES = ['Читаю твой день…', 'Раскладываю по задачам…', 'Сверяю с твоими целями…', 'Считаю относительно нормы…'];

const draftKey = (d) => `planka-draft:${d}`;
const readDraft = (d) => { try { return localStorage.getItem(draftKey(d)) || ''; } catch { return ''; } };
const writeDraft = (d, v) => { try { if (v) localStorage.setItem(draftKey(d), v); else localStorage.removeItem(draftKey(d)); } catch { /* приватный режим */ } };

function headline(pct) {
  if (pct >= 120) return 'Сильный день';
  if (pct >= 100) return 'Планка взята';
  if (pct >= 70) return 'Хороший день';
  return 'Спокойный день';
}

export default async function ritual(el, [dateParam]) {
  const s = await store.getSettings();
  const areas = s.areas && s.areas.length ? s.areas : ['Работа', 'Учёба', 'Здоровье'];
  const todayStr = todayYmd();
  const yesterday = addDays(todayStr, -1);
  let date = dateParam;
  if (!date) {
    const y = await store.getDay(yesterday);
    const t = await store.getDay(todayStr);
    date = new Date().getHours() < 5 && !(y && y.closed) && !(t && t.closed) ? yesterday : todayStr;
  }
  const projects = await store.allProjects();
  const existing = await store.getDay(date);
  const st = {
    date,
    text: existing && existing.raw ? existing.raw : readDraft(date),
    mood: existing ? existing.mood || 0 : 0,
    tasks: existing && existing.tasks ? existing.tasks.map((t) => ({ ...t })) : [],
    comment: existing ? existing.comment || '' : '',
    phase: existing && existing.closed ? 'review' : 'input',
    saved: !!(existing && existing.closed),
    dirty: false,
  };
  const norm = await store.normFor(date);
  let phraseTimer = null;

  const topbar = () => `
    <header class="topbar pad">
      <button class="icon-btn" data-act="exit" aria-label="Закрыть">${icon('close')}</button>
      <span class="small muted">${fmtLong(st.date)}</span>
      <span style="width:44px" aria-hidden="true"></span>
    </header>`;

  const inputHtml = () => {
    const switcher = !st.saved && (st.date === todayStr || st.date === yesterday)
      ? `<div class="seg" role="group" aria-label="Какой день закрываем">${[[yesterday, 'Вчера'], [todayStr, 'Сегодня']].map(([d, l]) => `<button data-act="date" data-v="${d}" aria-pressed="${st.date === d}">${l}</button>`).join('')}</div>`
      : '';
    return `${topbar()}
      <div class="pad stack" style="--gap:22px;padding-top:10px">
        <div class="stack" style="--gap:10px">
          <p class="eyebrow">Вечерний ритуал</p>
          <h1 class="h1">Как прошёл день?</h1>
          <p class="small muted m0">Пиши как другу: что сделал и примерно сколько времени ушло. Можно списком, можно одним абзацем.</p>
        </div>
        ${switcher}
        <div class="field">
          <label class="sr-only" for="dayText">Что сделал за день</label>
          <textarea id="dayText" class="textarea textarea--big" data-f="text" placeholder="Например: два часа сидел над курсовой, доделал презентацию, вечером сходил в зал">${esc(st.text)}</textarea>
        </div>
        <div class="stack" style="--gap:10px">
          <span class="label" id="moodLbl">Настроение</span>
          <div class="mood" role="group" aria-labelledby="moodLbl">
            ${[1, 2, 3, 4, 5].map((i) => `<button class="mood__dot" data-act="mood" data-v="${i}" aria-pressed="${st.mood === i}" aria-label="Настроение ${i} из 5" style="background:color-mix(in srgb, var(--accent) ${i * 20}%, var(--surface))"></button>`).join('')}
          </div>
          <div class="row between tiny muted"><span>так себе</span><span>отлично</span></div>
        </div>
        ${s.apiKey
          ? `<button class="btn btn--accent btn--block" data-act="evaluate">${icon('spark', 18)} Оценить день</button>`
          : '<div class="card p small">Чтобы день оценивал ИИ, добавь ключ в <a href="#/settings">настройках</a>. А пока можно разбить день на задачи самому.</div>'}
        <button class="btn btn--ghost btn--block" data-act="manual">${s.apiKey ? 'Без ИИ — разобью сам' : 'Разбить на задачи'}</button>
        ${st.tasks.length ? '<button class="btn btn--ghost btn--block" data-act="to-review">Вернуться к задачам</button>' : ''}
      </div>`;
  };

  const loadingHtml = () => `
    <div class="loading pad" role="status">
      <div class="breath" aria-hidden="true"></div>
      <p class="h2" id="phrase">${PHRASES[0]}</p>
      <p class="small muted m0">Обычно это 5–30 секунд</p>
    </div>`;

  const score = (l, v) => `<div class="score"><span class="row between"><span>${l}</span><b>${v}</b></span><span class="score__bar"><i style="width:${v * 10}%"></i></span></div>`;

  const taskHtml = (t) => {
    const proj = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
    return `<li class="card task" data-tid="${t.id}">
      <div class="task__top">
        <div class="stack grow" style="--gap:4px">
          <span class="task__title">${esc(t.title)}</span>
          <span class="tiny muted">${esc(t.area || '')}${proj ? ` · ${esc(proj.title)}` : ''}</span>
        </div>
        <span class="task__pts">+${store.taskPoints(t)}</span>
      </div>
      <div class="scores">${score('Сложность', t.difficulty)}${score('Силы', t.effort)}${score('Вклад', t.impact)}</div>
      ${t.reason ? `<p class="tiny muted m0">${esc(t.reason)}</p>` : ''}
      <div class="row" style="--gap:6px">
        <div class="seg grow" role="group" aria-label="Как тебе оценка">${Object.entries(FB).map(([v, l]) => `<button data-act="fb" data-v="${v}" aria-pressed="${(t.feedback || 'ok') === v}">${l}</button>`).join('')}</div>
        <button class="icon-sm" data-act="edit-task" aria-label="Изменить задачу">${icon('edit', 18)}</button>
      </div>
    </li>`;
  };

  const reviewHtml = () => {
    const total = st.tasks.reduce((a, t) => a + store.taskPoints(t), 0);
    const pct = Math.round((total / norm) * 100);
    return `${topbar()}
      <div class="pad stack" style="--gap:18px;padding-top:8px">
        <div class="stack" style="--gap:8px">
          <p class="eyebrow">${st.saved ? 'Закрытый день' : 'Почти готово'}</p>
          <h1 class="h1">${headline(pct)}</h1>
        </div>
        <section class="card p-lg stack" aria-label="Итог дня">
          <div class="row between" style="align-items:flex-end">
            <div class="stack" style="--gap:4px">
              <span class="small muted">Итог дня</span>
              <span class="big-num">${pct}%</span>
              <span class="small muted">${pts(total)} · норма ${norm}</span>
            </div>
            ${arcSvg(pct, 132, 11)}
          </div>
          ${st.comment ? `<p class="comment">${esc(st.comment)}</p>` : ''}
        </section>
        <div class="row between"><h2 class="eyebrow">Задачи · ${st.tasks.length}</h2><span class="tiny muted">Поправь, если ИИ промахнулся</span></div>
        ${st.tasks.length ? `<ul class="tasks">${st.tasks.map(taskHtml).join('')}</ul>` : '<div class="card p small muted">Задач пока нет — добавь их вручную.</div>'}
        <button class="btn btn--ghost btn--block" data-act="add-task">${icon('plus', 18)} Добавить задачу</button>
        <div class="stack" style="--gap:10px;margin-top:6px">
          <button class="btn btn--accent btn--block" data-act="save">${st.saved ? 'Сохранить изменения' : 'Сохранить и закрыть день'}</button>
          <button class="btn btn--ghost btn--block" data-act="edit-text">${icon('edit', 18)} Изменить описание</button>
          ${st.saved ? `<button class="btn btn--ghost btn--block" data-act="delete-day">${icon('trash', 18)} Удалить запись</button>` : ''}
        </div>
      </div>`;
  };

  function render() {
    el.innerHTML = st.phase === 'input' ? inputHtml() : st.phase === 'loading' ? loadingHtml() : reviewHtml();
    autosize(el.querySelector('#dayText'));
  }

  function startPhrases() {
    let i = 0;
    phraseTimer = setInterval(() => {
      i = (i + 1) % PHRASES.length;
      const p = el.querySelector('#phrase');
      if (p) p.textContent = PHRASES[i];
    }, 2600);
  }
  function stopPhrases() {
    clearInterval(phraseTimer);
    phraseTimer = null;
  }

  async function evaluate() {
    if (!st.text.trim()) {
      toast('Напиши пару строк о дне');
      return;
    }
    st.phase = 'loading';
    render();
    startPhrases();
    try {
      const res = await ai.evaluateDay({ date: st.date, text: st.text, mood: st.mood, projects, calib: await store.getCalib() });
      st.tasks = res.tasks.map((t) => ({
        id: uid(), ...t, feedback: 'ok', ai: { d: t.difficulty, e: t.effort, i: t.impact },
      }));
      st.comment = res.comment;
      st.phase = 'review';
      st.dirty = true;
    } catch (e) {
      toast(ai.aiErrorText(e), 'err');
      st.phase = 'input';
    }
    stopPhrases();
    if (el.isConnected) {
      render();
      window.scrollTo(0, 0);
    }
  }

  function manual() {
    const parts = st.text
      .split(/\n|;|•|,\s+|\.\s+/)
      .map((x) => x.replace(/^[\s\-–—*\d.)]+/, '').trim())
      .filter((x) => x.length > 1)
      .slice(0, 15);
    st.tasks = parts.map((title) => ({
      id: uid(), title: title.slice(0, 120), area: areas[0], difficulty: 5, effort: 5, impact: 5, projectId: null, reason: '', feedback: 'ok',
    }));
    st.comment = '';
    st.phase = 'review';
    st.dirty = true;
    render();
    window.scrollTo(0, 0);
    if (parts.length) toast('Проверь оценки — у всех по 5 из 10');
    else editTask(null);
  }

  function editTask(t) {
    const isNew = !t;
    const task = t ? { ...t } : {
      id: uid(), title: '', area: areas[0], difficulty: 5, effort: 5, impact: 5, projectId: null, reason: '', feedback: 'ok',
    };
    const areaList = areas.includes(task.area) ? areas : [...areas, task.area];
    const slider = (k, l) => `<div class="field"><div class="row between"><label class="label" for="t-${k}">${l}</label><b id="t-${k}-v">${task[k]}</b></div><input type="range" id="t-${k}" data-k="${k}" min="1" max="10" step="1" value="${task[k]}"></div>`;
    const projOpts = projects.filter((p) => !p.done || p.id === task.projectId);
    const sh = openSheet(`
      <form class="stack" data-form>
        <h2 class="h2">${isNew ? 'Новая задача' : 'Задача'}</h2>
        <div class="field"><label class="label" for="t-title">Что сделал</label>
          <input class="input" id="t-title" value="${esc(task.title)}" placeholder="Например: дописал главу" maxlength="120"></div>
        <div class="field"><label class="label" for="t-area">Направление</label>
          <select class="select" id="t-area">${areaList.map((a) => `<option ${a === task.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
        ${projOpts.length ? `<div class="field"><label class="label" for="t-proj">Проект</label>
          <select class="select" id="t-proj"><option value="">Без проекта</option>${projOpts.map((p) => `<option value="${p.id}" ${p.id === task.projectId ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></div>` : ''}
        ${slider('difficulty', 'Сложность для тебя')}${slider('effort', 'Затраты сил')}${slider('impact', 'Вклад в цели')}
        <button class="btn btn--accent btn--block" type="submit">${isNew ? 'Добавить' : 'Сохранить'}</button>
        ${isNew ? '' : `<button class="btn btn--ghost btn--block" type="button" data-act="del">${icon('trash', 18)} Удалить задачу</button>`}
      </form>`, { label: 'Задача' });
    sh.el.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (k) sh.el.querySelector(`#t-${k}-v`).textContent = e.target.value;
    });
    sh.el.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = sh.el.querySelector('#t-title').value.trim();
      if (!title) {
        toast('Назови задачу');
        return;
      }
      task.title = title;
      task.area = sh.el.querySelector('#t-area').value;
      const pj = sh.el.querySelector('#t-proj');
      task.projectId = pj && pj.value ? pj.value : null;
      let changed = false;
      for (const k of ['difficulty', 'effort', 'impact']) {
        const v = Number(sh.el.querySelector(`#t-${k}`).value);
        if (v !== task[k]) changed = true;
        task[k] = v;
      }
      if (changed && !isNew) {
        task.edited = true;
        task.feedback = 'ok';
      }
      if (isNew) st.tasks.push(task);
      else st.tasks = st.tasks.map((x) => (x.id === task.id ? task : x));
      st.dirty = true;
      sh.close();
      render();
    });
    const del = sh.el.querySelector('[data-act="del"]');
    if (del) {
      del.addEventListener('click', () => {
        st.tasks = st.tasks.filter((x) => x.id !== task.id);
        st.dirty = true;
        sh.close();
        render();
      });
    }
  }

  async function save(btn) {
    if (!st.tasks.length) {
      toast('Добавь хотя бы одну задачу');
      return;
    }
    busy(btn, true, 'Сохраняю…');
    const day = {
      date: st.date, raw: st.text, mood: st.mood, tasks: st.tasks, comment: st.comment, closed: true,
      closedAt: (existing && existing.closedAt) || Date.now(),
    };
    await store.saveDay(day);
    const calib = [];
    for (const t of st.tasks) {
      if (t.feedback === 'lower' || t.feedback === 'higher') {
        calib.push({ key: `${st.date}:${t.id}:${t.feedback}`, title: t.title, difficulty: t.difficulty, effort: t.effort, impact: t.impact, feedback: t.feedback });
      } else if (t.ai && t.edited) {
        const before = t.ai.d + t.ai.e + t.ai.i;
        const after = t.difficulty + t.effort + t.impact;
        if (Math.abs(after - before) >= 2) {
          calib.push({ key: `${st.date}:${t.id}:edit`, title: t.title, difficulty: t.ai.d, effort: t.ai.e, impact: t.ai.i, feedback: after < before ? 'lower' : 'higher' });
        }
      }
    }
    await store.addCalib(calib);
    await syncProjects(st.tasks);
    writeDraft(st.date, '');
    toast(st.saved ? 'Сохранено' : 'День закрыт. Спокойной ночи');
    location.hash = '#/today';
  }

  async function syncProjects(tasks) {
    for (const p of projects) {
      const old = p.activity || [];
      const keep = old.filter((a) => a.date !== st.date);
      const linked = tasks.filter((t) => t.projectId === p.id).map((t) => ({ date: st.date, title: t.title, points: store.taskPoints(t) }));
      if (!linked.length && keep.length === old.length) continue;
      p.activity = [...keep, ...linked].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-80);
      await store.saveProject(p);
    }
  }

  async function exit() {
    if (st.phase === 'review' && st.dirty) {
      const ok = await confirmSheet({ title: 'Выйти без сохранения?', text: 'Оценки этого дня не сохранятся.', ok: 'Выйти', danger: true });
      if (!ok) return;
    }
    if (history.length > 1) history.back();
    else location.hash = '#/today';
  }

  el.addEventListener('input', (e) => {
    if (e.target.dataset.f === 'text') {
      st.text = e.target.value;
      writeDraft(st.date, st.text);
    }
  });

  on(el, 'click', '[data-act]', async (e, b) => {
    const act = b.dataset.act;
    if (act === 'exit') exit();
    else if (act === 'mood') {
      st.mood = Number(b.dataset.v);
      el.querySelectorAll('.mood__dot').forEach((d) => d.setAttribute('aria-pressed', String(Number(d.dataset.v) === st.mood)));
    } else if (act === 'date') {
      const d = b.dataset.v;
      if (d === st.date) return;
      if (st.text && !readDraft(d)) writeDraft(d, st.text);
      writeDraft(st.date, '');
      location.hash = `#/ritual/${d}`;
    } else if (act === 'evaluate') evaluate();
    else if (act === 'manual') manual();
    else if (act === 'to-review') {
      st.phase = 'review';
      render();
    } else if (act === 'fb') {
      const li = b.closest('[data-tid]');
      const t = st.tasks.find((x) => x.id === li.dataset.tid);
      t.feedback = b.dataset.v;
      st.dirty = true;
      render();
    } else if (act === 'edit-task') {
      const li = b.closest('[data-tid]');
      editTask(st.tasks.find((x) => x.id === li.dataset.tid));
    } else if (act === 'add-task') editTask(null);
    else if (act === 'save') save(b);
    else if (act === 'edit-text') {
      st.phase = 'input';
      render();
      window.scrollTo(0, 0);
    } else if (act === 'delete-day') {
      const ok = await confirmSheet({ title: 'Удалить запись этого дня?', text: 'Задачи и оценка пропадут насовсем.', ok: 'Удалить', danger: true });
      if (!ok) return;
      await store.deleteDay(st.date);
      await syncProjects([]);
      toast('Запись удалена');
      location.hash = '#/today';
    }
  });

  render();
}
