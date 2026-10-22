import {
  esc, icon, logo, on, blobUrl, todayYmd, addDays, parseYmd, fmtLong, fmtShort, WD_SHORT, WEEKDAYS, MONTHS,
  pts, daysWord, openSheet,
} from '../ui.js';
import * as store from '../store.js';
import { kvGet } from '../db.js';
import { themeFromSettings } from '../themes.js';
import { projectCover, monthScene } from '../covers.js';
import { heroPhoto, shadeHero, openHeaderSheet } from '../header.js';
import { openDaySheet, openWeekSheet, headline } from '../daysheet.js';
import {
  todoList, todoRow, toggleTodo, openTodoSheet, addTodo, progressText,
} from '../todos.js';
import {
  photosBetween, addPhotos, openGallery, photoLabel, monthCoverUrl, dayPhotos, MAX_PHOTOS,
} from '../photos.js';

export const tab = 'today';

// ——— Блоки главной: плитки идут сеткой, секции — на всю ширину ———
const BLOCKS = [
  { id: 'today', name: 'Итог дня', kind: 'tile' },
  { id: 'streak', name: 'Серия дней', kind: 'tile' },
  { id: 'mood', name: 'Настроение недели', kind: 'tile' },
  { id: 'chart', name: 'График за 14 дней', kind: 'tile' },
  { id: 'project', name: 'Проект', kind: 'tile' },
  { id: 'plan', name: 'План на сегодня', kind: 'tile' },
  { id: 'best', name: 'Лучший день недели', kind: 'tile' },
  { id: 'tip', name: 'Совет от ИИ', kind: 'tile' },
  { id: 'photos', name: 'Неделя в фото', kind: 'section' },
  { id: 'todos', name: 'Дела с галочками', kind: 'section' },
  { id: 'month', name: 'Карточка месяца', kind: 'section' },
  { id: 'projects', name: 'Лента проектов', kind: 'section' },
];
const DEFAULT_HIDDEN = ['todos', 'projects'];
const SPAN = {
  today: [2, 2], streak: [1, 1], mood: [1, 1], chart: [2, 2], project: [1, 2], plan: [1, 1], best: [1, 1], tip: [2, 1],
};
const MOOD = ['', 'так себе', 'ниже среднего', 'нормально', 'хорошо', 'отлично'];

function layout(s) {
  const cfg = s.home || {};
  const known = BLOCKS.map((b) => b.id);
  const order = (cfg.order || []).filter((id) => known.includes(id));
  known.forEach((id, i) => {
    if (!order.includes(id)) order.splice(Math.min(i, order.length), 0, id);
  });
  return { order, hidden: new Set(cfg.hidden || DEFAULT_HIDDEN) };
}

const avgOf = (arr) => (arr.length ? Math.round(arr.reduce((a, x) => a + x, 0) / arr.length) : null);

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

function bigRing(pct) {
  const C1 = 2 * Math.PI * 52;
  const C2 = 2 * Math.PI * 40;
  const f1 = Math.min(pct, 100) / 100;
  const f2 = Math.min(Math.max(pct - 100, 0), 100) / 100;
  return `<svg viewBox="0 0 124 124" aria-hidden="true">
    <circle cx="62" cy="62" r="52" class="bigring__track"/>
    ${f1 > 0 ? `<circle cx="62" cy="62" r="52" class="bigring__val" stroke-dasharray="${C1.toFixed(2)}" stroke-dashoffset="${(C1 * (1 - f1)).toFixed(2)}"/>` : ''}
    ${f2 > 0 ? `<circle cx="62" cy="62" r="40" class="bigring__over" stroke-dasharray="${(C2 * f2).toFixed(2)} ${C2.toFixed(2)}"/>` : ''}
  </svg>`;
}

function smallRing(f, label) {
  const C = 2 * Math.PI * 16;
  return `<span class="sring"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" class="sring__track"/>${f > 0 ? `<circle cx="24" cy="24" r="16" class="sring__val" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - Math.min(f, 1))).toFixed(2)}"/>` : ''}</svg><b>${label}</b></span>`;
}

