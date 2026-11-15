// Pages the tours write into a project copy before it opens.

/** Tour 02: a flow part (heading, text, button, two boxes) and a free frame with two boxes. */
export const CANVAS_PAGE = `export function Home() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold">Tiêu đề chính</h1>
        <p className="text-slate-600">Đoạn mô tả ngắn gọn.</p>
        <button type="button" className="rounded bg-blue-600 px-4 py-2 text-white">
          Nút bấm
        </button>
        <div className="flex gap-4">
          <div className="h-20 w-40 bg-amber-100 p-2">Ô vàng</div>
          <div className="h-20 w-40 bg-green-100 p-2">Ô xanh</div>
        </div>
      </div>
      <section data-rc-free className="relative mt-8 h-[400px] w-[900px] bg-white">
        <div className="absolute top-[40px] left-[40px] h-[100px] w-[200px] bg-blue-100 p-2">
          Hộp A
        </div>
        <div className="absolute top-[200px] left-[400px] h-[80px] w-[160px] bg-pink-100 p-2">
          Hộp B
        </div>
      </section>
    </main>
  );
}

export default Home;
`;
