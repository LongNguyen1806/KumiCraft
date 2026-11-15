// Persistence and types for multiple open frames on Canvas (SPEC-04 M-MF).
import type { Frame } from '@kumicraft/shared';

export type OpenFrame = {
  readonly id: string;
  readonly frameId: string;
  readonly sessionId: number;
  readonly route: string;
  /** The draft this frame shows instead of a page (each frame its own, spec-log #148). */
  readonly draftFile?: string | undefined;
};

export const MAX_OPEN_FRAMES = 4;
export const OPEN_FRAMES_STORAGE_PREFIX = 'kumicraft.openFrames.';

function isValidOpenFrame(obj: unknown): obj is OpenFrame {
  if (typeof obj !== 'object' || !obj) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.frameId === 'string' &&
    candidate.frameId.length > 0 &&
    typeof candidate.sessionId === 'number' &&
    Number.isInteger(candidate.sessionId) &&
    candidate.sessionId > 0 &&
    typeof candidate.route === 'string' &&
    candidate.route.length > 0 &&
    (candidate.draftFile === undefined || typeof candidate.draftFile === 'string')
  );
}

export function getStoredOpenFrames(projectId: string): readonly OpenFrame[] | undefined {
  try {
    const raw = localStorage.getItem(`${OPEN_FRAMES_STORAGE_PREFIX}${projectId}`);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_OPEN_FRAMES) {
      return undefined;
    }
    const frames = parsed.filter(isValidOpenFrame);
    return frames.length === parsed.length ? frames : undefined;
  } catch {
    return undefined;
  }
}

export function setStoredOpenFrames(projectId: string, frames: readonly OpenFrame[]): void {
  try {
    localStorage.setItem(`${OPEN_FRAMES_STORAGE_PREFIX}${projectId}`, JSON.stringify(frames));
  } catch {
    // Ignore storage write failures
  }
}

export function defaultInitialOpenFrames(
  fallbackFrameId?: string,
  fallbackSessionId?: number,
  fallbackRoute?: string,
): readonly OpenFrame[] {
  return [
    {
      id: 'default',
      frameId: fallbackFrameId && fallbackFrameId.length > 0 ? fallbackFrameId : 'desktop',
      sessionId: fallbackSessionId !== undefined && fallbackSessionId > 0 ? fallbackSessionId : 1,
      route: fallbackRoute && fallbackRoute.length > 0 ? fallbackRoute : '/',
    },
  ];
}

let openFrameSeq = 1;

export function getNextOpenPreset(
  openFrames: readonly OpenFrame[],
  frames: readonly Frame[],
  requested?: string,
  fallback = 'desktop',
): string {
  if (requested) return requested;
  const used = new Set(openFrames.map((f) => f.frameId));
  return frames.find((f) => !used.has(f.id))?.id ?? frames[1]?.id ?? frames[0]?.id ?? fallback;
}

export function resolveCloseTarget(
  openFrames: readonly OpenFrame[],
  closedId: string,
  activeOpenId: string,
  currentFrameId: string,
) {
  const nextList = openFrames.filter((f) => f.id !== closedId);
  const switching = activeOpenId === closedId && nextList[0] !== undefined;
  return {
    nextList,
    nextActiveId: switching && nextList[0] ? nextList[0].id : activeOpenId,
    nextFrameId: switching && nextList[0] ? nextList[0].frameId : currentFrameId,
  };
}

export function initStoredFrames(
  projectId: string | undefined,
  activeId: string,
  route?: string,
  sessionId?: number,
  currentProjectId?: string,
) {
  if (!projectId || currentProjectId === projectId) return undefined;
  const stored = getStoredOpenFrames(projectId);
  const initial = stored ?? defaultInitialOpenFrames(activeId, sessionId ?? 1, route);
  return {
    currentProjectId: projectId,
    openFrames: initial,
    activeOpenFrameId: initial[0]?.id ?? 'default',
    activeFrameId: initial[0]?.frameId ?? activeId,
    // The panels start on the first frame: its own draft, if it showed one.
    draftFile: initial[0]?.draftFile,
  };
}

export function buildNewOpenFrame(
  openFrames: readonly OpenFrame[],
  frames: readonly Frame[],
  activeOpenFrameId: string,
  activeFrameId: string,
  frameId?: string,
  sessionId?: number,
  route?: string,
): { readonly newFrame: OpenFrame; readonly nextPreset: string } {
  const nextPreset = getNextOpenPreset(openFrames, frames, frameId, activeFrameId);
  const id = `frame-${String(Date.now())}-${String(openFrameSeq++)}`;
  const activeOpen = openFrames.find((f) => f.id === activeOpenFrameId);
  return {
    nextPreset,
    newFrame: {
      id,
      frameId: nextPreset,
      sessionId: sessionId ?? activeOpen?.sessionId ?? 1,
      route: route ?? activeOpen?.route ?? '/',
    },
  };
}
