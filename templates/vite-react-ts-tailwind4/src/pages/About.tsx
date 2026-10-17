import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Input } from '../components/ui/Input.tsx';

export function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold text-slate-900">About Oakline</h1>
        <p className="text-base leading-relaxed text-slate-600">
          Founded by a small collective of cabinetmakers, Oakline creates honest wooden furniture
          that balances architectural clarity with everyday comfort. We work directly with
          certified family mills to select boards with expressive grain and lasting strength.
        </p>
        <p className="text-base leading-relaxed text-slate-600">
          Instead of seasonal trends, our workshop focuses on a permanent collection of dining
          tables, seating, and lighting. Each piece is assembled to order and finished by hand.
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Join the workshop journal
          </h2>
          <p className="text-sm text-slate-600">
            Receive occasional notes on new releases, care guides, and studio open days.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
            <Button type="submit">Subscribe</Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
