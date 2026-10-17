import { Card } from './ui/Card.tsx';

type ProductCardProps = {
  readonly name: string;
  readonly price: string;
  readonly image: string;
  readonly description: string;
};

export function ProductCard({ name, price, image, description }: ProductCardProps) {
  return (
    <Card>
      <img
        src={image}
        alt={name}
        className="mb-4 h-48 w-full rounded-lg bg-slate-100 object-cover"
      />
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-slate-900">{name}</h3>
        <span className="text-sm font-bold text-brand">{price}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Card>
  );
}
