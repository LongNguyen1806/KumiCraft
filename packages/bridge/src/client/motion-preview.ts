// "Xem thử" in Motion plays, once, the motion the element has, without editing a file (K9.7-2
// TK-22; the owner's report, 2026-11-18: it must play what the Inspector set, and it played
// nothing for a hover effect). In order: the Reveal around the element, its CSS animation, then
// its hover look held for a moment. The hover look is read from the page's own CSS rules
// (`.x:hover`, `.group:hover .x`), so Tailwind and plain CSS play the same.
import type { StudioMotionPreviewPayload } from '@kumicraft/shared';

type Styled = HTMLElement | SVGElement;
type Declaration = { readonly name: string; readonly value: string; readonly priority: string };

const REVEAL_MS = 600;
const HOVER_HOLD_MS = 900;

type Playing = { readonly timers: ReturnType<typeof setTimeout>[]; readonly restore: () => void };

/** What plays now, so a second click starts over from the element's own look. */
const ACTIVE = new WeakMap<Element, Playing>();

function hasRules(rule: CSSRule): rule is CSSRule & { readonly cssRules: CSSRuleList } {
  return 'cssRules' in rule && rule.cssRules instanceof CSSRuleList;
}

/** The declarations the element takes on hover, from every rule whose `:hover` matches it. */
export function hoverDeclarations(el: Element): Declaration[] {
  const view = el.ownerDocument.defaultView ?? undefined;
  const out: Declaration[] = [];
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (
        view &&
        rule instanceof view.CSSMediaRule &&
        !view.matchMedia(rule.conditionText).matches
      ) {
        continue;
      }
      if (view && rule instanceof view.CSSStyleRule && rule.selectorText.includes(':hover')) {
        const matches = rule.selectorText.split(',').some((part) => {
          if (!part.includes(':hover')) return false;
          try {
            return el.matches(part.replaceAll(':hover', ''));
          } catch {
            return false;
          }
        });
        if (matches) {
          for (const name of Array.from(rule.style)) {
            const value = rule.style.getPropertyValue(name);
            out.push({ name, value, priority: rule.style.getPropertyPriority(name) });
          }
        }
      }
      if (hasRules(rule)) visit(rule.cssRules);
    }
  };
  for (const sheet of Array.from(el.ownerDocument.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      // A stylesheet from another origin cannot be read; it has no rule of the project.
    }
  }
  return out;
}

/** Shows the Reveal again from hidden: its own element, or each child when it staggers. */
function replayReveal(el: Element, view: Window & typeof globalThis): boolean {
  const wrapper = el.closest('[data-reveal]');
  if (!(wrapper instanceof view.HTMLElement)) return false;
  const effect = wrapper.getAttribute('data-reveal');
  const hidden =
    effect === 'slide-up' ? 'translateY(16px)' : effect === 'zoom' ? 'scale(0.96)' : '';
  const moving = [wrapper, ...Array.from(wrapper.firstElementChild?.children ?? [])].filter(
    (n): n is HTMLElement => n instanceof view.HTMLElement && n.style.transition !== '',
  );
  for (const node of moving) {
    const shown = node.style.cssText;
    node.style.transition = 'none';
    node.style.opacity = '0';
    if (hidden !== '') node.style.transform = hidden;
    void node.getBoundingClientRect();
    node.style.cssText = shown;
  }
  return moving.length > 0;
}

function replayAnimation(el: Styled, view: Window & typeof globalThis): boolean {
  const name = view.getComputedStyle(el).animationName;
  if (name === '' || name === 'none') return false;
  const own = el.style.animation;
  el.style.animation = 'none';
  void el.getBoundingClientRect();
  el.style.animation = own;
  return true;
}

/** The element's own inline style, put back as it was (no `style` attribute when it had none). */
function styleRestorer(el: Styled): () => void {
  const had = el.hasAttribute('style');
  const own = el.getAttribute('style') ?? '';
  return () => {
    if (had) el.setAttribute('style', own);
    else el.removeAttribute('style');
  };
}

function holdHover(el: Styled, after: number, playing: Playing): boolean {
  const declarations = hoverDeclarations(el);
  if (declarations.length === 0) return false;
  playing.timers.push(
    setTimeout(() => {
      for (const d of declarations) el.style.setProperty(d.name, d.value, d.priority);
    }, after),
    setTimeout(playing.restore, after + HOVER_HOLD_MS),
  );
  return true;
}

/** Plays the element's motion once; false when it has none to play. */
export function triggerMotionPreview(payload: StudioMotionPreviewPayload, doc: Document): boolean {
  const el = doc.querySelectorAll(`[data-rc-loc="${payload.ref.loc}"]`)[payload.ref.index];
  const view = doc.defaultView ?? undefined;
  if (view === undefined || !(el instanceof view.HTMLElement || el instanceof view.SVGElement)) {
    return false;
  }
  const before = ACTIVE.get(el);
  if (before !== undefined) {
    for (const timer of before.timers) clearTimeout(timer);
    before.restore();
  }
  const playing: Playing = { timers: [], restore: styleRestorer(el) };
  const revealed = replayReveal(el, view);
  const animated = replayAnimation(el, view);
  const hovered = holdHover(el, revealed ? REVEAL_MS : 0, playing);
  ACTIVE.set(el, playing);
  return revealed || animated || hovered;
}
