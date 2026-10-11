import { Header } from './components/Header';

export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header title="Fixture shop" />
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-base">Target project used by ReactCraft tests.</p>
      </main>
    </div>
  );
}
