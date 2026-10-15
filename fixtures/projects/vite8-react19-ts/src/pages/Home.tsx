import { Card as RelativeCard } from '../components/Card.tsx';
import { Card as AliasCard } from '@/components/Card.tsx';
import { cn } from '../utils/cn.ts';

export function Home() {
  const active = true;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-hero font-bold text-brand">Sản phẩm nổi bật</h1>
        <p className="text-slate-600">Đoạn văn mô tả với ký tự &amp; ký hiệu đặc biệt.</p>
        <button
          type="button"
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Mua ngay
        </button>
        <a href="https://example.com" className="text-brand underline hover:opacity-80">
          Xem thêm chi tiết
        </a>
        <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
        <ul className="space-y-2">
          {[1, 2, 3].map((item) => (
            <li key={item} className="rounded border border-slate-200 bg-white p-2">
              Mục số {item}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-4">
          <RelativeCard title="Thẻ tương đối">Nội dung thẻ dùng import tương đối</RelativeCard>
          <AliasCard title="Thẻ alias">Nội dung thẻ dùng import alias @/</AliasCard>
        </div>
        <div className={cn('p-4 border rounded-lg', active && 'bg-blue-50 border-blue-300')}>
          Khối sử dụng hàm cn()
        </div>
      </div>
    </main>
  );
}

export default Home;
