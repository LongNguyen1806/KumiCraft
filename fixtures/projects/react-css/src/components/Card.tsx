import './Card.css';

export function Card({ title }: { readonly title: string }) {
  return (
    <article className="card">
      <h3>{title}</h3>
    </article>
  );
}
