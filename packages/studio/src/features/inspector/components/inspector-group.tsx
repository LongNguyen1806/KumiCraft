// A collapsible Inspector group (P5): the header shows how many properties are set; a group with
// nothing set starts closed, and what the user opens or closes stays that way for the session.
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The user's own choice per group, kept while the Studio is open so it follows the selection. */
const userChoice = new Map<string, boolean>();

type InspectorGroupProps = {
  readonly id: string;
  readonly title: string;
  /** How many properties of the group have a value; `undefined` hides the hint. */
  readonly setCount?: number | undefined;
  readonly defaultOpen: boolean;
  readonly testId?: string | undefined;
  readonly children: ReactNode;
};

function SetHint({ count }: { readonly count: number }) {
  const { t } = useTranslation();
  return count > 0 ? (
    <span className="ml-auto text-[11px] font-medium text-accent">
      {t('inspector.groupSet', { n: count })}
    </span>
  ) : (
    <span className="ml-auto text-[11px] font-normal text-ink-faint">
      {t('inspector.groupUnset')}
    </span>
  );
}

export function InspectorGroup({
  id,
  title,
  setCount,
  defaultOpen,
  testId,
  children,
}: InspectorGroupProps) {
  const [choice, setChoice] = useState(() => userChoice.get(id));
  const open = choice ?? defaultOpen;

  return (
    <section data-testid={testId} className="-mx-3 border-b border-line">
      <h3>
        <button
          type="button"
          data-testid={`inspector-group-${id}`}
          aria-expanded={open}
          onClick={() => {
            userChoice.set(id, !open);
            setChoice(!open);
          }}
          className="flex h-[34px] w-full items-center gap-1.5 px-3 text-left text-xs font-semibold text-ink hover:bg-wash-cool"
        >
          <ChevronRight
            aria-hidden
            className={`size-3 shrink-0 text-ink-faint transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="truncate">{title}</span>
          {setCount !== undefined && <SetHint count={setCount} />}
        </button>
      </h3>
      <div hidden={!open} className="px-3 pb-2.5">
        {children}
      </div>
    </section>
  );
}
