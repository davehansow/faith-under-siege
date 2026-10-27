/*!
 * A Faith Under Siege · site script
 * Renders the film library, rails, film pages, press, journal, laurels and social embeds
 * inside Squarespace Code Blocks. No dependencies.
 *
 * Configure with window.FUS_CONFIG before this file loads (see snippets/header-injection.html).
 * Each component is a <div data-fus="..."> placeholder in a Code Block.
 */
(function () {
  'use strict';

  var DEFAULTS = {
    dataBase: '',                       // folder URL that holds films.json, press.json, laurels.json
    filmsUrl: '', pressUrl: '', laurelsUrl: '',
    youtubeApiKey: '',                  // optional: live YouTube mode
    channelId: 'UCx-2kTPvk4Z505gS2ZEch-A',
    playlists: {},                      // { playlistId: { type: 'episode', collection: 'series', topics: [] } }
    includeNewUploads: true,            // add channel uploads that are not in films.json
    youtubeSnapshotUrl: '',             // defaults to <dataBase>/youtube.json (refreshed daily by the GitHub Action)
    clipMaxSeconds: 180,                // videos this short become "Clips" (YouTube Shorts and quick dispatches)
    includeClips: true,
    cacheHours: 6,
    watchPath: '/watch',                // pages live at /watch/<slug>; any video plays at /watch/film?v=<id>
    filmTemplatePath: '/watch/film',
    pressPath: '/press',
    journalPath: '/news-and-updates',
    screeningPath: '/general-screening', // every "Host a screening" button goes here
    stagingPrefix: '',                  // e.g. '/new' while the new pages are built beside the live site; '' at launch
    social: { instagram: 'faithundersiege', x: 'FaithUnderSiege', facebook: 'afaithundersiege', tiktok: '' }
  };
  var C = Object.assign({}, DEFAULTS, window.FUS_CONFIG || {});
  C.social = Object.assign({}, DEFAULTS.social, (window.FUS_CONFIG || {}).social || {});
  /* Staging: new pages live under the prefix (/new, /new/watch, ...), and only those pages get the new look. */
  var SP = String(C.stagingPrefix || '').replace(/\/$/, '');
  if (SP) ['watchPath', 'filmTemplatePath', 'pressPath'].forEach(function (k) { if (C[k].charAt(0) === '/' && C[k].indexOf(SP + '/') !== 0) C[k] = SP + C[k]; });
  function isNewPage() { return !SP || location.pathname === SP || location.pathname.indexOf(SP + '/') === 0; }
  // Older pasted blocks pointed at /host-a-screening; send every screening link to the configured page
  function screeningUrl(u) { return !u || /^\/host-a-screening\/?$/.test(u) ? C.screeningPath : u; }
  function stagingLinks(root) {
    [].forEach.call((root || document).querySelectorAll('.fus a[href^="/host-a-screening"]'), function (a) { a.setAttribute('href', C.screeningPath); });
    var J = String(C.journalPath || '/journal').replace(/\/$/, '');
    if (J !== '/journal') [].forEach.call((root || document).querySelectorAll('.fus a[href^="/journal"]'), function (a) {
      var h = a.getAttribute('href'); if (/^\/journal(\/|\?|$)/.test(h)) a.setAttribute('href', J + h.slice(8));
    });
    if (!SP) return;
    [].forEach.call((root || document).querySelectorAll('.fus a[href^="/watch"], .fus a[href^="/press"], a.fus-panel[href^="/watch"]'), function (a) {
      var h = a.getAttribute('href'); if (/^\/(watch|press)(\/|\?|$)/.test(h)) a.setAttribute('href', SP + h);
    });
  }
  // Hourly version stamp so browsers pick up data updates within the hour instead of caching for days
  var STAMP = 'v=' + Math.floor(Date.now() / 36e5);
  function dataUrl(name, override) { return override || (C.dataBase ? C.dataBase.replace(/\/$/, '') + '/' + name + '?' + STAMP : name); }

  /* ---------------- helpers ---------------- */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { u = String(u || ''); return /^(https?:)?\/\//i.test(u) || u.charAt(0) === '/' ? u : ''; }
  function norm(s) { return String(s || '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function fmtDate(iso) { var d = String(iso || '').split('-'); return d.length === 3 ? MONTHS[+d[1] - 1] + ' ' + (+d[2]) + ', ' + d[0] : ''; }
  function fmtDuration(sec) { if (!sec) return ''; var m = Math.round(sec / 60); return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min'; }
  function isoToSec(p) { var m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(p || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; }
  function minutesOf(f) { if (f.seconds) return f.seconds / 60; var m = /(\d+)/.exec(f.runtime || ''); return m ? +m[1] : (f.type === 'feature' ? 90 : 30); }
  function attr(el, name, fallback) { var v = el.getAttribute('data-' + name); return v == null || v === '' ? fallback : v; }
  function store(key, val) {
    try {
      if (val === undefined) { var raw = localStorage.getItem(key); if (!raw) return null; var o = JSON.parse(raw); return Date.now() - o.t < C.cacheHours * 36e5 ? o.v : null; }
      localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: val }));
    } catch (e) { return null; }
  }
  var cache = {};
  function getJSON(url) {
    if (!cache[url]) cache[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); });
    return cache[url];
  }
  function svgPlay(w) { return '<svg width="' + w + '" height="' + Math.round(w * 1.14) + '" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1l11 7-11 7z" fill="currentColor"/></svg>'; }
  function thumb(id, size) { return id ? 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/' + (size || 'hqdefault') + '.jpg' : ''; }

  /* ---------------- data: catalog ---------------- */
  var catalogPromise;
  function loadCatalog() {
    if (catalogPromise) return catalogPromise;
    catalogPromise = getJSON(dataUrl('films.json', C.filmsUrl)).then(function (data) {
      var films = (data.films || []).map(function (f) { return Object.assign({ topics: [], watchOn: [] }, f); });
      var cat = { collections: data.collections || {}, topics: data.topics || {}, films: films, hide: data.hide || [] };
      return loadYouTube().then(function (videos) { merge(cat, videos); return finish(cat); }, function (err) {
        if (window.console) console.warn('[FUS] YouTube live mode failed, using films.json only.', err);
        return finish(cat);
      });
    });
    return catalogPromise;
  }
  function finish(cat) {
    cat.films.forEach(function (f) {
      if (!f.slug) f.slug = f.curated === false && f.youtubeId ? 'v-' + f.youtubeId : norm(f.title).replace(/ /g, '-');
      if (!f.page) f.page = f.curated === false && f.youtubeId ? C.filmTemplatePath + '?v=' + encodeURIComponent(f.youtubeId) : C.watchPath + '/' + f.slug;
      else if (SP && /^\/(watch|press)(\/|\?|$)/.test(f.page)) f.page = SP + f.page;
      if (!f.runtime && f.seconds) f.runtime = fmtDuration(f.seconds);
      f.collectionLabel = (cat.collections[f.collection] || {}).label || '';
      f.topicLabels = (f.topics || []).map(function (t) { return cat.topics[t] || t; });
      f._search = norm([f.title, f.subtitle, f.logline, f.featuring, f.collectionLabel].concat(f.topicLabels).join(' '));
    });
    cat.films.sort(function (a, b) { return (b.order || 0) - (a.order || 0) || String(b.published || '').localeCompare(String(a.published || '')); });
    cat.bySlug = {}; cat.byId = {};
    cat.films.forEach(function (f) { cat.bySlug[f.slug] = f; if (f.youtubeId) cat.byId[f.youtubeId] = f; });
    return cat;
  }

  /* ---------------- data: live YouTube ---------------- */
  function yt(path, params) {
    params.key = C.youtubeApiKey;
    var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return getJSON('https://www.googleapis.com/youtube/v3/' + path + '?' + q);
  }
  function playlistAll(id, max) {
    var out = [];
    function page(token) {
      var p = { part: 'snippet,contentDetails', maxResults: 50, playlistId: id };
      if (token) p.pageToken = token;
      return yt('playlistItems', p).then(function (r) {
        (r.items || []).forEach(function (it) {
          var s = it.snippet || {}, vid = (it.contentDetails || {}).videoId || ((s.resourceId || {}).videoId);
          if (!vid || s.title === 'Private video' || s.title === 'Deleted video') return;
          out.push({ id: vid, title: s.title, description: s.description || '', published: ((it.contentDetails || {}).videoPublishedAt || s.publishedAt || '').slice(0, 10), playlist: id });
        });
        return r.nextPageToken && out.length < (max || 400) ? page(r.nextPageToken) : out;
      });
    }
    return page();
  }
  function loadYouTube() {
    return getJSON(dataUrl('youtube.json', C.youtubeSnapshotUrl)).then(function (snap) {
      if (!snap || !snap.videos || !snap.videos.length) throw new Error('empty snapshot');
      return snap.videos;
    }).catch(function () {
      if (!C.youtubeApiKey) return [];
      return loadYouTubeLive();
    });
  }
  function loadYouTubeLive() {
    var key = 'fus:yt:' + C.channelId + ':' + Object.keys(C.playlists).join(',');
    var hit = store(key);
    if (hit) return Promise.resolve(hit);
    var uploads = C.channelId.replace(/^UC/, 'UU');
    var lists = [uploads].concat(Object.keys(C.playlists));
    return Promise.all(lists.map(function (id) { return playlistAll(id).catch(function () { return []; }); })).then(function (sets) {
      var byId = {};
      sets.forEach(function (set) {
        set.forEach(function (v) {
          var cur = byId[v.id];
          if (!cur) byId[v.id] = v; else if (v.playlist !== uploads) cur.playlist = v.playlist;
        });
      });
      var ids = Object.keys(byId), chunks = [];
      for (var i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
      return Promise.all(chunks.map(function (c) { return yt('videos', { part: 'contentDetails', id: c.join(','), maxResults: 50 }); })).then(function (res) {
        res.forEach(function (r) { (r.items || []).forEach(function (it) { if (byId[it.id]) byId[it.id].seconds = isoToSec((it.contentDetails || {}).duration); }); });
        var list = ids.map(function (id) { return byId[id]; });
        store(key, list);
        return list;
      });
    });
  }
  function merge(cat, videos) {
    var byId = {}, taken = {}, hidden = {};
    (cat.hide || []).forEach(function (id) { hidden[id] = 1; });
    cat.films.forEach(function (f) { if (f.youtubeId) { byId[f.youtubeId] = f; taken[f.youtubeId] = 1; } });
    videos.forEach(function (v) {
      if (hidden[v.id]) return;
      var f = byId[v.id];
      if (!f) {
        var t = norm(v.title);
        f = cat.films.filter(function (x) { return !x.youtubeId && x.match && t.indexOf(norm(x.match)) >= 0; })[0];
        if (f) { f.youtubeId = v.id; taken[v.id] = 1; }
      }
      if (f) {
        f.seconds = f.seconds || v.seconds; f.published = f.published || v.published;
        if (!f.logline && v.description) f.logline = v.description.split(/\n/)[0].slice(0, 160);
        return;
      }
      if (!C.includeNewUploads) return;
      var map = C.playlists[v.playlist] || {};
      var mins = (v.seconds || 0) / 60, clip = v.seconds && v.seconds <= C.clipMaxSeconds;
      if (clip && !C.includeClips) return;
      if (clip) map = { type: 'clip', collection: 'clips', topics: [] };
      cat.films.push({
        curated: false, youtubeId: v.id, title: v.title, published: v.published, seconds: v.seconds,
        type: map.type || (mins >= 60 ? 'feature' : mins >= 20 ? 'film' : 'short'),
        collection: map.collection || (mins >= 20 ? '' : 'deeper'),
        topics: map.topics || [], logline: clip ? '' : (v.description || '').split(/\n/)[0].slice(0, 160),
        synopsis: (v.description || '').split(/\n\s*\n/).slice(0, 3), watchOn: [], order: 0
      });
    });
  }

  /* ---------------- shared card ---------------- */
  var TYPE_LABEL = { feature: 'Feature', film: 'Film', episode: 'Episode', short: 'Short', clip: 'Clip' };
  function present(cat, test) { return cat.films.some(test); }
  function card(f, opts) {
    opts = opts || {};
    var img = f.image || thumb(f.youtubeId, 'hqdefault');
    var meta = [f.collectionLabel, f.topicLabels && f.topicLabels[0]].filter(Boolean).join(' · ');
    return '<a class="fus-card" href="' + esc(safeUrl(f.page)) + '">' +
      '<div class="fus-card__thumb">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      '<span class="fus-card__fallback" aria-hidden="true">' + (img ? '' : esc(f.title)) + '</span>' +
      '<span class="fus-card__badge">' + esc(TYPE_LABEL[f.type] || 'Film') + '</span>' +
      (f.runtime ? '<span class="fus-card__time">' + esc(f.runtime) + '</span>' : '') +
      '</div>' +
      (opts.noMeta || !meta ? '' : '<span class="fus-card__meta">' + esc(meta) + '</span>') +
      '<h3 class="fus-card__title">' + esc(f.title) + '</h3>' +
      (opts.noLine || !f.logline ? '' : '<p class="fus-card__line">' + esc(f.logline) + '</p>') +
      '</a>';
  }
  function loading(el, msg) { el.innerHTML = '<p class="fus-count">' + esc(msg || 'Loading…') + '</p>'; }
  function failed(el, err) { el.innerHTML = '<p class="fus-count">This section could not load right now.</p>'; if (window.console) console.error('[FUS]', err); }

  /* ---------------- component: rail (homepage) ---------------- */
  function rail(el) {
    var limit = +attr(el, 'limit', 12), state = 'all';
    loading(el);
    loadCatalog().then(function (cat) {
      var tabs = [['all', 'All'], ['feature', 'Feature'], ['series', 'Series'], ['fiw', 'Faith in War'], ['short', 'Shorts'], ['clip', 'Clips']].filter(function (t) {
        return t[0] === 'all' || present(cat, function (f) { return t[0] === 'series' ? f.collection === 'series' || f.type === 'episode' : t[0] === 'fiw' ? f.collection === 'fiw' : f.type === t[0]; });
      });
      function list() {
        return cat.films.filter(function (f) {
          if (state === 'all') return f.type !== 'clip';
          if (state === 'series') return f.collection === 'series' || f.type === 'episode';
          if (state === 'fiw') return f.collection === 'fiw';
          return f.type === state;
        }).slice(0, limit);
      }
      function draw() {
        el.querySelector('.fus-rail').innerHTML = list().map(function (f) { return card(f); }).join('');
        [].forEach.call(el.querySelectorAll('[data-tab]'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === state ? 'true' : 'false'); });
      }
      el.innerHTML =
        '<div class="fus-head" style="border:0;margin-bottom:24px;padding:0">' +
        '<div><p class="fus-eyebrow">' + esc(attr(el, 'eyebrow', 'The films')) + '</p><h2 class="fus-h2">' + esc(attr(el, 'title', 'Now streaming')) + '</h2></div>' +
        '<div class="fus-tabs" role="tablist" aria-label="Film type">' +
        tabs.map(function (t) { return '<button type="button" role="tab" class="fus-chip" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
        '</div></div><div class="fus-rail"></div>' +
        '<p style="margin:24px 0 0"><a class="fus-btn" href="' + esc(C.watchPath) + '">Browse all films</a></p>';
      el.addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) { state = b.getAttribute('data-tab'); draw(); } });
      draw();
    }).catch(function (e) { failed(el, e); });
  }

  /* ---------------- component: library (watch page) ---------------- */
  function library(el) {
    loading(el, 'Loading films…');
    loadCatalog().then(function (cat) {
      var params = new URLSearchParams(location.search);
      var s = { format: params.get('format') || 'all', topic: params.get('topic') || 'all', coll: params.get('collection') || 'all', q: params.get('q') || '', sort: params.get('sort') || 'new' };
      var formats = [['all', 'All'], ['feature', 'Feature'], ['film', 'Films'], ['episode', 'Episodes'], ['short', 'Shorts'], ['clip', 'Clips']]
        .filter(function (o) { return o[0] === 'all' || present(cat, function (f) { return f.type === o[0]; }); });
      var topics = [['all', 'All']].concat(Object.keys(cat.topics).filter(function (k) { return present(cat, function (f) { return (f.topics || []).indexOf(k) >= 0; }); }).map(function (k) { return [k, cat.topics[k]]; }));
      var colls = [['all', 'All']].concat(Object.keys(cat.collections).filter(function (k) { return present(cat, function (f) { return f.collection === k; }); }).map(function (k) { return [k, cat.collections[k].label]; }));
      function chips(key, opts, label) {
        return '<div class="fus-chips" role="group" aria-label="' + esc(label) + '"><span class="fus-chips__label">' + esc(label) + '</span>' +
          opts.map(function (o) { return '<button type="button" class="fus-chip" data-k="' + key + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>';
      }
      el.innerHTML =
        '<div class="fus-filters"><div class="fus-filters__inner">' +
        '<div class="fus-filters__row"><label class="fus-sr" for="fus-q">Search films</label>' +
        '<input id="fus-q" class="fus-input" type="search" placeholder="Search by title, person or place" value="' + esc(s.q) + '">' +
        '<label class="fus-chips__label" for="fus-sort" style="min-width:0">Sort</label>' +
        '<select id="fus-sort" class="fus-select"><option value="new">Featured</option><option value="date">Newest</option><option value="short">Shortest first</option><option value="az">A to Z</option></select>' +
        '<button type="button" class="fus-btn" data-reset style="margin-left:auto">Clear filters</button></div>' +
        chips('format', formats, 'Format') + chips('topic', topics, 'Topic') + chips('coll', colls, 'Collection') +
        '</div></div><p class="fus-count" aria-live="polite"></p><div class="fus-grid"></div>';
      var grid = el.querySelector('.fus-grid'), count = el.querySelector('.fus-count'), q = el.querySelector('#fus-q'), sort = el.querySelector('#fus-sort');
      sort.value = s.sort;
      function sync() {
        var p = new URLSearchParams();
        if (s.format !== 'all') p.set('format', s.format);
        if (s.topic !== 'all') p.set('topic', s.topic);
        if (s.coll !== 'all') p.set('collection', s.coll);
        if (s.q) p.set('q', s.q);
        if (s.sort !== 'new') p.set('sort', s.sort);
        var qs = p.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
      }
      function draw() {
        var nq = norm(s.q);
        var res = cat.films.filter(function (f) {
          if (f.type === 'clip' && s.format !== 'clip' && s.coll !== 'clips' && !nq) return false;
          return (s.format === 'all' || f.type === s.format) &&
            (s.topic === 'all' || (f.topics || []).indexOf(s.topic) >= 0) &&
            (s.coll === 'all' || f.collection === s.coll) &&
            (!nq || f._search.indexOf(nq) >= 0);
        });
        if (s.sort === 'az') res.sort(function (a, b) { return a.title.localeCompare(b.title); });
        else if (s.sort === 'short') res.sort(function (a, b) { return minutesOf(a) - minutesOf(b); });
        else if (s.sort === 'date') res.sort(function (a, b) { return String(b.published || b.year || '').localeCompare(String(a.published || a.year || '')); });
        var clips = cat.films.filter(function (f) { return f.type === 'clip'; }).length;
        var noun = s.format === 'clip' || s.coll === 'clips' ? ['clip', 'clips'] : ['film', 'films'];
        count.textContent = res.length + ' ' + noun[res.length === 1 ? 0 : 1] + (s.format === 'all' && s.coll === 'all' && !nq && clips ? ' · plus ' + clips + ' clips from the field under Clips' : '');
        grid.innerHTML = res.length ? res.map(function (f) { return card(f); }).join('') : '';
        grid.setAttribute('data-empty', res.length ? 'false' : 'true');
        if (!res.length) grid.innerHTML = '<p class="fus-empty">Nothing matches those filters yet. Try clearing one.</p>';
        [].forEach.call(el.querySelectorAll('[data-k]'), function (b) { b.setAttribute('aria-pressed', s[b.getAttribute('data-k')] === b.getAttribute('data-v') ? 'true' : 'false'); });
        sync();
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-k]');
        if (b) { s[b.getAttribute('data-k')] = b.getAttribute('data-v'); draw(); return; }
        if (e.target.closest('[data-reset]')) { s = { format: 'all', topic: 'all', coll: 'all', q: '', sort: s.sort }; q.value = ''; draw(); }
      });
      var t; q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { s.q = q.value; draw(); }, 120); });
      sort.addEventListener('change', function () { s.sort = sort.value; draw(); });
      draw();
    }).catch(function (e) { failed(el, e); });
  }

  /* ---------------- component: film page ---------------- */
  function film(el) {
    var slug = attr(el, 'slug', ''), vid = new URLSearchParams(location.search).get('v');
    loading(el, 'Loading film…');
    Promise.all([loadCatalog(), getJSON(dataUrl('laurels.json', C.laurelsUrl)).catch(function () { return { items: [] }; }), getJSON(dataUrl('press.json', C.pressUrl)).catch(function () { return { items: [] }; })]).then(function (r) {
      var cat = r[0], laurels = r[1].items || [], press = r[2].items || [];
      var f = (slug && cat.bySlug[slug]) || (vid && cat.byId[vid]) || (vid ? { title: 'Watch', youtubeId: vid, topics: [], watchOn: [] } : null);
      if (!f) { el.innerHTML = '<div class="fus-wrap"><p class="fus-empty">We couldn’t find that film. <a href="' + esc(C.watchPath) + '">See all films</a>.</p></div>'; return; }
      var coll = cat.collections[f.collection] || {};
      var eyebrow = coll.label ? coll.label + (f.episode ? ' · Film ' + f.episode + (f.collection === 'fiw' ? ' of 5' : '') : '') : (TYPE_LABEL[f.type] || 'Film');
      var facts = [f.year, f.runtime, f.language || 'English'].filter(Boolean);
      var mine = laurels.filter(function (l) { return l.film === f.slug; });
      var terms = (f.pressMatch || [f.title]).map(norm);
      var coverage = press.filter(function (p) { var t = norm(p.title + ' ' + (p.note || '')); return terms.some(function (x) { return x && t.indexOf(x) >= 0; }); })
        .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 4);
      var related = cat.films.filter(function (x) { return x !== f && x.collection === f.collection && f.collection; })
        .concat(cat.films.filter(function (x) { return x !== f && x.collection !== f.collection && (x.topics || []).some(function (t) { return (f.topics || []).indexOf(t) >= 0; }); }))
        .concat(cat.films.filter(function (x) { return x !== f && x.type !== 'clip'; })).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 4);
      var shareUrl = location.href.split('#')[0];
      var watch = (f.watchOn || []).map(function (w, i) {
        var url = safeUrl(w.url) || (/youtube/i.test(w.label) && f.youtubeId ? 'https://www.youtube.com/watch?v=' + f.youtubeId : '');
        return url ? '<a class="fus-pill' + (i === 0 ? ' fus-pill--solid' : '') + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(w.label) + '</a>' : '<span class="fus-pill">' + esc(w.label) + '</span>';
      }).join('');
      if (!watch && f.youtubeId) watch = '<a class="fus-pill fus-pill--solid" href="https://www.youtube.com/watch?v=' + esc(f.youtubeId) + '" target="_blank" rel="noopener">YouTube, free</a>';
      var rows = [
        ['Featuring', esc(f.featuring)], ['Directed by', esc(f.director && f.director.charAt(0) !== '[' ? f.director : '')],
        ['Series', coll.label ? '<a href="' + esc(C.watchPath + '?collection=' + f.collection) + '">' + esc(coll.label) + '</a>' : ''],
        ['Topic', esc((f.topicLabels || []).join(' · '))], ['Watch on', watch],
        ['Laurels', mine.length ? mine.map(function (l) { return '<span>' + esc(l.award + ', ' + l.festival + ' ' + l.year) + '</span>'; }).join('') : '', 'stack'],
        ['In the press', coverage.map(function (p) { return '<a href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener">' + esc(p.outlet) + ' · ' + esc(fmtDate(p.date)) + '</a>'; }).join(''), 'stack']
      ].filter(function (x) { return x[1]; });
      var poster = f.image || thumb(f.youtubeId, 'maxresdefault');
      el.innerHTML =
        '<div class="fus-film fus-light">' +
        '<div class="fus-wrap fus-film__top"><div style="display:flex;flex-direction:column;gap:10px">' +
        '<p class="fus-eyebrow"><a href="' + esc(C.watchPath + (f.collection ? '?collection=' + f.collection : '')) + '">' + esc(eyebrow) + '</a></p>' +
        '<h1 class="fus-h1">' + esc(f.title) + '</h1></div>' +
        '<div class="fus-film__facts">' + facts.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div></div>' +
        '<div class="fus-wrap"><div class="fus-player">' +
        (poster ? '<img src="' + esc(poster) + '" alt="" onerror="if(this.src.indexOf(\'maxres\')>0){this.src=this.src.replace(\'maxresdefault\',\'hqdefault\')}else{this.remove()}">' : '') +
        (f.youtubeId ? '<button type="button" class="fus-player__btn" aria-label="Play ' + esc(f.title) + '">' + svgPlay(32) + '</button>' : '<span class="fus-player__fallback">Video coming soon</span>') +
        '</div>' +
        '<div class="fus-film__bar"><div>' + (f.trailerId ? '<button type="button" class="fus-btn" data-play="' + esc(f.trailerId) + '">Trailer</button>' : '') +
        '<a class="fus-btn" href="' + esc(C.watchPath) + '">All films</a></div>' +
        '<div><span class="fus-eyebrow">Share</span>' +
        '<button type="button" class="fus-btn" data-copy>Copy link</button>' +
        '<a class="fus-btn" target="_blank" rel="noopener" href="https://x.com/intent/post?url=' + encodeURIComponent(shareUrl) + '&text=' + encodeURIComponent('Watch ' + f.title + ' free') + '">X</a>' +
        '<a class="fus-btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl) + '">Facebook</a>' +
        '<a class="fus-btn" href="sms:?&body=' + encodeURIComponent('Watch ' + f.title + ': ' + shareUrl) + '">Text a friend</a>' +
        '</div></div></div>' +
        '<div class="fus-wrap fus-film__body"><div class="fus-film__synopsis">' +
        (f.synopsis && f.synopsis.length ? f.synopsis : [f.logline || '']).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '<div class="fus-film__ctas"><a class="fus-btn fus-btn--red" href="' + esc(screeningUrl(attr(el, 'screening-url', ''))) + '">Host a screening of this film</a>' +
        (f.guideUrl ? '<a class="fus-btn" href="' + esc(safeUrl(f.guideUrl)) + '">Discussion guide</a>' : '') + '</div></div>' +
        '<dl class="fus-dl">' + rows.map(function (x) { return '<dt>' + x[0] + '</dt><dd' + (x[2] ? ' class="fus-dl__stack"' : '') + '>' + x[1] + '</dd>'; }).join('') + '</dl></div>' +
        (related.length ? '<div class="fus-section"><div class="fus-wrap"><div class="fus-head"><h2 class="fus-h2">Keep watching</h2><a class="fus-link" href="' + esc(C.watchPath) + '">View all</a></div>' +
          '<div class="fus-grid fus-grid--4">' + related.map(function (x) { return card(x, { noLine: true }); }).join('') + '</div></div></div>' : '') +
        '</div>';
      document.title = f.title + ' · A Faith Under Siege';
      el.addEventListener('click', function (e) {
        var p = e.target.closest('.fus-player__btn, [data-play]');
        if (p) {
          var id = p.getAttribute('data-play') || f.youtubeId, box = el.querySelector('.fus-player');
          box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="' + esc(f.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        var c = e.target.closest('[data-copy]');
        if (c && navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(function () { c.textContent = 'Copied'; setTimeout(function () { c.textContent = 'Copy link'; }, 1600); });
      });
    }).catch(function (e) { failed(el, e); });
  }

  /* ---------------- component: press (full page) ---------------- */
  function pressPage(el) {
    loading(el, 'Loading coverage…');
    getJSON(dataUrl('press.json', C.pressUrl)).then(function (data) {
      var all = (data.items || []).filter(function (p) { return safeUrl(p.url); }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var outlets = {}; all.forEach(function (p) { outlets[norm(p.outlet)] = 1; });
      var years = {}; all.forEach(function (p) { if (p.date) years[p.date.slice(0, 4)] = 1; });
      var s = { type: 'all', year: 'all', lang: 'all', q: '', limit: 24 };
      var types = ['all', 'Article', 'Op-ed', 'TV & video', 'Radio & podcast'];
      el.innerHTML =
        '<div class="fus-wrap"><div class="fus-head" style="border:0;padding:0;margin-bottom:28px"><div><p class="fus-eyebrow">Coverage</p><h1 class="fus-h1">' + esc(attr(el, 'title', 'In the press')) + '</h1></div>' +
        '<div class="fus-counts"><div><b>' + all.length + '</b><span>Features</span></div><div><b>' + Object.keys(outlets).length + '</b><span>Outlets</span></div></div></div>' +
        '<div class="fus-filters"><div class="fus-filters__inner"><div class="fus-filters__row">' +
        '<label class="fus-sr" for="fus-pq">Search coverage</label><input id="fus-pq" class="fus-input" type="search" placeholder="Search outlet or headline">' +
        '<label class="fus-chips__label" for="fus-py" style="min-width:0">Year</label><select id="fus-py" class="fus-select"><option value="all">All years</option>' +
        Object.keys(years).sort().reverse().map(function (y) { return '<option>' + y + '</option>'; }).join('') + '</select>' +
        '<label class="fus-chips__label" for="fus-pl" style="min-width:0">Language</label><select id="fus-pl" class="fus-select"><option value="all">All</option><option value="en">English</option><option value="other">Other languages</option></select></div>' +
        '<div class="fus-chips">' + types.map(function (t) { return '<button type="button" class="fus-chip" data-t="' + esc(t) + '">' + (t === 'all' ? 'All coverage' : esc(t)) + '</button>'; }).join('') + '</div>' +
        '</div></div><p class="fus-count" aria-live="polite"></p><div class="fus-press"></div>' +
        '<button type="button" class="fus-btn fus-btn--solid fus-more">Show more</button></div>';
      var list = el.querySelector('.fus-press'), count = el.querySelector('.fus-count'), more = el.querySelector('.fus-more');
      function draw() {
        var nq = norm(s.q);
        var res = all.filter(function (p) {
          return (s.type === 'all' || p.type === s.type) && (s.year === 'all' || String(p.date).indexOf(s.year) === 0) &&
            (s.lang === 'all' || (s.lang === 'en' ? /^english$/i.test(p.language || 'English') : !/^english$/i.test(p.language || 'English'))) &&
            (!nq || norm(p.outlet + ' ' + p.title).indexOf(nq) >= 0);
        });
        count.textContent = res.length + ' results';
        list.innerHTML = res.slice(0, s.limit).map(pressItem).join('') || '<p class="fus-empty">No coverage matches those filters.</p>';
        more.hidden = res.length <= s.limit;
        [].forEach.call(el.querySelectorAll('[data-t]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-t') === s.type ? 'true' : 'false'); });
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-t]'); if (b) { s.type = b.getAttribute('data-t'); s.limit = 24; draw(); }
        if (e.target.closest('.fus-more')) { s.limit += 24; draw(); }
      });
      var t, q = el.querySelector('#fus-pq');
      q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { s.q = q.value; s.limit = 24; draw(); }, 120); });
      el.querySelector('#fus-py').addEventListener('change', function (e) { s.year = e.target.value; s.limit = 24; draw(); });
      el.querySelector('#fus-pl').addEventListener('change', function (e) { s.lang = e.target.value; s.limit = 24; draw(); });
      draw();
    }).catch(function (e) { failed(el, e); });
  }
  function pressItem(p) {
    return '<a class="fus-press__item" href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener">' +
      '<span class="fus-press__top"><span class="fus-press__outlet">' + esc(p.outlet) + '</span><span class="fus-press__type">' + esc(p.type || '') + '</span></span>' +
      '<span class="fus-press__title">' + esc(p.title) + '</span><span class="fus-date">' + esc(fmtDate(p.date)) + '</span></a>';
  }

  /* ---------------- component: press headlines (homepage) ---------------- */
  function pressHeadlines(el) {
    var limit = +attr(el, 'limit', 6);
    getJSON(dataUrl('press.json', C.pressUrl)).then(function (data) {
      var items = (data.items || []).filter(function (p) { return safeUrl(p.url) && p.type !== 'Radio & podcast' && !/^(interview|colby barrett op-ed|steven on)/i.test(p.title); });
      var pinned = items.filter(function (p) { return p.featured; });
      var rest = items.filter(function (p) { return !p.featured; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      el.innerHTML = '<div class="fus-press">' + pinned.concat(rest).slice(0, limit).map(pressItem).join('') + '</div>';
    }).catch(function (e) { failed(el, e); });
  }
  /* Give every logo a similar visual weight: wide wordmarks get shorter, square marks taller (but not by area alone, which makes square marks look heavy) */
  function fitLogo(img) {
    var ratio = img.naturalWidth / img.naturalHeight; if (!ratio) return;
    var h = 34 * Math.pow(ratio, -0.4) * (+img.getAttribute('data-scale') || 1);
    h = Math.max(15, Math.min(32, h));
    img.style.height = Math.round(h) + 'px'; img.style.width = Math.round(h * ratio) + 'px'; img.style.maxWidth = 'none';
  }
  function pressLogos(el) {
    getJSON(dataUrl('press.json', C.pressUrl)).then(function (data) {
      var logos = data.featuredLogos || (data.featuredOutlets || []).map(function (x) { return { name: x }; });
      var n = (data.items || []).length;
      el.innerHTML = '<div class="fus-logos"><span class="fus-eyebrow">As featured in</span>' +
        logos.map(function (x) {
          return safeUrl(x.logo) ? '<img class="fus-logos__img" src="' + esc(x.logo) + '" alt="' + esc(x.name) + '"' + (x.scale ? ' data-scale="' + (+x.scale || 1) + '"' : '') + ' loading="lazy">'
            : '<span class="fus-logos__name">' + esc(x.name) + '</span>';
        }).join('') +
        '<a class="fus-link fus-logos__more" href="' + esc(C.pressPath) + '">' + (Math.floor(n / 10) * 10) + '+ features</a></div>';
      [].forEach.call(el.querySelectorAll('.fus-logos__img'), function (img) {
        if (img.complete && img.naturalWidth) fitLogo(img); else img.addEventListener('load', function () { fitLogo(img); });
      });
    }).catch(function (e) { failed(el, e); });
  }

  /* ---------------- component: laurels ---------------- */
  var LAUREL_BRANCH = '<svg class="fus-laurel__branch" viewBox="0 -4 50 118" aria-hidden="true"><path d="M43.3 3.6 L40.8 5.4 L38.4 7.3 L36.0 9.4 L33.8 11.5 L31.7 13.8 L29.7 16.2 L27.8 18.6 L26.0 21.2 L24.4 23.9 L22.9 26.6 L21.5 29.4 L20.3 32.2 L19.3 35.2 L18.3 38.1 L17.6 41.1 L17.0 44.2 L16.5 47.3 L16.2 50.3 L16.0 53.4 L16.0 56.6 L16.2 59.7 L16.5 62.7 L17.0 65.8 L17.6 68.9 L18.3 71.9 L19.3 74.8 L20.3 77.8 L21.5 80.6 L22.9 83.4 L24.4 86.1 L26.0 88.8 L27.8 91.4 L29.7 93.8 L31.7 96.2 L33.8 98.5 L36.0 100.6 L38.4 102.7 L40.8 104.6 L43.3 106.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="45.5" cy="6.2" rx="7.2" ry="2.9" transform="rotate(-5 45.5 6.2)" fill="currentColor"/><ellipse cx="41.0" cy="0.5" rx="7.2" ry="2.9" transform="rotate(-73 41.0 0.5)" fill="currentColor"/><ellipse cx="34.7" cy="15.5" rx="7.2" ry="2.9" transform="rotate(-19 34.7 15.5)" fill="currentColor"/><ellipse cx="28.9" cy="11.1" rx="7.2" ry="2.9" transform="rotate(-87 28.9 11.1)" fill="currentColor"/><ellipse cx="26.4" cy="27.1" rx="7.2" ry="2.9" transform="rotate(-33 26.4 27.1)" fill="currentColor"/><ellipse cx="19.7" cy="24.3" rx="7.2" ry="2.9" transform="rotate(-101 19.7 24.3)" fill="currentColor"/><ellipse cx="21.2" cy="40.4" rx="7.2" ry="2.9" transform="rotate(-47 21.2 40.4)" fill="currentColor"/><ellipse cx="14.0" cy="39.3" rx="7.2" ry="2.9" transform="rotate(-115 14.0 39.3)" fill="currentColor"/><ellipse cx="19.4" cy="54.6" rx="7.2" ry="2.9" transform="rotate(-61 19.4 54.6)" fill="currentColor"/><ellipse cx="12.1" cy="55.2" rx="7.2" ry="2.9" transform="rotate(-129 12.1 55.2)" fill="currentColor"/><ellipse cx="21.0" cy="68.8" rx="7.2" ry="2.9" transform="rotate(-75 21.0 68.8)" fill="currentColor"/><ellipse cx="14.2" cy="71.2" rx="7.2" ry="2.9" transform="rotate(-143 14.2 71.2)" fill="currentColor"/><ellipse cx="26.1" cy="82.2" rx="7.2" ry="2.9" transform="rotate(-89 26.1 82.2)" fill="currentColor"/><ellipse cx="20.0" cy="86.1" rx="7.2" ry="2.9" transform="rotate(-157 20.0 86.1)" fill="currentColor"/><ellipse cx="34.2" cy="93.9" rx="7.2" ry="2.9" transform="rotate(-103 34.2 93.9)" fill="currentColor"/><ellipse cx="29.2" cy="99.2" rx="7.2" ry="2.9" transform="rotate(-171 29.2 99.2)" fill="currentColor"/><ellipse cx="48.3" cy="0.2" rx="7" ry="2.8" transform="rotate(-34 48.3 0.2)" fill="currentColor"/></svg>';
  function laurelsBlock(el) {
    var filmSlug = attr(el, 'film', ''), limit = +attr(el, 'limit', 8), only = attr(el, 'awards', '');
    Promise.all([getJSON(dataUrl('laurels.json', C.laurelsUrl)), loadCatalog().catch(function () { return { bySlug: {} }; })]).then(function (r) {
      var rank = { 'Winner': 0, 'Finalist': 1, 'Nominee': 2, 'Official Selection': 3 };
      var items = (r[0].items || []).filter(function (l) { return (!filmSlug || l.film === filmSlug) && (!only || only.split(',').indexOf(l.award) >= 0); })
        .sort(function (a, b) { var ra = a.award in rank ? rank[a.award] : 9, rb = b.award in rank ? rank[b.award] : 9; return ra - rb || String(b.year).localeCompare(String(a.year)); });
      if (attr(el, 'style', '') === 'names') {
        var seen = {}, names = items.filter(function (l) { var k = norm(l.festival); if (seen[k]) return false; seen[k] = 1; return true; }).map(function (l) { return esc(l.festival); });
        el.innerHTML = '<p class="fus-laurel-names">' + names.join('<span aria-hidden="true"> · </span>') + '</p>';
        return;
      }
      var plain = attr(el, 'style', '') === 'simple';
      if (plain) { var once = {}; items = items.filter(function (l) { var k = l.award + norm(l.festival); if (once[k]) return false; once[k] = 1; return true; }); }
      el.innerHTML = '<div class="fus-laurels' + (plain ? ' fus-laurels--simple' : '') + '">' + items.slice(0, limit).map(function (l) {
        var f = r[1].bySlug[l.film];
        return '<div class="fus-laurel' + (l.award === 'Winner' ? ' fus-laurel--win' : '') + '">' + LAUREL_BRANCH +
          '<div class="fus-laurel__text"><span class="fus-laurel__award">' + esc(l.award) + '</span><span class="fus-laurel__fest">' + esc(l.festival) + '</span>' +
          '<span class="fus-laurel__meta">' + esc((f ? f.title + ' · ' : '') + l.year) + '</span></div>' + LAUREL_BRANCH.replace('fus-laurel__branch', 'fus-laurel__branch fus-laurel__branch--r') + '</div>';
      }).join('') + '</div>';
    }).catch(function (e) { failed(el, e); });
  }

  /* ---------------- component: journal (Squarespace blog JSON) ---------------- */
  function journal(el) {
    var path = attr(el, 'collection', C.journalPath), limit = +attr(el, 'limit', 5);
    var src = attr(el, 'source', path + '?format=json');
    loading(el);
    getJSON(src).then(function (data) {
      var items = (data.items || []).slice(0, limit);
      if (!items.length) { el.innerHTML = ''; return; }
      function date(ms) { var d = new Date(ms); return isNaN(d) ? '' : MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
      function tag(it) { return (it.categories && it.categories[0]) || (it.tags && it.tags[0]) || 'News'; }
      function excerpt(it) { var d = document.createElement('div'); d.innerHTML = it.excerpt || ''; return d.textContent.trim().slice(0, 220); }
      var lead = items[0], rest = items.slice(1);
      el.innerHTML = '<div class="fus-journal">' +
        '<a class="fus-journal__lead fus-card" href="' + esc(safeUrl(lead.fullUrl)) + '">' +
        '<div class="fus-card__thumb">' + (lead.assetUrl ? '<img src="' + esc(lead.assetUrl) + '?format=1500w" alt="" loading="lazy">' : '') + '</div>' +
        '<span class="fus-tag">' + esc(tag(lead)) + '</span><h3>' + esc(lead.title) + '</h3>' +
        (excerpt(lead) ? '<p class="fus-card__line" style="font-size:18px">' + esc(excerpt(lead)) + '</p>' : '') +
        '<span class="fus-date">' + esc(date(lead.publishOn)) + '</span></a>' +
        '<div class="fus-journal__list">' + rest.map(function (it) {
          return '<a class="fus-journal__item" href="' + esc(safeUrl(it.fullUrl)) + '"><span class="fus-tag">' + esc(tag(it)) + '</span><h3>' + esc(it.title) + '</h3><span class="fus-date">' + esc(date(it.publishOn)) + '</span></a>';
        }).join('') + '</div></div>';
    }).catch(function (e) { failed(el, e); });
  }
  /* Category bar for the blog page: marks the active category */
  function journalFilter(el) {
    var cur = new URLSearchParams(location.search).get('category') || '';
    [].forEach.call(el.querySelectorAll('a'), function (a) {
      var c = new URL(a.href, location.href).searchParams.get('category') || '';
      if (c === cur) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---------------- component: social embeds (lazy) ---------------- */
  function loadScript(src) { if (document.querySelector('script[src="' + src + '"]')) return; var s = document.createElement('script'); s.async = true; s.src = src; document.body.appendChild(s); }
  function social(el) {
    var S = C.social, cards = [];
    var sec = el.closest('.page-section') || el.closest('section') || document;
    var slot = el.querySelector('[data-fus-slot="instagram"]') || sec.querySelector('[class*="sqs-block-instagram"]');
    if (S.instagram) cards.push(['Instagram', '@' + S.instagram, 'https://www.instagram.com/' + S.instagram + '/', slot ? 'slot' : 'link']);
    if (S.x) cards.push(['X', '@' + S.x, 'https://x.com/' + S.x, 'x']);
    if (S.facebook) cards.push(['Facebook', S.facebook, 'https://www.facebook.com/' + S.facebook, 'fb']);
    if (S.tiktok) cards.push(['TikTok', '@' + S.tiktok, 'https://www.tiktok.com/@' + S.tiktok, 'tt']);
    var wrap = document.createElement('div'); wrap.className = 'fus-social';
    wrap.innerHTML = cards.map(function (c) {
      var body = '';
      if (c[3] === 'x') body = '<a class="twitter-timeline" data-theme="light" data-chrome="noheader nofooter" data-height="460" href="https://twitter.com/' + esc(S.x) + '">Posts by @' + esc(S.x) + '</a>';
      if (c[3] === 'fb') body = '<iframe title="Facebook posts" loading="lazy" height="460" src="https://www.facebook.com/plugins/page.php?href=' + encodeURIComponent(c[2]) + '&tabs=timeline&width=340&height=460&small_header=true&hide_cover=true&show_facepile=false"></iframe>';
      if (c[3] === 'tt') body = '<blockquote class="tiktok-embed" cite="' + esc(c[2]) + '" data-unique-id="' + esc(S.tiktok) + '" data-embed-type="creator" style="max-width:100%;min-width:288px;margin:0"><section><a target="_blank" href="' + esc(c[2]) + '">@' + esc(S.tiktok) + '</a></section></blockquote>';
      if (c[3] === 'link') body = '<p style="padding:24px;margin:0">Add Squarespace’s Instagram block here (see README), or follow us on Instagram.</p>';
      return '<div class="fus-social__card" data-net="' + c[3] + '"><div class="fus-social__head">' + c[0] + '<span>' + esc(c[1]) + '</span></div><div class="fus-social__body">' + body + '</div>' +
        '<a class="fus-link fus-social__foot" href="' + esc(c[2]) + '" target="_blank" rel="noopener">Follow on ' + c[0] + '</a></div>';
    }).join('');
    el.innerHTML = ''; el.appendChild(wrap);
    if (slot) { var ig = wrap.querySelector('[data-net="slot"] .fus-social__body'); if (ig) ig.appendChild(slot); }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); go(); } }, { rootMargin: '400px' }) : null;
    function go() { if (S.x) loadScript('https://platform.twitter.com/widgets.js'); if (S.tiktok) loadScript('https://www.tiktok.com/embed.js'); }
    if (io) io.observe(el); else go();
  }

  /* ---------------- boot ---------------- */
  var COMPONENTS = { rail: rail, library: library, film: film, press: pressPage, 'press-headlines': pressHeadlines, 'press-logos': pressLogos, laurels: laurelsBlock, journal: journal, 'journal-filter': journalFilter, social: social };
  // A logo or key-art image that fails to load falls back to text / plain panel instead of a broken icon
  document.addEventListener('error', function (e) {
    var t = e.target; if (!t || t.tagName !== 'IMG') return;
    if (t.classList.contains('fus-logos__img')) { var s = document.createElement('span'); s.className = 'fus-logos__name'; s.textContent = t.alt; t.replaceWith(s); }
    else if (t.closest && t.closest('.fus')) t.style.display = 'none';
  }, true);
  function boot(root) {
    document.documentElement.classList.toggle('fus-on', isNewPage());
    // Blog list: only page one gets the big lead story
    if (document.body) document.body.classList.toggle('fus-blog-paged', /[?&]offset=/.test(location.search));
    [].forEach.call((root || document).querySelectorAll('[data-fus]'), function (el) {
      if (el.__fus) return; el.__fus = 1;
      el.classList.add('fus');
      var fn = COMPONENTS[el.getAttribute('data-fus')];
      if (fn) { try { fn(el); } catch (e) { failed(el, e); } }
    });
    stagingLinks(root);
  }
  window.FUS = { boot: boot, loadCatalog: loadCatalog, config: C };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(); }); else boot();
  window.addEventListener('mercury:load', function () { boot(); }); // Squarespace AJAX page loads
})();
