# AniCards - AniList Statistics Cards

AniCards is a dynamic and customizable tool designed to generate beautiful statistic cards from your AniList profile data. Effortlessly display your anime and manga stats with vibrant, animated SVGs that you can share on any platform!

## 🚀 Live Demo

Experience AniCards live at [anicards.alpha49.com](https://anicards.alpha49.com)

## 🎨 Card Style Requests

**I especially encourage design submissions!** If you have an idea for:

- New color schemes or themes 🎨
- Creative layout concepts 🖼️
- Animated elements to enhance the card's appeal ✨
- New card types for additional statistics or different variants 📊

Submit your design concepts (sketches, Figma files, or detailed descriptions) and I'll work on implementing them!

## 📊 Available Card Types

Each card has a `cardType` ID and supports one or more `variation` values.

### Main Stats

- **Anime Statistics** (`animeStats`) — Variations: Default, Vertical, Compact, Minimal
- **Manga Statistics** (`mangaStats`) — Variations: Default, Vertical, Compact, Minimal

### Social

- **Social Statistics** (`socialStats`) — Variations: Default, Compact, Minimal, Badges
- **Social Milestones** (`socialMilestones`) — Variations: Default

### Profile & Favourites

- **Profile Overview** (`profileOverview`) — Variations: Default, Compact, Minimal
- **Favourites Summary** (`favoritesSummary`) — Variations: Default, Compact, Minimal
- **Favourites Grid** (`favoritesGrid`) — Variations: Anime, Manga, Characters, Mixed
  - Optional layout params: `gridCols` (1–5), `gridRows` (1–5)

### Anime Breakdowns

- **Anime Genres** (`animeGenres`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Anime Tags** (`animeTags`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Voice Actors** (`animeVoiceActors`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Animation Studios** (`animeStudios`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
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

### Manga Breakdowns

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

### Activity & Time

- **Activity Heatmap** (`activityHeatmap`) — Variations: Default, GitHub, Fire
- **Recent Activity Summary** (`recentActivitySummary`) — Variations: Default
- **Recent Activity Feed** (`recentActivityFeed`) — Variations: Default
- **Activity Streaks** (`activityStreaks`) — Variations: Default
- **Top Activity Days** (`topActivityDays`) — Variations: Default

### Completion & Progress

- **Status Completion Overview** (`statusCompletionOverview`) — Variations: Combined, Split
- **Consumption Milestones** (`milestones`) — Variations: Default
- **Personal Records** (`personalRecords`) — Variations: Default
- **Planning Backlog** (`planningBacklog`) — Variations: Default
- **Most Rewatched/Reread** (`mostRewatched`) — Variations: Default, Anime, Manga
- **Currently Watching / Reading** (`currentlyWatchingReading`) — Variations: Default, Anime, Manga

### Comparisons & Diversity

- **Anime vs Manga Overview** (`animeMangaOverview`) — Variations: Default
- **Anime vs Manga Score Comparison** (`scoreCompareAnimeManga`) — Variations: Default
- **Country Diversity** (`countryDiversity`) — Variations: Default
- **Genre Diversity** (`genreDiversity`) — Variations: Default
- **Format Preference Overview** (`formatPreferenceOverview`) — Variations: Default
- **Release Era Preference** (`releaseEraPreference`) — Variations: Default
- **Start-Year Momentum** (`startYearMomentum`) — Variations: Default
- **Length Preference** (`lengthPreference`) — Variations: Default

### User Analytics & Misc

- **Tag Category Distribution** (`tagCategoryDistribution`) — Variations: Default
- **Tag Diversity** (`tagDiversity`) — Variations: Default
- **Seasonal Viewing Patterns** (`seasonalViewingPatterns`) — Variations: Default
- **Dropped Media** (`droppedMedia`) — Variations: Default
- **Review Statistics** (`reviewStats`) — Variations: Default

## 🛠️ Customization

You can easily generate your cards using the [Live Generator](https://anicards.alpha49.com).

Alternatively, construct the URL manually:

```text
https://api.anicards.alpha49.com/card.svg?cardType={CARD_TYPE}&userId={USER_ID}&variation={VARIATION}&colorPreset={PRESET_NAME}
```

### Parameters

- `cardType` (required): The ID of the card (e.g., `animeStats`, `mangaGenres`). See the "Available Card Types" above for all supported values.
- `userId` or `userName` (required): Pass either the numeric AniList user ID via `userId`, or a username via `userName`. If both are provided the numeric `userId` is used.
- `variation` (optional): Visual variation to use for the card. Valid values depend on the `cardType`, but commonly supported values include: `default`, `vertical`, `compact`, `minimal`, `pie`, `bar`, `horizontal`. The generator will fall back to the appropriate `default` value for unsupported/invalid variants.
- `colorPreset` (optional): Named color preset to use (e.g., `anilistDark`, `sunset`, `default`). Use `colorPreset=custom` to tell the server to use colors stored in stored on the server (this will ignore per-color URL overrides).
- `titleColor`, `backgroundColor`, `textColor`, `circleColor` (optional): Individual color overrides to apply to the card (hex values like `#ff0000` or valid CSS color strings). Note: `#` must be URL encoded (e.g., `titleColor=%23ff0000`).
- `borderColor` (optional): Stroke color for the card border (like `#ff00ff`).
- `borderRadius` (optional): Numeric value (pixels) to override the card corner radius.
- `showFavorites` (optional): `true` or `false` — applicable only to certain category cards (voice actors, studios, staff) to visualize favorites.
- `statusColors` (optional): `true` or `false` — tells status distribution cards to use fixed status colors.
- `piePercentages` (optional): `true` or `false` — show percentage labels on pie charts (only meaningful for `pie`/`donut` variants).
- `_t` (optional): Any value used to bust caches (commonly a timestamp).

### Notes

- When `colorPreset=custom`, the server will load color data from the card stored in the database and ignore any `titleColor` / `backgroundColor` / `textColor` / `circleColor` URL overrides.
- Certain flags (like `showFavorites`, `statusColors`, and `piePercentages`) are only relevant to specific card types. If omitted, the API will use the stored card configuration if present, otherwise fall back to sensible defaults.

Example (URL-encoded colors):

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeGenres&userId=542244&variation=pie&colorPreset=anilistDark&titleColor=%23ff0000&backgroundColor=%230b1622&piePercentages=true
```

> Here it uses the color preset `anilistDark` as a base, but overrides the title and background colors.

Example using username:

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeStats&userName=Alpha49&variation=compact&colorPreset=sunset&titleColor=%23ff77aa
```

**For a full list of supported card types, color presets, and variations, visit the [Live Generator](https://anicards.alpha49.com).**

## 🏗️ Getting Started

To run the project locally:

1. **Clone the repository**

   ```bash
   git clone https://github.com/RLAlpha49/AniCards.git
   cd AniCards
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Run the development server**

   ```bash
   bun run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## 🤝 Contributing

Contributions are very welcome! Here's how you can contribute:

1. Fork the repository.
2. Create your feature branch:

    ```bash
    git checkout -b feature/your-feature-name
    ```

3. Commit your changes:

    ```bash
    git commit -m 'Add some amazing feature'
    ```

4. Push your branch:

    ```bash
    git push origin feature/your-feature-name
    ```

5. Open a Pull Request and describe your changes in detail.

## 🐛 Issues & Feature Requests

Found a bug or have an idea for improvement? Let me know!

1. Check the existing [issues](https://github.com/RLAlpha49/AniCards/issues).
2. If your issue or idea isn't listed, [open a new issue](https://github.com/RLAlpha49/AniCards/issues/new).

## 📄 License

Distributed under the MIT License. See the [LICENSE](LICENSE) file for more information.

---

**Disclaimer**: AniCards is not affiliated with AniList.co. Use of AniList's API is subject to their terms of service.
