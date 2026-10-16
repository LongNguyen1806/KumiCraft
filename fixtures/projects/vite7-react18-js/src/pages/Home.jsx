import { Card } from '../components/Card.jsx';

export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Cửa hàng mẫu</h1>
        <p className="p-4 text-lg">Đoạn văn mô tả cửa hàng mẫu.</p>
        <Card title="Thẻ mẫu">Nội dung thẻ mẫu</Card>
      </div>
    </main>
  );
}

export default Home;
