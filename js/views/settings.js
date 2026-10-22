import {
  esc, icon, on, toast, busy, confirmSheet, promptSheet, compressImage, pickFiles, blobUrl, debounce, autosize, todayYmd,
} from '../ui.js';
import * as store from '../store.js';
import * as ai from '../ai.js';
import { THEMES, PHOTO_CREDITS, applyTheme, themeFromSettings, paletteFromImage } from '../themes.js';

export const tab = null;

export default async function settings(el) {
  let s = await store.getSettings();
  const saveText = debounce((patch) => store.saveSettings(patch), 400);
  let keyStatus = '';

  async function render() {
    s = await store.getSettings();
    const customUrl = s.customTheme && s.customTheme.blobId ? await blobUrl(s.customTheme.blobId) : '';
    const tiles = Object.values(THEMES).map((t) => `<button class="theme-tile" data-act="theme" data-v="${t.id}" aria-pressed="${s.themeId === t.id}" aria-label="Тема «${t.name}»"><img src="${t.photo}" alt="" style="object-position:${t.pos}"><i style="background:${t.accent}"></i><span>${t.name}</span></button>`).join('');
    const custom = customUrl
      ? `<button class="theme-tile" data-act="theme" data-v="custom" aria-pressed="${s.themeId === 'custom'}" aria-label="Своя тема"><img src="${customUrl}" alt=""><i style="background:${s.customTheme.accent}"></i><span>Своё фото</span></button>`
      : '';
    el.innerHTML = `
      <header class="topbar pad">
        <a class="icon-btn" href="#/today" aria-label="Назад">${icon('back')}</a>
        <span class="small muted">Настройки</span>
        <span style="width:44px" aria-hidden="true"></span>
      </header>
      <div class="pad stack" style="--gap:34px;padding-top:10px">
        <section class="stack" style="--gap:14px" aria-labelledby="st-profile">
          <h1 class="h1" id="st-profile">Профиль</h1>
          <p class="small muted m0">По нему ИИ понимает, что для тебя сложно, а что разминка.</p>
          <div class="field"><label class="label" for="st-name">Имя</label><input class="input" id="st-name" data-f="name" value="${esc(s.name)}"></div>
          <div class="field"><label class="label" for="st-about">Кто ты и чем занимаешься</label><input class="input" id="st-about" data-f="about" value="${esc(s.about)}" placeholder="Например: студентка-дизайнер, 2 курс"></div>
          <div class="field"><label class="label" for="st-goals">Цели</label><textarea class="textarea" id="st-goals" data-f="goals" rows="3">${esc(s.goals)}</textarea></div>
          <div class="field"><span class="label">Направления</span>
            <div class="chips">${(s.areas || []).map((a) => `<button class="toggle" aria-pressed="true" data-act="area-del" data-v="${esc(a)}" aria-label="Убрать направление «${esc(a)}»">${esc(a)} ${icon('close', 14, 2.2)}</button>`).join('')}
              <button class="toggle toggle--add" data-act="area-add">${icon('plus', 16)} Добавить</button></div>
          </div>
        </section>

        <section class="stack" style="--gap:14px" aria-labelledby="st-theme">
          <h2 class="h2" id="st-theme">Тема</h2>
          <p class="small muted m0">Своё фото: приложение вытащит из него цвета и перекрасится. Сменить только шапку можно кнопкой с картинкой на главном экране.</p>
          <div class="themes">${tiles}${custom}
            <button class="theme-tile theme-tile--add" data-act="custom">${icon('image', 22)}<span>${customUrl ? 'Другое фото' : 'Своё фото'}</span></button>
          </div>
        </section>

        <section class="stack" style="--gap:14px" aria-labelledby="st-ai">
          <h2 class="h2" id="st-ai">ИИ</h2>
          <div class="field"><label class="label" for="st-key">Ключ OpenRouter</label>
            <div class="erow"><input class="input" id="st-key" type="password" value="${esc(s.apiKey)}" autocomplete="off" spellcheck="false" placeholder="sk-or-v1-…">
            <button class="icon-sm" data-act="show-key" aria-label="Показать ключ">${icon('eye', 20)}</button></div></div>
          ${keyStatus ? `<div class="okline">${keyStatus}</div>` : ''}
          <div class="row wrap" style="--gap:10px">
            <button class="btn btn--accent btn--sm" data-act="check-key">${icon('key', 18)} Проверить и сохранить</button>
            <a class="btn btn--ghost btn--sm" href="https://openrouter.ai/keys" target="_blank" rel="noopener">${icon('external', 18)} Получить ключ</a>
          </div>
          <div class="card p stack" style="--gap:8px">
            <span class="small"><b>Модель:</b> <span data-model>${s.modelOverride ? esc(s.modelOverride) : 'подбирается автоматически'}</span></span>
            <span class="tiny muted">Берём лучшую бесплатную модель из списка — у всех одна и та же, поэтому шкала оценок общая.</span>
            ${s.apiKey ? `<button class="btn btn--ghost btn--sm" data-act="model-refresh">${icon('refresh', 18)} Обновить выбор</button>` : ''}
          </div>
          <div class="field"><label class="label" for="st-model">Своя модель — для тех, у кого есть баланс</label>
            <input class="input" id="st-model" data-f="modelOverride" value="${esc(s.modelOverride)}" placeholder="Например: deepseek/deepseek-v4-flash" spellcheck="false"></div>
        </section>

        <section class="stack" style="--gap:12px" aria-labelledby="st-data">
          <h2 class="h2" id="st-data">Данные</h2>
          <p class="small muted m0">Всё хранится только на этом телефоне. Если очистить данные браузера или удалить приложение — записи пропадут, поэтому иногда сохраняй копию.</p>
          <button class="btn btn--ghost btn--block" data-act="export">${icon('download', 18)} Сохранить копию данных</button>
          <button class="btn btn--ghost btn--block" data-act="import">${icon('upload', 18)} Восстановить из копии</button>
          <button class="btn btn--ghost btn--block" data-act="wipe">${icon('trash', 18)} Удалить все данные</button>
        </section>

        <p class="tiny muted m0" style="text-align:center">Планка · версия 1.1 · ${PHOTO_CREDITS}</p>
      </div>`;
    el.querySelectorAll('textarea').forEach(autosize);
    if (s.apiKey && !s.modelOverride) {
      ai.currentModel().then((id) => {
        const span = el.querySelector('[data-model]');
        if (span && id) span.textContent = id;
      });
    }
  }

  el.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    s[f] = e.target.value;
    saveText({ [f]: e.target.value.trim() });
  });

  on(el, 'click', '[data-act]', async (e, b) => {
    const act = b.dataset.act;
    if (act === 'theme') {
      const cur = await store.getSettings();
      if (cur.header && cur.header.blobId) await store.deleteBlob(cur.header.blobId);
      await store.saveSettings({ themeId: b.dataset.v, header: null });
      applyTheme(themeFromSettings(await store.getSettings()));
      await render();
    } else if (act === 'custom') {
      const [f] = await pickFiles();
      if (!f) return;
      toast('Подбираю цвета под фото…');
      const blob = await compressImage(f, 2000, 0.86);
      const pal = await paletteFromImage(blob);
      const blobId = await store.saveBlob(blob);
      if (s.customTheme && s.customTheme.blobId) await store.deleteBlob(s.customTheme.blobId);
      const cur = await store.getSettings();
      if (cur.header && cur.header.blobId) await store.deleteBlob(cur.header.blobId);
      await store.saveSettings({ customTheme: { ...pal, blobId }, header: null, baseThemeId: cur.themeId !== 'custom' ? cur.themeId : cur.baseThemeId, themeId: 'custom' });
      applyTheme(themeFromSettings(await store.getSettings()));
      await render();
      toast('Готово — тема из твоего фото');
    } else if (act === 'area-del') {
      if ((s.areas || []).length <= 1) {
        toast('Нужно хотя бы одно направление');
        return;
      }
      await store.saveSettings({ areas: s.areas.filter((a) => a !== b.dataset.v) });
      await render();
    } else if (act === 'area-add') {
      const v = await promptSheet({ title: 'Новое направление', placeholder: 'Например: Дизайн', ok: 'Добавить' });
      if (v && !(s.areas || []).includes(v)) {
        await store.saveSettings({ areas: [...(s.areas || []), v.slice(0, 24)] });
        await render();
      }
    } else if (act === 'show-key') {
      const input = el.querySelector('#st-key');
      input.type = input.type === 'password' ? 'text' : 'password';
    } else if (act === 'check-key') {
      const key = el.querySelector('#st-key').value.trim();
      if (!key) {
        await store.saveSettings({ apiKey: '' });
        keyStatus = '';
        toast('Ключ удалён');
        await render();
        return;
      }
      busy(b, true, 'Проверяю…');
      try {
        await ai.checkKey(key);
        await store.saveSettings({ apiKey: key });
        await ai.refreshModel();
        keyStatus = `${icon('check', 18, 2.4)} Ключ работает и сохранён`;
        await render();
      } catch (err) {
        busy(b, false);
        toast(ai.aiErrorText(err), 'err');
      }
    } else if (act === 'model-refresh') {
      busy(b, true, 'Ищу…');
      const id = await ai.refreshModel();
      busy(b, false);
      const span = el.querySelector('[data-model]');
      if (span) span.textContent = id || 'не нашлось — попробуй позже';
    } else if (act === 'export') {
      busy(b, true, 'Собираю…');
      try {
        const data = await store.exportAll();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const name = `planka-${todayYmd()}.json`;
        const file = new File([blob], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Копия Планки' }).catch(() => {});
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          a.click();
        }
        toast('Копия готова. Ключ в неё не попадает.');
      } finally {
        busy(b, false);
      }
    } else if (act === 'import') {
      const [f] = await pickFiles({ accept: '.json,application/json' });
      if (!f) return;
      let data;
      try {
        data = JSON.parse(await f.text());
      } catch {
        toast('Это не похоже на копию Планки', 'err');
        return;
      }
      const ok = await confirmSheet({ title: 'Восстановить из копии?', text: 'Текущие записи на этом телефоне заменятся данными из файла.', ok: 'Восстановить', danger: true });
      if (!ok) return;
      try {
        await store.importAll(data);
        applyTheme(themeFromSettings(await store.getSettings()));
        toast('Данные восстановлены');
        location.hash = '#/today';
      } catch {
        toast('Это не похоже на копию Планки', 'err');
      }
    } else if (act === 'wipe') {
      const ok = await confirmSheet({ title: 'Удалить все данные?', text: 'Дни, проекты, фото и настройки пропадут с этого телефона насовсем.', ok: 'Удалить всё', danger: true });
      if (!ok) return;
      await store.wipe();
      try { Object.keys(localStorage).filter((k) => k.startsWith('planka-')).forEach((k) => localStorage.removeItem(k)); } catch { /* ок */ }
      location.hash = '#/onboarding';
      location.reload();
    }
  });

  await render();
}
