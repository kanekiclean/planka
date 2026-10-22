import {
  esc, icon, on, MONTHS, MONTHS_GEN, WD_SHORT, todayYmd, fmtShort, pts, daysWord, parseYmd,
} from '../ui.js';
import * as store from '../store.js';
import { monthScene } from '../covers.js';
import { openShare } from '../share.js';
import { openDaySheet } from '../daysheet.js';

export const tab = 'archive';

export default async function month(el, [key]) {
  const [y, m] = key.split('-').map(Number);
  const mi = m - 1;
  const days = (await store.allDays()).filter((d) => d.closed && d.date.startsWith(key));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = todayYmd();
  const lead = (new Date(y, mi, 1).getDay() + 6) % 7;
  const dim = new Date(y, m, 0).getDate();

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({ state: 'blank' });
  for (let d = 1; d <= dim; d++) {
    const ds = `${key}-${String(d).padStart(2, '0')}`;
    const day = byDate.get(ds);
    let state = 'empty';
    if (ds > today) state = 'future';
    else if (day) state = day.pct >= 100 ? 'full' : day.pct >= 60 ? 'part' : 'low';
    cells.push({ state, ds, day, isToday: ds === today });
  }

  const closed = days.length;
  const avg = closed ? Math.round(days.reduce((a, d) => a + d.pct, 0) / closed) : 0;
  const bestDay = days.reduce((b, d) => (!b || d.pct > b.pct ? d : b), null);
  const totalPts = days.reduce((a, d) => a + (d.total || 0), 0);
  let run = 0;
  let bestRun = 0;
  for (const c of cells) {
    if (c.state === 'blank') continue;
    if (c.day) {
      run += 1;
      bestRun = Math.max(bestRun, run);
    } else run = 0;
  }
  const byArea = {};
  for (const d of days) for (const t of d.tasks || []) byArea[t.area || 'Другое'] = (byArea[t.area || 'Другое'] || 0) + store.taskPoints(t);
  const areaList = Object.entries(byArea).sort((a, b) => b[1] - a[1]);
  const areaMax = areaList.length ? areaList[0][1] : 1;
  const areaSum = areaList.reduce((a, [, v]) => a + v, 0) || 1;

  const label = { full: 'в норме', part: 'частично', low: 'спокойный день', empty: 'не закрыт', future: 'впереди' };
  const pills = cells.map((c) => {
    if (c.state === 'blank') return '<span class="pill pill--blank" aria-hidden="true"></span>';
    const d = Number(c.ds.slice(8));
    const cls = `pill pill--${c.state}${c.isToday ? ' pill--today' : ''}`;
    const title = `${d} ${MONTHS_GEN[mi]}: ${c.day ? `${c.day.pct}%` : label[c.state]}`;
    return `<button class="${cls}" data-day="${c.ds}" aria-label="${title}" title="${title}"></button>`;
  }).join('');

  const list = [...days].reverse();

  el.innerHTML = `
    <div class="hero" style="--hero-h:330px;--overlap:90px">
      <div class="hero__svg">${monthScene(mi)}</div>
      <div class="hero__top">
        <a class="icon-btn" href="#/archive" aria-label="К архиву">${icon('back')}</a>
        ${closed ? `<button class="icon-btn" data-act="share" aria-label="Поделиться итогами месяца">${icon('share')}</button>` : '<span></span>'}
      </div>
      <div class="hero__content" style="top:auto;bottom:100px">
        <p class="eyebrow">${y}</p>
        <h1 class="h1 hero__title" style="font-size:52px">${MONTHS[mi]}</h1>
      </div>
    </div>
    <div class="pad stack over" style="--gap:26px">
      <div class="stats4">
        <div class="stat"><span class="tiny muted">Закрыто</span><b>${daysWord(closed)}</b></div>
        <div class="stat"><span class="tiny muted">Средний день</span><b>${closed ? `${avg}%` : '—'}</b></div>
        <div class="stat"><span class="tiny muted">Лучший день</span><b>${bestDay ? `${bestDay.pct}%` : '—'}</b>${bestDay ? `<span class="tiny muted">${fmtShort(bestDay.date)}</span>` : ''}</div>
        <div class="stat"><span class="tiny muted">Серия подряд</span><b>${bestRun ? daysWord(bestRun) : '—'}</b></div>
      </div>

      <section class="card p-lg stack" style="--gap:14px" aria-label="Календарь месяца">
        <div class="row between"><h2 class="h3">Календарь</h2><span class="small muted">${pts(totalPts)}</span></div>
        <div class="pills-head" aria-hidden="true">${WD_SHORT.map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="pills">${pills}</div>
        <div class="legend">
          <span><i style="background:var(--accent)"></i>в норме</span>
          <span><i style="background:rgb(var(--accent-rgb) / .42)"></i>от 60%</span>
          <span><i style="background:rgb(var(--text-rgb) / .18)"></i>спокойный</span>
          <span><i style="border:1px solid var(--line-strong)"></i>не закрыт</span>
        </div>
      </section>

      ${areaList.length ? `<section class="stack" style="--gap:14px" aria-label="Куда ушли очки">
        <h2 class="eyebrow">Куда ушли очки</h2>
        <div class="hbars">${areaList.map(([a, v]) => `<div class="hbar"><span>${esc(a)}</span><div class="bar bar--theme"><i style="width:${Math.round((v / areaMax) * 100)}%"></i></div><b>${Math.round((v / areaSum) * 100)}%</b></div>`).join('')}</div>
      </section>` : ''}

      ${list.length ? `<section class="stack" style="--gap:6px" aria-label="Дни месяца">
        <h2 class="eyebrow">Дни</h2>
        <ul class="daylist">${list.map((d) => `<li><button data-day="${d.date}"><span class="d">${fmtShort(d.date)}</span><span class="grow small">${esc((d.tasks || []).slice(0, 2).map((t) => t.title).join(' · ') || 'без задач')}</span><span class="p">${d.pct}%</span></button></li>`).join('')}</ul>
      </section>` : `<div class="card p-lg small muted">${parseYmd(`${key}-01`) > new Date() ? 'Этот месяц ещё впереди.' : 'В этом месяце пока нет закрытых дней.'}</div>`}
    </div>`;

  on(el, 'click', '[data-day]', (e, b) => openDaySheet(b.dataset.day));
  on(el, 'click', '[data-act="share"]', () => openShare('month', {
    month: key,
    stats: {
      closed, avg, best: bestDay ? bestDay.pct : 0,
      cells: cells.map((c) => (c.state === 'blank' ? 'blank' : c.state === 'full' ? 'full' : c.state === 'part' || c.state === 'low' ? 'part' : 'empty')),
    },
  }));
}
