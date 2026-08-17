# StepBy — UI4

Front end for the StepBy barrier-free walking map. **English, Hindi and Japanese.**

A rebuild of the UI1 design as a separate candidate, so `UI1/` stays exactly
as it was and the two can be compared side by side. Published at
`/StepBy/UI4/`.

No build step: what is in this folder is what ships — GitHub Pages serves it
as-is.

---

## Why this is a rebuild rather than a patch

`UI1/` translates itself by loading the Google Translate widget and
machine-translating the whole page. On the live site that produced:

- **zero translated words in any language** — the cookie was set, the widget
  reported `translated-ltr`, the language `<select>` held the right value, and
  the text stayed Japanese;
- `<html lang>` rewritten to `hi` while the content was still Japanese, so a
  screen reader read Japanese aloud with a Hindi voice;
- the widget's own language list injected into every page's accessibility tree
  (hidden at `left:-9999px`, which hides it from eyes but not from assistive
  technology);
- a reload loop risk whenever the `googtrans` cookie could not be written
  (iOS private mode, ITP), because the code reloaded until cookie and
  preference agreed;
- a language picker built from ~100 lines of dead code — the flag that enabled
  it was never set anywhere in the repository.

None of that is fixable while the translation layer is a third-party widget
operating on rendered DOM. This build replaces it with a dictionary.

---

## How translation works now

`i18n/dict.js` holds all three languages in one synchronous file (190 keys each).
It is loaded in `<head>`, so the strings are in place before the first paint —
no network request, no cookie, no reload, no flash.

```html
<h1 data-i18n="map.title">Map</h1>
<input data-i18n-attr="placeholder:post.notesPlaceholder">
<span data-i18n="feed.count" data-i18n-n="12">12 reports</span>
```

English is also written inline in the markup. An English user therefore sees
final copy on the first frame, and a missing key degrades to readable English
instead of a raw key name.

Changing language dispatches `stepby:langchange`. `js/ui.js` re-renders the app
bar, bottom navigation and document title; each screen re-renders its own
dynamic content. **Nothing reloads** — scroll position, form state and keyboard
focus all survive.

Backend tags carry a stable `code`; `tag.<code>` keys translate them, and an
unknown code falls back to the label the API sent, so a tag added server-side
still renders instead of disappearing.

### Adding another language

1. add an entry to `LANGS` in `js/config.js`
2. add a dictionary to `i18n/dict.js`
3. `npm run check:i18n`

That is all — the settings screen builds its list from `LANGS`. Nothing else
hard-codes a language list. (Japanese was added exactly this way after the
first two, and touched two files.)

On first run the device language is used when it is one we support, otherwise
English. After that the user's choice in Settings wins.

---

## Checks

```bash
npm install
npm run check
```

- `npm run lint` — ESLint. The old config declared browser globals by hand and
  missed `Event`, `Headers`, `atob`, `AbortController`, `self`, `caches`…, so it
  reported 19 phantom errors and nobody ran it. This one uses the `globals`
  package and splits browser from service-worker scope. **Currently 0 errors,
  0 warnings.**
- `npm run check:i18n` — verifies every `data-i18n` key exists, that every
  language defines the same keys, that `{placeholders}` survive translation,
  and reports keys nobody uses. Exits non-zero on a real problem, so it can gate
  a deploy. **Currently clean.**

---

## Layout

```
index.html            safety gate, then routes to /login/ or /map/
offline.html          service-worker fallback
manifest.webmanifest
sw.js

css/    tokens.css  base.css  components.css  fonts.css (generated)
js/     config.js  prefs.js  i18n.js  auth.js  api.js  geo.js  ui.js  icons.js (generated)
i18n/   dict.js
assets/ icons + self-hosted Noto Sans
vendor/ leaflet 1.9.4 (self-hosted)
tools/  build-icons.py  check-i18n.mjs

login/  onboarding/  map/  feed/  detail/  post/  mine/
profile/  profile-edit/  ranking/  help/  settings/
```

Twelve screens, down from seventeen:

| was | now |
| --- | --- |
| `posts/` `recent/` `popular/` `recommend/` — four 28 KB near-copies | `feed/` with a sort control |
| `post_road/` + `edit_post/` | `post/`, `?id=` switches to edit |
| `settings/display.html` + `settings/language.html` | `settings/` |

