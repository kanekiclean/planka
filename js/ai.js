// Работа с ИИ через OpenRouter. Ключ хранится только на устройстве
// и уходит напрямую в OpenRouter, без промежуточных серверов.
import * as db from './db.js';
import { getSettings } from './store.js';
import { fmtLong } from './ui.js';

const BASE = 'https://openrouter.ai/api/v1';
const MODEL_TTL = 12 * 60 * 60 * 1000;

export class AIError extends Error {
  constructor(code, detail = '') {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

export function aiErrorText(e) {
  const map = {
    no_key: 'Добавь ключ OpenRouter в настройках — без него ИИ не работает.',
    bad_key: 'Ключ не подошёл. Проверь его в настройках.',
    rate_limit: 'Лимит бесплатных запросов исчерпан. Попробуй позже или оцени день без ИИ.',
    no_credits: 'Для этой модели нужен баланс на OpenRouter. Оставь выбор модели автоматическим.',
    no_model: 'Сейчас не нашлось бесплатной модели. Попробуй позже.',
    network: 'Нет связи с ИИ. Проверь интернет.',
    bad_json: 'ИИ ответил что-то странное. Попробуй ещё раз.',
    server: 'ИИ временно недоступен. Попробуй через минуту.',
  };
  return map[e && e.code] || 'Что-то пошло не так. Попробуй ещё раз.';
}

let configPromise = null;
function getConfig() {
  if (!configPromise) {
    configPromise = fetch('config.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return configPromise;
}

export async function checkKey(key) {
  let r;
  try {
    r = await fetch(`${BASE}/key`, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    throw new AIError('network');
  }
  if (r.status === 401 || r.status === 403) throw new AIError('bad_key');
  if (!r.ok) throw new AIError('server');
  const j = await r.json();
  return j.data || {};
}

function isFree(m) {
  if (m.id.endsWith(':free')) return true;
  const p = m.pricing || {};
  return Number(p.prompt) === 0 && Number(p.completion) === 0 && m.id !== 'openrouter/auto';
}

// Одна модель на всех: из бесплатных берём первую по списку предпочтений
// из config.json. Выбор детерминированный, поэтому у всех он одинаковый.
async function pickModel({ exclude = [] } = {}) {
  const s = await getSettings();
  if (s.modelOverride) return s.modelOverride;
  const cached = await db.kvGet('modelPick');
  if (cached && Date.now() - cached.at < MODEL_TTL && !exclude.includes(cached.id)) return cached.id;

  const cfg = await getConfig();
  const preferred = cfg.preferred || ['deepseek', 'qwen', 'llama-3.3-70b', 'llama-4', 'gemma', 'mistral'];
  const avoid = cfg.avoid || ['vision', '-vl', 'embed', 'guard', 'tts', 'audio', 'image', 'openrouter/free'];
  const minContext = cfg.minContext || 16000;
  let list = [];
  try {
    const r = await fetch(`${BASE}/models`);
    if (r.ok) list = (await r.json()).data || [];
  } catch {
    /* сеть недоступна — ниже возьмём запасную модель */
  }
  const free = list.filter((m) => isFree(m)
    && !exclude.includes(m.id)
    && !avoid.some((a) => m.id.toLowerCase().includes(a))
    && (m.context_length || 0) >= minContext
    && (!m.architecture || !m.architecture.output_modalities || m.architecture.output_modalities.includes('text')));
  const rank = (m) => {
    const i = preferred.findIndex((p) => m.id.toLowerCase().includes(p.toLowerCase()));
    return i === -1 ? preferred.length : i;
  };
  free.sort((a, b) => rank(a) - rank(b) || (b.context_length || 0) - (a.context_length || 0) || a.id.localeCompare(b.id));
  const id = free[0] ? free[0].id : (cfg.fallbackModel || null);
  if (!id) throw new AIError('no_model');
  await db.kvSet('modelPick', { id, at: Date.now() });
  return id;
}

export async function currentModel() {
  try {
    return await pickModel();
  } catch {
    return null;
  }
}

export async function refreshModel() {
  await db.kvSet('modelPick', null);
  return currentModel();
}

function parseJSON(text) {
  let t = String(text || '');
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
  t = t.replace(/```(?:json)?/gi, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b <= a) throw new AIError('bad_json');
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch {
    throw new AIError('bad_json');
  }
}

async function chat(messages, { temperature = 0, maxTokens = 2500 } = {}) {
  const s = await getSettings();
  if (!s.apiKey) throw new AIError('no_key');
  const tried = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = await pickModel({ exclude: tried });
    let r;
    try {
      r = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${s.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin,
          'X-Title': 'Planka',
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      });
    } catch {
      throw new AIError('network');
    }
    if (r.status === 401 || r.status === 403) throw new AIError('bad_key');
    if (r.status === 402) {
      if (s.modelOverride) throw new AIError('no_credits');
      tried.push(model);
      await db.kvSet('modelPick', null);
      continue;
    }
    if (r.status === 429) throw new AIError('rate_limit');
    if (r.status === 404 || r.status === 400 || r.status >= 500) {
      if (s.modelOverride || attempt === 2) throw new AIError(r.status >= 500 ? 'server' : 'no_model');
      tried.push(model);
      await db.kvSet('modelPick', null);
      continue;
    }
    if (!r.ok) throw new AIError('server');
    const j = await r.json();
    if (j.error) {
      if (j.error.code === 429) throw new AIError('rate_limit');
      tried.push(model);
      await db.kvSet('modelPick', null);
      continue;
    }
    const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!content) {
      tried.push(model);
      continue;
    }
    try {
      return parseJSON(content);
    } catch (e) {
      if (attempt === 2) throw e;
      messages = [...messages, { role: 'assistant', content }, { role: 'user', content: 'Верни только JSON-объект, без текста вокруг.' }];
    }
  }
  throw new AIError('server');
}

const int10 = (v) => Math.min(10, Math.max(1, Math.round(Number(v) || 5)));

function profileBlock(s) {
  return [
    `Имя: ${s.name || 'не указано'}`,
    `О себе: ${s.about || 'не указано'}`,
    `Цели: ${s.goals || 'не указаны'}`,
    `Направления: ${(s.areas || []).join(', ') || 'Работа, Учёба, Здоровье'}`,
  ].join('\n');
}

export async function evaluateDay({ date, text, mood, projects, calib }) {
  const s = await getSettings();
  const areas = s.areas && s.areas.length ? s.areas : ['Работа', 'Учёба', 'Здоровье'];
  const calibText = (calib || []).slice(-12).map((c) => `— «${c.title}» (сложность ${c.difficulty}, силы ${c.effort}, вклад ${c.impact}): человек считает, что оценка ${c.feedback === 'lower' ? 'завышена' : 'занижена'}`).join('\n');
  const projText = (projects || []).filter((p) => !p.done).map((p) => `[${p.id}] ${p.title}`).join('; ') || 'нет';
  const system = `Ты — оценщик в приложении «Планка», тихом вечернем дневнике. Человек перед сном описывает свой день, а ты разбиваешь описание на отдельные задачи и оцениваешь каждую ОТНОСИТЕЛЬНО ЭТОГО человека: его уровня, опыта и целей, а не среднего пользователя. То, что новичку даётся тяжело, опытному может быть разминкой, и наоборот.

${profileBlock(s)}
Проекты: ${projText}
${calibText ? `Поправки человека к прошлым оценкам — подстрой под них свою шкалу:\n${calibText}\n` : ''}
Для каждой задачи поставь целые оценки от 1 до 10:
- difficulty — насколько это сложно именно для этого человека;
- effort — сколько сил и времени ушло (учитывай указанное время);
- impact — насколько это двигает его цели.
Не придумывай задач, которых нет в тексте. Мелкие однотипные дела объединяй. Отдых и быт можно записать с низким impact.

Ответь строго одним JSON-объектом, без пояснений и без markdown:
{"tasks":[{"title":"коротко, 2–6 слов, в прошедшем времени","area":"одно из направлений","difficulty":5,"effort":5,"impact":5,"project_id":"id проекта или null","reason":"одна короткая фраза, почему такая оценка"}],"comment":"1–2 тёплых предложения на «ты» об итогах дня: заметь главное, без лести и без морали; если день слабый — мягко, без упрёков"}`;
  const user = `Дата: ${fmtLong(date)}. Настроение: ${mood ? `${mood} из 5` : 'не отмечено'}.\nКак прошёл день:\n${text}`;
  const out = await chat([{ role: 'system', content: system }, { role: 'user', content: user }]);
  const ids = new Set((projects || []).map((p) => p.id));
  const tasks = (Array.isArray(out.tasks) ? out.tasks : []).filter((t) => t && t.title).slice(0, 20).map((t) => ({
    title: String(t.title).slice(0, 120),
    area: areas.includes(t.area) ? t.area : areas[0],
    difficulty: int10(t.difficulty),
    effort: int10(t.effort),
    impact: int10(t.impact),
    projectId: ids.has(t.project_id) ? t.project_id : null,
    reason: t.reason ? String(t.reason).slice(0, 200) : '',
  }));
  if (!tasks.length) throw new AIError('bad_json');
  return { tasks, comment: out.comment ? String(out.comment).slice(0, 400) : '' };
}

export async function suggestStructure({ title, desc }) {
  const s = await getSettings();
  const system = `Ты помогаешь разложить большой проект на понятные части в приложении «Планка».
${profileBlock(s)}
Ответь строго JSON без пояснений: {"sections":[{"title":"раздел, 1–4 слова","items":["конкретный шаг"]}]}. 3–6 разделов, в каждом 2–5 шагов, на русском, без воды.`;
  const out = await chat([{ role: 'system', content: system }, { role: 'user', content: `Проект: ${title}\n${desc ? `Описание: ${desc}` : ''}` }], { temperature: 0.3 });
  return (out.sections || []).filter((x) => x && x.title).slice(0, 8).map((x) => ({
    title: String(x.title).slice(0, 80),
    items: (x.items || []).map((i) => String(i).slice(0, 160)).filter(Boolean).slice(0, 8),
  }));
}

export function projectToText(p) {
  const lines = [`Проект: ${p.title}`];
  if (p.desc) lines.push(`Описание: ${p.desc}`);
  for (const b of p.blocks || []) {
    if (b.type === 'heading') lines.push(`\n## ${b.text || ''}`);
    else if (b.type === 'text' || b.type === 'quote') lines.push(b.text || '');
    else if (b.type === 'checklist') (b.items || []).forEach((i) => lines.push(`[${i.done ? 'x' : ' '}] ${i.text}`));
    else if (b.type === 'table') (b.rows || []).forEach((r) => lines.push(r.join(' | ')));
    else if (b.type === 'stats') (b.items || []).forEach((i) => lines.push(`${i.value} — ${i.label}`));
    else if (b.type === 'photo' || b.type === 'gallery') lines.push(`[фото${b.caption ? `: ${b.caption}` : ''}]`);
  }
  if (p.activity && p.activity.length) {
    lines.push('\nИз вечерних записей:');
    p.activity.slice(-15).forEach((a) => lines.push(`${a.date}: ${a.title}`));
  }
  return lines.join('\n').slice(0, 9000);
}

export async function analyzeProject(p) {
  const s = await getSettings();
  const system = `Ты оцениваешь, насколько продвинулся проект, по его странице в приложении «Планка».
${profileBlock(s)}
Ответь строго JSON без пояснений: {"progress":0,"done":["что уже сделано"],"left":["что осталось"],"next":"один конкретный следующий шаг"}. progress — целое 0–100. В done и left не больше трёх пунктов по 2–7 слов. Пиши на русском, коротко.`;
  const out = await chat([{ role: 'system', content: system }, { role: 'user', content: projectToText(p) }]);
  return {
    pct: Math.min(100, Math.max(0, Math.round(Number(out.progress) || 0))),
    done: (out.done || []).map(String).slice(0, 3),
    left: (out.left || []).map(String).slice(0, 3),
    next: out.next ? String(out.next).slice(0, 200) : '',
    at: Date.now(),
  };
}

export async function importDoc({ text, title }) {
  const system = `Ты превращаешь документ в красивую страницу-дашборд проекта в приложении «Планка».
Выдели структуру, ключевые числа вынеси в плашки stats, длинные куски сократи до 2–4 предложений, то, что уже сделано, отметь в чек-листе как done, цитаты и главные мысли — в quote.
Ответь строго JSON без пояснений:
{"blocks":[{"type":"heading","text":"..."},{"type":"text","text":"..."},{"type":"checklist","items":[{"text":"...","done":false}]},{"type":"stats","items":[{"value":"...","label":"..."}]},{"type":"quote","text":"..."}]}
Не больше 20 блоков, в stats не больше 3 плашек. Пиши на языке документа.`;
  const out = await chat([
    { role: 'system', content: system },
    { role: 'user', content: `Название проекта: ${title}\n\nДокумент:\n${text.slice(0, 15000)}` },
  ], { maxTokens: 3500 });
  return Array.isArray(out.blocks) ? out.blocks.slice(0, 24) : [];
}
