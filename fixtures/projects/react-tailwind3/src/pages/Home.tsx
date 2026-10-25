export function Home() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sản phẩm</h1>
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold">Thẻ nổi bật</h2>
        <p className="text-gray-600">Dùng class Tailwind 3 chuẩn</p>
        <button type="button" className="mt-3 px-4 py-2 rounded bg-brand text-white">
          Mua ngay
        </button>
      </div>
    </main>
  );
}
