# AniCards - AniList Statistics Cards

AniCards is a dynamic and customizable tool designed to generate beautiful statistic cards from your AniList profile data. Effortlessly display your anime and manga stats with vibrant, animated SVGs that you can share on any platform!

## 🚀 Live Demo

Experience AniCards live at [anicards.alpha49.com](https://anicards.alpha49.com)

## ✨ Features

- **10+ Card Types**: Visualize detailed statistics including anime consumption, manga progress, social interactions, genres, staff details, and more.
- **Custom Designs**: Choose from preset themes or create your own color combinations to match your unique style.
- **Dynamic SVGs**: Enjoy animated, vector-based cards that are optimized and easily shareable.
- **Fast & Lightweight**: Built with Next.js and optimized with modern web practices for quick loading times.
- **Easy Integration**: Use a simple URL to display your stats anywhere.

## 🎨 Card Style Requests

**I especially encourage design submissions!** If you have an idea for:

- New color schemes or themes 🎨
- Creative layout concepts 🖼️
- Animated elements to enhance the card's appeal ✨
- New card types for additional statistics or different variants 📊

Submit your design concepts (sketches, Figma files, or detailed descriptions) and I'll work on implementing them!

## 📊 Available Card Types

### Statistics

- **Anime Statistics**: Overview of anime watched, episodes, and time spent.
  - Variations: Default, Vertical, Compact, Minimal
- **Manga Statistics**: Overview of manga read, chapters, and volumes.
  - Variations: Default, Vertical, Compact, Minimal
- **Social Statistics**: Followers, following, and activity stats.
  - Variations: Default, Compact, Minimal

### Content Breakdown

- **Genres**: Top genres for Anime or Manga.
  - Variations: Default, Pie Chart, Bar Chart
- **Tags**: Top tags for Anime or Manga.
  - Variations: Default, Pie Chart, Bar Chart
- **Voice Actors**: Top voice actors.
  - Variations: Default, Pie Chart, Bar Chart
- **Studios**: Top animation studios.
  - Variations: Default, Pie Chart, Bar Chart
- **Staff**: Top staff members for Anime or Manga.
  - Variations: Default, Pie Chart, Bar Chart

### Distributions

- **Status Distribution**: Breakdown by watching/reading status.
  - Variations: Default, Pie Chart, Bar Chart
- **Format Distribution**: Breakdown by media format (TV, Movie, etc.).
  - Variations: Default, Pie Chart, Bar Chart
- **Country Distribution**: Breakdown by country of origin.
  - Variations: Default, Pie Chart, Bar Chart
- **Score Distribution**: Distribution of scores given.
  - Variations: Default, Horizontal
- **Year Distribution**: Distribution of content by release year.
  - Variations: Default, Horizontal

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
- `piePercentages` (optional): `true` or `false` — show percentage labels on pie charts (only meaningful for `pie` variants).
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