Those four list pages had already diverged: only `posts/` had the tag-rendering
fix, so the other three printed `undefined` for string tags. Shared chrome now
lives in `js/ui.js`.

### Navigation

Header only, exactly as the original: **map · settings dropdown · profile**,
with the current screen highlighted. **There is no bottom navigation bar** —
`UI1/` has none on any screen (the `<!-- Bottom Nav -->` comments are
still in its markup with the markup underneath deliberately deleted), and one
was briefly added here by mistake.

Everything that is not the map or settings hangs off the **profile page**,
which acts as the hub: add a report, all reports, my contributions,
leaderboard, edit profile, settings, help. In the original build `post_road/`
and `ranking/` were reachable from nowhere at all; they are linked now.

---

## Things worth knowing before deploying

**`MAP_DEFAULT_CENTER` in `js/config.js` is set to Tokyo.** That is where all
the existing data is, so the app shows something out of the box. For a Hindi /
English launch this should almost certainly change to the target city — it is
the coordinate used before the device reports a position, and for the feed's
bounding circle when location permission is refused.

**`GOOGLE_CLIENT_ID` is empty.** The login screen detects this and shows a
disabled Google button with an explanation rather than a dead primary button.
Guest sign-in works today (verified against the live API). Set the client id and
the real Google button appears.

**`APP_BASE_PATH` is derived from the URL of `js/config.js`**, so the same files
work at `/StepBy/UI1/`, at a domain root, and on a local dev server with no
edit. The old build hard-coded `/StepBy/UI1` in four files.

**`/api/road-info` and `/api/records` reject any request without a bounding
circle** — even `mine=1` returns `400 invalid_radius`. `js/api.js` makes the
centre a required argument so no screen can forget, and `js/geo.js` is the one
place that resolves it (cached per session, so five screens do not each raise
their own permission prompt).

**The list endpoint returns coordinates only** — `{id, lat, lng, createdBy}`,
no tags, notes, photos or author. `api.listReportsDetailed()` fetches the detail
for a bounded number of points through a small worker pool and reports each one
as it lands, so cards fill in progressively. If the backend ever returns full
records from the list, delete the hydration half and everything downstream keeps
working.

**The leaderboard has no endpoint behind it.** It is derived client-side from
the report list, capped at 50, and the page says so when the cap bites rather
than presenting a partial board as the whole picture. A real `/api/ranking`
would replace one function.

---

## The map screen

Rebuilt to the original layout after an earlier version of this rebuild drifted
from it:

```
notice banner        dismissible, remembered in localStorage
brand header         logo · StepBy · BARRIER-FREE MAP · map/settings/profile
wave separator       the SVG curve from the original
map                  zoom control top-left, coordinate strip along the top
drawer  ├ record actions   Start recording · Pause   (UI2 proportions)
        ├ handle           collapses the card row, state remembered
        └ two layer cards  Map information · Centre on me
```

Reviewed against UI2 and adjusted to it, except where the team preferred UI1:

| | |
| --- | --- |
| Logo alignment | kept UI1's — UI2's is slightly off |
| Voice-nav icon in the header | not added; the feature is gone |
| Current-screen button | UI1's brighten-on-selected kept, and made brighter still (UI2 dims it, and the first attempt here was too subtle to read) |
| Record buttons | enlarged to UI2's proportions; the primary action dominates and Pause is sized to its own label so it cannot wrap in any language |
| Layer cards | four collapsed into two. **Map information** turns on tactile paving, recorded routes and reports together; **Centre on me** is unchanged. Bigger, with UI2's ON/OFF pill, icon on top, and no sub-caption |

Each card is a real `<label>` + `<input type="checkbox">` rather than a `div`
with a click handler, so it is reachable by keyboard and announced as a
checkbox with its state.

### Recorded routes (the green lines)

Tapping one opens who recorded it, when, its tags and its note — and, for your
own recording, edit-note and delete. Same behaviour as the original build:
ownership is decided by comparing the JWT `sub` with the route's `user_id`,
the detail comes from `GET /api/tactile-session-info`, and delete calls
`POST /api/session/deactivate`.

