import {
  Component,
  FileEdit,
  FileText,
  FolderTree,
  Layers,
  Library,
  type LucideIcon,
  Palette,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { useDrafts } from '../drafts/use-drafts.ts';
import { usePanelLayoutStore } from '../editor/use-panel-layout.ts';
import { useStyleLayerSupported } from '../project/use-style-edit.ts';
import { SettingsButton } from '../settings/settings-button.tsx';
import { activate, type ActivityId, useShownActivity } from './activity-store.ts';

export type ActivityContext = {
  readonly brandSupported: boolean;
  readonly draftCount: number;
  readonly hasBuildError: boolean;
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
  {
    id: 'files',
    icon: FolderTree,
    labelKey: 'activity.files',
    badge: (ctx) => (ctx.hasBuildError ? 1 : undefined),
  },
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
      className={`relative flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
        isPressed
          ? 'bg-accent-soft text-accent before:absolute before:top-[7px] before:bottom-[7px] before:-left-1.5 before:w-[3px] before:rounded-r before:bg-accent'
          : 'text-ink-faint hover:bg-field hover:text-ink'
      }`}
    >
      <Icon className="size-[17px]" />
      {badgeValue !== undefined && (
        <span
          data-testid={`activity-badge-${item.id}`}
          className={`absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9.5px] leading-none font-semibold ${
            item.id === 'files' ? 'bg-rose-600 text-white' : 'bg-charcoal text-on-charcoal'
          }`}
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
  const buildError = useCanvasErrorStore((s) => s.buildError);

  const ctx: ActivityContext = {
    brandSupported: context?.brandSupported ?? styleLayerSupported,
    draftCount: context?.draftCount ?? drafts.length,
    hasBuildError: context?.hasBuildError ?? buildError !== undefined,
  };

  return (
    <nav
      aria-label={t('activity.bar')}
      className="z-10 flex h-full w-11 min-w-11 flex-col justify-between border-r border-line bg-card-solid py-1.5 select-none"
    >
      <div className="flex w-full flex-col items-center gap-[3px]">
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
