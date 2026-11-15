// Markdown copy of the tool gaps (R-AG-20), written next to the JSON so the KumiCraft developer can
// read it straight from the project folder while testing with an external agent.
import type { ToolGap } from '@kumicraft/shared';

export const TOOL_GAPS_MD_FILE = '.kumicraft/tool-gaps.md';

/** A fence longer than any run of backticks inside the example, so the example cannot close it. */
function fenceFor(text: string): string {
  const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length));
  return '`'.repeat(longest + 1);
}

/** Most reported first, as the gaps are stored. */
export function toolGapsMarkdown(gaps: readonly ToolGap[]): string {
  const lines = ['# KumiCraft tool gaps', ''];
  for (const gap of gaps) {
    const fence = fenceFor(gap.example);
    lines.push(`## ${gap.need} (×${String(gap.count)})`, '');
    lines.push(`**Why:** ${gap.why}`, '');
    if (gap.example.trim() !== '') {
      lines.push('**Example:**', '', fence, gap.example, fence, '');
    }
    lines.push(`_Last reported: ${gap.lastAt}_`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
