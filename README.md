# A Faith Under Siege · Squarespace build kit

This kit turns the approved mockup into the live faithundersiege.com on **Squarespace 7.1**. Squarespace stays in charge of pages, navigation, the blog and the footer, so the team keeps editing those as usual. The custom pieces (film library, film pages, press page, journal feed, laurels, social wall) are small code blocks that read three data files.

Custom code needs a Squarespace plan that allows it: **Core or higher** (the old Business plan or above). Personal/Basic plans can't run code blocks or code injection.

## What's in here

| Path | What it is | Where it goes |
|---|---|---|
| `css/fus.css` | All styles: fonts, header, buttons, blog, every component | Website › Website Tools › **Custom CSS** |
| `snippets/header-injection.html` | Fonts and the site settings (`FUS_CONFIG`) | Website › Website Tools › **Code Injection › Header** |
| `snippets/footer-injection.html` | Loads the site script | **Code Injection › Footer** |
| `js/fus.js` | The site script (no dependencies) | Hosted file, or pasted into the footer injection |
| `data/films.json` | Curated film catalog: titles, loglines, topics, where to watch | Hosted file |
| `data/press.json` | 232 press items with links, typed and dated | Hosted file |
| `data/laurels.json` | 25 festival honors | Hosted file |
| `data/youtube.json` | Snapshot of every channel video, refreshed daily | Hosted file (auto) |
| `scripts/refresh-youtube.mjs`, `.github/workflows/` | Daily YouTube refresh | GitHub only |
| `blocks/*.html` | One snippet per Code Block, numbered in page order | Code Blocks on each page |
| `preview/` | Local test pages (open with any static server) | Not uploaded |

## Building beside the live site (staging)

Nothing here replaces the current pages until you decide to launch. The header injection sets `stagingPrefix: '/new'`. While it's set:
- Only pages whose URL starts with `/new` get the new look. Every other page, blog posts included, looks exactly as it does today.
- Build the new pages at `/new` (home), `/new/watch`, `/new/watch/film`, `/new/watch/<slug>` and `/new/press`, in the Not Linked section so visitors don't see them.
- Links inside the new blocks point at the `/new` pages automatically.

**Launch day:** set `stagingPrefix: ''` in the header injection, remove `new/` from each new page's URL slug (rename or disable the old pages first so the slugs are free), set the new home page as the homepage, move the pages into the main navigation, and add the redirects below.

## Step 1 · Decide where the script and data live

**Option A, recommended: a GitHub repo served by jsDelivr (free).** Put `js/` and `data/` in a public repo. Files are then at
`https://cdn.jsdelivr.net/gh/<user>/<repo>@main/js/fus.js` and `.../data/`. Updating press or films is a commit, not a Squarespace edit, and a scheduled GitHub Action can refresh the YouTube catalog daily without using any API quota on visitors.

**Option B, all inside Squarespace.** Paste the whole of `js/fus.js` into the footer injection between `<script>` and `</script>`. For data, upload each JSON file through any text link (Link › File › Upload). Squarespace gives a `/s/films.json` style URL. Put those three URLs in `filmsUrl`, `pressUrl` and `laurelsUrl` in the header injection. Updating data means re-uploading a file.

## Step 2 · Site styles (Squarespace settings, no code)

1. **Site Styles › Colors:** use a dark theme for most sections (background `#0A0A0A`, text `#F5F3EF`, accent `#E3242B`). Add a light theme (background `#FFFFFF`, text `#0A0A0A`) for film, press and impact sections.
2. **Site Styles › Fonts:** anything. `fus.css` sets Inter Tight everywhere.
3. **Header:** logo or site title on the left, nav on the right: Watch, Series (`/watch?collection=fiw`), Impact, Press, Journal, About. Turn on the header button: "Host a screening" → `/host-a-screening`.

## Step 3 · Paste the global code

1. `css/fus.css` → Custom CSS. Paste it below any CSS you already have. While staging is on, its site-wide rules only touch `/new` pages; the component styles only touch the new blocks.
2. `snippets/header-injection.html` → Code Injection › Header. `dataBase` already points at the GitHub repo. Fill in `social.tiktok`, and check `journalPath` matches your blog's URL (it's set to `/news-and-updates`).
3. `snippets/footer-injection.html` → Code Injection › Footer, with the script URL (Option A) or the pasted script (Option B).

## Step 4 · YouTube (automatic)

