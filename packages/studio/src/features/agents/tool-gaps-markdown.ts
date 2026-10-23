// Markdown export of the tool gaps (R-AG-20): something the owner can paste into a plan or a brief.
import type { ToolGap } from '@reactcraft/shared';

export type ToolGapsMarkdownLabels = {
  readonly title: string;
  readonly why: string;
  readonly example: string;
  readonly last: string;
};

/** A fence longer than any run of backticks inside the example, so the example cannot close it. */
function fenceFor(text: string): string {
  const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length));
  return '`'.repeat(longest + 1);
}

export function toolGapsMarkdown(
  gaps: readonly ToolGap[],
  labels: ToolGapsMarkdownLabels,
  date: Date,
): string {
  const lines = [`# ${labels.title}`, '', date.toISOString().slice(0, 10), ''];
  for (const gap of gaps) {
    const fence = fenceFor(gap.example);
    lines.push(`## ${gap.need} (×${String(gap.count)})`, '');
    lines.push(`**${labels.why}:** ${gap.why}`, '');
    if (gap.example.trim() !== '') {
      lines.push(`**${labels.example}:**`, '', fence, gap.example, fence, '');
    }
    lines.push(`_${labels.last}: ${gap.lastAt}_`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
