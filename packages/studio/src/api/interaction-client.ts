// Interaction & Dark/Smooth-Scroll API client (K9.8-1 TK-73..80).
import {
  type ApplySmoothScrollRequest,
  type ApplySmoothScrollResult,
  ApplySmoothScrollResultSchema,
  type EnableDarkModeRequest,
  type EnableDarkModeResult,
  EnableDarkModeResultSchema,
  type InteractionAction,
  type InteractionResult,
  InteractionResultSchema,
} from '@kumicraft/shared';

import { apiPost, parseResponse } from './http.ts';

export async function applyInteraction(action: InteractionAction): Promise<InteractionResult> {
  return parseResponse(InteractionResultSchema, await apiPost('source/interaction', action));
}

export async function enableDarkMode(
  request: EnableDarkModeRequest = {},
): Promise<EnableDarkModeResult> {
  return parseResponse(EnableDarkModeResultSchema, await apiPost('project/dark-mode', request));
}

export async function applySmoothScroll(
  request: ApplySmoothScrollRequest,
): Promise<ApplySmoothScrollResult> {
  return parseResponse(
    ApplySmoothScrollResultSchema,
    await apiPost('project/smooth-scroll', request),
  );
}
