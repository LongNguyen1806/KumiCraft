export interface ActionCardProps {
  title: string;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  count?: number;
  onClick?: () => void;
}

export function ActionCard({
  title,
  variant = 'primary',
  disabled = false,
  count = 0,
  onClick,
}: ActionCardProps) {
  return (
    <div
      data-testid="action-card"
      className={`rounded-lg border p-4 ${variant === 'outline' ? 'border-blue-500 bg-white' : 'border-slate-200 bg-slate-50'}`}
    >
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600">Count: {count}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Trigger
      </button>
    </div>
  );
}
