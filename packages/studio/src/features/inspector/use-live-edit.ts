// Live edit hook for Inspector (SPEC-04 R-IN-13, R-IN-14, R-IN-20).
import type { ClassContext, ClassValue, PropertyId } from '@kumicraft/shared';
import { writeValue } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/http.ts';
import { editSource } from '../../api/source-client.ts';
import type { InspectorTarget } from './types.ts';

export type UseLiveEditOptions = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly ctx: ClassContext;
  readonly throttleMs?: number | undefined;
};

export type LiveEditState = {
  readonly classString: string;
  readonly isSaving: boolean;
  readonly error?: string | undefined;
  readonly mutateProperty: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly mutateRawClass: (raw: string) => void;
  readonly flush: () => void;
};

type QueuedMutation = {
  readonly nextString: string;
  readonly property?: PropertyId | undefined;
};

type QueueCallbacks = {
  readonly onConfirmed: (val: string) => void;
  readonly onError: (err: unknown) => void;
  readonly onSavingChange: (saving: boolean) => void;
};

export class LiveEditQueue {
  private inFlight = false;
  private pending: QueuedMutation | undefined = undefined;
  private scheduled: QueuedMutation | undefined = undefined;
  private timer: ReturnType<typeof setTimeout> | undefined = undefined;
  private confirmed: string;
  private readonly loc: string;
  private readonly tag: string;
  private readonly prefix: string;
  private readonly throttleMs: number;
  private readonly callbacks: QueueCallbacks;

  constructor(
    loc: string,
    tag: string,
    prefix: string,
    throttleMs: number,
    callbacks: QueueCallbacks,
    initialClass: string,
  ) {
    this.loc = loc;
    this.tag = tag;
    this.prefix = prefix;
    this.throttleMs = throttleMs;
    this.callbacks = callbacks;
    this.confirmed = initialClass;
  }

  getConfirmed(): string {
    return this.confirmed;
  }

  destroy(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.scheduled = undefined;
    this.pending = undefined;
    this.inFlight = false;
  }

  enqueue(mutation: QueuedMutation): void {
    this.scheduled = mutation;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const m = this.scheduled;
      this.scheduled = undefined;
      if (m !== undefined) {
        void this.dispatch(m);
      }
    }, this.throttleMs);
  }

  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
      const m = this.scheduled;
      this.scheduled = undefined;
      if (m !== undefined) {
        void this.dispatch(m);
      }
    }
  }

  private async dispatch(mutation: QueuedMutation): Promise<void> {
    if (this.inFlight) {
      this.pending = mutation;
      return;
    }
    this.inFlight = true;
    this.callbacks.onSavingChange(true);
    const beforeVal = this.confirmed;
    const coalesceKey =
      mutation.property !== undefined
        ? `${this.loc}|${mutation.property}|${this.prefix}`
        : undefined;

    try {
      const res = await editSource({
        edit: {
          kind: 'setClassName',
          loc: this.loc,
          tag: this.tag,
          before: beforeVal,
          after: mutation.nextString,
        },
        coalesceKey,
      });
      const confirmedVal =
        res.element.className.kind === 'static' ? res.element.className.value : mutation.nextString;
      this.confirmed = confirmedVal;
      this.callbacks.onConfirmed(confirmedVal);
    } catch (err) {
      this.pending = undefined;
      this.callbacks.onError(err);
    } finally {
      this.inFlight = false;
      if (this.pending !== undefined) {
        const next = this.pending;
        this.pending = undefined;
        void this.dispatch(next);
      } else {
        this.callbacks.onSavingChange(false);
      }
    }
  }
}

function getStaticClass(target: Extract<InspectorTarget, { readonly kind: 'element' }>): string {
  if (target.source?.className.kind === 'static') {
    return target.source.className.value;
  }
  return '';
}

function handleEditError(
  err: unknown,
  queue: LiveEditQueue,
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
  t: TFunction,
  setOptimistic: (val: string) => void,
  setError: (msg: string | undefined) => void,
): void {
  setOptimistic(queue.getConfirmed());
  if (err instanceof ApiError && err.code === 'E017') {
    setError(t('inspector.errors.sourceConflict'));
    target.refresh();
  } else {
    setError(t('inspector.errors.editFailed'));
  }
}

function useLiveQueue(
  loc: string,
  tag: string,
  prefix: string,
  throttleMs: number,
  serverClass: string,
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
  t: TFunction,
  setOptimisticClass: (val: string) => void,
  setError: (msg: string | undefined) => void,
  setIsSaving: (saving: boolean) => void,
): React.RefObject<LiveEditQueue | undefined> {
  const queueRef = useRef<LiveEditQueue | undefined>(undefined);

  useEffect(() => {
    const queue = new LiveEditQueue(
      loc,
      tag,
      prefix,
      throttleMs,
      {
        onConfirmed: () => {
          setError(undefined);
        },
        onError: (err) => {
          handleEditError(err, queue, target, t, setOptimisticClass, setError);
        },
        onSavingChange: setIsSaving,
      },
      serverClass,
    );
    queueRef.current = queue;
    return () => {
      queue.destroy();
      queueRef.current = undefined;
    };
  }, [
    loc,
    tag,
    prefix,
    throttleMs,
    serverClass,
    target,
    t,
    setOptimisticClass,
    setError,
    setIsSaving,
  ]);

  return queueRef;
}

export function useLiveEdit({ target, ctx, throttleMs = 100 }: UseLiveEditOptions): LiveEditState {
  const { t } = useTranslation();
  const serverClass = getStaticClass(target);
  const loc = target.ref.loc;
  const tag = target.source?.tag ?? loc.split(':')[0] ?? 'div';

  const [optimisticClass, setOptimisticClass] = useState(serverClass);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const [prevLoc, setPrevLoc] = useState(loc);
  const [prevServerClass, setPrevServerClass] = useState(serverClass);

  if (loc !== prevLoc || serverClass !== prevServerClass) {
    setPrevLoc(loc);
    setPrevServerClass(serverClass);
    setOptimisticClass(serverClass);
    setError(undefined);
  }

  const queueRef = useLiveQueue(
    loc,
    tag,
    target.writePrefix,
    throttleMs,
    serverClass,
    target,
    t,
    setOptimisticClass,
    setError,
    setIsSaving,
  );

  return {
    classString: optimisticClass,
    isSaving,
    error,
    mutateProperty: (property, value) => {
      const nextStr = writeValue(optimisticClass, property, target.currentScope, value, ctx);
      setOptimisticClass(nextStr);
      queueRef.current?.enqueue({ nextString: nextStr, property });
    },
    mutateRawClass: (raw: string) => {
      setOptimisticClass(raw);
      queueRef.current?.enqueue({ nextString: raw });
    },
    flush: () => {
      queueRef.current?.flush();
    },
  };
}
