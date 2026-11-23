// When the Canvas should reload an ASP.NET page (03c section 3.3): `dotnet watch` applies a view
// change without saying when, so after a view of the copy changes, the page the Canvas shows is
// asked for again until its HTML differs; a static file (CSS, images) is served from disk at once.
const POLL_MS = 100;
/** A change that never shows on this page (another view) stops being waited for after this. */
const WAIT_MS = 20_000;

export type ServedPage = {
  /** The Canvas loaded `path` and the app answered `html`. */
  seen(path: string, html: string): void;
  /** A file of the copy changed; `view`: a .cshtml or code that changes the HTML. */
  changed(view: boolean): void;
};

async function fetchHtml(port: number, path: string): Promise<string | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${String(port)}${path}`, {
      headers: { accept: 'text/html' },
    });
    return res.ok ? await res.text() : undefined;
  } catch {
    return undefined;
  }
}

/** The page without what changes on every answer (anti-forgery tokens of forms). */
const stable = (html: string): string => html.replace(/value="CfDJ8[^"]*"/g, 'value=""');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createServedPage(appPort: number, reload: () => void): ServedPage {
  let last: { path: string; html: string } | undefined;
  let waiting = false;
  let again = false;

  const waitForNewHtml = async (): Promise<void> => {
    if (waiting) {
      again = true;
      return;
    }
    waiting = true;
    try {
      const page = last;
      const started = Date.now();
      while (page !== undefined && Date.now() - started < WAIT_MS) {
        const html = await fetchHtml(appPort, page.path);
        if (html !== undefined && stable(html) !== stable(page.html)) {
          last = { path: page.path, html };
          reload();
          return;
        }
        await sleep(POLL_MS);
      }
    } finally {
      waiting = false;
      if (again) {
        again = false;
        void waitForNewHtml();
      }
    }
  };

  return {
    seen(path, html) {
      last = { path, html };
    },
    changed(view) {
      if (view) void waitForNewHtml();
      else reload();
    },
  };
}
