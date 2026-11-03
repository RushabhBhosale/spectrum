# One More Episode

Everything I've watched: an opening trailer, my perfect tens as graded cards on a table, a flight through the shows I rated nine and above, every title full screen in colour order, and the full collection with my ratings and quotes.

The site's name lives in `lib/site.ts`.

## Run it

```bash
npm install
npm run dev
```

The site opens on http://localhost:3200.

## Add titles

Use `/studio` to add titles. Before MongoDB is configured you can also add a line to `data/titles.json`:

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

This needs a free key from https://www.themoviedb.org/settings/api in `.env` or `.env.local` (see `.env.example`). It only processes new titles; add `-- --force` to redo them all. The JSON files are the starting data for an empty database. Once MongoDB has been initialised, use Studio to make changes; running this script does not update the database.

Check the printed `title -> TMDB name` lines. Search takes the best-known match, so a short title can land on the wrong show. Add its `tmdbId`, delete its entry from `data/generated.json`, and run the script again.

Until a title has been processed, it uses a placeholder palette and the page says so.

## How the colours work

`scripts/palette.mjs` reads up to eight of a title's most-voted stills, or its poster if it has none. It ignores letterbox black and blown-out white, clusters the remaining pixels, and keeps seven distinct colours, ordered by how much of the image they cover with a boost for vivid ones.

## How hours work

With `episodes`, hours are episodes × runtime. Without it, TMDB's full episode count is used, so set `episodes` or `hours` on anything unfinished. Before TMDB runs, hours use a typical episode length for the category.

## Studio

`/studio` is a private page for adding series and quotes. Set `ADMIN_PASSWORD`, `TMDB_API_KEY` and `MONGODB_URI` in `.env.local`. Optionally set `MONGODB_DB` to choose a database name (the default is `spectrum`). The database user needs read and write access and Atlas must allow connections from the deployment. With no MongoDB URI, local Studio saves to the `data` files instead.

Set the same variables for the Vercel Production environment and redeploy. The initial collection comes from the bundled JSON files; the first successful Studio save writes it to MongoDB. Later changes appear on the site without a redeployment. Keep database credentials private and back up the database regularly.

## Good to know

Stop `npm run dev` before running `npm run build`. They share the `.next` folder, and a running dev page can stop loading until the dev server restarts.

## Deploy

Import the repo into Vercel with the default Next.js settings and configure the Studio variables above.

## Test

```bash
npm test
```
