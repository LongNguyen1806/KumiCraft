# Monorepo fixture (Phase 4 K5)

Shaped like MarketLink and WorkTracker: the repo root is not an app; `frontend/` is the React + Vite
app, `backend/` is a Django API. `legacy-cra/` (Create React App) and `next-site/` (Next.js) are
apps KumiCraft 1.0 names but does not run. The tests link `node_modules` at this root only, so the
frontend's packages are hoisted, as in an npm or pnpm workspace.
