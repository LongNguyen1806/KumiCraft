import { Outlet } from 'react-router';

import { Footer } from '../components/Footer.tsx';
import { Header } from '../components/Header.tsx';

export function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