`data/youtube.json` holds every public video on the channel: 417 at last count, with titles, runtimes and view counts. A GitHub Action (`.github/workflows/refresh-youtube.yml`) rebuilds it every morning, so new uploads show up on the site within a day without touching Squarespace.

One-time setup in the repo: Settings › Secrets and variables › Actions › **New repository secret** `YT_API_KEY` = your YouTube Data API key. You can also run it on demand from the Actions tab ("Refresh YouTube catalog" › Run workflow).

How videos are sorted:
- Videos listed in `films.json` (by `youtubeId`) get their curated title, logline, credits and page.
- Videos 3 minutes or shorter become **Clips** (your daily shorts). They have their own filter and rail tab and stay out of the main grid.
- Other new videos land in the collection their playlist maps to (`playlists` in the header injection), or as Shorts/Films by length.
- `hide` in `films.json` keeps duplicates and trailers off the grid. Trailers play from each film page's Trailer button.

`youtubeApiKey` in the header injection is an optional fallback that the browser uses only if `youtube.json` can't load.

## Step 5 · Build the pages

Each code block goes in its own **full-width section** (Edit section › Section height: Small; Content width: Full). Paste the snippet into a **Code Block** with "Display Source" off.

**Home (`/`):** blocks `01` to `09` in order.
- `01` hero: replace the image URL with your banner (upload it to any image block once, then copy its address), or use a muted MP4 loop.
- `04` series: replace the two key-art images.
- `05` journal: change `/journal` if your blog uses another URL. It reads the blog automatically.
- `06` impact: fill in `[X]` screenings (YouTube views are already set to 6.4M+). Laurels come from `laurels.json`.
- `08` social: in the **same section**, also add Squarespace's **Instagram block** (connected to @faithundersiege). The script moves it into the Instagram card. X and Facebook embed for free. TikTok shows once its handle is set.
- Use a light section color for `06` and `07`.

**Watch (`/watch`):** block `10`. Filters are links you can share, for example `/watch?collection=fiw` or `/watch?topic=children`.

**Film pages (`/watch/<slug>`):** block `11`, one page per film. Set `data-slug` to the film's slug in `films.json`. Use a white section. Pages to create: `a-faith-under-siege`, `the-stolen-children`, `even-in-the-ruins`, `safe-ground`, `soldiers-of-light`, `no-surrender`, `no-priests-left` (and any short you want a page for).
**Catch-all player (`/watch/film`):** block `11` with `data-slug=""`. It plays any video at `/watch/film?v=<YouTubeID>`, so new uploads get a page automatically. Make it a not-linked page.

**Press (`/press`):** block `12`, white section.

**Journal (`/journal`):** keep the native blog. Put block `13` above it for the category bar. Use these categories on posts: News, In the Press, From the Front, Behind the Films, Reports. Category filtering is Squarespace's own (`/journal?category=News`).

**Redirects (Settings › Advanced › URL Mappings)** so old links keep working:
```
/feature-film -> /watch/a-faith-under-siege 301
/orthodox-under-fire -> /watch?q=orthodox 301
/jewish-persecution -> /watch?topic=jewish 301
/behind-scenes -> /watch?topic=bts 301
/drones -> /watch?q=drones 301
/updates-front -> /watch?topic=front 301
/putin-christians -> /watch?q=putin 301
/dont-forget -> /watch?q=forget 301
/in-the-press -> /press 301
/news-and-updates -> /journal 301
/news-and-updates/[slug] -> /journal/[slug] 301
```
(Only add the blog mappings if you move the blog to `/journal`.)

## Keeping it up to date

- **New film or episode on YouTube:** nothing to do; it appears after the next daily refresh. To give it a curated page (logline, credits, where to watch), add an entry to `films.json`.
- **New press hit:** add a line to `press.json` (`date`, `outlet`, `title`, `type`, `url`). Add `"featured": true` to pin it on the homepage.
- **New laurel:** add a line to `laurels.json`.
- **Blog posts:** in Squarespace as always. They appear on the homepage automatically.

## Testing locally

From this folder run `python3 -m http.server 8000`, then open `http://localhost:8000/preview/index.html` (also `watch.html`, `film.html`, `press.html`). The preview uses a stand-in header and a sample blog feed.

## Placeholders still to fill

Hero and series images, real logo, `[X]` screenings number, directors, the Angel series episodes (not found on the YouTube channel yet), TikTok handle, and a few press rows without headlines (for example "Colby Barrett op-ed").
