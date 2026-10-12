// Shared helpers for the generator, QA scripts and factory. No third-party dependencies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const rel = (...parts) => path.join(ROOT, ...parts);

export function readJSON(file) {
  const full = path.isAbsolute(file) ? file : rel(file);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${path.relative(ROOT, full)}: ${err.message}`);
  }
}

export function writeJSON(file, value) {
  const full = path.isAbsolute(file) ? file : rel(file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function listFiles(dir, ext) {
  const full = rel(dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => !ext || f.endsWith(ext)).sort();
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// Lowercase, strip diacritics (including Vietnamese đ) and punctuation. Used for search, slugs and similarity.
export function normalize(value) {
  return String(value ?? '')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const slugify = (value) => normalize(value).replace(/\s+/g, '-');

export const stripTags = (html) =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export function wordCount(text) {
  // "150.000" or "1,5" count as one word.
  const words = String(text ?? '').match(/[\p{L}\p{N}](?:[\p{L}\p{N}'’-]|[.,](?=\p{N}))*/gu);
  return words ? words.length : 0;
}

export const shortHash = (content) => crypto.createHash('sha1').update(content).digest('hex').slice(0, 10);

export function formatNumberPT(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// 150000 -> "150.000 VND"; [900000, 1200000] -> "900.000–1.200.000 VND"; null -> fallback label.
export function formatVND(value, onRequest = 'Sob consulta') {
  if (value === null || value === undefined) return onRequest;
  if (Array.isArray(value)) return `${formatNumberPT(value[0])}–${formatNumberPT(value[1])} VND`;
  return `${formatNumberPT(value)} VND`;
}

const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function formatDatePT(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return `${Number(m[3])} de ${MONTHS_PT[Number(m[2]) - 1]} de ${m[1]}`;
}

export const isISODate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Path helpers: every public URL starts and ends with "/" (except files such as /sitemap.xml).
export const urlToFile = (url) => (url === '/' ? 'index.html' : `${url.replace(/^\//, '')}index.html`);

export const isCleanUrl = (url) => /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/.test(url);

export function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function fail(message) {
  const err = new Error(message);
  err.isBuildError = true;
  throw err;
}
