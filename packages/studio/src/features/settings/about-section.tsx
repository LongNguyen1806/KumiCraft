import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchSession } from '../../api/session.ts';

/** Who made KumiCraft: shown as written in every language. */
export const AUTHOR = {
  name: 'Long Nguyen',
  role: 'Full Stack Engineer',
  school: 'FPT Aptech',
} as const;

/** The version of the running KumiCraft, read when the section opens. */
function useAppVersion(open: boolean): string | undefined {
  const [version, setVersion] = useState<string>();
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      try {
        const session = await fetchSession();
        if (alive) setVersion(session.version);
      } catch {
        // Without the server the section still shows what KumiCraft is and who made it.
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [open]);
  return version;
}

/** The four highlights shown as a two-column grid. */
const FEATURES = ['edit', 'devices', 'ai', 'styles'] as const;

function FeatureGrid() {
  const { t } = useTranslation();
  return (
    <ul className="grid grid-cols-2 gap-2" data-testid="about-features">
      {FEATURES.map((id) => (
        <li key={id} className="rounded-lg border border-line px-2.5 py-2">
          <p className="text-xs font-semibold text-ink-strong">
            {t(`settings.aboutPage.features.${id}.title`)}
          </p>
          <p className="text-[11px] leading-snug text-ink-soft">
            {t(`settings.aboutPage.features.${id}.body`)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function AuthorCard() {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="about-author-title"
      className="rounded-lg border border-line bg-wash-cool px-3 py-2.5"
      data-testid="about-author"
    >
      <h4
        id="about-author-title"
        className="pb-0.5 text-[11px] font-medium tracking-wide text-ink-faint uppercase"
      >
        {t('settings.aboutPage.author')}
      </h4>
      <p className="text-sm font-semibold text-ink-strong">{AUTHOR.name}</p>
      <p className="text-xs text-ink-soft">
        {AUTHOR.role} · {AUTHOR.school}
      </p>
    </section>
  );
}

/** Settings > About: what KumiCraft is, its version and its author, all visible without scrolling. */
export function AboutSection({ open }: { readonly open: boolean }) {
  const { t } = useTranslation();
  const version = useAppVersion(open);
  return (
    <div className="flex flex-col gap-3" data-testid="settings-about">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-11 place-items-center rounded-lg bg-sun text-lg font-bold text-on-sun"
        >
          K
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-strong">{t('app.name')}</h3>
          {version !== undefined && (
            <p className="font-mono text-xs text-ink-faint" data-testid="about-version">
              {t('app.version', { version })}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">{t('settings.aboutPage.description')}</p>
      <FeatureGrid />
      <p className="text-[11px] text-ink-faint">{t('settings.aboutPage.platforms')}</p>
      <AuthorCard />
      <p className="text-[11px] text-ink-faint">
        {t('settings.aboutPage.copyright', { year: 2026, name: AUTHOR.name })} ·{' '}
        <span className="italic">{t('settings.aboutPage.tagline')}</span>
      </p>
    </div>
  );
}
