// Карточка дня: открывается по нажатию на день в любом графике или календаре.
import {
  esc, icon, openSheet, arcSvg, fmtLong, pts, toast, busy, todayYmd, addDays,
} from './ui.js';
import * as store from './store.js';
import * as ai from './ai.js';
import { openShare } from './share.js';
import { themeFromSettings } from './themes.js';
import { heroPhoto } from './header.js';
import { kvGet, kvSet } from './db.js';
import { mountPhotoStrip, dayPhotos } from './photos.js';
import { blobUrl } from './ui.js';

const MOOD = ['', 'так себе', 'ниже среднего', 'нормально', 'хорошо', 'отлично'];

export function headline(pct) {
  if (pct >= 120) return 'Сильный день';
  if (pct >= 100) return 'Планка взята';
  if (pct >= 70) return 'Хороший день';
  return 'Спокойный день';
}

function analysisHtml(a) {
  const list = (title, items) => (items && items.length ? `<div class="stack" style="--gap:4px"><span class="label">${title}</span><ul class="small ai-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
  return `<div class="row" style="--gap:8px"><span style="color:var(--accent)">${icon('spark', 18)}</span><b class="small">Разбор от ИИ</b></div>
    ${list('Получилось', a.good)}
    ${list('Можно лучше', a.improve)}
    ${a.tomorrow ? `<p class="small m0"><b>На завтра:</b> ${esc(a.tomorrow)}</p>` : ''}`;
}

export async function openDaySheet(date, { onChange } = {}) {
  let changed = false;
  const onPhotos = () => { changed = true; };
  const onClose = () => { if (changed && onChange) onChange(); };
  const s = await store.getSettings();
  const day = await store.getDay(date);
  const plan = await store.todosFor(date);
  const planDone = plan.filter((t) => t.done).length;
  const today = todayYmd();

  const photoSection = `<section class="stack" style="--gap:8px" aria-label="Фото дня"><span class="label">Фото дня</span><div data-photos-host></div></section>`;

  if (!day || !day.closed) {
    const future = date > today;
    const osh = openSheet(`
      <div class="stack">
        <p class="eyebrow">${fmtLong(date)}</p>
        <h2 class="h2">${future ? 'Этот день впереди' : 'День не закрыт'}</h2>
        ${plan.length ? `<p class="small muted m0">В плане: ${plan.length}, выполнено ${planDone}.</p>` : ''}
        ${future ? '' : photoSection}
        <div class="stack" style="--gap:10px">
          ${!future ? `<a class="btn btn--accent btn--block" href="#/ritual/${date}" data-close>Закрыть день</a>` : ''}
          <a class="btn btn--ghost btn--block" href="#/plan/${date}" data-close>${icon('list', 18)} План на этот день</a>
        </div>
      </div>`, { label: fmtLong(date), onClose });
    const host = osh.el.querySelector('[data-photos-host]');
    if (host) mountPhotoStrip(host, date, onPhotos);
    return;
  }

  const sh = openSheet(`
    <div class="stack" style="--gap:16px">
      <div class="stack" style="--gap:6px"><p class="eyebrow">${fmtLong(date)}</p><h2 class="h2">${headline(day.pct)}</h2></div>
      <div class="row between" style="align-items:flex-end">
        <div class="stack" style="--gap:4px">
          <span class="big-num">${day.pct}%</span>
          <span class="small muted">${pts(day.total)} · норма ${day.norm}${day.mood ? ` · настроение: ${MOOD[day.mood]}` : ''}</span>
        </div>
        ${arcSvg(day.pct, 116, 10)}
      </div>
      ${day.comment ? `<p class="comment">${esc(day.comment)}</p>` : ''}
      <div>${(day.tasks || []).map((t) => `<div class="mini-task"><span>${esc(t.title)} <span class="tiny muted">· ${esc(t.area || '')}</span></span><b>+${store.taskPoints(t)}</b></div>`).join('')}</div>
      ${plan.length ? `<span class="small muted">План на день: выполнено ${planDone} из ${plan.length}</span>` : ''}
      ${photoSection}
      <section class="card p stack" style="--gap:12px" data-analysis aria-live="polite">
        ${day.analysis ? analysisHtml(day.analysis) : s.apiKey
          ? `<p class="small muted m0">ИИ разберёт день: что получилось, что можно лучше и что сделать завтра.</p><button class="btn btn--accent btn--sm" data-act="analyze">${icon('spark', 18)} Разбор дня от ИИ</button>`
          : '<p class="small muted m0">Добавь ключ ИИ в настройках — и здесь появится разбор дня.</p>'}
      </section>
      <div class="row" style="--gap:10px">
        <a class="btn btn--ghost btn--sm grow" href="#/ritual/${date}" data-close>${icon('edit', 18)} Изменить день</a>
        <button class="btn btn--ghost btn--sm" data-act="share">${icon('share', 18)} Поделиться</button>
      </div>
    </div>`, { label: fmtLong(date), onClose });

  sh.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'share') {
      const theme = themeFromSettings(s);
      const ids = await dayPhotos(date);
      openShare('day', { day, photo: (ids[0] && await blobUrl(ids[0])) || await heroPhoto(s, theme) });
    } else if (b.dataset.act === 'analyze') {
      busy(b, true, 'ИИ разбирает день…');
      try {
        const all = await store.allDays();
        const recent = all.filter((d) => d.closed && d.date < date && d.date >= addDays(date, -7));
        day.analysis = await ai.analyzeDay({ day, recent, plan });
        await store.putDay(day);
        sh.el.querySelector('[data-analysis]').innerHTML = analysisHtml(day.analysis);
      } catch (err) {
        busy(b, false);
        toast(ai.aiErrorText(err), 'err');
      }
    }
  });
  mountPhotoStrip(sh.el.querySelector('[data-photos-host]'), date, (ids) => {
    day.photos = ids;
    onPhotos();
  });
}

// Разбор недели: кэшируется по понедельнику, чтобы не тратить лимит повторно.
export async function openWeekSheet(monday) {
  const s = await store.getSettings();
  const all = await store.allDays();
  const sunday = addDays(monday, 6);
  const days = all.filter((d) => d.closed && d.date >= monday && d.date <= sunday);
  const todos = (await store.allTodos()).filter((t) => t.date >= monday && t.date <= sunday);
  const key = `weekAnalysis:${monday}`;
  const cached = await kvGet(key);
  const avg = days.length ? Math.round(days.reduce((a, d) => a + d.pct, 0) / days.length) : 0;
  const render = (a) => `
    <div class="row" style="--gap:8px"><span style="color:var(--accent)">${icon('spark', 18)}</span><b class="small">Разбор недели</b></div>
    ${a.summary ? `<p class="small m0">${esc(a.summary)}</p>` : ''}
    ${a.best ? `<p class="small m0"><b>Лучше всего:</b> ${esc(a.best)}</p>` : ''}
    ${a.pattern ? `<p class="small m0"><b>Закономерность:</b> ${esc(a.pattern)}</p>` : ''}
    ${a.advice ? `<p class="small m0"><b>Совет:</b> ${esc(a.advice)}</p>` : ''}`;
  const fresh = cached && cached.closed === days.length;
  const sh = openSheet(`
    <div class="stack" style="--gap:14px">
      <p class="eyebrow">${fmtLong(monday)} — ${fmtLong(sunday).split(', ')[1]}</p>
      <h2 class="h2">Неделя: ${days.length ? `в среднем ${avg}%` : 'пока без закрытых дней'}</h2>
      <section class="card p stack" style="--gap:10px" data-week aria-live="polite">
        ${fresh ? render(cached) : days.length < 2
          ? '<p class="small muted m0">Для разбора нужно хотя бы два закрытых дня на этой неделе.</p>'
          : s.apiKey ? `<button class="btn btn--accent btn--sm" data-act="week">${icon('spark', 18)} Разобрать неделю</button>` : '<p class="small muted m0">Добавь ключ ИИ в настройках — и здесь появится разбор недели.</p>'}
      </section>
    </div>`, { label: 'Разбор недели' });
  sh.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act="week"]');
    if (!b) return;
    busy(b, true, 'ИИ смотрит на неделю…');
    try {
      const a = await ai.analyzeWeek({ days, planDone: todos.filter((t) => t.done).length, planTotal: todos.length });
      await kvSet(key, { ...a, closed: days.length });
      sh.el.querySelector('[data-week]').innerHTML = render(a);
    } catch (err) {
      busy(b, false);
      toast(ai.aiErrorText(err), 'err');
    }
  });
}
