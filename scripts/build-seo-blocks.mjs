// Rebuilds the Code Block files for the film pages, /watch and /press so each one carries plain
// HTML text (title, synopsis, links) inside its placeholder. Search engines, AI tools and link
// previews that don't run scripts read that text; for visitors, fus.js replaces it with the full
// page as soon as it loads, so nobody sees it twice.
//
// Run after editing data/films.json or data/press.json:  node scripts/build-seo-blocks.mjs
// Then re-paste the changed files into their Code Blocks (each file says which page it belongs on).
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const films = read('data/films.json');
const press = read('data/press.json');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SCREENING = '/general-screening';
const HIDE = '<style>.fus-on .fus-seo{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}</style>';

function watchLinks(f) {
  const links = (f.watchOn || []).map((w) => {
    const url = w.url || (/youtube/i.test(w.label) && f.youtubeId ? `https://www.youtube.com/watch?v=${f.youtubeId}` : '');
    return url ? `<a href="${esc(url)}">${esc(w.label)}</a>` : esc(w.label);
  });
  if (!links.length && f.youtubeId) links.push(`<a href="https://www.youtube.com/watch?v=${esc(f.youtubeId)}">YouTube, free</a>`);
  return links.join(' · ');
}

// Film pages: one file per curated film that has a page (pages/films/<slug>.html)
const pages = {
  'a-faith-under-siege': 1, 'the-stolen-children': 1, 'even-in-the-ruins': 1, 'safe-ground': 1, 'soldiers-of-light': 1,
  'no-surrender': 1, 'no-priests-left': 1, 'pastor-of-kherson': 1, nadiia: 1,
};
for (const f of films.films) {
  if (!pages[f.slug]) continue;
  const coll = (films.collections[f.collection] || {}).label;
  const facts = [coll && (coll + (f.episode ? ` · Film ${f.episode} of 5` : '')), f.year, f.runtime, 'Documentary'].filter(Boolean).join(' · ');
  const synopsis = (f.synopsis && f.synopsis.length ? f.synopsis : [f.logline]).filter(Boolean).map((p) => `    <p>${esc(p)}</p>`).join('\n');
  const html = `<!-- FILM PAGE · paste this whole file into ONE Code Block, in ONE full-width section.
     Page URL slug: /watch/${f.slug} · Section: white
     The text inside is for search engines and link previews; the site script swaps in the full page.
     Built by scripts/build-seo-blocks.mjs from data/films.json. -->
${HIDE}
<div data-fus="film" data-slug="${f.slug}" data-screening-url="${SCREENING}">
  <div class="fus-seo">
    <h1>${esc(f.title)}${f.subtitle ? ': ' + esc(f.subtitle) : ''}</h1>
    <p>${esc(facts)}</p>
${synopsis}
${f.featuring ? `    <p>Featuring ${esc(f.featuring)}.</p>\n` : ''}    <p>Watch: ${watchLinks(f)}</p>
    <p><a href="${SCREENING}">Host a free screening of ${esc(f.title)}</a> · <a href="/watch">See every film</a></p>
  </div>
</div>
`;
  writeFileSync(new URL(`pages/films/${f.slug}.html`, root), html);
}

// Watch page: the heading plus a plain list of every curated film
const list = films.films.filter((f) => f.type !== 'clip' && !(films.hide || []).includes(f.youtubeId));
const watch = `<!-- WATCH · paste this whole file into ONE Code Block, in ONE full-width section.
     Page URL slug: /watch · Section: dark
     Filters are shareable links, e.g. /watch?collection=fiw or /watch?topic=children
     The list inside the library is for search engines; the site script swaps in the full library.
     Built by scripts/build-seo-blocks.mjs from data/films.json. -->
${HIDE}
<section class="fus" style="padding:64px 0 96px"><div class="fus-wrap">
  <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:36px">
    <p class="fus-eyebrow">Free to stream</p>
    <h1 class="fus-h1">Every film</h1>
    <p class="fus-lede">Features, series and short films from inside Ukraine. New releases are added automatically from YouTube.</p>
  </div>
  <div data-fus="library">
    <div class="fus-seo">
      <h2>Documentaries about faith in Russian-occupied Ukraine, free to watch</h2>
      <ul>
${list.map((f) => `        <li><a href="${esc(f.page || '/watch/' + f.slug)}">${esc(f.title)}</a>${f.runtime ? ' (' + esc(f.runtime) + ')' : ''}: ${esc(f.logline || '')}</li>`).join('\n')}
      </ul>
      <p><a href="/watch?collection=fiw">The Faith in War series</a> · <a href="${SCREENING}">Host a free screening</a></p>
    </div>
  </div>
</div></section>
`;
writeFileSync(new URL('pages/watch.html', root), watch);

// Press page: the 40 most recent pieces of coverage as plain links
const items = (press.items || []).filter((p) => p.url).sort((a, b) => String(b.date).localeCompare(String(a.date)));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (d) => { const p = String(d || '').split('-'); return p.length === 3 ? `${MONTHS[+p[1] - 1]} ${+p[2]}, ${p[0]}` : ''; };
const outlets = [...new Set(items.map((p) => p.outlet))];
const named = (press.featuredLogos || []).map((x) => x.name).concat(press.featuredOutlets || []).filter((x, i, a) => x && a.indexOf(x) === i);
// Same rule as the homepage headlines: real headlines only, no podcast or placeholder rows
const headlines = items.filter((p) => p.type !== 'Radio & podcast' && !/^(interview|colby barrett op-ed|steven on)\b/i.test(p.title));
const pressHtml = `<!-- PRESS · paste this whole file into ONE Code Block, in ONE full-width section.
     Page URL slug: /press · Section: white
     The list inside is for search engines; the site script swaps in the full, filterable press page.
     Built by scripts/build-seo-blocks.mjs from data/press.json. -->
${HIDE}
<section class="fus fus-light" style="padding:64px 0 96px">
  <div data-fus="press" data-title="In the press">
    <div class="fus-seo">
      <h1>A Faith Under Siege in the press</h1>
      <p>${items.length} articles, TV segments, op-eds and interviews from ${outlets.length} outlets, including ${(named.length ? named : outlets).slice(0, 12).map(esc).join(', ')}.</p>
      <ul>
${headlines.slice(0, 40).map((p) => `        <li>${esc(p.outlet)}, ${esc(fmt(p.date))}: <a href="${esc(p.url)}">${esc(p.title)}</a></li>`).join('\n')}
      </ul>
    </div>
  </div>
</section>
`;
writeFileSync(new URL('pages/press.html', root), pressHtml);
console.log('Rebuilt film pages, watch.html and press.html');
