// Prompt construction for agent turns (WP-3.03b, R-AG-13, S-111, S-117, Round S1).
import type { StylingReport, StylingSystem, TurnContext } from '@kumicraft/shared';

import { err, ok, type Result } from '../../kernel/result.ts';

export const PROMPT_MAX_CHARS = 30_000;
export const GUIDE_MAX_CHARS = 8_000;

export type PromptInput = {
  readonly request: string;
  readonly context: TurnContext;
  readonly mirrors: readonly { readonly label: string; readonly dir: string }[];
  readonly docs: readonly string[];
  readonly images?: readonly string[] | undefined;
  readonly guide?: string | undefined;
  readonly styling?: StylingReport | undefined;
  readonly allowEdits?: boolean | undefined;
};

function formatSystemName(sys: StylingSystem): string {
  const versionSuffix = sys.version !== undefined ? ` ${sys.version}` : '';
  switch (sys.id) {
    case 'tailwind':
      return `Tailwind${versionSuffix}`;
    case 'css':
      return 'plain CSS';
    case 'cssModules':
      return 'CSS Modules';
    case 'sass':
      return `Sass${versionSuffix}`;
    case 'less':
      return `Less${versionSuffix}`;
    case 'bootstrap':
      return `Bootstrap${versionSuffix}`;
    case 'styledComponents':
      return `styled-components${versionSuffix}`;
    case 'emotion':
      return `Emotion${versionSuffix}`;
    case 'mui':
      return `MUI${versionSuffix}`;
    case 'antd':
      return `Ant Design${versionSuffix}`;
    case 'chakra':
      return `Chakra UI${versionSuffix}`;
  }
}

function buildStylingLine(styling: StylingReport): string | undefined {
  if (styling.systems.length === 0) return undefined;
  const names = styling.systems.map(formatSystemName).join(', ');
  const hasTailwind = styling.systems.some((s) => s.id === 'tailwind');
  const tailwindWarning = hasTailwind ? '' : '; do not add Tailwind';
  return `Styling: ${names}. Keep using the project's styling approach${tailwindWarning}.`;
}

function buildContextLines(input: PromptInput): readonly string[] {
  const lines: string[] = [];
  if (input.context.element !== undefined) {
    lines.push(`Selected element: ${input.context.element.loc} (${input.context.element.tag})`);
  }
  if (input.context.route !== undefined) {
    lines.push(`Page: ${input.context.route}`);
  }
  if (input.context.frame !== undefined) {
    lines.push(`Viewport: ${input.context.frame.id}, ${String(input.context.frame.width)} px`);
  }
  if (input.styling !== undefined) {
    const stylingLine = buildStylingLine(input.styling);
    if (stylingLine !== undefined) {
      lines.push(stylingLine);
    }
  }
  if (input.mirrors.length > 0) {
    lines.push('Backend mirrors (read-only copies; never edit them):');
    for (const mirror of input.mirrors) {
      lines.push(`- ${mirror.label}: ${mirror.dir}`);
    }
  }
  if (input.docs.length > 0) {
    lines.push('Documents the user pointed to:');
    for (const doc of input.docs) {
      lines.push(`- ${doc}`);
    }
  }
  if (input.images !== undefined && input.images.length > 0) {
    lines.push('Images the user attached (read them with your file tools):');
    for (const image of input.images) {
      lines.push(`- ${image}`);
    }
  }
  if (input.allowEdits === false) {
    lines.push(
      'Read-only mode (chế độ chỉ đọc): do not edit, create, or delete any files; if asked to edit files, reply that the user needs to turn on "AI được sửa file".',
    );
  }
  return lines;
}

export function buildPrompt(input: PromptInput): Result<string> {
  const sections: string[] = [input.request];

  const contextLines = buildContextLines(input);
  if (contextLines.length > 0) {
    sections.push(['--- KumiCraft context ---', ...contextLines].join('\n'));
  }

  if (input.guide !== undefined && input.guide.trim().length > 0) {
    const trimmedGuide =
      input.guide.length > GUIDE_MAX_CHARS ? input.guide.slice(0, GUIDE_MAX_CHARS) : input.guide;
    sections.push(['--- Project guide (.kumicraft/agent-guide.md) ---', trimmedGuide].join('\n'));
  }

  const prompt = sections.join('\n\n');
  if (prompt.length > PROMPT_MAX_CHARS) {
    return err({
      code: 'E016',
      params: { reason: 'promptTooLong', limit: PROMPT_MAX_CHARS },
    });
  }

  return ok(prompt);
}
