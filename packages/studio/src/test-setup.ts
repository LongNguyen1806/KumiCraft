// Studio unit tests run offline. The Canvas iframe still gets a window (the Bridge channel talks
// to it), but nothing dials a real address: a page load or a fetch a test did not mock gets a
// blank page or a 503 answer at once instead of a refused connection to 127.0.0.1:5173 or
// localhost:3000.
import { DetachedWindowAPI, Response as HappyResponse } from 'happy-dom';

function offlineResponse(pageLoad: boolean): HappyResponse | undefined {
  // The window's own Response class is happy-dom's, bound to this window.
  const response: unknown = pageLoad
    ? new Response('<!doctype html><title>offline</title>', {
        headers: { 'Content-Type': 'text/html' },
      })
    : new Response('', { status: 503, statusText: 'Unit tests are offline' });
  return response instanceof HappyResponse ? response : undefined;
}

// The test's own window, typed as a plain object so happy-dom's window type compares with it.
const testWindow: object = globalThis;
const api: unknown = Reflect.get(globalThis, 'happyDOM');
if (api instanceof DetachedWindowAPI) {
  api.settings.enableIframePageLoading = true;
  api.settings.fetch.interceptor = {
    // A request from another window is the Canvas iframe loading its page.
    beforeAsyncRequest: ({ window }) => Promise.resolve(offlineResponse(window !== testWindow)),
  };
}
