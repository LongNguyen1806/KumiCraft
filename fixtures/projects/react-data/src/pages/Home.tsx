import { ActionCard } from '../components/ActionCard.tsx';

export function Home() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8 bg-white">
      <h1 className="text-2xl font-bold text-slate-900">Data Showcase</h1>

      <article data-testid="solo-card" className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Starter Plan</h2>
        <p className="text-sm text-slate-600">Ideal for solo builders</p>
      </article>

      <ActionCard title="Hello Card" variant="primary" disabled={false} count={2} />

      <p data-testid="low-contrast-text" className="bg-white text-sm text-slate-200">
        Subtle low contrast sample text
      </p>

      <button
        type="button"
        data-testid="unlabeled-icon-btn"
        className="inline-flex size-8 items-center justify-center rounded border border-slate-300"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="5" fill="currentColor" />
        </svg>
      </button>

      <div data-testid="overflow-box" className="w-[1600px] bg-slate-100 p-2 text-slate-900">
        Wide overflow element
      </div>
    </main>
  );
}
