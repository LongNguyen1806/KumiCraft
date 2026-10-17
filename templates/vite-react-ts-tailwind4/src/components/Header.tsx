import { Link } from 'react-router';

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-brand-ink"
        >
          Oakline
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className="text-sm font-medium text-slate-700 transition hover:text-brand"
          >
            Home
          </Link>
          <Link
            to="/about"
            className="text-sm font-medium text-slate-700 transition hover:text-brand"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
