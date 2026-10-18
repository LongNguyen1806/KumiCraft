// History and route synchronization (R-BR-19).

export function wrapBrowserHistory(onRoute: () => void): () => void {
  const origPush = window.history.pushState.bind(window.history);
  const origReplace = window.history.replaceState.bind(window.history);

  window.history.pushState = (...args: Parameters<typeof origPush>): void => {
    origPush(...args);
    onRoute();
  };

  window.history.replaceState = (...args: Parameters<typeof origReplace>): void => {
    origReplace(...args);
    onRoute();
  };

  window.addEventListener('popstate', onRoute);

  return (): void => {
    window.history.pushState = origPush;
    window.history.replaceState = origReplace;
    window.removeEventListener('popstate', onRoute);
  };
}