Each route is drawn twice: the visible 4 px line, and a 30 px line at 8%
opacity purely as a tap target. iOS WebKit drops fully transparent paths out of
hit-testing, so it has to be 8% rather than 0 — the same trick and the same
numbers the original arrived at after several passes at widening these.

Two deliberate differences from the original, both flagged rather than silent:

- **The note now actually saves.** The original opened `prompt()` and wrote the
  result into the DOM only — it never called `POST /api/session/memo`, so the
  note was gone on the next load. Here it is a field in the sheet and it is
  persisted.
- **Tactile paving comes from `GET /api/osm-tactile-ways`**, not a direct
  browser call to `overpass-api.de`. The backend endpoint is the documented
  one. Side effect: it queries a 2 km radius around the centre where the
  original queried the visible map bounds. Say the word and it can follow the
  viewport instead.

### One icon bug worth knowing about

`hydrate()` used to fill the `<span class="icon" data-icon="...">` placeholder
with an `<svg class="icon">`, nesting one icon box inside another. The svg then
sat in an inline line-box and `vertical-align` pushed it a few pixels below the
centre of its container — measurably, 15.9 px from the top of a 40 px chip
where centring is 10.5 px. Every icon in the app was slightly low, which showed
up as adjacent icons "looking misaligned" even though their boxes were
identical to the pixel.

`hydrate()` now **replaces** the placeholder, so the svg itself is the grid
item and centres properly. `StepByIcons.set(el, name)` swaps a glyph after
that, since a cached reference may now be the `<svg>` and writing innerHTML
into one would nest a second svg inside it.

## Deliberately removed

**Voice navigation.** The old map screen announced nearby spots through
`SpeechSynthesis`. It was removed rather than rebuilt, by team decision: StepBy
does not do route guidance yet, so announcing "there is tactile paving here" on
its own helps nobody, and a speaking layer is a large source of bugs for a
feature the team has not asked for. (It was also hard-coded to `ja-JP`, so it
could never have followed the UI language.) Revisit it only if and when actual
turn-by-turn guidance exists.

This is not the same as screen-reader support, which this build takes seriously:
correct `lang` on every page, real landmarks (`header` / `nav` / `main`), a skip
link, labelled controls, `aria-live` for toasts and status, 44 px targets, and
visible focus rings. Measured on the map screen: 0 unnamed buttons, 0 unlabelled
inputs, 0 unlabelled icons — against 2, 12 and 24 in the old build, which also
had no landmarks at all.

**Every CDN dependency.** Font Awesome's webfont became a 56-icon SVG sprite
(`tools/build-icons.py` regenerates it), Leaflet is vendored, and Noto Sans is
self-hosted with `unicode-range` so Devanagari is only downloaded when Hindi is
actually rendered (~105 KB for English, ~396 KB for Hindi). Japanese uses the
platform's own UI face — a CJK webfont is several megabytes even subsetted, and
that is not a reasonable download for an app people open while walking. The PWA
now works offline; the old one listed no CDN asset in its cache and could not.

**`zoom:` for text size.** Replaced with a root `font-size` scale, so layout
maths and Leaflet hit-testing stay correct at every size.

**Infinite decorative animations.** The shimmering header and pulsing nav ran
forever, on a device the user is holding while walking.

---

## Service worker

| request | strategy | why |
| --- | --- | --- |
| navigations | network-first | a deploy is live on the next load |
| JS / CSS / i18n | network-first | stale-while-revalidate serves the previous copy, so freshly deployed markup can run one-generation-old code — the exact class of bug this rebuild exists to remove. Cache remains the offline fallback. |
| fonts, images, vendor | stale-while-revalidate | effectively immutable |
| `/api/*`, `/auth/*` | never cached | stale accessibility data is worse than none, and a cached authenticated response would leak between accounts |

The old worker was cache-first for everything including HTML, so a deploy was
invisible to returning users.

---

## Credits

Map data © OpenStreetMap contributors (ODbL).
Icons: Font Awesome Free 6.5.1 (CC BY 4.0).
Typeface: Noto Sans (SIL Open Font License); Japanese uses the system UI face.
