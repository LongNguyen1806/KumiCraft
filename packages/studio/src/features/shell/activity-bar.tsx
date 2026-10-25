import {
  Component,
  FileEdit,
  FileText,
  Layers,
  Library,
  type LucideIcon,
  Palette,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useDrafts } from '../drafts/use-drafts.ts';
import { usePanelLayoutStore } from '../editor/use-panel-layout.ts';
import { useStyleLayerSupported } from '../project/use-style-edit.ts';
import { SettingsButton } from '../settings/settings-button.tsx';
import { activate, type ActivityId, useShownActivity } from './activity-store.ts';

export type ActivityContext = {
  readonly brandSupported: boolean;
  readonly draftCount: number;
};

export type ActivityLabelKey = `activity.${ActivityId}`;

export type ActivityItemConfig = {
  readonly id: ActivityId;
  readonly icon: LucideIcon;
  readonly labelKey: ActivityLabelKey;
  readonly visible?: (ctx: ActivityContext) => boolean;
  readonly badge?: (ctx: ActivityContext) => number | undefined;
};

export const ACTIVITY_ITEMS: readonly ActivityItemConfig[] = [
  { id: 'layers', icon: Layers, labelKey: 'activity.layers' },
  { id: 'library', icon: Library, labelKey: 'activity.library' },
  { id: 'components', icon: Component, labelKey: 'activity.components' },
  { id: 'pages', icon: FileText, labelKey: 'activity.pages' },
  {
    id: 'drafts',
    icon: FileEdit,
    labelKey: 'activity.drafts',
    badge: (ctx) => (ctx.draftCount > 0 ? ctx.draftCount : undefined),
  },
  {
    id: 'brand',
    icon: Palette,
    labelKey: 'activity.brand',
    visible: (ctx) => ctx.brandSupported,
  },
];

type ActivityBarButtonProps = {
  readonly item: ActivityItemConfig;
  readonly isPressed: boolean;
  readonly badgeValue?: number | undefined;
  readonly onActivate: (id: ActivityId) => void;
};

function ActivityBarButton({ item, isPressed, badgeValue, onActivate }: ActivityBarButtonProps) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(item.labelKey);

  return (
    <button
      type="button"
      data-testid={`activity-${item.id}`}
      aria-label={label}
      title={label}
      aria-pressed={isPressed}
      onClick={() => {
        onActivate(item.id);
      }}
      className={`relative flex size-10 items-center justify-center rounded-lg transition-colors cursor-pointer ${
        isPressed
          ? 'text-ink bg-field/80 font-medium before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-charcoal before:rounded-r'
          : 'text-ink-soft hover:bg-field/50 hover:text-ink'
      }`}
    >
      <Icon className="size-5" />
      {badgeValue !== undefined && (
        <span
          data-testid={`activity-badge-${item.id}`}
          className="absolute top-1 right-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-charcoal px-1 text-[10px] font-semibold text-on-charcoal leading-none"
        >
          {badgeValue}
        </span>
      )}
    </button>
  );
}

export type ActivityBarProps = {
  readonly context?: Partial<ActivityContext> | undefined;
};

export function ActivityBar({ context }: ActivityBarProps = {}) {
  const { t } = useTranslation();
  const active = useShownActivity();
  const isLeftOpen = usePanelLayoutStore((s) => s.layout.visible.left);

  const styleLayerSupported = useStyleLayerSupported();
  const { drafts } = useDrafts();

  const ctx: ActivityContext = {
    brandSupported: context?.brandSupported ?? styleLayerSupported,
    draftCount: context?.draftCount ?? drafts.length,
  };

  return (
    <nav
      aria-label={t('activity.bar')}
      className="flex flex-col justify-between w-12 min-w-12 h-full border-r border-border/60 bg-card py-2 select-none z-10"
    >
      <div className="flex flex-col items-center gap-1 w-full">
        {ACTIVITY_ITEMS.map((item) => {
          if (item.visible !== undefined && !item.visible(ctx)) {
            return undefined;
          }
          return (
            <ActivityBarButton
              key={item.id}
              item={item}
              isPressed={active === item.id && isLeftOpen}
              badgeValue={item.badge?.(ctx)}
              onActivate={activate}
            />
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1 w-full">
        <SettingsButton variant="activity" />
      </div>
    </nav>
  );
}
