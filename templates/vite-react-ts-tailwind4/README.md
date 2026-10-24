# Oakline — KumiCraft Starter

A modern React + TypeScript + Tailwind CSS v4 starter project built for visual editing in KumiCraft and code editing with your favorite IDE or AI agent.

## Getting Started

Run the following scripts using your package manager (`pnpm`, `npm`, or `yarn`):

- `pnpm dev` — Start the Vite development server.
- `pnpm build` — Type-check with TypeScript and build for production.
- `pnpm lint` — Lint the project with ESLint.
- `pnpm preview` — Preview the production build locally.

## Project Structure

```text
├── public/
│   ├── favicon.svg
│   └── images/
│       ├── hero.svg
│       ├── product-1.svg
│       ├── product-2.svg
│       └── product-3.svg
├── src/
│   ├── api/                 # Backend API client functions
│   ├── components/          # Reusable visual components
│   │   ├── ui/              # Base UI primitives (Button, Card, Input, Badge)
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── ProductCard.tsx
│   ├── layouts/             # Shared page shells
│   │   └── MainLayout.tsx
│   ├── lib/                 # Utility functions
│   │   └── utils.ts
│   ├── pages/               # Route views
│   │   ├── Home.tsx
│   │   ├── About.tsx
│   │   └── NotFound.tsx
│   ├── index.css            # Tailwind CSS v4 & @theme design tokens
│   ├── main.tsx             # Application entry point
│   └── routes.tsx           # React Router configuration
├── index.html
├── eslint.config.js
├── tsconfig.json
└── vite.config.ts
```

## Design Zones

KumiCraft organizes visual components into three design zones inside `src/`:

1. **`src/pages/`**: Full route views (`Home.tsx`, `About.tsx`, `NotFound.tsx`) registered in `src/routes.tsx`.
2. **`src/layouts/`**: Shared layout wrappers (`MainLayout.tsx`) that render persistent navigation and `<Outlet />`.
3. **`src/components/`**: Reusable sections (`Header.tsx`, `Footer.tsx`, `ProductCard.tsx`) and base UI primitives in `src/components/ui/` (`Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx`).

## Backend API (`src/api/`)

Keep all HTTP calls and backend data-fetching modules inside `src/api/`. Configure the backend base URL via `VITE_API_BASE_URL` (see `.env.example`).

## Visual Editing & Static `className` Convention

To ensure every element can be selected and styled visually in KumiCraft's Inspector:

- Always write Tailwind classes as static string literals: `className="flex items-center gap-4"`.
- Avoid dynamic expressions (`className={...}`), template literals, or conditional class helpers on elements meant for visual editing.
- Write out repeated visual sections explicitly rather than rendering them with `.map(...)` when individual items need independent visual styling.
