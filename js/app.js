import { getSettings } from './store.js';
import { applyTheme, themeFromSettings } from './themes.js';
import { $, icon, esc } from './ui.js';
import * as today from './views/today.js';
import * as ritual from './views/ritual.js';
import * as projects from './views/projects.js';
import * as project from './views/project.js';
import * as archive from './views/archive.js';
import * as month from './views/month.js';
import * as settings from './views/settings.js';
import * as onboarding from './views/onboarding.js';

const routes = [
  [/^#\/today$/, today],
  [/^#\/ritual(?:\/(\d{4}-\d{2}-\d{2}))?$/, ritual],
  [/^#\/projects(?:\/(new))?$/, projects],
  [/^#\/project\/([\w-]+)$/, project],
  [/^#\/archive$/, archive],
  [/^#\/month\/(\d{4}-\d{2})$/, month],
  [/^#\/settings$/, settings],
  [/^#\/onboarding$/, onboarding],
];

let token = 0;

export async function refreshTheme() {
  applyTheme(themeFromSettings(await getSettings()));
}

function tabbar(active) {
  const tb = $('#tabbar');
  if (!active) {
    tb.hidden = true;
    return;
  }
  tb.hidden = false;
  const tab = (id, href, ic, label) => `<a class="tab" href="${href}" aria-label="${label}"${active === id ? ' aria-current="page"' : ''}>${icon(ic)}<span class="lbl">${label}</span></a>`;
  tb.innerHTML = tab('today', '#/today', 'home', 'Сегодня')
    + tab('projects', '#/projects', 'layers', 'Проекты')
    + `<a class="tab tab--plus" href="#/ritual" aria-label="Закрыть день">${icon('plus', 22, 2.2)}</a>`
    + tab('archive', '#/archive', 'calendar', 'Архив');
}

async function route() {
  const s = await getSettings();
  const hash = location.hash || '#/today';
  if (!s.onboarded && !hash.startsWith('#/onboarding')) {
    location.replace('#/onboarding');
    return;
  }
  for (const [re, mod] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    const mine = ++token;
    const el = document.createElement('main');
    el.className = 'view';
    try {
      await mod.default(el, m.slice(1));
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="pad stack" style="padding-top:96px"><h1 class="h2">Что-то сломалось</h1><p class="muted m0">${esc(e && e.message)}</p><a class="btn btn--ghost" href="#/today">На главную</a></div>`;
    }
    if (mine !== token) return;
    $('#app').replaceChildren(el);
    window.scrollTo(0, 0);
    tabbar(mod.tab);
    return;
  }
  location.replace('#/today');
}

window.addEventListener('hashchange', route);

(async () => {
  await refreshTheme();
  await route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
