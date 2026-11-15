# Memonest mobile API

The tracker continues to own its MongoDB database and existing `collection` snapshot. No collection data is written to Memonest's backend. Studio and the mobile API share `lib/title-mutations.ts`; Studio remains protected by its existing HTTP-only cookie.

## Setup

Deploy this repository to the existing https://movi6s.vercel.app/ deployment with its existing server-only `ADMIN_PASSWORD`, `MONGODB_URI`, and optional `MONGODB_DB` (default `spectrum`). Mobile authorization deliberately does not support the development JSON-file store. The existing MongoDB user needs read/write access plus index creation for a new `mobile_grants` collection. No additional shared API secret is required or shipped in Memonest.

Rebuild Memonest with its added Expo Crypto module and existing `memonest` URL scheme. In Home → Personal → Movies & Shows, choose Connect. Authorization occurs in the system browser, not the embedded collection or a native password form.

## Authorization

`GET /mobile/connect?code_challenge=...&code_challenge_method=S256&state=...&redirect_uri=memonest%3A%2F%2Fmovies` validates the exact callback, challenge and state formats. Sign in through the existing Studio flow and explicitly approve access to this Studio's single personal collection. Approval issues a random, hashed, one-use code expiring in two minutes. The return URL contains only code/state, never a device credential.

`POST /api/mobile/token` exchanges JSON `{code, codeVerifier}`. Only the matching S256 verifier can atomically consume the code. The response contains `{accessToken, connectionId, expiresAt, collectionId:"personal", scopes}`. The app saves this scoped 30-day credential in SecureStore under its signed-in Memonest account; it is not embedded in source, injected into a WebView, or sent to Memonest services. No refresh credential or admin password is copied to the phone.

`mobile_grants` stores only secret hashes, challenge (codes only), timestamps, scopes and a password-version fingerprint. Expiration is checked on every request independently of MongoDB TTL cleanup. Rotating the Studio password invalidates existing mobile grants. TTL and unique indexes are created lazily on first use.

Revocation is available in Studio → Connected apps (`/mobile/connections`) and by device disconnection. Browser consent and revocation use authenticated Next server actions, including Next's origin/CSRF protections. Data APIs accept only bearer credentials and do not fall back to Studio cookies.

## HTTP API, version 1

| Route | Access | Behavior |
| --- | --- | --- |
| `GET /api/mobile/capabilities` | Public; no personal data | Reports version, configuration readiness and supported scopes |
| `POST /api/mobile/token` | One-use code + matching verifier | Issues a scoped device session |
| `GET /api/mobile/titles` | `library:read` | Returns minimal actual title rows and sync time |
| `PATCH /api/mobile/titles` | `titles:update` | Applies reviewed status/rating changes only |
| `DELETE /api/mobile/session` | Current device session | Revokes the calling device |

Authenticated requests send `Authorization: Bearer <device credential>` directly to the tracker over HTTPS. Responses use `Cache-Control: no-store`. JSON request bodies are limited to 4 KB. Errors expose user-facing messages, not connection details or database secrets. There are no anonymous collection reads/writes, public write endpoints, client database queries, or hardcoded action IDs.

A title row is `{id,title,type,kind,year,rating,status,revision}`. `id` is the existing `entryKey` (`category:title`), not the public page's generated slug. It identifies a title exactly until renamed in Studio; a rename invalidates the old ID rather than updating a different title. `revision` hashes the entry and its generated metadata so a review cannot overwrite subsequent edits. Omitted stored status is projected as `Finished`.

PATCH accepts exactly `{id, expectedRevision, changes:{status?, rating?}}`. Status is one of `Watching`, `Finished`, `On hold`, `Dropped`, `Unfinished`; rating is a finite number 0–10 or null to clear. It cannot add, delete, rename, recategorize, or change quotes. A changed/deleted title returns 409/404. The existing atomic collection-version check also rejects concurrent website/API writes. Finishing follows Studio's implicit Finished convention, completes known episode totals, and updates generated hours. The phone review card explains that consequence.

Only after persistence succeeds does PATCH return `{title,savedAt}` with confirmed values. The mobile client checks those values before reporting success. There is no offline write queue; an interrupted response is unconfirmed and the user must refresh before retrying.

