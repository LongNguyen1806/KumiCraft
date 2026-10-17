import { ProductCard } from '../components/ProductCard.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';

export function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-6 py-12">
      <section className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
        <div className="space-y-6">
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Welcome to Oakline
          </h1>
          <p className="text-lg text-slate-600">
            Handcrafted solid oak furniture designed for calm, enduring living spaces. Built to
            last with timeless Nordic proportions.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button>Shop now</Button>
            <Button>Learn more</Button>
          </div>
        </div>
        <div>
          <img
            src="/images/hero.svg"
            alt="Oakline living room collection"
            className="w-full rounded-card shadow-card"
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-slate-900">Featured products</h2>
          <p className="text-sm text-slate-600">
            Explore our signature solid timber pieces made in small batches.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProductCard
            name="Oak Lounge Chair"
            price="$240"
            image="/images/product-1.svg"
            description="Curved backrest in kiln-dried white oak with a warm oil finish."
          />
          <ProductCard
            name="Nordic Coffee Table"
            price="$320"
            image="/images/product-2.svg"
            description="Low-profile table with beveled edges and mortise-and-tenon joinery."
          />
          <ProductCard
            name="Atelier Table Lamp"
            price="$145"
            image="/images/product-3.svg"
            description="Turned oak base paired with a diffused warm-glow shade."
          />
        </div>
      </section>

      <section className="rounded-card bg-brand-soft p-8">
        <div className="max-w-2xl space-y-4">
          <Badge>Sustainably Harvested</Badge>
          <h2 className="font-display text-2xl font-bold text-brand-ink">
            Crafted for everyday life
          </h2>
          <p className="text-base text-slate-700">
            Every Oakline piece starts with responsibly sourced timber and finishes with natural
            plant-based oils that age gracefully in your home.
          </p>
        </div>
      </section>
    </div>
  );
}
