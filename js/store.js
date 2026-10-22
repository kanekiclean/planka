import * as db from './db.js';
import { uid, addDays } from './ui.js';

const DEFAULT_SETTINGS = {
  name: '',
  about: '',
  goals: '',
  areas: ['Работа', 'Учёба', 'Здоровье'],
  apiKey: '',
  modelOverride: '',
  themeId: 'evening',
  customTheme: null,
  onboarded: false,
};

let settingsCache = null;

export async function getSettings() {
  if (!settingsCache) {
    const saved = (await db.kvGet('settings')) || {};
    settingsCache = { ...DEFAULT_SETTINGS, ...saved };
  }
  return settingsCache;
}

export async function saveSettings(patch) {
  const s = await getSettings();
  Object.assign(s, patch);
  await db.kvSet('settings', { ...s });
  return s;
}

// ——— Очки и норма ———
export const START_NORM = 40;

export function taskPoints(t) {
  const base = (t.difficulty || 1) * 1.0 + (t.effort || 1) * 0.6 + (t.impact || 1) * 1.4;
  const k = t.feedback === 'lower' ? 0.8 : t.feedback === 'higher' ? 1.2 : 1;
  return Math.max(1, Math.round(base * k));
}

export const dayTotal = (day) => (day.tasks || []).reduce((a, t) => a + taskPoints(t), 0);

export async function allDays() {
  const days = await db.all('days');
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const getDay = (date) => db.get('days', date);

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Личная норма — медиана очков за последние 14 закрытых дней.
export async function normFor(date, days) {
  const list = (days || (await allDays())).filter((d) => d.date < date && d.closed && d.total > 0).slice(-14);
  if (list.length < 3) return START_NORM;
  return Math.max(10, Math.round(median(list.map((d) => d.total))));
}

export async function saveDay(day) {
  day.total = dayTotal(day);
  day.norm = await normFor(day.date);
  day.pct = Math.round((day.total / day.norm) * 100);
  day.updatedAt = Date.now();
  await db.put('days', day);
  return day;
}

export const deleteDay = (date) => db.del('days', date);

export function streak(days, today) {
  const closed = new Set(days.filter((d) => d.closed).map((d) => d.date));
  let cur = closed.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (closed.has(cur)) {
    n += 1;
    cur = addDays(cur, -1);
  }
  return n;
}

// ——— Калибровка: поправки человека к оценкам ИИ ———
export async function getCalib() {
  return (await db.kvGet('calib')) || [];
}
export async function addCalib(items) {
  if (!items.length) return;
  const list = await getCalib();
  const keys = new Set(list.map((c) => c.key));
  for (const it of items) if (!keys.has(it.key)) list.push(it);
  await db.kvSet('calib', list.slice(-30));
}

// ——— Проекты ———
export async function allProjects() {
  const list = await db.all('projects');
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
export const getProject = (id) => db.get('projects', id);

export function newProject({ title, desc = '', coverBlobId = null }) {
  const now = Date.now();
  return {
    id: uid(), title, desc, coverBlobId, blocks: [], activity: [],
    progress: null, done: false, createdAt: now, updatedAt: now,
  };
}

export async function saveProject(p) {
  p.updatedAt = Date.now();
  await db.put('projects', p);
  return p;
}

export function projectBlobIds(p) {
  const ids = [];
  if (p.coverBlobId) ids.push(p.coverBlobId);
  for (const b of p.blocks || []) {
    if (b.type === 'photo' && b.blobId) ids.push(b.blobId);
    if (b.type === 'gallery') ids.push(...(b.blobIds || []));
  }
  return ids;
}

export async function deleteProject(p) {
  for (const id of projectBlobIds(p)) await db.del('blobs', id);
  await db.del('projects', p.id);
}

export function localProgress(p) {
  let total = 0;
  let done = 0;
  for (const b of p.blocks || []) {
    if (b.type === 'checklist') {
      for (const it of b.items || []) {
        total += 1;
        if (it.done) done += 1;
      }
    }
  }
  return total ? Math.round((done / total) * 100) : null;
}

export function projectPct(p) {
  if (p.progress && typeof p.progress.pct === 'number') return p.progress.pct;
  return localProgress(p) ?? 0;
}

// ——— Файлы ———
export async function saveBlob(blob) {
  const id = uid();
  await db.put('blobs', { id, blob, type: blob.type, at: Date.now() });
  return id;
}
export const deleteBlob = (id) => db.del('blobs', id);

// ——— Бэкап ———
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function exportAll() {
  const blobs = [];
  for (const rec of await db.all('blobs')) {
    blobs.push({ id: rec.id, type: rec.type, data: await blobToBase64(rec.blob) });
  }
  const s = { ...(await getSettings()) };
  delete s.apiKey;
  return {
    app: 'planka', version: 1, exportedAt: new Date().toISOString(),
    settings: s, calib: await getCalib(),
    days: await db.all('days'), projects: await db.all('projects'), blobs,
  };
}

export async function importAll(data) {
  if (!data || data.app !== 'planka') throw new Error('not_planka');
  const keepKey = (await getSettings()).apiKey;
  await db.wipeAll();
  settingsCache = null;
  await db.kvSet('settings', { ...DEFAULT_SETTINGS, ...data.settings, apiKey: keepKey, onboarded: true });
  await db.kvSet('calib', data.calib || []);
  for (const d of data.days || []) await db.put('days', d);
  for (const p of data.projects || []) await db.put('projects', p);
  for (const b of data.blobs || []) await db.put('blobs', { id: b.id, type: b.type, blob: base64ToBlob(b.data, b.type), at: Date.now() });
  settingsCache = null;
}

export async function wipe() {
  await db.wipeAll();
  settingsCache = null;
}
