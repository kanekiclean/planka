import { esc, icon, on, toast, busy, logo, autosize, promptSheet } from '../ui.js';
import * as store from '../store.js';
import { THEMES, applyTheme } from '../themes.js';
import { checkKey, aiErrorText, refreshModel } from '../ai.js';

export const tab = null;

const AREAS = ['Работа', 'Учёба', 'Наука', 'Здоровье', 'Творчество', 'Дом', 'Спорт', 'Хобби'];
const TOTAL = 5;

export default async function onboarding(el) {
  const s = await store.getSettings();
  const st = {
    step: 0,
    name: s.name || '',
    about: s.about || '',
    goals: s.goals || '',
    areas: s.areas && s.areas.length ? [...s.areas] : ['Работа', 'Учёба', 'Здоровье'],
    extra: [],
    key: s.apiKey || '',
    keyOk: !!s.apiKey,
    themeId: s.themeId && s.themeId !== 'custom' ? s.themeId : 'evening',
  };

  const body = () => {
    switch (st.step) {
      case 0:
        return `
          <h1 class="h1">Привет!</h1>
          <p class="m0" style="font-size:17px;line-height:1.55">Планка — тихий вечерний дневник. Перед сном пишешь пару строк о том, что успел, а ИИ оценивает день относительно тебя, а не среднего человека.</p>
          <p class="small muted m0">Записи хранятся только на этом телефоне.</p>
          <button class="btn btn--light btn--block" data-act="next">Начать</button>`;
      case 1:
        return `
          <h1 class="h1">Давай знакомиться</h1>
          <div class="field"><label class="label" for="ob-name">Как тебя зовут</label>
            <input class="input" id="ob-name" data-f="name" value="${esc(st.name)}" autocomplete="given-name" placeholder="Имя"></div>
          <div class="field"><label class="label" for="ob-about">Кто ты и чем занимаешься</label>
            <input class="input" id="ob-about" data-f="about" value="${esc(st.about)}" placeholder="Например: студент 4 курса, стажёр по ИИ"></div>
          <div class="field"><label class="label" for="ob-goals">Цели на ближайший год</label>
            <textarea class="textarea" id="ob-goals" data-f="goals" rows="3" placeholder="Например: защитить диплом, выпустить две статьи">${esc(st.goals)}</textarea></div>
          <p class="tiny muted m0">От этого зависит, как ИИ оценивает задачи: для одного домашка — подвиг, для другого — разминка.</p>
          <button class="btn btn--light btn--block" data-act="next">Дальше</button>`;
      case 2: {
        const all = [...new Set([...AREAS, ...st.areas, ...st.extra])];
        return `
          <h1 class="h1">Чем живёшь?</h1>
          <p class="small muted m0">Выбери направления — по ним ИИ раскладывает задачи. Потом можно поменять.</p>
          <div class="chips">
            ${all.map((a) => `<button class="toggle" data-act="area" data-v="${esc(a)}" aria-pressed="${st.areas.includes(a)}">${st.areas.includes(a) ? icon('check', 16, 2.4) : ''}${esc(a)}</button>`).join('')}
            <button class="toggle toggle--add" data-act="area-add">${icon('plus', 16)} Своё</button>
          </div>
          <button class="btn btn--light btn--block" data-act="next">Дальше</button>`;
      }
      case 3:
        return `
          <h1 class="h1">Ключ для ИИ</h1>
          <p class="small muted m0">ИИ работает через OpenRouter — там есть бесплатные модели. Ключ бесплатный и хранится только на этом телефоне.</p>
          <ol class="steps">
            <li>Открой openrouter.ai и войди через Google или почту.</li>
            <li>В разделе Keys нажми «Create Key».</li>
            <li>Скопируй ключ (начинается с sk-or-) и вставь сюда.</li>
          </ol>
          <a class="btn btn--ghost btn--block" href="https://openrouter.ai/keys" target="_blank" rel="noopener">${icon('external', 18)} Получить ключ</a>
          <div class="field"><label class="label" for="ob-key">Ключ OpenRouter</label>
            <input class="input" id="ob-key" data-f="key" type="password" value="${esc(st.key)}" autocomplete="off" spellcheck="false" placeholder="sk-or-v1-…"></div>
          ${st.keyOk ? `<div class="okline">${icon('check', 18, 2.4)} Ключ работает</div>` : ''}
          <button class="btn btn--light btn--block" data-act="check">Проверить и дальше</button>
          <button class="btn btn--ghost btn--block" data-act="skip">Пропустить — оценю дни сам</button>`;
      default:
        return `
          <h1 class="h1">Выбери настроение</h1>
          <p class="small muted m0">Тема меняет фото в шапке и цвета. Потом можно поставить своё фото.</p>
          <div class="themes">
            ${Object.values(THEMES).map((t) => `<button class="theme-tile" data-act="theme" data-v="${t.id}" aria-pressed="${st.themeId === t.id}" aria-label="Тема «${t.name}»"><img src="${t.photo}" alt="" style="object-position:${t.pos}"><i style="background:${t.accent}"></i><span>${t.name}</span></button>`).join('')}
          </div>
          <button class="btn btn--light btn--block" data-act="finish">Готово, поехали</button>`;
    }
  };

  function render() {
    el.innerHTML = `
      <div class="onb">
        <div class="onb__bg"><img src="img/onboarding.webp" alt=""></div>
        <div class="onb__inner">
          <div class="row between">${logo()}${st.step > 0 ? `<button class="btn btn--ghost btn--sm" data-act="back">${icon('back', 18)} Назад</button>` : '<span></span>'}</div>
          <div class="onb__dots" aria-hidden="true">${Array.from({ length: TOTAL }, (_, i) => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('')}</div>
          <div class="onb__body">${body()}</div>
        </div>
      </div>`;
    el.querySelectorAll('textarea').forEach(autosize);
  }

  el.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (f) {
      st[f] = e.target.value;
      if (f === 'key') st.keyOk = false;
    }
  });

  on(el, 'click', '[data-act]', async (e, b) => {
    const act = b.dataset.act;
    if (act === 'back') {
      st.step = Math.max(0, st.step - 1);
      render();
    } else if (act === 'next') {
      if (st.step === 1 && !st.name.trim()) {
        toast('Как к тебе обращаться?');
        el.querySelector('#ob-name').focus();
        return;
      }
      if (st.step === 2 && !st.areas.length) {
        toast('Выбери хотя бы одно направление');
        return;
      }
      st.step += 1;
      render();
    } else if (act === 'area') {
      const v = b.dataset.v;
      st.areas = st.areas.includes(v) ? st.areas.filter((a) => a !== v) : [...st.areas, v];
      render();
    } else if (act === 'area-add') {
      const v = await promptSheet({ title: 'Своё направление', placeholder: 'Например: Дизайн', ok: 'Добавить' });
      if (v) {
        const name = v.slice(0, 24);
        st.extra.push(name);
        if (!st.areas.includes(name)) st.areas.push(name);
        render();
      }
    } else if (act === 'check') {
      const key = st.key.trim();
      if (!key) {
        toast('Вставь ключ или пропусти этот шаг');
        return;
      }
      busy(b, true, 'Проверяю…');
      try {
        await checkKey(key);
        st.key = key;
        st.keyOk = true;
        await store.saveSettings({ apiKey: key });
        st.step += 1;
        render();
      } catch (err) {
        busy(b, false);
        toast(aiErrorText(err), 'err');
      }
    } else if (act === 'skip') {
      st.step += 1;
      render();
    } else if (act === 'theme') {
      st.themeId = b.dataset.v;
      applyTheme(THEMES[st.themeId]);
      render();
    } else if (act === 'finish') {
      await store.saveSettings({
        name: st.name.trim(), about: st.about.trim(), goals: st.goals.trim(), areas: st.areas,
        apiKey: st.keyOk ? st.key.trim() : (st.key.trim() || ''), themeId: st.themeId, onboarded: true,
      });
      if (st.key.trim()) refreshModel();
      toast(`Готово, ${st.name.trim()}!`);
      location.hash = '#/today';
    }
  });

  render();
}
