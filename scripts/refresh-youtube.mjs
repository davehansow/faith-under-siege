// Refreshes data/youtube.json from the YouTube Data API.
// Run by .github/workflows/refresh-youtube.yml every day, or locally:
//   YT_API_KEY=... node scripts/refresh-youtube.mjs
// The key is referrer-restricted to the website, so requests send that Referer.
import { writeFile, readFile } from 'node:fs/promises';

const KEY = process.env.YT_API_KEY;
const REFERER = process.env.YT_REFERER || 'https://faithundersiege.com/';
const CHANNEL = process.env.YT_CHANNEL || 'UCx-2kTPvk4Z505gS2ZEch-A';
const OUT = new URL('../data/youtube.json', import.meta.url);
if (!KEY) { console.error('YT_API_KEY is not set'); process.exit(1); }

async function yt(path, params) {
  const q = new URLSearchParams({ ...params, key: KEY });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${q}`, { headers: { Referer: REFERER } });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function playlistItems(playlistId) {
  const out = [];
  let pageToken;
  do {
    const r = await yt('playlistItems', { part: 'snippet,contentDetails', playlistId, maxResults: 50, ...(pageToken ? { pageToken } : {}) });
    out.push(...r.items);
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}
const toSec = (d) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ''); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };

const uploads = CHANNEL.replace(/^UC/, 'UU');
const lists = (await yt('playlists', { part: 'snippet', channelId: CHANNEL, maxResults: 50 })).items.map((p) => ({ id: p.id, title: p.snippet.title }));
const videos = new Map();
for (const pl of [{ id: uploads, title: 'Uploads' }, ...lists]) {
  for (const it of await playlistItems(pl.id)) {
    const s = it.snippet, id = it.contentDetails.videoId;
    if (!id || s.title === 'Private video' || s.title === 'Deleted video') continue;
    const v = videos.get(id) || {
      id, title: s.title, description: (s.description || '').slice(0, 600),
      published: (it.contentDetails.videoPublishedAt || s.publishedAt || '').slice(0, 10), playlist: pl.id, playlists: []
    };
    if (pl.id !== uploads) { v.playlist = pl.id; v.playlists.push(pl.title); }
    videos.set(id, v);
  }
}
const ids = [...videos.keys()];
let totalViews = 0;
for (let i = 0; i < ids.length; i += 50) {
  const r = await yt('videos', { part: 'contentDetails,statistics', id: ids.slice(i, i + 50).join(',') });
  for (const it of r.items) {
    const v = videos.get(it.id);
    v.seconds = toSec(it.contentDetails.duration);
    v.views = +(it.statistics?.viewCount || 0);
    totalViews += v.views;
  }
}
const list = [...videos.values()].sort((a, b) => b.published.localeCompare(a.published));
const next = { channelId: CHANNEL, playlists: lists, totalViews, count: list.length, videos: list };
let prev = '';
try { prev = await readFile(OUT, 'utf8'); } catch {}
const body = JSON.stringify({ updated: new Date().toISOString().slice(0, 10), ...next }) + '\n';
if (prev && JSON.stringify({ ...JSON.parse(prev), updated: 0 }) === JSON.stringify({ updated: 0, ...next })) { console.log('No changes'); process.exit(0); }
await writeFile(OUT, body);
console.log(`Wrote ${list.length} videos, ${totalViews} total views`);
