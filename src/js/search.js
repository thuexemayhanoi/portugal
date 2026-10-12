// Smart Search: loaded on demand (dynamic import) the first time search is opened.
// Indexes title, meta description, H2/H3 headings and category. Accent-insensitive (Portuguese and Vietnamese).
const dialog = document.querySelector('[data-search-dialog]');
const input = dialog.querySelector('input[type="search"]');
const status = dialog.querySelector('.search-status');
const list = dialog.querySelector('.search-results');
const MAX_RESULTS = 12;
let records = null;
let loading = null;
let selected = -1;

const fold = (s) =>
  String(s || '')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Folded text plus a map from folded index to original index (for highlighting).
function foldWithMap(text) {
  let out = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    for (let j = 0; j < f.length; j++) {
      out += f[j];
      map.push(i);
    }
  }
  return { out, map };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function highlight(text, terms) {
  const { out, map } = foldWithMap(text);
  const ranges = [];
  for (const t of terms) {
    let from = 0;
    let at;
    while ((at = out.indexOf(t, from)) !== -1) {
      ranges.push([map[at], map[at + t.length - 1] + 1]);
      from = at + t.length;
    }
  }
  if (!ranges.length) return escapeHtml(text);
  ranges.sort((a, b) => a[0] - b[0]);
  let html = '';
  let pos = 0;
  for (const [s, e] of ranges) {
    if (s < pos) continue;
    html += escapeHtml(text.slice(pos, s)) + '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>';
    pos = e;
  }
  return html + escapeHtml(text.slice(pos));
}

function load() {
  if (records) return Promise.resolve(records);
  if (loading) return loading;
  status.textContent = dialog.dataset.loading;
  loading = fetch(dialog.dataset.index, { credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((rows) => {
      records = rows.map((r) => ({
        ...r,
        ft: fold(r.t),
        fd: fold(r.d),
        fh: fold((r.h || []).join(' · ')),
        fc: fold(r.c)
      }));
      return records;
    })
    .catch((err) => {
      loading = null;
      status.textContent = dialog.dataset.error;
      throw err;
    });
  return loading;
}

function score(rec, terms) {
  let total = 0;
  for (const t of terms) {
    let s = 0;
    if (rec.ft.includes(t)) s += rec.ft.startsWith(t) || rec.ft.includes(' ' + t) ? 8 : 5;
    if (rec.fh.includes(t)) s += 3;
    if (rec.fd.includes(t)) s += 2;
    if (rec.fc.includes(t)) s += 1;
    if (!s) return 0; // every term must match somewhere
    total += s;
  }
  return total;
}

function render(query) {
  const terms = fold(query).split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  selected = -1;
  if (!terms.length) {
    list.innerHTML = '';
    status.textContent = dialog.dataset.hint;
    return;
  }
  const results = records
    .map((r) => ({ r, s: score(r, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_RESULTS);
  if (!results.length) {
    list.innerHTML = '';
    status.textContent = dialog.dataset.empty;
    return;
  }
  status.textContent = results.length === 1 ? '1 resultado' : results.length + ' resultados';
  list.innerHTML = results
    .map(({ r }, i) => {
      const cat = r.c ? '<span class="r-cat">' + escapeHtml(r.c) + '</span>' : '';
      return (
        '<li><a id="sr-' + i + '" href="' + escapeHtml(r.u) + '">' + cat +
        '<span class="r-title">' + highlight(r.t, terms) + '</span>' +
        '<span class="r-desc">' + highlight(r.d, terms) + '</span></a></li>'
      );
    })
    .join('');
}

function move(delta) {
  const links = list.querySelectorAll('a');
  if (!links.length) return;
  if (selected >= 0) links[selected].removeAttribute('aria-selected');
  selected = (selected + delta + links.length) % links.length;
  links[selected].setAttribute('aria-selected', 'true');
  links[selected].scrollIntoView({ block: 'nearest' });
}

let timer = null;
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => load().then(() => render(input.value)).catch(() => {}), 80);
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    move(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    move(-1);
  } else if (event.key === 'Enter') {
    const links = list.querySelectorAll('a');
    const target = links[selected >= 0 ? selected : 0];
    if (target) {
      event.preventDefault();
      window.location.href = target.href;
    }
  }
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

export function open() {
  if (!dialog.open) dialog.showModal();
  input.focus();
  input.select();
  load()
    .then(() => {
      if (input.value) render(input.value);
      else status.textContent = dialog.dataset.hint;
    })
    .catch(() => {});
}
