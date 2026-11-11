import { Code, Languages, Sparkles, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EDITORS, PACKAGE_MANAGERS } from '../../api/settings-client.ts';
import { CHOICE_TRACK, ChoicePill } from '../../components/ui/choice-pill.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';
import { LANGUAGES } from '../../i18n/i18n.ts';
import { errorText } from '../../routes/error-text.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { AgentSection } from '../agents/agent-section.tsx';
import { ToolGapsSection } from '../agents/tool-gaps-section.tsx';
import { useProjectInfo } from '../project/project-store.ts';

type SettingsDialogProps = { readonly open: boolean; readonly onClose: () => void };

const SECTIONS = [
  { id: 'interface', icon: Languages },
  { id: 'tools', icon: Code },
  { id: 'agent', icon: Sparkles },
  { id: 'canvas', icon: Square },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

/** The four parts of Settings, one at a time (P5). */
function SectionNav({
  current,
  onPick,
}: {
  readonly current: SectionId;
  readonly onPick: (id: SectionId) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('settings.sections')}
      className="flex flex-col gap-0.5 border-r border-line bg-wash-cool p-2"
    >
      {SECTIONS.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          data-testid={`settings-section-${id}`}
          aria-current={current === id}
          onClick={() => {
            onPick(id);
          }}
          className="flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-xs text-ink-soft hover:bg-field hover:text-ink aria-[current=true]:bg-card-solid aria-[current=true]:font-medium aria-[current=true]:text-ink aria-[current=true]:shadow-[0_0_0_1px_var(--color-line)]"
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t(`settings.${id}`)}</span>
        </button>
      ))}
    </nav>
  );
}

function SectionBody({ id, open }: { readonly id: SectionId; readonly open: boolean }) {
  const { t: tChat } = useTranslation('chat');
  const project = useProjectInfo();
  if (id === 'interface') return <LanguageChoice />;
  if (id === 'tools') {
    return (
      <>
        <EditorChoice />
        <PackageManagerChoice />
      </>
    );
  }
  if (id === 'canvas') return <LoginSessionsChoice />;
  return (
    <>
      <AgentSection />
      {/* The gaps live in the project, which must be open and trusted (R-AG-20). */}
      {project?.trusted === true && (
        <section className="mt-3 border-t border-line pt-3">
          <h3 className="pb-1 font-medium">{tChat('toolGaps.title')}</h3>
          <ToolGapsSection open={open} projectRoot={project.root} />
        </section>
      )}
    </>
  );
}

/**
 * Settings (SPEC-03 section 5.2): interface language, the editor that opens source files, the
 * package manager for new projects, the AI assistant and the Canvas options. Changes apply at once
 * and are remembered for every project on this computer.
 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation();
  const refreshAgents = useAgentsStore((state) => state.refresh);
  const [section, setSection] = useState<SectionId>('interface');

  useEffect(() => {
    if (open) {
      void refreshAgents();
    }
  }, [open, refreshAgents]);

  return (
    <Dialog
      open={open}
      title={t('settings.title')}
      closeLabel={t('settings.close')}
      onClose={onClose}
      size="wide"
      flush
      headerExtra={<SaveStatus />}
    >
      <div className="grid min-h-[22rem] grid-cols-[11rem_minmax(0,1fr)]">
        <SectionNav current={section} onPick={setSection} />
        <section aria-label={t(`settings.${section}`)} className="min-w-0 px-5 pt-2 pb-5">
          <SectionBody id={section} open={open} />
        </section>
      </div>
    </Dialog>
  );
}

/** Login sessions on the Canvas (spec-log #77): an advanced option, off by default. */
function LoginSessionsChoice() {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  return (
    <div className="grid gap-1 py-2.5">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          data-testid="settings-login-sessions"
          disabled={settings === undefined}
          checked={settings?.loginSessions === true}
          onChange={(e) => {
            void update({ loginSessions: e.target.checked });
          }}
        />
        <span className="font-medium">{t('settings.loginSessions')}</span>
      </label>
      <span className="pl-6 text-xs text-ink-soft">{t('settings.loginSessionsHelp')}</span>
    </div>
  );
}

/** The editor that "Open in editor" starts (SPEC-03 section 5.2). */
function EditorChoice() {
  const { t } = useTranslation();
  const editor = useSettingsStore((state) => state.settings?.editor);
  const update = useSettingsStore((state) => state.update);
  return (
    <fieldset className="grid min-w-0 gap-2 py-2.5" disabled={editor === undefined}>
      <legend className="pb-1.5 font-medium">{t('settings.editor')}</legend>
      <div className={CHOICE_TRACK}>
        {EDITORS.map((value) => (
          <ChoicePill
            key={value}
            name="editor"
            value={value}
            checked={editor === value}
            onChange={() => {
              void update({ editor: value });
            }}
          >
            {t(`settings.editors.${value}`)}
          </ChoicePill>
        ))}
      </div>
      <span className="text-xs text-ink-soft">{t('settings.editorHelp')}</span>
    </fieldset>
  );
}

/** Package manager used to install a new project; an existing project keeps its own. */
function PackageManagerChoice() {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  return (
    <fieldset className="grid min-w-0 gap-2 py-2.5" disabled={settings === undefined}>
      <legend className="pb-1.5 font-medium">{t('settings.packageManager')}</legend>
      <div className={CHOICE_TRACK}>
        {PACKAGE_MANAGERS.map((value) => (
          <ChoicePill
            key={value}
            name="package-manager"
            value={value}
            checked={settings?.packageManager === value}
            onChange={() => {
              void update({ packageManager: value });
            }}
          >
            {value}
          </ChoicePill>
        ))}
      </div>
      <span className="text-xs text-ink-soft">{t('settings.packageManagerHelp')}</span>
    </fieldset>
  );
}

/** Interface language: switches at once and is remembered (ADR-FE-16). */
function LanguageChoice() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  return (
    <fieldset className="grid min-w-0 gap-2 py-2.5">
      <legend className="pb-1.5 font-medium">{t('settings.language')}</legend>
      <div className={CHOICE_TRACK}>
        {LANGUAGES.map((language) => (
          <ChoicePill
            key={language}
            name="interface-language"
            value={language}
            checked={i18n.resolvedLanguage === language}
            onChange={() => {
              void setLanguage(language);
            }}
          >
            {t(`language.${language}`)}
          </ChoicePill>
        ))}
      </div>
      <span className="text-xs text-ink-soft">{t('settings.languageHelp')}</span>
    </fieldset>
  );
}

/** "Saved", or why the last change could not be saved (it was undone). */
function SaveStatus() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const save = useSettingsStore((state) => state.save);
  if (save.status === 'failed') {
    return (
      <p role="alert" className="max-w-64 truncate text-xs text-danger">
        {errorText(tError, save.info.code, save.info.params)}
      </p>
    );
  }
  return (
    <p role="status" className="text-xs text-leaf">
      {save.status === 'idle' ? '' : t(`settings.${save.status}`)}
    </p>
  );
}
