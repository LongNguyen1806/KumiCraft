// "Áp cho: Mọi màn hình / Chỉ Mobile" and the question asked when a property already differs by
// screen (spec-log #141). Both read and set the shared screen-edit store.
import type { PropertyId } from '@kumicraft/shared';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useScreenEditStore, useScreens } from '../screen-scope.ts';

/** The device a frame width stands for, by the usual phone and tablet sizes. */
export function ScreenIcon({
  width,
  className,
}: {
  readonly width: number;
  readonly className: string;
}) {
  if (width < 640) return <Smartphone className={className} aria-hidden />;
  if (width < 1024) return <Tablet className={className} aria-hidden />;
  return <Monitor className={className} aria-hidden />;
}

const SEGMENT =
  'h-[26px] min-w-0 truncate px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

function OnlyThisScreenButton({
  on,
  disabled,
  stateActive,
  className,
  onPick,
}: {
  readonly on: boolean;
  readonly disabled: boolean;
  readonly stateActive: boolean;
  readonly className: string;
  readonly onPick: () => void;
}) {
  const { t } = useTranslation();
  const active = useScreens().active;
  return (
    <button
      type="button"
      data-testid="screen-scope-only"
      aria-pressed={on}
      disabled={disabled}
      title={stateActive ? t('inspector.screen.stateHint') : undefined}
      onClick={onPick}
      className={`${SEGMENT} flex flex-1 items-center justify-center gap-1 border-l border-line ${className}`}
    >
      {active !== undefined && <ScreenIcon width={active.width} className="size-3 shrink-0" />}
      <span className="truncate">{t('inspector.screen.only', { frame: active?.label ?? '' })}</span>
    </button>
  );
}

/** Every screen by default; "only this screen" holds for the selected element until it changes. */
export function ScreenScopeSwitch({
  loc,
  stateActive,
}: {
  readonly loc: string;
  readonly stateActive: boolean;
}) {
  const { t } = useTranslation();
  const screens = useScreens();
  const only = useScreenEditStore((s) => s.onlyKey === loc) && !stateActive;
  const setOnly = useScreenEditStore((s) => s.setOnly);
  const canSplit = screens.frames.length > 1 && !stateActive;
  const on = 'bg-ink text-card-solid';
  const off = 'bg-card-solid text-ink-soft hover:bg-field hover:text-ink';

  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-[11px] text-ink-faint">{t('inspector.screen.appliesTo')}</span>
      <div
        role="group"
        aria-label={t('inspector.screen.appliesTo')}
        className="flex min-w-0 flex-1 overflow-hidden rounded-md border border-line"
      >
        <button
          type="button"
          data-testid="screen-scope-all"
          aria-pressed={!only}
          onClick={() => {
            setOnly(undefined);
          }}
          className={`${SEGMENT} flex-1 ${only ? off : on}`}
        >
          {t('inspector.screen.all')}
        </button>
        <OnlyThisScreenButton
          on={only}
          disabled={!canSplit}
          stateActive={stateActive}
          className={only ? on : off}
          onPick={() => {
            setOnly(loc);
          }}
        />
      </div>
    </div>
  );
}

/** Asks where an edit goes when the property already differs by screen; stays in view while scrolling. */
export function ScreenAskBar() {
  const { t } = useTranslation();
  const pending = useScreenEditStore((s) => s.pending);
  const setPending = useScreenEditStore((s) => s.setPending);
  const frameLabel = useScreens().active?.label ?? '';
  if (pending === undefined) return undefined;
  return (
    <div
      role="alertdialog"
      aria-label={t('inspector.screen.ask')}
      data-testid="screen-ask"
      className="sticky bottom-0 z-10 -mx-3 mt-2 flex flex-col gap-2 border-t border-line bg-card-solid px-3 py-2.5 shadow-soft"
    >
      <p className="text-xs leading-snug text-ink">{t('inspector.screen.ask')}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="screen-ask-all"
          onClick={() => {
            pending.apply(false);
          }}
          className="h-7 rounded-md bg-ink px-2.5 text-xs font-medium text-card-solid hover:opacity-90"
        >
          {t('inspector.screen.askAll')}
        </button>
        <button
          type="button"
          data-testid="screen-ask-only"
          onClick={() => {
            pending.apply(true);
          }}
          className="h-7 rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field"
        >
          {t('inspector.screen.askOnly', { frame: frameLabel })}
        </button>
        <button
          type="button"
          data-testid="screen-ask-cancel"
          onClick={() => {
            setPending(undefined);
          }}
          className="ml-auto h-7 px-2 text-xs text-ink-soft hover:text-ink"
        >
          {t('inspector.screen.askCancel')}
        </button>
      </div>
    </div>
  );
}

/** The icon beside a field label when the active screen has its own value: click drops it. */
export function ScreenOwnButton({
  property,
  disabled,
}: {
  readonly property: PropertyId;
  readonly disabled: boolean;
}) {
  const { t } = useTranslation();
  const active = useScreens().active;
  const drop = useScreenEditStore((s) => s.drop);
  if (active === undefined || drop === undefined) return undefined;
  const label = t('inspector.screen.drop', { frame: active.label });
  return (
    <button
      type="button"
      data-testid={`screen-own-${property}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => {
        drop(property);
      }}
      className="grid size-4 place-items-center rounded text-accent hover:bg-accent-soft disabled:opacity-40"
    >
      <ScreenIcon width={active.width} className="size-3" />
    </button>
  );
}
