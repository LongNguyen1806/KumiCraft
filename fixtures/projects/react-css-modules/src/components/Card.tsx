import styles from './Card.module.css';

export function Card({ title }: { readonly title: string }) {
  return (
    <article className={styles.card}>
      <h3>{title}</h3>
    </article>
  );
}