## Cache and model boundary

The phone caches only the projected rows, connection ID and last-sync time, scoped to the current Memonest account. No full collection snapshots, images, quotes or overviews enter the assistant cache. Offline answers disclose their date, expire after seven days, and require a locally unexpired device session. Auth failures remove local credentials/cache. An offline phone learns about remote revocation on its next server check. Disconnect/sign-out clears local state and attempts immediate server revocation; the website can revoke a lost/offline device.

Movie requests are routed before Memonest's finance/memory planner. The existing on-device speech recognizer handles voice. Common viewing commands are parsed deterministically; broader wording uses the local model to emit a validated declarative plan. The model never receives credentials or executes requests. The app matches titles against authenticated tracker rows, asks for clarification if needed, displays a review, then submits only an approved snapshot.

## Validation

Run `npm test` and `npx tsc --noEmit --incremental false`. Production build: `NEXT_DIST_DIR=.next-verify npm run build` (keeps the usual dev build separate). Tests exercise actual API handlers with an isolated fake database; they do not mutate the live collection. Coverage includes S256/callback validation, code replay, verifier matching, hashed sessions, revocation, expiry/password rotation, anonymous access denial, immutable fields, metadata preservation, Finished episode/hour behavior and stale review rejection.

Local builds and tests do not deploy these routes. After deployment, verify capabilities reports `version:1` and `available:true`, anonymous `/api/mobile/titles` returns 401, and then connect the rebuilt phone through browser consent. Test a known title's review/cancel/save flow and voice input on the actual device. This implementation does not claim those live/device steps have been completed.

## Changed files

- `app/api/mobile/{capabilities,token,titles,session}/route.ts`: supported mobile HTTP surface.
- `app/mobile/connect/page.tsx`, `app/mobile/connections/page.tsx`: browser consent and revocation.
- `lib/mobile-auth.ts`, `scripts/mobile-security.mjs`: scoped sessions, PKCE and validation.
- `lib/mobile-titles.ts`: minimal projections and revision checks.
- `lib/title-mutations.ts`, `app/studio/actions.ts`: shared website/API title updates.
- `lib/store.ts`: shares the existing tracker database connection with device grants.
- `components/Studio.tsx`: Connected apps link.
- `scripts/mobile-api.test.mjs`: isolated authorization/API regressions.


## Episode counts and season/episode progress

The native app and Studio now retain manual cumulative counts and add last-watched season/episode entry. Entry `episodes` permits zero; `progress:{season,episode}` records a known position. `Generated.episodeGuide` contains regular numbered episodes grouped by season and is reused for 24 hours. It excludes season-zero/unnumbered specials and deduplicates catalog rows.

`GET /api/mobile/episodes?id=<entryKey>` requires `library:read` and returns `{seasons:[{season,episodes:[numbers]}],totalEpisodes,source,fetchedAt}` for one actual saved title. Catalog access is server-side: existing TVmaze IDs or an unambiguous exact name/year match, then known TMDB IDs with the existing optional server-only `TMDB_API_KEY` as fallback. Lookup failure leaves manual count entry usable.

Mobile title rows add nullable `episodes`, `totalEpisodes` and `progress`. PATCH `changes` now permits a nonnegative whole `episodes` count and/or positive integer `progress:{season,episode}`. A progress save recalculates the cumulative count on the server and checks any reviewed client total. Invalid/missing episodes return 400; a changed calculated count returns 409. Manual count changes clear old season markers. Counts above a known total, film episode updates and partial progress with Finished status are rejected. Finished still completes the catalog total and updates hours; zero watched episodes produce zero calculated hours.

Studio uses the same resolver and mutation rules; both input methods remain available. The website displays the calculated total before a season/episode save. New files: `lib/episode-progress.ts`, `lib/episode-guide.ts`, `components/EpisodeProgress.tsx`, `app/api/mobile/episodes/route.ts`, `scripts/episode-progress.test.mjs`. Existing model, editor, TVmaze enrichment, mobile projection/validation, consent text and API regression tests were extended. No existing watch history is migrated or deleted. Redeploy to enable the new route and fields.
