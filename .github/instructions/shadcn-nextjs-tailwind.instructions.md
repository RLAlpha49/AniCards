---
name: "Shadcn + Tailwind + Next.js Guide"
description: "Guidelines for building Shadcn UI components, Tailwind styling, and Next.js App Router patterns. Apply when building or maintaining UI components, routes, and styling in this Next.js TypeScript project."
applyTo: "**/*.{ts,tsx,js,jsx,css,scss,json}"
---

# Shadcn + Tailwind with Next.js Development Guide

You are an expert TypeScript developer specializing in Next.js applications, Shadcn/ui components, and Tailwind CSS with modern React patterns.

## Tech Stack

- TypeScript (strict mode)
- Next.js App Router (routing & SSR)
- Shadcn/ui (UI components)
- Tailwind CSS (styling)
- Zod (validation)
- Zustand (client state) or React Query where needed (optional)

## Code Style Rules

- Avoid using `any` type; prefer `unknown` with narrowing, explicit types, and TypeScript strict mode.
- Prefer function components over class components
- Always validate external data with Zod schemas
- Include error and pending boundaries for all routes
- Follow accessibility best practices with ARIA attributes

## Component Patterns

Use function components with proper TypeScript interfaces:

```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export default function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button onClick={onClick} className={cn(buttonVariants({ variant }))}>
      {children}
    </button>
  );
}
```

## Data Fetching

Use Server Components and route handlers for server-side data fetching (initial page data, SEO-critical data), and client-side state libraries (Zustand or React Query) for frequently updating or interactive UI state.

```tsx
// app/users/page.tsx (Server Component)
import UserList from "@/components/UserList";
import { getUsers } from "@/lib/api";

export default async function UsersPage() {
  const users = await getUsers();
  return <UserList users={users} />; // UserList can be a Client Component if interactive
}

// Client-side state with Zustand (for interactive updates)
import create from "zustand";

const useStore = create((set) => ({
  stats: null,
  async fetchStats(userId) {
    const res = await fetch(`/api/users/${userId}/stats`);
    const data = await res.json();
    set({ stats: data });
  },
}));

function StatsComponent({ userId }) {
  const { stats, fetchStats } = useStore();
  useEffect(() => {
    fetchStats(userId);
  }, [userId, fetchStats]);
  return <div>{stats ? stats.value : "Loading..."}</div>;
}
```

## Zod Validation

Always validate external data. Define schemas in `src/lib/schemas.ts`:

```typescript
export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  role: z.enum(["admin", "user"]).default("user"),
});

export type User = z.infer<typeof userSchema>;

// Safe parsing
const result = userSchema.safeParse(data);
if (!result.success) {
  console.error("Validation failed:", result.error.format());
  return null;
}
```

## Routes

Structure routes using Next.js App Router (`app/`). Use Server Components for data loading and Client Components for interactive UI. Include error and loading boundaries using `error.tsx` and `loading.tsx` files in the route folder.

```tsx
// app/users/[id]/page.tsx (Server Component)
import { getUser } from "@/lib/api";
import UserDetail from "@/components/UserDetail";

export default async function UserPage({ params }) {
  const user = await getUser(params.id);
  return <UserDetail user={user} />;
}

// app/users/[id]/loading.tsx
export default function Loading() {
  return <div className="p-4">Loading...</div>;
}

// app/users/[id]/error.tsx
export default function Error({ error }) {
  return <div className="p-4 text-red-600">Error: {error?.message}</div>;
}
```

## UI Components

Always prefer Shadcn/ui components over custom ones:

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>User Details</CardTitle>
  </CardHeader>
  <CardContent>
    <Button onClick={handleSave}>Save</Button>
  </CardContent>
</Card>
```

Use Tailwind for styling with responsive design:

```typescript
<div className="flex flex-col gap-4 p-6 md:flex-row md:gap-6">
  <Button className="w-full md:w-auto">Action</Button>
</div>
```

## Accessibility

Use semantic HTML first. Only add ARIA when no semantic equivalent exists:

```typescript
// ✅ Good: Semantic HTML with minimal ARIA
<button onClick={toggleMenu}>
  <MenuIcon aria-hidden="true" />
  <span className="sr-only">Toggle Menu</span>
</button>

// ✅ Good: ARIA only when needed (for dynamic states)
<button
  aria-expanded={isOpen}
  aria-controls="menu"
  onClick={toggleMenu}
>
  Menu
</button>

// ✅ Good: Semantic form elements
<label htmlFor="email">Email Address</label>
<input id="email" type="email" />
{errors.email && (
  <p role="alert">{errors.email}</p>
)}
```

## File Organization

```
app/
├── components/ui/    # Shadcn/ui components
├── lib/schemas.ts    # Zod schemas
├── app/ (route folders)  # App Router routes and pages
└── app/api/      # Server route handlers (route.ts)
```

## Import Standards

Use `@/` alias for all internal imports:

```typescript
// ✅ Good
import { Button } from "@/components/ui/button";
import { userSchema } from "@/lib/schemas";

// ❌ Bad
import { Button } from "../components/ui/button";
```

## Adding Components

Install Shadcn components when needed:

```bash
npx shadcn@latest add button card input dialog
```

## Common Patterns

- Always validate external data with Zod
- Use Server Components and route handlers (app router) for initial data; client state (Zustand or React Query) for interactive updates.
- Include error/pending boundaries on all routes
- Prefer Shadcn components over custom UI
- Use `@/` imports consistently
- Follow accessibility best practices
