// Loads every data source and derives the full site model: pages, live categories, breadcrumbs,
// previous/next and related articles. All link targets are validated here so a build can never
// publish an intermediate URL that returns 404.
import fs from 'node:fs';
import { readJSON, listFiles, rel, isCleanUrl, isISODate, urlToFile, fail, normalize } from './util.mjs';

const PAGE_TEMPLATES = new Set(['home', 'page', 'hub', 'contact', 'faq', 'legal']);

export function loadModel() {
  const data = readJSON('site/data.json');
  const taxonomy = readJSON('site/taxonomy.json');
  const sourceList = readJSON('site/sources.json').sources;
  const sources = new Map(sourceList.map((s) => [s.id, s]));
  if (sources.size !== sourceList.length) fail('Duplicate id in site/sources.json');

  const plan = fs.existsSync(rel('data/editorial-plan.json')) ? readJSON('data/editorial-plan.json') : { topics: [] };
  const state = fs.existsSync(rel('data/factory-state.json')) ? readJSON('data/factory-state.json') : { published_ids: [] };
  const topicsById = new Map(plan.topics.map((t) => [t.id, t]));

  // --- taxonomy index
  const parents = new Map();
  const children = new Map();
  for (const p of taxonomy.parents) {
    if (parents.has(p.id)) fail(`Duplicate parent ${p.id}`);
    parents.set(p.id, p);
    for (const c of p.children) {
      if (children.has(c.id)) fail(`Duplicate child ${c.id}`);
      children.set(c.id, { ...c, parentId: p.id });
    }
  }

  // --- base pages
  const pages = [];
  for (const file of listFiles('content/pages', '.json')) {
    const page = readJSON(`content/pages/${file}`);
    for (const key of ['url', 'template', 'title', 'description', 'h1', 'updated']) {
      if (!page[key]) fail(`content/pages/${file}: missing "${key}"`);
    }
    if (!PAGE_TEMPLATES.has(page.template)) fail(`content/pages/${file}: unknown template ${page.template}`);
    if (!isCleanUrl(page.url)) fail(`content/pages/${file}: URL must be lowercase, ASCII, hyphenated and end with "/" (${page.url})`);
    if (!isISODate(page.updated)) fail(`content/pages/${file}: "updated" must be YYYY-MM-DD`);
    if (page.parent && !parents.has(page.parent)) fail(`content/pages/${file}: unknown parent ${page.parent}`);
    if (page.child && !children.has(page.child)) fail(`content/pages/${file}: unknown child ${page.child}`);
    pages.push({ ...page, kind: 'page', source: `content/pages/${file}`, indexable: page.indexable !== false });
  }

  // --- published articles
  const articles = [];
  for (const id of state.published_ids || []) {
    const topic = topicsById.get(id);
    if (!topic) fail(`Published article ${id} is not in data/editorial-plan.json`);
    const file = `content/articles/${id}.json`;
    if (!fs.existsSync(rel(file))) fail(`Published article ${id} has no ${file}`);
    const article = readJSON(file);
    if (article.id !== id) fail(`${file}: id mismatch (${article.id})`);
    if (article.slug !== topic.slug) fail(`${file}: slug "${article.slug}" differs from plan slug "${topic.slug}"`);
    if (!isISODate(article.date_published) || !isISODate(article.date_modified)) fail(`${file}: missing publication dates`);
    const child = children.get(topic.child_category);
    if (!child) fail(`${id}: unknown child category ${topic.child_category}`);
    articles.push({
      kind: 'article',
      template: 'article',
      source: file,
      id,
      url: topic.target_url,
      title: article.title,
      description: article.description,
      h1: article.h1,
      lead: article.summary,
      updated: article.date_modified,
      published: article.date_published,
      parent: child.parentId,
      child: child.id,
      order: Number(id.slice(3)),
      topic,
      article,
      indexable: true,
      toc: true
    });
  }

  // --- counts per category
  const childCount = new Map([...children.keys()].map((k) => [k, 0]));
  const parentCount = new Map([...parents.keys()].map((k) => [k, 0]));
  for (const a of articles) {
    childCount.set(a.child, childCount.get(a.child) + 1);
    parentCount.set(a.parent, parentCount.get(a.parent) + 1);
  }

  // --- generated hubs/archives (only when they have real content)
  const s = taxonomy.settings;
  const generated = [];
  for (const p of parents.values()) {
    if (!p.basePage && parentCount.get(p.id) > 0) {
      generated.push({
        kind: 'hub',
        template: 'parent-hub',
        url: p.url,
        parent: p.id,
        title: p.seoTitle || fail(`taxonomy parent ${p.id} needs seoTitle before its hub can be generated`),
        description: p.seoDescription || fail(`taxonomy parent ${p.id} needs seoDescription`),
        h1: p.label,
        eyebrow: 'Categoria',
        lead: p.intro,
        navLabel: p.label,
        updated: latest(articles.filter((a) => a.parent === p.id)),
        indexable: parentCount.get(p.id) >= s.parentHubMinArticlesToIndex
      });
    }
  }
  for (const c of children.values()) {
    if (!c.archiveIsBasePage && childCount.get(c.id) >= s.childArchiveMinArticles) {
      generated.push({
        kind: 'archive',
        template: 'child-archive',
        url: c.archiveUrl,
        parent: c.parentId,
        child: c.id,
        title: c.seoTitle || fail(`taxonomy child ${c.id} needs seoTitle before its archive can be generated`),
        description: c.seoDescription || fail(`taxonomy child ${c.id} needs seoDescription`),
        h1: c.label,
        eyebrow: parents.get(c.parentId).label,
        lead: c.intro,
        navLabel: c.label,
        updated: latest(articles.filter((a) => a.child === c.id)),
        indexable: true
      });
    }
  }

  const all = [...pages, ...generated, ...articles];
  const byUrl = new Map();
  for (const p of all) {
    if (byUrl.has(p.url)) fail(`Duplicate URL ${p.url} (${byUrl.get(p.url).source || byUrl.get(p.url).kind} and ${p.source || p.kind})`);
    byUrl.set(p.url, p);
    p.file = urlToFile(p.url);
  }

  // --- live category links ("Em breve" when null)
  const childLink = (id) => {
    const c = children.get(id);
    if (!c) fail(`Unknown child ${id}`);
    return byUrl.has(c.archiveUrl) ? c.archiveUrl : null;
  };
  const parentLink = (id) => {
    const p = parents.get(id);
    if (!p) fail(`Unknown parent ${id}`);
    return byUrl.has(p.url) ? p.url : null;
  };
  for (const p of parents.values()) {
    if (p.basePage && !byUrl.has(p.url)) fail(`Parent ${p.id} declares basePage but ${p.url} has no content/pages entry`);
  }
  for (const c of children.values()) {
    if (c.archiveIsBasePage && !byUrl.has(c.archiveUrl)) fail(`Child ${c.id} declares archiveIsBasePage but ${c.archiveUrl} does not exist`);
  }

  // --- breadcrumbs (every intermediate segment must exist)
  for (const p of all) {
    const trail = [{ label: data.ui.home, url: '/' }];
    if (p.url !== '/') {
      const parts = p.url.split('/').filter(Boolean);
      let acc = '/';
      parts.forEach((part, i) => {
        acc += `${part}/`;
        if (i === parts.length - 1) return;
        const target = byUrl.get(acc);
        if (!target) fail(`Intermediate URL ${acc} of ${p.url} does not exist (would return 404)`);
        trail.push({ label: target.navLabel || target.h1, url: acc });
      });
      if (p.kind === 'article') {
        const archive = childLink(p.child);
        if (archive && !trail.some((t) => t.url === archive)) {
          trail.push({ label: children.get(p.child).label, url: archive });
        }
      }
      trail.push({ label: p.navLabel || p.h1, url: p.url });
    }
    p.breadcrumb = trail;
  }

  // --- previous / next within the same child category, and related articles
  const byChild = new Map();
  for (const a of articles) {
    if (!byChild.has(a.child)) byChild.set(a.child, []);
    byChild.get(a.child).push(a);
  }
  for (const list of byChild.values()) list.sort((x, y) => x.order - y.order);
  for (const a of articles) {
    const list = byChild.get(a.child);
    const i = list.indexOf(a);
    a.prev = i > 0 ? list[i - 1] : null;
    a.next = i < list.length - 1 ? list[i + 1] : null;
    a.related = relatedFor(a, articles, 3);
  }

  return {
    data,
    taxonomy,
    sources,
    plan,
    state,
    parents,
    children,
    pages: all,
    articles,
    byUrl,
    childCount,
    parentCount,
    childLink,
    parentLink
  };
}

function latest(list) {
  return list.map((a) => a.updated).sort().pop();
}

function keywordSet(a) {
  const words = [a.topic.primary_keyword, ...(a.topic.secondary_keywords || [])].join(' ');
  return new Set(normalize(words).split(' ').filter((w) => w.length > 3));
}

export function relatedFor(article, articles, limit) {
  if (article.article.related_ids?.length) {
    const manual = article.article.related_ids.map((id) => articles.find((a) => a.id === id)).filter(Boolean);
    if (manual.length >= limit) return manual.slice(0, limit);
  }
  const mine = keywordSet(article);
  return articles
    .filter((a) => a !== article)
    .map((a) => {
      let score = 0;
      if (a.child === article.child) score += 3;
      if (a.parent === article.parent) score += 1;
      for (const w of keywordSet(a)) if (mine.has(w)) score += 0.5;
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.order - y.a.order)
    .slice(0, limit)
    .map((x) => x.a);
}
