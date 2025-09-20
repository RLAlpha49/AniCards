# AniCards AI Coding Guidelines

## Project Overview 🎨

AniCards generates dynamic SVG stat cards from AniList profiles using Next.js 15, TypeScript, Tailwind CSS, and Shadcn/ui. The app fetches anime/manga statistics via AniList's GraphQL API and renders them as customizable, animated SVG cards.

## Core Architecture

### API Flow Pattern

- **Rate Limited Requests**: All external API calls use `@upstash/redis` for rate limiting (100 req/10s)
- **AniList Proxy**: `app/api/anilist/route.ts` proxies GraphQL requests with caching and error handling
- **SVG Generation**: `app/api/card.svg/route.ts` converts user stats into SVG using templates in `lib/svg-templates/`
- **Data Flow**: AniList API → User Stats → SVG Template → Cached Response

### SVG Template System

Templates in `lib/svg-templates/` follow a consistent pattern:

```typescript
export function templateName(input: TemplateInput): string {
  // Calculate dimensions and layout
  const { w, h } = getDimensions(variant);
  // Generate SVG elements with dynamic styling
  return `<svg width="${w}" height="${h}">...</svg>`;
}
```

Key templates: `media-stats.ts`, `social-stats.ts`, `distribution.ts`, `extra-anime-manga-stats.ts`

### Type System

- `lib/types/card.ts`: Core interfaces for `UserStats`, `CardConfig`, and stat structures
- `lib/types/records.ts`: Database record types for user/card storage
- All API responses follow strict GraphQL schema from AniList

## Development Patterns

### Component Architecture

- **UI Primitives**: `components/ui/` contains Shadcn/ui components (button, dialog, etc.)
- **Feature Components**: Domain-specific components in `components/stat-card-generator/`, `components/settings/`
- **Layout Pattern**: Use `LayoutShell` wrapper with `Sidebar` for consistent navigation

### API Route Structure

```typescript
export async function GET/POST(request: Request) {
  // 1. Rate limiting check
  const { success } = await ratelimit.limit(identifier);

  // 2. Input validation and parsing
  const data = await safeParse(request);

  // 3. Business logic with error handling
  try { /* main logic */ } catch { /* structured error response */ }

  // 4. Response with proper headers
  return new Response(result, { headers: { 'Content-Type': 'image/svg+xml' }});
}
```

### Color System

- Use Tailwind CSS variables defined in `app/globals.css`
- Color presets in `lib/data.ts` provide consistent theming
- SVG templates accept `styles` object with `titleColor`, `backgroundColor`, `textColor`, `circleColor`

### State Management

- React hooks pattern: `hooks/use-stat-card-submit.ts` handles form logic
- Local storage for user preferences via `lib/data.ts` utilities
- No external state management - React state + localStorage

## Testing Conventions

### Jest Setup

- Configuration: `jest.config.js` with custom reporter
- Test files: `*.test.ts` alongside source files in `app/api/`
- Mock pattern for external APIs and Redis calls
- Use `X-Test-Status` header for simulating rate limits and errors in development

### Test Structure

```typescript
describe("API Route", () => {
  beforeEach(() => {
    // Mock external dependencies
  });

  it("should handle success case", async () => {
    // Test normal flow
  });

  it("should handle rate limiting", async () => {
    // Test error scenarios
  });
});
```

## Key Commands

```bash
# Development with Turbopack
npm run dev

# Build optimized for production
npm run build

# Run all tests with custom reporter
npm run test

# Format with Prettier
npm run format:write

# Lint with ESLint
npm run lint
```

## Critical Integration Points

### AniList API

- Endpoint: `https://graphql.anilist.co`
- Queries defined in `lib/anilist/queries.ts`
- Two main operations: `GetUserId` (username → id) and `GetUserStats` (id → full stats)
- Handle rate limiting with exponential backoff

### Upstash Redis

- Rate limiting and analytics tracking
- Environment variables: Redis connection automatically configured
- Graceful degradation if Redis fails

### Vercel Deployment

- Edge runtime for API routes
- Environment variables in `next.config.ts`
- Static optimization for public assets

## Code Style Rules

### TypeScript

- Strict mode enabled, no implicit any
- Use interfaces for data structures, types for unions
- Prefer `const` arrow functions: `const handleClick = () => {}`

### React/Next.js

- Use "use client" directive for interactive components
- Early returns for error/loading states
- Destructure props and use descriptive names with "handle" prefix for events

### Styling

- **Only use Tailwind classes** - no inline styles or CSS modules
- Use `cn()` utility from `lib/utils.ts` for conditional classes
- Implement accessibility: `tabindex="0"`, `aria-label`, keyboard handlers

### SVG Generation

- All SVG output must be properly escaped
- Use `calculateDynamicFontSize()` utility for responsive text
- Maintain consistent spacing with mathematical calculations

## Emoji Guidelines 🚀

- Place emojis at the end of statements to enhance meaning
- Limit to 1-2 per major section, be contextually creative
- Examples: "Database optimized 🏃‍♂️", "Bug squashed 🥾🐛"
