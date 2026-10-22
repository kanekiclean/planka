import {
  icon, on, MONTHS, MONTHS_GEN, WEEKDAYS, WD_SHORT, todayYmd, addDays, parseYmd, fmtShort, fmtLong, daysWord, plural,
} from '../ui.js';
import * as store from '../store.js';
import { monthScene } from '../covers.js';
import { openDaySheet, openWeekSheet } from '../daysheet.js';

export const tab = 'archive';

const avgOf = (arr) => (arr.length ? Math.round(arr.reduce((a, x) => a + x, 0) / arr.length) : null);

function lineChart(points) {
  const W = 340;
  const top = 12;
  const bottom = 132;
  const cap = Math.max(150, Math.min(200, Math.max(...points.map((p) => p.pct || 0))));
  const x = (i) => 8 + (i * (W - 16)) / (points.length - 1);
  const y = (p) => bottom - (Math.min(p, cap) / cap) * (bottom - top);
  const segs = [];
  let cur = [];
  points.forEach((p, i) => {
    if (p.pct == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push([x(i), y(p.pct)]);
  });
  if (cur.length) segs.push(cur);
  const line = segs.map((s) => `M ${s.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L ')}`).join(' ');
  const area = segs.filter((s) => s.length > 1).map((s) => `M ${s[0][0].toFixed(1)} ${bottom} L ${s.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L ')} L ${s[s.length - 1][0].toFixed(1)} ${bottom} Z`).join(' ');
  const dots = points.map((p, i) => (p.pct == null ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="${p.isToday ? 5 : 3.5}" style="fill:${p.pct >= 100 ? 'var(--accent)' : 'var(--surface)'};stroke:var(--accent)" stroke-width="2"/>`)).join('');
  const ny = y(100).toFixed(1);
  return `<div class="chart">
    <svg viewBox="0 0 ${W} 144" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
      <line x1="0" x2="${W}" y1="${ny}" y2="${ny}" style="stroke:rgb(var(--text-rgb) / .35)" stroke-dasharray="4 4" stroke-width="1.2"/>
      ${area ? `<path d="${area}" fill="url(#lc-fill)"/>` : ''}
      <path d="${line}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>
    <div class="chart__hits">${points.map((p) => `<button data-day="${p.ds}" aria-label="${fmtLong(p.ds)}${p.pct == null ? ': не закрыт' : `: ${p.pct}%`}"></button>`).join('')}</div>
  </div>`;
}

function barsCard(title, rows, note) {
  const max = Math.max(...rows.map((r) => r.v || 0), 100);
  return `<section class="card p stack" style="--gap:12px">
    <h3 class="label m0">${title}</h3>
    <div class="vbars" style="grid-template-columns:repeat(${rows.length}, minmax(0, 1fr))">${rows.map((r) => `<div class="vbars__col">
      <span class="vbars__v">${r.v == null ? '' : `${r.v}%`}</span>
      <span class="vbars__track"><span class="vbars__bar${r.best ? ' is-best' : ''}" style="height:${r.v == null ? 4 : Math.max(6, Math.round((r.v / max) * 70))}px"></span></span>
      <span class="vbars__l">${r.label}</span>
    </div>`).join('')}</div>
    ${note ? `<p class="tiny muted m0">${note}</p>` : ''}
  </section>`;
}

export default async function archive(el) {
  const all = await store.allDays();
  const days = all.filter((d) => d.closed);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = todayYmd();
  const now = today.slice(0, 7);

  // ——— Месяцы ———
  const first = days.length ? days[0].date.slice(0, 7) : now;
  const months = [];
  let [y, m] = now.split('-').map(Number);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    months.push(key);
    if (key <= first || months.length >= 60) break;
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const byMonth = {};
  for (const d of days) (byMonth[d.date.slice(0, 7)] ||= []).push(d);
  let lastYear = null;
  const cards = months.map((key) => {
    const list = byMonth[key] || [];
    const avg = avgOf(list.map((d) => d.pct));
    const yr = key.slice(0, 4);
    const sep = yr !== lastYear && lastYear !== null ? `<h2 class="eyebrow" style="margin-top:14px">${yr}</h2>` : '';
    lastYear = yr;
    const mi = Number(key.slice(5, 7)) - 1;
    return `${sep}<a class="month" href="#/month/${key}" aria-label="${MONTHS[mi]} ${yr}">
      ${monthScene(mi)}
      <span class="month__badge">${list.length ? `${daysWord(list.length)} · ${avg}%` : key === now ? 'месяц только начался' : 'пусто'}</span>
      <span class="month__name">${MONTHS[mi]}</span>
    </a>`;
  }).join('');

  // ——— Динамика ———
  let insights = '';
  if (days.length) {
    const points = Array.from({ length: 30 }, (_, i) => {
      const ds = addDays(today, i - 29);
      const d = byDate.get(ds);
      return { ds, pct: d ? d.pct : null, isToday: ds === today };
    });
    const last7 = points.slice(-7).filter((p) => p.pct != null).map((p) => p.pct);
    const prev7 = points.slice(-14, -7).filter((p) => p.pct != null).map((p) => p.pct);
    const a7 = avgOf(last7);
    const p7 = avgOf(prev7);
    const trend = a7 != null && p7 != null ? a7 - p7 : null;
    const closed30 = points.filter((p) => p.pct != null);

    const wd = Array.from({ length: 7 }, () => []);
    for (const d of days) wd[(parseYmd(d.date).getDay() + 6) % 7].push(d.pct);
    const wdAvg = wd.map(avgOf);
    const bestWd = wdAvg.reduce((b, v, i) => (v != null && (b === -1 || v > wdAvg[b]) ? i : b), -1);
    const wdNote = bestWd >= 0 && wd.filter((x) => x.length).length >= 3
      ? `Твой самый сильный день — ${WEEKDAYS[(bestWd + 1) % 7].toLowerCase()}, в среднем ${wdAvg[bestWd]}%.`
      : 'Закрой ещё несколько дней — проявится твой ритм недели.';

    const md = Array.from({ length: 5 }, () => []);
    for (const d of days) if (d.mood) md[d.mood - 1].push(d.pct);
    const mdAvg = md.map(avgOf);
    const moodLevels = mdAvg.filter((v) => v != null).length;
    const hi = avgOf([...md[3], ...md[4]]);
    const lo = avgOf([...md[0], ...md[1]]);
    const moodNote = hi != null && lo != null
      ? `С хорошим настроением ты выдаёшь в среднем ${hi}%, с плохим — ${lo}%.`
      : moodLevels >= 2 ? 'Отмечай настроение вечером — станет видно, как оно связано с результатом.' : '';

    const todos = (await store.allTodos()).filter((t) => t.date <= today && t.date >= addDays(today, -29));
    const tDone = todos.filter((t) => t.done).length;
    const tPct = todos.length ? Math.round((tDone / todos.length) * 100) : null;

    const weeks = 26;
    const thisMonday = addDays(today, -((parseYmd(today).getDay() + 6) % 7));
    const start = addDays(thisMonday, -(weeks - 1) * 7);
    const heat = Array.from({ length: weeks * 7 }, (_, i) => {
      const ds = addDays(start, i);
      const d = byDate.get(ds);
      let st = 'empty';
      if (ds > today) st = 'future';
      else if (d) st = d.pct >= 100 ? 'full' : d.pct >= 60 ? 'part' : 'low';
      return `<button class="heat__c heat__c--${st}${ds === today ? ' is-today' : ''}" data-day="${ds}" aria-label="${fmtLong(ds)}${d ? `: ${d.pct}%` : ''}"${st === 'future' ? ' disabled' : ''}></button>`;
    }).join('');
    const sm = parseYmd(start);

    insights = `
      <section class="stack" style="--gap:12px;margin-top:26px" aria-label="Динамика">
        <div class="row between"><h2 class="eyebrow">Динамика</h2><button class="link small" data-act="week" style="background:none;border:0;padding:0">${icon('spark', 14)} Разбор недели</button></div>
        <section class="card p stack" style="--gap:10px">
          <div class="row between" style="align-items:baseline">
            <h3 class="label m0">30 дней</h3>
            <span class="small">${a7 != null ? `неделя: <b>${a7}%</b>` : ''}${trend != null ? ` <span class="trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)}%</span>` : ''}</span>
          </div>
          ${lineChart(points)}
          <div class="row between tiny muted"><span>${fmtShort(points[0].ds)}</span><span>Закрыто ${closed30.length} из 30 · нажми на точку</span><span>сегодня</span></div>
        </section>
        ${barsCard('Дни недели', WD_SHORT.map((l, i) => ({ label: l, v: wdAvg[i], best: i === bestWd })), wdNote)}
        ${moodLevels >= 2 ? barsCard('Настроение и результат', ['1', '2', '3', '4', '5'].map((l, i) => ({ label: l, v: mdAvg[i], best: false })), moodNote) : ''}
        ${tPct != null ? `<section class="card p stack" style="--gap:10px">
          <div class="row between"><h3 class="label m0">Ежедневник за 30 дней</h3><b>${tPct}%</b></div>
          <div class="bar bar--theme"><i style="width:${tPct}%"></i></div>
          <span class="tiny muted">Выполнено ${tDone} из ${todos.length} ${plural(todos.length, 'запланированного дела', 'запланированных дел', 'запланированных дел')}</span>
        </section>` : ''}
        <section class="card p stack" style="--gap:10px">
          <div class="row between"><h3 class="label m0">Полгода в пикселях</h3><span class="tiny muted">с ${sm.getDate()} ${MONTHS_GEN[sm.getMonth()]}</span></div>
          <div class="heat">${heat}</div>
          <div class="legend"><span><i style="background:var(--accent)"></i>в норме</span><span><i style="background:rgb(var(--accent-rgb) / .42)"></i>от 60%</span><span><i style="background:rgb(var(--text-rgb) / .2)"></i>спокойный</span></div>
        </section>
      </section>`;
  }

  const avgAll = avgOf(days.map((d) => d.pct));
  el.innerHTML = `
    <header class="pad stack" style="--gap:10px;padding-top:calc(22px + var(--safe-t))">
      <div class="row between"><p class="eyebrow">Архив · ${now.slice(0, 4)}</p><a class="icon-btn" href="#/settings" aria-label="Настройки">${icon('gear')}</a></div>
      <h1 class="h1">Твои месяцы</h1>
      <p class="small muted m0">${days.length ? `Закрыто ${daysWord(days.length)}, в среднем ${avgAll}% от нормы.` : 'Здесь будут собираться твои месяцы и графики. Закрой первый день — и начнётся история.'}</p>
    </header>
    <div class="pad">
      ${insights}
      <h2 class="eyebrow" style="margin:30px 0 12px">Месяцы</h2>
      <div class="months">${cards}</div>
    </div>`;

  on(el, 'click', '[data-day]', (e, b) => openDaySheet(b.dataset.day));
  on(el, 'click', '[data-act="week"]', () => openWeekSheet(addDays(today, -((parseYmd(today).getDay() + 6) % 7))));
}
