import { Card } from '../components/Card.tsx';

export function Home() {
  return (
    <main className="home">
      <h1 className="title">Sản phẩm</h1>
      <p className="lead">Hàng mới về</p>
      <p className="lead">Giao nhanh</p>
      <div className="grid">
        <Card title="Bàn phím" />
        <Card title="Chuột" />
        <Card title="Màn hình" />
      </div>
    </main>
  );
}
