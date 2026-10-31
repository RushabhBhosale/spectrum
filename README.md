# Spectrum

Everything I've watched, as one wall of colour. Each title is a stripe made from its own film stills, and a stripe's height is my rating.

## Run it

```bash
npm install
npm run dev
```

The site opens on http://localhost:3200.

## Add titles

Add a line to `data/titles.json`:

```json
{ "title": "Frieren: Beyond Journey's End", "type": "Anime", "rating": 9, "episodes": 28 }
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | Yes | Name as it appears on TMDB |
| `type` | Yes | `Anime`, `K-drama`, `C-drama`, `J-drama`, `Web series` or `Hindi series` |
| `rating` | Yes | 0 to 10, or `null` if unrated. Unrated titles are short stripes and don't count towards the average |
| `episodes` | No | Episodes watched, used to work out hours |
| `status` | No | Leave out when finished. Otherwise `Dropped`, `On hold`, `Unfinished`, `Watching` or any short note |
| `review` | No | Shown like a subtitle |
| `hours` | No | Replaces the estimate |
| `colours` | No | Seven hex colours, replacing the ones from TMDB |
| `tmdbKind` | No | `movie` for a film, otherwise it's treated as a show |
| `tmdbId` | No | Fixes a wrong match |

Then fetch colours, release years, hours and posters:

```bash
npm run colours
```

This needs a free key from https://www.themoviedb.org/settings/api in `.env` or `.env.local` (see `.env.example`). It only processes new titles; add `-- --force` to redo them all. Commit `data/generated.json`, because the site reads colours from that file and never calls TMDB while running.

Check the printed `title -> TMDB name` lines. Search takes the best-known match, so a short title can land on the wrong show. Add its `tmdbId`, delete its entry from `data/generated.json`, and run the script again.

Until a title has been processed, it uses a placeholder palette and the page says so.

## How the colours work

`scripts/palette.mjs` reads up to eight of a title's most-voted stills, or its poster if it has none. It ignores letterbox black and blown-out white, clusters the remaining pixels, and keeps seven distinct colours, ordered by how much of the image they cover with a boost for vivid ones.

## How hours work

With `episodes`, hours are episodes × runtime. Without it, TMDB's full episode count is used, so set `episodes` or `hours` on anything unfinished. Before TMDB runs, hours use a typical episode length for the category.

## Studio

`/studio` is a private page for adding series and quotes. Add `ADMIN_PASSWORD` to `.env` to turn it on. Locally it saves to the `data` files.

On Vercel, set `ADMIN_PASSWORD`, `TMDB_API_KEY`, `GITHUB_TOKEN` (with contents write access to this repo) and `GITHUB_REPO` (`owner/name`). Saves become a commit, and the site redeploys in about a minute.

## Good to know

Stop `npm run dev` before running `npm run build`. They share the `.next` folder, and a running dev page can stop loading until the dev server restarts.

## Deploy

Import the repo into Vercel with the default Next.js settings. No environment variables are needed.

## Test

```bash
npm test
```
