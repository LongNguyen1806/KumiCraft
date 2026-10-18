// Runtime error reporting (R-BR-17).

export function attachRuntimeErrorListeners(
  sendError: (message: string, stack?: string) => void,
): () => void {
  const onErr = (evt: ErrorEvent): void => {
    const err = evt.error as { stack?: string } | undefined;
    sendError(
      evt.message || 'Unknown error',
      typeof err?.stack === 'string' ? err.stack : undefined,
    );
  };

  const onRej = (evt: PromiseRejectionEvent): void => {
    const reason = evt.reason as { message?: string; stack?: string } | undefined;
    const rawMsg =
      typeof reason?.message === 'string'
        ? reason.message
        : typeof evt.reason === 'string'
          ? evt.reason
          : 'Unhandled promise rejection';
    sendError(rawMsg, typeof reason?.stack === 'string' ? reason.stack : undefined);
  };

  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onRej);

  return (): void => {
    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onRej);
  };
}
