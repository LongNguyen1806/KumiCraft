// State of the Welcome form (SPEC-04.1 section 2.4). The request is checked with the same schema
// as the server, so the user sees field errors before anything is sent.
import {
  buildFrames,
  type CreateWorkspaceRequest,
  CreateWorkspaceRequestSchema,
  type Frame,
  type FramePreset,
  resolvePrimaryFrame,
  type ResponsiveMode,
} from '@reactcraft/model';
import { useState } from 'react';

import { ApiError } from '../../api/http.ts';
import { createWorkspace } from '../../api/workspace-client.ts';

export type FrameChoice = FramePreset | 'custom';
export type DarkMode = 'none' | 'media' | 'class';
export type FieldError = 'name' | 'frame';

export type WelcomeValues = {
  readonly name: string;
  readonly mode: ResponsiveMode;
  readonly frame: FrameChoice;
  readonly customWidth: number;
  readonly customHeight: number;
  readonly contentLocale: string;
  readonly darkMode: DarkMode;
};

const DEFAULT_FRAME: Record<ResponsiveMode, FramePreset> = {
  'desktop-first': 'desktop-1440',
  'mobile-first': 'mobile-375',
};

/** The frame the form stands for; `customLabel` names a custom frame in the user's language. */
export function primaryFrameOf(values: WelcomeValues, customLabel: string): Frame {
  if (values.frame !== 'custom') return resolvePrimaryFrame(values.mode, values.frame);
  return {
    id: 'custom',
    label: customLabel,
    width: values.customWidth,
    height: values.customHeight,
  };
}

export function framesOf(values: WelcomeValues, customLabel: string): Frame[] {
  return buildFrames(values.mode, primaryFrameOf(values, customLabel));
}

export function toRequest(values: WelcomeValues, customLabel: string): CreateWorkspaceRequest {
  return {
    name: values.name,
    responsiveMode: values.mode,
    primaryFrame: values.frame === 'custom' ? primaryFrameOf(values, customLabel) : values.frame,
    contentLocale: values.contentLocale,
    darkMode: values.darkMode,
  };
}

/** Field errors of the request, by the first path segment of each schema issue. */
export function fieldErrors(request: CreateWorkspaceRequest): readonly FieldError[] {
  const parsed = CreateWorkspaceRequestSchema.safeParse(request);
  if (parsed.success) return [];
  const fields = parsed.error.issues.map((issue) =>
    issue.path[0] === 'name' ? 'name' : ('frame' as const),
  );
  return [...new Set(fields)];
}

type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'sending' }
  | { readonly status: 'failed'; readonly code: string };

/** Form values, derived frames and submission. `onCreated` runs once the workspace exists. */
export function useCreateWorkspaceForm(initialLocale: string, onCreated: () => void) {
  const [values, setValues] = useState<WelcomeValues>({
    name: '',
    mode: 'desktop-first',
    frame: 'desktop-1440',
    customWidth: 1366,
    customHeight: 768,
    contentLocale: initialLocale,
    darkMode: 'none',
  });
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });
  const [showErrors, setShowErrors] = useState(false);

  const update = (patch: Partial<WelcomeValues>) => {
    setValues((current) => {
      const next = { ...current, ...patch };
      // Switching mode moves an untouched default frame to the default of the new mode.
      if (patch.mode !== undefined && current.frame === DEFAULT_FRAME[current.mode]) {
        return { ...next, frame: DEFAULT_FRAME[patch.mode] };
      }
      return next;
    });
  };

  const send = async (request: CreateWorkspaceRequest) => {
    setShowErrors(true);
    if (fieldErrors(request).length > 0) return;
    setSubmit({ status: 'sending' });
    try {
      await createWorkspace(request);
      onCreated();
    } catch (error) {
      const code = error instanceof ApiError ? (error.code ?? String(error.status)) : 'network';
      setSubmit({ status: 'failed', code });
    }
  };

  return { values, update, submit, showErrors, send };
}
