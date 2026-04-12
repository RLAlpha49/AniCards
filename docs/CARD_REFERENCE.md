# AniCards card reference

Browse supported card types, decode URL parameters, or build an embed from scratch — this is the reference for all of it.

## Supporting diagrams

- [`card-generation-pipeline.drawio`](./diagrams/card-generation-pipeline.drawio) — the end-to-end SVG render path from `/api/card` request through cache layers, data resolution, template dispatch, and response.
- [`card-type-taxonomy.drawio`](./diagrams/card-type-taxonomy.drawio) — every card family, its card types, supported variations, and the SVG template directory that renders each.

## Start here

- **Fastest option:** the [live generator](https://anicards.alpha49.com) handles everything visually
- **Public SVG embed URL:** `https://api.anicards.alpha49.com/card.svg`
- **Public PNG preview route:** `/card.png`
- **Canonical API handler:** `/api/card` — for contract details, see [`API.md`](./API.md)

Every card has a `cardType` identifier and supports one or more `variation` values.

## Card catalog

### Core stats

- **Anime Statistics** (`animeStats`) — Variations: Default, Vertical, Compact, Minimal
- **Manga Statistics** (`mangaStats`) — Variations: Default, Vertical, Compact, Minimal
- **Social Statistics** (`socialStats`) — Variations: Default, Compact, Minimal, Badges
- **Profile Overview** (`profileOverview`) — Variations: Default
- **Anime vs Manga Overview** (`animeMangaOverview`) — Variations: Default

### Anime deep dive

- **Anime Genres** (`animeGenres`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Anime Tags** (`animeTags`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Voice Actors** (`animeVoiceActors`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Animation Studios** (`animeStudios`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Studio Collaboration** (`studioCollaboration`) — Variations: Default
- **Anime Staff** (`animeStaff`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Anime Status Distribution** (`animeStatusDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `statusColors`
- **Anime Format Distribution** (`animeFormatDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Source Material Distribution** (`animeSourceMaterialDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Seasonal Preference** (`animeSeasonalPreference`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Episode Length Preferences** (`animeEpisodeLengthPreferences`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Country Distribution** (`animeCountry`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Score Distribution** (`animeScoreDistribution`) — Variations: Default, Horizontal, Cumulative
- **Anime Year Distribution** (`animeYearDistribution`) — Variations: Default, Horizontal
- **Anime Genre Synergy** (`animeGenreSynergy`) — Variations: Default

### Manga deep dive

- **Manga Genres** (`mangaGenres`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Manga Tags** (`mangaTags`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Manga Staff** (`mangaStaff`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Manga Status Distribution** (`mangaStatusDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `statusColors`
- **Manga Format Distribution** (`mangaFormatDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Manga Country Distribution** (`mangaCountry`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Manga Score Distribution** (`mangaScoreDistribution`) — Variations: Default, Horizontal, Cumulative
- **Manga Year Distribution** (`mangaYearDistribution`) — Variations: Default, Horizontal

### Activity and engagement

- **Recent Activity Summary** (`recentActivitySummary`) — Variations: Default
- **Activity Streaks** (`activityStreaks`) — Variations: Default
- **Top Activity Days** (`topActivityDays`) — Variations: Default
- **Social Milestones** (`socialMilestones`) — Variations: Default
- **Review Statistics** (`reviewStats`) — Variations: Default
- **Seasonal Viewing Patterns** (`seasonalViewingPatterns`) — Variations: Default

### Library and progress

- **Favourites Summary** (`favoritesSummary`) — Variations: Default
- **Favourites Grid** (`favoritesGrid`) — Variations: Anime, Manga, Characters, Staff, Studios, Mixed
  - Optional layout params: `gridCols` (1–5), `gridRows` (1–5)
- **Status Completion Overview** (`statusCompletionOverview`) — Variations: Combined, Split
- **Consumption Milestones** (`milestones`) — Variations: Default
- **Personal Records** (`personalRecords`) — Variations: Default
- **Planning Backlog** (`planningBacklog`) — Variations: Default
- **Most Rewatched/Reread** (`mostRewatched`) — Variations: Default, Anime, Manga
- **Currently Watching / Reading** (`currentlyWatchingReading`) — Variations: Default, Anime, Manga
- **Dropped Media** (`droppedMedia`) — Variations: Default

### Advanced analytics

- **Anime vs Manga Score Comparison** (`scoreCompareAnimeManga`) — Variations: Default
- **Country Diversity** (`countryDiversity`) — Variations: Default
- **Genre Diversity** (`genreDiversity`) — Variations: Default
- **Format Preference Overview** (`formatPreferenceOverview`) — Variations: Default
- **Release Era Preference** (`releaseEraPreference`) — Variations: Default
- **Start-Year Momentum** (`startYearMomentum`) — Variations: Default
- **Length Preference** (`lengthPreference`) — Variations: Default
- **Tag Category Distribution** (`tagCategoryDistribution`) — Variations: Default
- **Tag Diversity** (`tagDiversity`) — Variations: Default

## Building an SVG or PNG URL

The live generator handles the heavy lifting, but you can always write a URL by hand:

```text
https://api.anicards.alpha49.com/card.svg?cardType={CARD_TYPE}&username={USERNAME}&variation={VARIATION}&colorPreset={PRESET_NAME}
```

Swap `/card.svg` for `/card.png` when you want a raster response instead of SVG.

### Parameters

- `cardType` (required): The card identifier — `animeStats`, `mangaGenres`, and so on.
- `userId` or `username` (required): Numeric AniList user ID or canonical AniList username. If both are present, `userId` wins.
- `userName` (optional, deprecated): Backward-compatible alias for `username`. New links should use `username`.
- `variation` (optional): Which visual layout to use. Accepted variation values depend on the card type and currently include `default`, `vertical`, `compact`, `minimal`, `badges`, `pie`, `donut`, `bar`, `radar`, `horizontal`, `cumulative`, `anime`, `manga`, `characters`, `staff`, `studios`, `mixed`, `combined`, and `split`.
- `animate` (optional): Animation toggle. SVG routes keep animations enabled unless the value is one of `0`, `false`, `no`, or `off` (case-insensitive after trimming). `/card.png` injects `animate=false` when the parameter is omitted before rasterizing the card.
- `colorPreset` (optional): A runtime preset name from the accepted inventory below. Named presets apply first, then per-color URL overrides can replace individual colors. The special value `custom` loads saved custom colors unless the request also provides all four core colors (`titleColor`, `backgroundColor`, `textColor`, and `circleColor`), in which case the URL colors are used directly.
- `titleColor`, `backgroundColor`, `textColor`, `circleColor` (optional): Core per-color overrides. URL-encode `#` as `%23`. With named presets, provided values override the preset. With `colorPreset=custom`, URL color overrides only take effect when all four core colors are present together.
- `borderColor` (optional): Border stroke color override. This is independent of the `custom` core-color precedence rules.
- `borderRadius` (optional): Corner radius in pixels. The route clamps the effective value into the `0`–`100` range.
- `showFavorites` (optional): `true` or `false` — applies only to supported category cards.
- `statusColors` (optional): `true` or `false` — applies only to supported status distribution cards.
- `piePercentages` (optional): `true` or `false` — applies only to supported pie and donut variants.
- `gridCols`, `gridRows` (optional): Grid dimensions for `favoritesGrid`. The route clamps each value into the `1`–`5` range.
- `_t` (optional): Manual card-cache bust token. Any value bypasses card-response cache reads and returns no-store headers for that render. It does **not** fetch fresh AniList data on its own.

### Behavior notes

- **Identifier resolution:** `username` is the canonical name parameter, `userName` is deprecated/backward-compatible only, and `userId` takes precedence when both ID and name are present.
- **Color resolution:** Named presets can be mixed with individual URL color overrides. `colorPreset=custom` means “use saved custom colors” unless all four core URL colors are present, in which case the URL becomes the full source of truth for those core colors.
- **Animation defaults:** SVG routes animate by default. `/card.png` defaults missing `animate` to `false` before forwarding the request to the SVG renderer.
- **Cache behavior:** Canonical renders (no explicit visual overrides and no `_t`) use the long-lived card cache. Requests with explicit variation, color, border, flag, or grid overrides use the shorter preview cache. `_t` renders and all error renders are no-store.
- **Response hints:** Successful SVG and PNG card responses expose `X-Card-Border-Radius` and `X-Cache-Source`, where the cache source currently distinguishes `render`, `memory`, `redis`, and `refresh` responses.

### Accepted color presets

This list mirrors the live sorted `colorPresets` keys in `components/stat-card-generator/constants.ts`:

- `anicardsDark`, `anicardsDarkGradient`, `anicardsLight`, `anicardsLightGradient`, `anilistDark`, `anilistDarkGradient`, `anilistLight`, `anilistLightGradient`, `arcticAurora`, `aurora`
- `bubblegum`, `canyonSunrise`, `cherryBlossom`, `citrus`, `coral`, `coralReef`, `cosmicNebula`, `custom`, `cyberpunk`, `darkModeBlue`
- `default`, `earthyGreen`, `emberGlow`, `fire`, `fireEmber`, `forest`, `forestDepth`, `galaxy`, `goldenHour`, `goldStandard`
- `lavender`, `lavenderBloom`, `midnight`, `mint`, `mintFresh`, `monochromeGray`, `neonGlow`, `ocean`, `oceanBreeze`, `oceanWaves`
- `pastelDreams`, `polarNight`, `purpleDusk`, `purpleHaze`, `rainforestMist`, `redAlert`, `rosegold`, `seafoam`, `skylineAzure`, `solarizedLight`
- `springGarden`, `stardust`, `sunriseMeadow`, `sunset`, `sunsetGradient`, `synthwave`, `twilight`, `twilightSky`, `verdantTwilight`, `vintageSepia`

`custom` is the only special sentinel value; it follows the precedence rules above instead of applying a named palette.

### Examples

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeGenres&userId=542244&variation=pie&colorPreset=anilistDark&titleColor=%23ff0000&backgroundColor=%230b1622&piePercentages=true
```

That one starts from the named `anilistDark` preset and then overrides individual colors from the URL.

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeStaff&username=Alpha49&colorPreset=custom&titleColor=%23aaaaaa&backgroundColor=%230b1622&textColor=%23e2e8f0&circleColor=%233cc8ff&showFavorites=false
```

Because all four core colors are present, the URL colors win even though `colorPreset=custom`.

```text
/card.png?cardType=profileOverview&username=Alpha49&colorPreset=anicardsDarkGradient
```

That uses the public PNG route. Because `animate` is omitted, `/card.png` forwards `animate=false` before rasterizing the card.

Need canonical route details or alias information? See [`API.md`](./API.md).
