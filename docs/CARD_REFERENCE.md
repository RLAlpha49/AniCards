# AniCards card reference

Browse supported card types, decode URL parameters, or build an embed from scratch — this is the reference for all of it.

## Supporting diagrams

- [`card-generation-pipeline.drawio`](./diagrams/card-generation-pipeline.drawio) — the end-to-end SVG render path from `/api/card` request through cache layers, data resolution, template dispatch, and response.
- [`card-type-taxonomy.drawio`](./diagrams/card-type-taxonomy.drawio) — every card family, its card types, supported variations, and the SVG template directory that renders each.

## Start here

- **Fastest option:** the [live generator](https://anicards.alpha49.com) handles everything visually
- **Public embed URL:** `https://api.anicards.alpha49.com/card.svg`
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

## Building an embed URL

The live generator handles the heavy lifting, but you can always write a URL by hand:

```text
https://api.anicards.alpha49.com/card.svg?cardType={CARD_TYPE}&userId={USER_ID}&variation={VARIATION}&colorPreset={PRESET_NAME}
```

### Parameters

- `cardType` (required): The card identifier — `animeStats`, `mangaGenres`, and so on.
- `userId` or `userName` (required): Numeric AniList user ID or an AniList username. Pass both and `userId` takes precedence.
- `variation` (optional): Which visual layout to use. Common values: `default`, `vertical`, `compact`, `minimal`, `pie`, `bar`, `horizontal`.
- `colorPreset` (optional): A named preset — `anilistDark`, `sunset`, `default`. Use `colorPreset=custom` to pull colors stored server-side for that card.
- `titleColor`, `backgroundColor`, `textColor`, `circleColor` (optional): Per-color overrides. URL-encode `#` as `%23`.
- `borderColor` (optional): Border stroke color.
- `borderRadius` (optional): Corner radius in pixels.
- `showFavorites` (optional): `true` or `false` — applies to supported category cards.
- `statusColors` (optional): `true` or `false` — applies to supported status distribution cards.
- `piePercentages` (optional): `true` or `false` — labels on pie and donut charts.
- `gridCols`, `gridRows` (optional): Grid dimensions for `favoritesGrid`.
- `_t` (optional): Cache-busting value — usually a timestamp.

### Behavior notes

When `colorPreset=custom`, the server loads the full color configuration stored for that card and ignores individual color overrides in the URL. Feature flags like `showFavorites`, `statusColors`, and `piePercentages` only do anything on cards that support them — on everything else, they're ignored in favor of stored settings or defaults.

### Examples

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeGenres&userId=542244&variation=pie&colorPreset=anilistDark&titleColor=%23ff0000&backgroundColor=%230b1622&piePercentages=true
```

That one starts from the `anilistDark` preset and then overrides the title and background colors specifically.

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeStats&userName=Alpha49&variation=compact&colorPreset=sunset&titleColor=%23ff77aa
```

Need canonical route details or alias information? See [`API.md`](./API.md).
