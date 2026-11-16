// Small formatting helpers: money, dates, time left, HTML escaping, and a
// safe markdown-lite renderer for bounty descriptions (escaped first, so no
// markup from the API can ever run as HTML).

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function money(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function money0(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function plural(n, one, many) {
  return n === 1 ? one : many;
}

export function dateShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "2d 4h left", "3h 12m left", "45m left", or "Closed" once past deadline. */
export function timeLeft(deadlineIso, now = Date.now()) {
  const end = new Date(deadlineIso).getTime();
  if (Number.isNaN(end)) return '—';
  const diff = end - now;
  if (diff <= 0) return 'Closed';
  const m = Math.floor(diff / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${min}m left`;
  return `${min}m left`;
}

export function isOpen(deadlineIso, now = Date.now()) {
  const end = new Date(deadlineIso).getTime();
  return Number.isFinite(end) && end > now;
}

/** "closing soon" when the deadline is within 48 hours. */
export function isClosingSoon(deadlineIso, now = Date.now()) {
  const end = new Date(deadlineIso).getTime();
  return Number.isFinite(end) && end > now && end - now < 48 * 3600 * 1000;
}

/**
 * Render a bounty description (markdown-ish) to safe HTML: escape everything
 * first, then headings, bold, lists and paragraphs. Links become anchors only
 * when they point at make.fun itself; any other link stays plain text.
 */
export function renderMarkdown(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  const inline = (s) => {
    let out = esc(s);
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\[([^\]]+)\]\((https:\/\/make\.fun[^)\s]*)\)/g, '<a href="$2">$1</a>');
    return out;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
    } else if (line.startsWith('## ')) {
      closeList();
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (line.startsWith('# ')) {
      closeList();
      html += `<h2>${inline(line.slice(2))}</h2>`;
    } else if (line === '') {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}
