# Project conventions for AI agents

This project is edited both visually in KumiCraft and by AI agents. Keep the code easy to edit visually:

- React + TypeScript + Tailwind CSS v4. Style with Tailwind classes in a static `className="..."` string (`className` must be a static string literal, not `className={...}`, template literals, or `cn(...)` in JSX); KumiCraft can only edit static class strings.
- Do not use `.map(` in `src/pages/`, `src/components/`, or `src/layouts/` for visual sections that need to be selected and styled individually in the canvas; write each item explicitly and keep display text directly in JSX.
- Pages live in `src/pages/<Name>.tsx` and are registered in `src/routes.tsx` with `createBrowserRouter([...])`.
- Shared page shells live in `src/layouts/` (e.g. `MainLayout.tsx` with `<Header />`, `<Outlet />`, and `<Footer />`).
- Shared components live in `src/components/` and base UI primitives live in `src/components/ui/` (`Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx`). Keep UI primitive props simple (`children`, `type`) without `className` merging or variant props. Use `Link` from `react-router` with static `className` instead of `NavLink` with a function `className`.
- Code that calls the backend API lives in `src/api/`.
- Design tokens (colors, fonts, radii, shadows) are CSS variables in the `@theme` block of `src/index.css`.
- Do not edit files outside this project folder. A read-only copy of the backend, if linked, is given to you separately: read it, never write to it.
- Never read or copy secret files such as `.env`, keys or credentials.
