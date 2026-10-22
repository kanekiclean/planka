import { icon, MONTHS, todayYmd, daysWord } from '../ui.js';
import * as store from '../store.js';
import { monthScene } from '../covers.js';

export const tab = 'archive';

export default async function archive(el) {
  const days = (await store.allDays()).filter((d) => d.closed);
  const now = todayYmd().slice(0, 7);
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
  const avgAll = days.length ? Math.round(days.reduce((a, d) => a + d.pct, 0) / days.length) : null;

  let lastYear = null;
  const cards = months.map((key) => {
    const list = byMonth[key] || [];
    const avg = list.length ? Math.round(list.reduce((a, d) => a + d.pct, 0) / list.length) : null;
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

  el.innerHTML = `
    <header class="pad stack" style="--gap:10px;padding-top:calc(22px + var(--safe-t))">
      <div class="row between"><p class="eyebrow">Архив · ${now.slice(0, 4)}</p><a class="icon-btn" href="#/settings" aria-label="Настройки">${icon('gear')}</a></div>
      <h1 class="h1">Твои месяцы</h1>
      <p class="small muted m0">${days.length ? `Закрыто ${daysWord(days.length)}, в среднем ${avgAll}% от нормы.` : 'Здесь будут собираться твои месяцы. Закрой первый день — и начнётся история.'}</p>
    </header>
    <div class="pad months" style="margin-top:22px">${cards}</div>`;
}