function sparkline(points) {
  const W = 320;
  const H = 92;
  const vals = points.filter((p) => p.pct != null).map((p) => p.pct);
  const cap = Math.max(150, Math.min(200, Math.max(...vals, 0)));
  const x = (i) => 6 + (i * (W - 12)) / (points.length - 1);
  const y = (p) => 8 + (1 - Math.min(p, cap) / cap) * (H - 16);
  const segs = [];
  let cur = [];
  points.forEach((p, i) => {
    if (p.pct == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push([x(i), y(p.pct)]);
  });
  if (cur.length) segs.push(cur);
  const f = (n) => n.toFixed(1);
  const line = segs.map((sg) => `M ${sg.map(([a, b]) => `${f(a)} ${f(b)}`).join(' L ')}`).join(' ');
  const area = segs.filter((sg) => sg.length > 1).map((sg) => `M ${f(sg[0][0])} ${H} L ${sg.map(([a, b]) => `${f(a)} ${f(b)}`).join(' L ')} L ${f(sg[sg.length - 1][0])} ${H} Z`).join(' ');
  const dots = points.map((p, i) => (p.pct == null ? '' : `<i class="spark__dot${p.pct >= 100 ? ' is-hit' : ''}${i === points.length - 1 ? ' is-last' : ''}" style="left:${f((x(i) / W) * 100)}%;top:${f((y(p.pct) / H) * 100)}%"></i>`)).join('');
  return `<div class="spark">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="sp-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
      <line x1="0" x2="${W}" y1="${f(y(100))}" y2="${f(y(100))}" class="spark__norm"/>
      ${area ? `<path d="${area}" fill="url(#sp-fill)"/>` : ''}
      ${line ? `<path d="${line}" class="spark__line"/>` : ''}
    </svg>
    ${dots}
    <div class="spark__hits" style="grid-template-columns:repeat(${points.length}, minmax(0, 1fr))">${points.map((p) => `<button data-day="${p.ds}" aria-label="${fmtLong(p.ds)}${p.pct == null ? ': не закрыт' : `: ${p.pct}%`}"></button>`).join('')}</div>
  </div>`;
}

export default async function today(el) {
  const s = await store.getSettings();
  const theme = themeFromSettings(s);
  const photo = await heroPhoto(s, theme);
  const now = new Date();
  const hour = now.getHours();
  const todayStr = todayYmd();
  const days = await store.allDays();
  const closedDays = days.filter((d) => d.closed);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const yesterday = addDays(todayStr, -1);
  const late = hour < 5 && !(byDate.get(yesterday) || {}).closed && !(byDate.get(todayStr) || {}).closed;
  const focus = late ? yesterday : todayStr;
  const day = byDate.get(focus);
  const closed = !!(day && day.closed);
  const norm = await store.normFor(todayStr, days);
  const streak = store.streak(days, todayStr);
  const allProjects = await store.allProjects();
  const activeProjects = allProjects.filter((p) => !p.done);
  const todayTodos = await store.todosFor(todayStr);
  const { order, hidden } = layout(s);
  const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

  // ——— Кружки недели ———
  const monday = addDays(todayStr, -((parseYmd(todayStr).getDay() + 6) % 7));
  const week = await Promise.all(Array.from({ length: 7 }, async (_, i) => {
    const ds = addDays(monday, i);
    const d = byDate.get(ds);
    const ids = ds > todayStr ? [] : await dayPhotos(ds, d || null);
    return {
      ds, i, pct: d && d.closed ? d.pct : null, future: ds > todayStr, isToday: ds === todayStr, photo: ids[0] ? await blobUrl(ids[0]) : '',
    };
  }));
  const RC = 2 * Math.PI * 21;
  const ringsHtml = `<div class="rings" aria-label="Дни этой недели">${week.map((w) => {
    const val = w.pct == null ? 0 : Math.min(w.pct, 100) / 100;
    const cls = ['ring', w.isToday && 'is-today', w.future && 'is-future', w.pct != null && 'is-closed', w.photo && 'has-photo'].filter(Boolean).join(' ');
    const label = `${WEEKDAYS[(w.i + 1) % 7]}${w.isToday ? ', сегодня' : ''}: ${w.future ? 'впереди' : w.pct == null ? 'не закрыт' : `${w.pct}%`}`;
    return `<button class="${cls}" data-day="${w.ds}" aria-label="${label}">
      <span class="ring__c">
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" class="ring__track"/>${val > 0 ? `<circle cx="24" cy="24" r="21" class="ring__val" stroke-dasharray="${RC.toFixed(2)}" stroke-dashoffset="${(RC * (1 - val)).toFixed(2)}"/>` : ''}</svg>
        ${w.photo ? `<img class="ring__img" src="${w.photo}" alt="">` : ''}
        <span class="ring__wd">${WD_SHORT[w.i]}</span>
      </span>
      <span class="ring__v">${w.pct == null ? '—' : `${w.pct}%`}</span>
    </button>`;
  }).join('')}</div>`;

  // ——— Плитки ———
  const tiles = {};
  const planDone = todayTodos.filter((t) => t.done).length;

  tiles.today = () => {
    if (closed) {
      return `<section class="tile tile--today" aria-label="Итог дня">
        <div class="bigring">${bigRing(day.pct)}<span class="bigring__c"><b>${day.pct}%</b><span>от нормы</span></span></div>
        <div class="stack grow" style="--gap:6px">
          <span class="tile__eyebrow">${late ? 'Вчера' : 'Сегодня'}</span>
          <span class="tile__title">${headline(day.pct)}</span>
          <span class="tiny muted">${pts(day.total)} · норма ${day.norm}</span>
          <button class="btn btn--accent btn--sm" data-day="${focus}" style="align-self:flex-start;margin-top:4px">Открыть день</button>
        </div>
      </section>`;
    }
    const title = late ? 'Вчера ещё открыто' : hour < 17 ? 'День в разгаре' : 'Пора закрыть день';
    const sub = todayTodos.length && !late ? `В плане сделано ${planDone} из ${todayTodos.length}` : 'Пара строк — и ИИ всё посчитает';
    return `<section class="tile tile--today" aria-label="День">
      <div class="bigring bigring--wait">${bigRing(0)}<span class="bigring__c"><b>${norm}</b><span>норма, очков</span></span></div>
      <div class="stack grow" style="--gap:6px">
        <span class="tile__eyebrow">${late ? 'Вчера' : 'Сегодня'}</span>
        <span class="tile__title">${title}</span>
        <span class="tiny muted">${sub}</span>
        <a class="btn btn--accent btn--sm" href="#/ritual/${focus}" style="align-self:flex-start;margin-top:4px">Закрыть день</a>
      </div>
    </section>`;
  };

  tiles.streak = () => {
    const dates = closedDays.map((d) => d.date);
    let best = 0;
    let run = 0;
    dates.forEach((ds, i) => {
      run = i && addDays(dates[i - 1], 1) === ds ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return `<section class="tile tile--row" aria-label="Серия">
      <span class="tile__ic">${icon('flame', 20)}</span>
      <span class="stack" style="--gap:0;min-width:0"><b class="tile__num">${daysWord(streak)}</b><span class="tiny muted">${streak ? (best > streak ? `подряд · рекорд ${best}` : 'подряд — рекорд') : 'серия начнётся сегодня'}</span></span>
    </section>`;
  };

  tiles.mood = () => {
    const list = closedDays.filter((d) => d.mood && d.date > addDays(todayStr, -7)).map((d) => d.mood);
    const m = avgOf(list);
    return `<section class="tile tile--mood" aria-label="Настроение недели">
      <span class="tiny muted">Настроение недели</span>
      <b class="tile__word2">${m ? MOOD[m] : 'не отмечено'}</b>
      <span class="mdots" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i === m ? 'on' : ''}" style="background:color-mix(in srgb, var(--accent) ${i * 20}%, var(--surface-2))"></i>`).join('')}</span>
    </section>`;
  };

  tiles.chart = () => {
    const points = Array.from({ length: 14 }, (_, i) => {
      const ds = addDays(todayStr, i - 13);
      const d = byDate.get(ds);
      return { ds, pct: d && d.closed ? d.pct : null };
    });
    const vals = points.filter((p) => p.pct != null).map((p) => p.pct);
    const a7 = avgOf(points.slice(7).filter((p) => p.pct != null).map((p) => p.pct));
    const p7 = avgOf(points.slice(0, 7).filter((p) => p.pct != null).map((p) => p.pct));
    const trend = a7 != null && p7 != null ? a7 - p7 : null;
    return `<section class="tile tile--chart" aria-label="График за 14 дней">
      <div class="row between" style="align-items:baseline">
        <span class="small muted" style="font-weight:600">14 дней</span>
        <span class="small">${vals.length ? `в среднем <b>${avgOf(vals)}%</b>` : ''}${trend != null ? ` <span class="trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)}%</span>` : ''}</span>
      </div>
      ${vals.length >= 2 ? sparkline(points) : '<div class="spark spark--empty"><span class="tiny muted">Закрой пару дней — здесь появится график</span></div>'}
      <div class="row between tiny muted"><span>${fmtShort(points[0].ds)}</span><span>${vals.length >= 2 ? 'нажми на точку' : ''}</span><span>сегодня</span></div>
    </section>`;
  };

  tiles.project = async () => {
    const p = activeProjects[0];
    if (!p) {
      return `<a class="tile tile--new" href="#/projects/new">${icon('plus', 24)}<b>Новый проект</b><span class="tiny muted">диплом, ремонт, большой кейс</span></a>`;
    }
    const url = p.coverBlobId ? await blobUrl(p.coverBlobId) : '';
    const pct = store.projectPct(p);
    return `<a class="tile tile--photo" href="#/project/${p.id}" aria-label="Проект «${esc(p.title)}», готово ${pct}%">
      ${url ? `<img class="tile__img" src="${url}" alt="">` : `<span class="tile__svg">${projectCover(p.id)}</span>`}
      <span class="tile__tag">Проект</span>
      <span class="tile__bottom"><span class="tile__ptitle">${esc(p.title)}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="tiny">Готово ${pct}%</span></span>
    </a>`;
  };

  tiles.plan = () => {
    const next = todayTodos.find((t) => !t.done);
    const n = todayTodos.length;
    const label = n ? `${planDone}/${n}` : '0';
    const [cap, txt] = !n ? ['План пуст', 'добавь пару дел'] : next ? ['Дальше', next.text] : ['План', 'всё сделано'];
    return `<a class="tile tile--row" href="#/plan" aria-label="План на сегодня: ${n ? `сделано ${planDone} из ${n}` : 'пусто'}">
      ${smallRing(n ? planDone / n : 0, label)}
      <span class="stack" style="--gap:2px;min-width:0"><span class="tiny muted">${cap}</span><span class="tile__next">${esc(txt)}</span></span>
    </a>`;
  };

  tiles.best = () => {
    const wd = Array.from({ length: 7 }, () => []);
    for (const d of closedDays) wd[(parseYmd(d.date).getDay() + 6) % 7].push(d.pct);
    const avg = wd.map(avgOf);
    const enough = wd.filter((x) => x.length).length >= 3;
    const best = avg.reduce((b, v, i) => (v != null && (b === -1 || v > avg[b]) ? i : b), -1);
    const max = Math.max(...avg.map((v) => v || 0), 1);
    return `<a class="tile tile--best" href="#/archive" aria-label="${enough ? `Лучший день недели — ${WEEKDAYS[(best + 1) % 7].toLowerCase()}` : 'Лучший день недели пока не ясен'}">
      <span class="row between" style="align-items:flex-end"><span class="tiny muted">Твой пик</span>
        <span class="minibars" aria-hidden="true">${avg.map((v, i) => `<i class="${enough && i === best ? 'on' : ''}" style="height:${v == null ? 3 : Math.max(4, Math.round((v / max) * 24))}px"></i>`).join('')}</span></span>
      <span class="tile__word">${enough ? WEEKDAYS[(best + 1) % 7].toLowerCase() : 'ещё рано'}</span>
    </a>`;
  };

  tiles.tip = async () => {
    let text = '';
    let cap = '';
    let attrs = '';
    const recent = [...closedDays].reverse().filter((d) => d.date >= addDays(todayStr, -3));
    const withTip = recent.find((d) => d.analysis && d.analysis.tomorrow);
    const wk = (await kvGet(`weekAnalysis:${monday}`)) || (await kvGet(`weekAnalysis:${addDays(monday, -7)}`));
    if (withTip) {
      text = withTip.analysis.tomorrow;
      cap = `из разбора дня · ${fmtShort(withTip.date)}`;
      attrs = `data-day="${withTip.date}"`;
    } else if (wk && wk.advice) {
      text = wk.advice;
      cap = 'из разбора недели';
      attrs = `data-act="week" data-mon="${(await kvGet(`weekAnalysis:${monday}`)) ? monday : addDays(monday, -7)}"`;
    } else if (!s.apiKey) {
      text = 'Добавь ключ ИИ — здесь появятся советы на завтра';
      cap = 'настройки';
      attrs = 'data-href="#/settings"';
    } else if (recent.length) {
      text = 'Открой разбор дня — ИИ подскажет, с чего начать завтра';
      cap = fmtShort(recent[0].date);
      attrs = `data-day="${recent[0].date}"`;
    } else {
      text = 'Закрой день — и здесь появится совет от ИИ';
      cap = 'вечерний ритуал';
      attrs = `data-href="#/ritual/${focus}"`;
    }
    return `<button class="tile tile--tip" ${attrs}>
      <span class="tile__spark">${icon('spark', 22)}</span>
      <span class="stack" style="--gap:2px;min-width:0"><span class="tile__quote">${esc(text)}</span><span class="tiny muted">${esc(cap)}</span></span>
    </button>`;
  };

  // ——— Секции ———
  const sections = {};
  sections.photos = async () => {
    const items = await photosBetween(addDays(todayStr, -6), todayStr, days);
    const canAdd = (await dayPhotos(focus, day || null)).length < MAX_PHOTOS;
    const urls = await Promise.all(items.slice(0, 3).map((it) => blobUrl(it.id)));
    const fig = (k, cls = '') => `<button class="wph__f ${cls}" data-ph="${k}" aria-label="Фото: ${fmtLong(items[k].date)}">
      <img src="${urls[k]}" alt="">
      ${k === 2 && items.length > 3 ? `<span class="wph__more">+${items.length - 3}</span>` : `<span class="wph__cap">${photoLabel(items[k])}</span>`}
    </button>`;
    const n = items.length;
    const body = !n
      ? `<button class="card wph-empty" data-act="add-photo">${icon('camera', 26)}<b>Добавь фото дня</b><span class="tiny muted">Закат, кофе, конспект — что угодно. Здесь соберётся коллаж недели, а лучшее фото станет обложкой месяца.</span></button>`
      : `<div class="wph wph--${Math.min(n, 3)}">${fig(0, 'is-big')}${n > 1 ? fig(1) : ''}${n > 2 ? fig(2) : ''}</div>`;
    return `<section class="pad stack" style="--gap:12px" aria-label="Неделя в фото">
      <div class="row between"><h2 class="eyebrow">Неделя в фото</h2>${n && canAdd ? `<button class="link small" data-act="add-photo" style="background:none;border:0;padding:0;gap:6px">${icon('camera', 16)} Фото дня</button>` : ''}</div>
      ${body}
    </section>`;
  };

  sections.todos = () => `<section class="pad stack" style="--gap:12px" aria-label="Дела на сегодня">
      <div class="row between"><h2 class="eyebrow">Дела на сегодня</h2><span class="row" style="--gap:12px"><span class="small muted" data-plan-count>${progressText(todayTodos)}</span><a class="link small" href="#/plan">Весь план</a></span></div>
      <div class="card p">
        ${todayTodos.length ? todoList(todayTodos, allProjects) : '<p class="small muted m0" style="padding:4px 2px 2px">Пока пусто. Добавь пару дел — вечером ИИ учтёт, что выполнено.</p>'}
        <form class="todo-add" data-add>
          <label class="sr-only" for="today-todo">Новое дело на сегодня</label>
          <input class="input" id="today-todo" maxlength="140" autocomplete="off" placeholder="Добавить дело на сегодня">
          <button class="add-btn" type="submit" aria-label="Добавить дело">${icon('plus', 22, 2.2)}</button>
        </form>
      </div>
    </section>`;

  sections.month = async () => {
    const key = todayStr.slice(0, 7);
    const mi = Number(key.slice(5, 7)) - 1;
    const list = closedDays.filter((d) => d.date.startsWith(key));
    const cover = await monthCoverUrl(list);
    const avg = avgOf(list.map((d) => d.pct));
    return `<div class="pad"><a class="month" href="#/month/${key}" aria-label="${MONTHS[mi]}: ${list.length ? `${daysWord(list.length)}, в среднем ${avg}%` : 'пока без закрытых дней'}">
      ${cover ? `<img class="month__img" src="${cover}" alt="">` : monthScene(mi)}
      <span class="month__badge">${list.length ? `${daysWord(list.length)} · ${avg}%` : 'месяц только начался'}</span>
      <span class="month__name">${MONTHS[mi]}</span>
    </a></div>`;
  };

  sections.projects = async () => {
    const list = activeProjects.slice(0, 8);
    return `<section class="stack" style="--gap:12px" aria-label="Проекты">
      <div class="pad row between"><h2 class="eyebrow">Проекты</h2>${list.length ? '<a class="link small" href="#/projects">Все</a>' : ''}</div>
      <div class="hscroll">${(await Promise.all(list.map((p) => projectCardHtml(p, true)))).join('')}<a class="pcard pcard--mini pcard--new" href="#/projects/new">${icon('plus', 22)}<span>Новый проект</span></a></div>
    </section>`;
  };

  // Собираем по порядку: подряд идущие плитки — в одну сетку.
  const parts = [];
  let grid = [];
  const flush = () => {
    if (grid.length) parts.push(`<div class="pad"><div class="bento">${grid.join('')}</div></div>`);
    grid = [];
  };
  for (const id of order) {
    if (hidden.has(id)) continue;
    const b = BLOCKS.find((x) => x.id === id);
    if (b.kind === 'tile') {
      const [c, r] = SPAN[id];
      const html = await tiles[id]();
      grid.push(html.replace(/^<(\w+) class="tile/, `<$1 style="grid-column:span ${c};grid-row:span ${r}" class="tile`));
    } else {
      flush();
      parts.push(await sections[id]());
    }
  }
  flush();

  const hello = s.name ? `Привет, ${esc(s.name)}!` : 'Привет!';
  const sub = closed
    ? `${late ? 'Вчера' : 'Сегодня'} ты на ${day.pct}% — ${headline(day.pct).toLowerCase()}.`
    : late ? 'Вчерашний день ещё открыт — закрой его перед сном.'
      : hour < 12 ? 'Хорошего дня. Вечером расскажешь, как прошёл.'
        : hour < 17 ? 'День в самом разгаре — держи ритм.'
          : 'Вечер. Пара строк о дне — и можно отдыхать.';

  el.innerHTML = `
    <div class="hero" style="--hero-h:300px;--overlap:58px">
      <img class="hero__img" src="${photo}" alt="" style="object-position:${theme.pos || '50% 50%'}">
      <div class="hero__top">${logo()}<div class="row" style="--gap:8px"><button class="icon-btn" data-act="header" aria-label="Сменить шапку">${icon('image')}</button><a class="icon-btn" href="#/settings" aria-label="Настройки">${icon('gear')}</a></div></div>
      <div class="hero__content">
        <p class="eyebrow">${fmtLong(todayStr)}</p>
        <h1 class="h1 hero__title">${hello}</h1>
        <p class="hero__sub">${sub}</p>
      </div>
    </div>
    <div class="pad over">${ringsHtml}</div>
    <div class="home">${parts.join('')}
      <div class="pad" style="display:flex;justify-content:center"><button class="cfg-btn" data-act="home-cfg">${icon('gear', 18)} Настроить главную</button></div>
    </div>`;

  const openDay = (ds) => openDaySheet(ds, { onChange: rerender });
  on(el, 'click', '[data-day]', (e, b) => openDay(b.dataset.day));
  on(el, 'click', '[data-href]', (e, b) => { location.hash = b.dataset.href; });
  on(el, 'click', '[data-act="week"]', (e, b) => openWeekSheet(b.dataset.mon || monday));
  on(el, 'click', '[data-act="add-photo"]', async () => {
    if (await addPhotos(focus)) rerender();
  });
  on(el, 'click', '[data-ph]', async (e, b) => {
    const items = await photosBetween(addDays(todayStr, -6), todayStr);
    openGallery(items, Number(b.dataset.ph), { onOpenDay: openDay });
  });
  on(el, 'click', '[data-act="home-cfg"]', () => openHomeSettings(rerender));
  on(el, 'click', '[data-act="todo-toggle"]', async (e, b) => {
    await toggleTodo(b.closest('[data-tid]'));
    const c = el.querySelector('[data-plan-count]');
    if (c) c.textContent = progressText(await store.todosFor(todayStr));
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
  on(el, 'click', '[data-act="header"]', () => openHeaderSheet(rerender));
  shadeHero(el.querySelector('.hero'), photo, theme, [0.2, 0.62]);
}

// ——— Настройка главной: что показывать и в каком порядке ———
async function openHomeSettings(onDone) {
  const s = await store.getSettings();
  let { order, hidden } = layout(s);
  let changed = false;
  const sh = openSheet(`
    <div class="stack">
      <h2 class="h2">Главная</h2>
      <p class="small muted m0">Включай нужные блоки и двигай их стрелками. Плитки, что стоят рядом, собираются в сетку.</p>
      <ul class="cfg" data-list></ul>
      <div class="stack" style="--gap:10px">
        <button class="btn btn--accent btn--block" data-close>Готово</button>
        <button class="btn btn--ghost btn--block" data-reset>Вернуть как было</button>
      </div>
    </div>`, { label: 'Настройка главной', onClose: () => { if (changed) onDone(); } });
  const list = sh.el.querySelector('[data-list]');
  const draw = () => {
    list.innerHTML = order.map((id, i) => {
      const b = BLOCKS.find((x) => x.id === id);
      const onn = !hidden.has(id);
      return `<li class="cfg__row${onn ? '' : ' is-off'}" data-id="${id}">
        <button class="cfg__toggle" data-t aria-pressed="${onn}"><span class="box${onn ? ' box--on' : ''}">${onn ? icon('check', 14, 3) : ''}</span><span class="grow">${b.name}</span><span class="tiny muted">${b.kind === 'tile' ? 'плитка' : 'блок'}</span></button>
        <button class="icon-sm" data-mv="-1" aria-label="Выше: ${b.name}"${i === 0 ? ' disabled' : ''}>${icon('up', 18)}</button>
        <button class="icon-sm" data-mv="1" aria-label="Ниже: ${b.name}"${i === order.length - 1 ? ' disabled' : ''}>${icon('down', 18)}</button>
      </li>`;
    }).join('');
  };
  const save = async () => {
    changed = true;
    await store.saveSettings({ home: { order: [...order], hidden: [...hidden] } });
    draw();
  };
  sh.el.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (e.target.closest('[data-reset]')) {
      order = BLOCKS.map((b) => b.id);
      hidden = new Set(DEFAULT_HIDDEN);
      await save();
      return;
    }
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('[data-t]')) {
      if (hidden.has(id)) hidden.delete(id);
      else hidden.add(id);
      await save();
      sh.el.querySelector(`[data-id="${id}"] [data-t]`)?.focus();
    }
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const i = order.indexOf(id);
      const j = i + Number(mv.dataset.mv);
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      await save();
      sh.el.querySelector(`[data-id="${id}"] [data-mv="${mv.dataset.mv}"]`)?.focus();
    }
  });
  draw();
}
