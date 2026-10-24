// Operations external AI agents needed but no KumiCraft tool offered (R-AG-20). Kept per project in
// `.kumicraft/tool-gaps.json` so the owner sees what to build next.
import {
  ok,
  type Result,
  type ToolGap,
  type ToolGapReport,
  ToolGapSchema,
} from '@kumicraft/shared';
import { z } from 'zod';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';

export const TOOL_GAPS_FILE = '.kumicraft/tool-gaps.json';
/** R-AG-20: past this many entries the one seen longest ago goes. */
export const MAX_TOOL_GAPS = 500;

const ToolGapsFileSchema = z.strictObject({
  version: z.literal(1),
  gaps: z.array(ToolGapSchema).max(MAX_TOOL_GAPS),
});

export type ToolGapStoreDeps = {
  readonly fs: FileSystemPort;
  readonly logger: LoggerPort;
  readonly now: () => Date;
};

export type ToolGapStore = {
  /** Most reported first, then the most recent. */
  list(projectRoot: string): Promise<readonly ToolGap[]>;
  report(projectRoot: string, report: ToolGapReport): Promise<Result<ToolGap>>;
};

const keyOf = (need: string): string => need.trim().toLowerCase();

function sorted(gaps: readonly ToolGap[]): ToolGap[] {
  return [...gaps].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

async function load(deps: ToolGapStoreDeps, projectRoot: string): Promise<readonly ToolGap[]> {
  const read = await deps.fs.readText(projectRoot, TOOL_GAPS_FILE, { maxBytes: 4 * 1024 * 1024 });
  if (!read.ok) return [];
  try {
    return ToolGapsFileSchema.parse(JSON.parse(read.value)).gaps;
  } catch {
    // A broken file counts as empty; the next report writes a good one.
    deps.logger.warn({ file: TOOL_GAPS_FILE }, 'tool gaps file is broken; starting over');
    return [];
  }
}

function merge(gaps: readonly ToolGap[], report: ToolGapReport, lastAt: string) {
  const need = report.need.trim();
  const existing = gaps.find((gap) => keyOf(gap.need) === keyOf(need));
  const gap: ToolGap = {
    need: existing?.need ?? need,
    why: report.why,
    example: report.example,
    count: (existing?.count ?? 0) + 1,
    lastAt,
  };
  const others = gaps.filter((item) => item !== existing);
  const kept = [...others]
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, MAX_TOOL_GAPS - 1);
  return { gap, gaps: [gap, ...kept] };
}

export function createToolGapStore(deps: ToolGapStoreDeps): ToolGapStore {
  // Reports run one after another: two agents reporting at once must not lose a count.
  let tail: Promise<void> = Promise.resolve();
  const inTurn = async <T>(task: () => Promise<T>): Promise<T> => {
    const previous = tail;
    let release: () => void = () => undefined;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  };
  return {
    async list(projectRoot) {
      return sorted(await load(deps, projectRoot));
    },
    report(projectRoot, report) {
      return inTurn(async () => {
        const merged = merge(await load(deps, projectRoot), report, deps.now().toISOString());
        const text = `${JSON.stringify({ version: 1, gaps: sorted(merged.gaps) }, undefined, 2)}\n`;
        const written = await deps.fs.writeTextAtomic(projectRoot, TOOL_GAPS_FILE, text);
        if (!written.ok) return written;
        return ok(merged.gap);
      });
    },
  };
}
