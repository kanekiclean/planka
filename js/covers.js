// Нарисованные обложки месяцев и запасные обложки проектов.
let seq = 0;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</linearGradient>`;
const rg = (id, stops) => `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`;
const blur = (id, sd) => `<filter id="${id}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;

const NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DESCR = ['Снежные вершины', 'Иней и бледное солнце', 'Тающий лёд на озере', 'Зелёные холмы', 'Цветущие деревья', 'Луг с цветами', 'Море на закате', 'Поле на закате', 'Горы в тумане', 'Золотой лес', 'Дождь над городом', 'Огни зимнего города'];

export function monthScene(m) {
  const k = `c${m}_${seq++}`;
  const r = rng(m * 97 + 13);
  let defs = '';
  let body = '';
  switch (m) {
    case 0:
      defs = lg(`${k}s`, [[0, '#2F6EA6'], [1, '#A9CDE6']]) + lg(`${k}g`, [[0, '#2F4558'], [1, '#16222C']]);
      body = `<rect width="500" height="220" fill="url(#${k}s)"/>
        <polygon points="-20,200 170,40 360,200" fill="#E9EEF2"/><polygon points="170,40 360,200 230,200 200,110" fill="#B5C4D2"/>
        <polygon points="250,200 390,70 540,200" fill="#DCE4EA"/><polygon points="390,70 540,200 450,200 410,140" fill="#A9BAC9"/>
        <polygon points="-10,220 -10,190 70,160 140,185 220,150 300,180 380,155 460,180 510,165 510,220" fill="url(#${k}g)"/>`;
      break;
    case 1: {
      defs = lg(`${k}s`, [[0, '#BFD0E0'], [1, '#EEF3F7']]);
      let dots = '';
      for (let i = 0; i < 40; i++) dots += `<circle cx="${(r() * 500).toFixed(0)}" cy="${(130 + r() * 90).toFixed(0)}" r="${(0.8 + r() * 1.8).toFixed(1)}" fill="#FFFFFF" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
      body = `<rect width="500" height="220" fill="url(#${k}s)"/><circle cx="380" cy="64" r="26" fill="#FFFFFF" opacity="0.75"/>
        <polygon points="0,220 0,150 120,122 260,150 380,115 500,140 500,220" fill="#F7FAFC"/>
        <polygon points="0,220 0,185 150,160 300,190 450,165 500,175 500,220" fill="#D6E2EC"/>${dots}`;
      break;
    }
    case 2:
      defs = lg(`${k}s`, [[0, '#8FA3B3'], [1, '#D5DEE3']]) + lg(`${k}w`, [[0, '#7F97A6'], [1, '#3C5260']]);
      body = `<rect width="500" height="220" fill="url(#${k}s)"/>
        <polygon points="0,130 0,118 80,100 170,112 260,95 360,110 440,98 500,105 500,130" fill="#5E7280"/>
        <rect y="125" width="500" height="95" fill="url(#${k}w)"/>
        <g fill="#F2F6F8" opacity="0.88"><ellipse cx="90" cy="158" rx="60" ry="8"/><ellipse cx="250" cy="180" rx="80" ry="10"/><ellipse cx="400" cy="148" rx="50" ry="6"/><ellipse cx="430" cy="196" rx="70" ry="9"/><ellipse cx="150" cy="205" rx="40" ry="5"/></g>`;
      break;
    case 3: {
      defs = lg(`${k}s`, [[0, '#BFE0F2'], [1, '#EAF4E8']]);
      let trees = '';
      for (let i = 0; i < 7; i++) trees += `<circle cx="${(40 + r() * 420).toFixed(0)}" cy="${(140 + r() * 30).toFixed(0)}" r="${(6 + r() * 6).toFixed(0)}" fill="#3F7A36"/>`;
      body = `<rect width="500" height="220" fill="url(#${k}s)"/>
        <polygon points="0,220 0,140 110,110 230,140 360,100 500,130 500,220" fill="#9CCB7A"/>${trees}
        <polygon points="0,220 0,170 160,140 320,175 500,150 500,220" fill="#6FA956"/>
        <polygon points="0,220 0,200 200,180 380,205 500,190 500,220" fill="#4E8A40"/>`;
      break;
    }
    case 4: {
      defs = lg(`${k}s`, [[0, '#F7CBD4'], [1, '#FBEFE6']]);
      const crown = (x, y) => {
        let c = '';
        for (let i = 0; i < 14; i++) c += `<circle cx="${(x + (r() - 0.5) * 90).toFixed(0)}" cy="${(y + (r() - 0.5) * 50).toFixed(0)}" r="${(12 + r() * 12).toFixed(0)}" fill="${['#F4B6C2', '#EE9FB1', '#FBD3DB'][i % 3]}"/>`;
        return c;
      };
      let petals = '';
      for (let i = 0; i < 26; i++) petals += `<circle cx="${(r() * 500).toFixed(0)}" cy="${(r() * 220).toFixed(0)}" r="${(1.2 + r() * 1.6).toFixed(1)}" fill="#F7B9C6" opacity="0.8"/>`;
      body = `<rect width="500" height="220" fill="url(#${k}s)"/>
        <polygon points="0,220 0,168 200,142 500,172 500,220" fill="#A7C98B"/>
        <rect x="104" y="120" width="8" height="60" fill="#6B4A3A"/><rect x="356" y="105" width="8" height="70" fill="#6B4A3A"/>
        ${crown(110, 105)}${crown(360, 90)}${petals}`;
      break;
    }
    case 5: {
      defs = lg(`${k}s`, [[0, '#6FB5E8'], [1, '#CBE7F5']]) + lg(`${k}f`, [[0, '#9BC95A'], [1, '#5E9A35']]);
      let flowers = '';
      for (let i = 0; i < 70; i++) flowers += `<circle cx="${(r() * 500).toFixed(0)}" cy="${(150 + r() * 70).toFixed(0)}" r="${(1.5 + r() * 2).toFixed(1)}" fill="${['#F4D35E', '#FFFFFF', '#F2A3B8'][i % 3]}"/>`;
      body = `<rect width="500" height="220" fill="url(#${k}s)"/>
        <g fill="#FFFFFF" opacity="0.9"><ellipse cx="110" cy="50" rx="46" ry="14"/><ellipse cx="140" cy="42" rx="30" ry="14"/><ellipse cx="370" cy="70" rx="56" ry="15"/><ellipse cx="400" cy="60" rx="30" ry="13"/></g>
        <polygon points="0,220 0,150 250,135 500,150 500,220" fill="url(#${k}f)"/>${flowers}`;
      break;
    }
    case 6:
      defs = lg(`${k}s`, [[0, '#EFE0C8'], [1, '#D7A982']]) + lg(`${k}w`, [[0, '#6E8A90'], [1, '#1B2A2F']]) + blur(`${k}b`, 5);
      body = `<rect width="500" height="125" fill="url(#${k}s)"/><circle cx="250" cy="116" r="22" fill="#FFF1DA" opacity="0.95"/>
        <rect y="120" width="500" height="100" fill="url(#${k}w)"/>
        <rect x="238" y="124" width="24" height="96" fill="#FFE4C0" opacity="0.4" filter="url(#${k}b)"/>
        <line x1="0" y1="120" x2="500" y2="120" stroke="#F3EBDD" stroke-opacity="0.35"/>`;
      break;
    case 7:
      defs = lg(`${k}s`, [[0, '#F9DDB4'], [0.6, '#F2A65A'], [1, '#E06A35']]) + rg(`${k}u`, [[0, '#FFF4DD'], [0.35, '#FFE3B3', 0.9], [1, '#FFE3B3', 0]]) + lg(`${k}f`, [[0, '#9A6427'], [1, '#3A220E']]);
      body = `<rect width="500" height="150" fill="url(#${k}s)"/><circle cx="340" cy="142" r="70" fill="url(#${k}u)"/>
        <rect y="140" width="500" height="80" fill="url(#${k}f)"/>
        <g stroke="#D89A4E" stroke-width="1.5" opacity="0.45"><line x1="0" y1="160" x2="500" y2="154"/><line x1="0" y1="182" x2="500" y2="174"/><line x1="0" y1="204" x2="500" y2="196"/></g>`;
      break;
    case 8:
      defs = lg(`${k}s`, [[0, '#DCD5C8'], [1, '#A9B2AE']]) + blur(`${k}b`, 9);
      body = `<rect width="500" height="220" fill="url(#${k}s)"/>
        <polygon points="0,130 60,88 120,112 190,64 260,104 330,76 410,116 500,86 500,220 0,220" fill="#8E9B99" opacity="0.75"/>
        <rect x="0" y="108" width="500" height="36" fill="#F3EBDD" opacity="0.35" filter="url(#${k}b)"/>
        <polygon points="0,160 80,120 150,150 230,114 300,154 380,124 450,150 500,135 500,220 0,220" fill="#5A6B6B"/>
        <polygon points="0,192 100,160 200,186 300,164 400,190 500,170 500,220 0,220" fill="#2E3B3B"/>`;
      break;
    case 9: {
      defs = lg(`${k}s`, [[0, '#EBCB98'], [1, '#B97A3E']]) + rg(`${k}u`, [[0, '#FFF0D0', 0.8], [1, '#FFF0D0', 0]]) + blur(`${k}b`, 8);
      let far = '0,220 0,170';
      for (let x = 20; x <= 500; x += 40) far += ` ${x},${136 + Math.round(r() * 10)} ${Math.min(500, x + 20)},170`;
      far += ' 500,220';
      body = `<rect width="500" height="220" fill="url(#${k}s)"/><circle cx="320" cy="50" r="150" fill="url(#${k}u)"/>
        <polygon points="${far}" fill="#C08A4E" opacity="0.7"/>
        <rect x="0" y="150" width="500" height="30" fill="#F3EBDD" opacity="0.2" filter="url(#${k}b)"/>
        <g fill="#5C3519"><polygon points="10,220 40,112 70,220"/><polygon points="75,220 110,98 145,220"/><polygon points="170,220 200,120 230,220"/><polygon points="250,220 285,104 320,220"/><polygon points="345,220 375,116 405,220"/><polygon points="420,220 455,100 490,220"/></g>`;
      break;
    }
    case 10: {
      defs = lg(`${k}s`, [[0, '#3F4A57'], [1, '#232A33']]);
      let rain = '';
      for (let i = 0; i < 60; i++) {
        const x = r() * 520;
        const y = r() * 200;
        rain += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - 6).toFixed(0)}" y2="${(y + 18).toFixed(0)}"/>`;
      }
      let drops = '';
      for (let i = 0; i < 16; i++) drops += `<circle cx="${(r() * 500).toFixed(0)}" cy="${(r() * 200).toFixed(0)}" r="${(2 + r() * 4).toFixed(1)}"/>`;
      body = `<rect width="500" height="220" fill="url(#${k}s)"/>
        <g fill="#F2C46B" opacity="0.5"><rect x="62" y="156" width="4" height="5"/><rect x="122" y="150" width="4" height="5"/><rect x="312" y="152" width="4" height="5"/><rect x="214" y="162" width="4" height="5"/></g>
        <polygon points="0,220 0,170 40,170 40,150 70,150 70,165 110,165 110,140 150,140 150,170 200,170 200,155 240,155 240,175 300,175 300,145 330,145 330,170 380,170 380,160 430,160 430,175 500,175 500,220" fill="#1A2027"/>
        <g stroke="#BFD0E0" stroke-opacity="0.28" stroke-width="1.2">${rain}</g>
        <g fill="none" stroke="#DDE7F0" stroke-opacity="0.35" stroke-width="1.2">${drops}</g>`;
      break;
    }
    default: {
      defs = lg(`${k}s`, [[0, '#0F1B33'], [1, '#2A3B5F']]);
      let win = '';
      const bld = [[20, 120, 60], [90, 95, 50], [150, 130, 70], [230, 80, 55], [295, 110, 65], [370, 90, 50], [430, 125, 60]];
      let blds = '';
      for (const [x, y, w] of bld) {
        blds += `<rect x="${x}" y="${y}" width="${w}" height="${220 - y}"/>`;
        for (let yy = y + 10; yy < 190; yy += 14) {
          for (let xx = x + 8; xx < x + w - 8; xx += 12) if (r() > 0.55) win += `<rect x="${xx}" y="${yy}" width="5" height="6"/>`;
        }
      }
      let snow = '';
      for (let i = 0; i < 70; i++) snow += `<circle cx="${(r() * 500).toFixed(0)}" cy="${(r() * 200).toFixed(0)}" r="${(0.8 + r() * 1.6).toFixed(1)}"/>`;
      body = `<rect width="500" height="220" fill="url(#${k}s)"/><circle cx="430" cy="48" r="18" fill="#F3EBDD" opacity="0.9"/>
        <g fill="#0B1222">${blds}</g><g fill="#F2C46B" opacity="0.85">${win}</g>
        <polygon points="0,220 0,198 500,192 500,220" fill="#E9EEF5"/><g fill="#FFFFFF" opacity="0.8">${snow}</g>`;
    }
  }
  return `<svg viewBox="0 0 500 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${NAMES[m]}: ${DESCR[m]}"><defs>${defs}</defs>${body}</svg>`;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Мягкая абстрактная обложка проекта из цветов текущей темы.
export function projectCover(seed) {
  const r = rng(hash(String(seed)));
  const k = `p${seq++}`;
  let blobs = '';
  for (let i = 0; i < 4; i++) {
    blobs += `<circle cx="${(r() * 400).toFixed(0)}" cy="${(r() * 500).toFixed(0)}" r="${(110 + r() * 120).toFixed(0)}" style="fill:${i % 2 ? 'var(--accent)' : 'var(--muted)'}" opacity="${(0.35 + r() * 0.35).toFixed(2)}"/>`;
  }
  return `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><filter id="${k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter></defs><rect width="400" height="500" style="fill:var(--surface)"/><g filter="url(#${k})">${blobs}</g></svg>`;
}

export function monthSceneDataUrl(m) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monthScene(m).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="440" '))}`;
}
