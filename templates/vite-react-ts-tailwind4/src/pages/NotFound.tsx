import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-20 text-center">
      <h1 className="font-display text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="text-base text-slate-600">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-ink"
      >
        Back to Home
      </Link>
    </div>
  );
}
