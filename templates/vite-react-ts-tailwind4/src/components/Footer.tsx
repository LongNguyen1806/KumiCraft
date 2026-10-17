import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <p className="text-sm text-slate-500">
          Oakline Studio — Thoughtfully crafted timber furniture for modern spaces.
        </p>
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm text-slate-600 hover:text-brand">
            Home
          </Link>
          <Link to="/about" className="text-sm text-slate-600 hover:text-brand">
            About
          </Link>
        </div>
      </div>
    </footer>
  );
}
