// Чтение .docx прямо на телефоне, без внешних библиотек:
// распаковываем zip встроенным DecompressionStream и разбираем XML.
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function unzipIndex(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not_docx');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(buf.subarray(off + 46, off + 46 + nameLen));
    entries[name] = { method, csize, lho };
    off += 46 + nameLen + extraLen + commLen;
  }
  return { dv, entries };
}

async function readEntry(buf, idx, name) {
  const e = idx.entries[name];
  if (!e) return null;
  const nl = idx.dv.getUint16(e.lho + 26, true);
  const el = idx.dv.getUint16(e.lho + 28, true);
  const start = e.lho + 30 + nl + el;
  const data = buf.subarray(start, start + e.csize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method === 8) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }
  throw new Error('not_docx');
}

const val = (node, tag) => {
  const el = node.getElementsByTagNameNS(W, tag)[0];
  return el ? el.getAttributeNS(W, 'val') || el.getAttribute('w:val') || '' : '';
};
const textOf = (node) => Array.from(node.getElementsByTagNameNS(W, 't')).map((t) => t.textContent).join('').replace(/\s+/g, ' ').trim();

export async function readDocx(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const idx = unzipIndex(buf);
  const xml = await readEntry(buf, idx, 'word/document.xml');
  if (!xml) throw new Error('not_docx');
  const headingStyles = new Set();
  const stylesXml = await readEntry(buf, idx, 'word/styles.xml').catch(() => null);
  if (stylesXml) {
    const sd = new DOMParser().parseFromString(stylesXml, 'application/xml');
    for (const st of Array.from(sd.getElementsByTagNameNS(W, 'style'))) {
      const id = st.getAttributeNS(W, 'styleId') || st.getAttribute('w:styleId');
      const name = val(st, 'name').toLowerCase();
      if (id && (/^heading \d/.test(name) || name === 'title' || /^заголовок/.test(name))) headingStyles.add(id);
    }
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const blocks = [];
  const plain = [];
  let textBuf = [];
  let listBuf = [];
  const flushText = () => {
    if (textBuf.length) blocks.push({ type: 'text', text: textBuf.join('\n\n') });
    textBuf = [];
  };
  const flushList = () => {
    if (listBuf.length) blocks.push({ type: 'checklist', items: listBuf.map((t) => ({ text: t, done: false })) });
    listBuf = [];
  };
  for (const node of Array.from(body ? body.childNodes : [])) {
    if (node.localName === 'p') {
      const text = textOf(node);
      if (!text) continue;
      plain.push(text);
      const style = val(node, 'pStyle');
      const isHeading = headingStyles.has(style) || /^(heading|title)/i.test(style);
      const isList = node.getElementsByTagNameNS(W, 'numPr').length > 0;
      if (isHeading) {
        flushText();
        flushList();
        blocks.push({ type: 'heading', text: text.slice(0, 140) });
      } else if (isList) {
        flushText();
        listBuf.push(text.slice(0, 300));
      } else {
        flushList();
        textBuf.push(text);
        if (textBuf.join('').length > 900) flushText();
      }
    } else if (node.localName === 'tbl') {
      flushText();
      flushList();
      const rows = Array.from(node.getElementsByTagNameNS(W, 'tr')).map((tr) => Array.from(tr.getElementsByTagNameNS(W, 'tc')).map((tc) => textOf(tc)));
      if (rows.length) {
        const width = Math.max(...rows.map((r) => r.length));
        blocks.push({ type: 'table', rows: rows.slice(0, 40).map((r) => [...r, ...Array(width - r.length).fill('')]) });
        plain.push(rows.map((r) => r.join(' | ')).join('\n'));
      }
    }
  }
  flushText();
  flushList();
  return { blocks: blocks.slice(0, 60), text: plain.join('\n') };
}
