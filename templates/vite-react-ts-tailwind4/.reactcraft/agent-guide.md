# Project conventions for AI agents

This project is edited both visually in ReactCraft and by AI agents. Keep the code easy to edit visually:

- React + TypeScript + Tailwind CSS v4. Style with Tailwind classes in a static `className="..."` string whenever possible; ReactCraft can only edit static class strings.
- Pages live in `src/pages/<Name>.tsx` and are registered in `src/routes.tsx` with `createBrowserRouter([...])`, one `{ path, element }` object per page.
- Shared components live in `src/components/`. Code that calls the backend API lives in `src/api/`.
- Design tokens (colors, font sizes, radii) are CSS variables in the `@theme` block of `src/index.css`.
- Do not edit files outside this project folder. A read-only copy of the backend, if linked, is given to you separately: read it, never write to it.
- Never read or copy secret files such as `.env`, keys or credentials.
