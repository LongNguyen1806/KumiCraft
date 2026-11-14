// Temporary Design-mode previews for Dark mode, Interaction states, and SelectPanel switching (K9.8-1).
import {
  type ElementRef,
  type InspectorPreviewState,
  splitSelectorList,
  type StudioSetStatePreviewPayload,
} from '@kumicraft/shared';

import { resolveElementsByRefs } from './drag.ts';

type SavedAttr = {
  readonly el: Element;
  readonly name: string;
  readonly prev: string | undefined;
};

const STATE_STYLE_ATTR = 'data-kc-state-preview';
const TARGET_ATTR = 'data-kc-state-target';
const GROUP_ATTR = 'data-kc-group-target';

function pseudoTokenFor(state: InspectorPreviewState): string | undefined {
  if (state === 'hover' || state === 'active' || state === 'focus' || state === 'disabled') {
    return `:${state}`;
  }
  return undefined;
}

function rewritePartForPreview(
  part: string,
  state: InspectorPreviewState,
  el: Element,
): string | undefined {
  if (state === 'groupHover') {
    const idx = part.indexOf(':hover');
    if (idx === -1) return undefined;
    const before = part.slice(0, idx);
    const after = part.slice(idx + ':hover'.length);
    if (!/\s/.test(after)) return undefined;
    const testSelector = `${before}${after}`;
    try {
      if (!el.matches(testSelector)) return undefined;
    } catch {
      return undefined;
    }
    return `[${GROUP_ATTR}="1"]${after}`;
  }

  const pseudo = pseudoTokenFor(state);
  if (pseudo === undefined) return undefined;
  const re = new RegExp(`(?<!:)${pseudo}(?![\\w-])`, 'g');
  if (!re.test(part)) return undefined;
  const stripped = part.replace(re, '').trim() || '*';
  try {
    if (!el.matches(stripped)) return undefined;
  } catch {
    return undefined;
  }
  return `${part.replace(re, '')}[${TARGET_ATTR}="1"]`;
}

function collectSheetRules(
  rules: CSSRuleList,
  state: InspectorPreviewState,
  el: Element,
  view: Window,
  out: string[],
): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const matched = splitSelectorList(rule.selectorText)
        .map((part) => rewritePartForPreview(part, state, el))
        .filter((s): s is string => s !== undefined);
      if (matched.length > 0 && rule.style.cssText.trim() !== '') {
        out.push(`${matched.join(', ')} { ${rule.style.cssText} }`);
      }
    } else if (rule instanceof CSSMediaRule && view.matchMedia(rule.media.mediaText).matches) {
      collectSheetRules(rule.cssRules, state, el, view, out);
    }
  }
}

export class DarkStatePreview {
  private previewDark = false;
  private styleEl: HTMLStyleElement | undefined;
  private savedAttrs: SavedAttr[] = [];

  public setDarkPreview(doc: Document, dark: boolean): void {
    doc.documentElement.classList.toggle('dark', dark);
    this.previewDark = dark;
  }

  private saveAndSetAttr(el: Element, name: string, value: string): void {
    const prev = el.hasAttribute(name) ? (el.getAttribute(name) ?? '') : undefined;
    this.savedAttrs.push({ el, name, prev });
    el.setAttribute(name, value);
  }

  public clearState(doc: Document): void {
    this.styleEl?.remove();
    this.styleEl = undefined;
    for (let i = this.savedAttrs.length - 1; i >= 0; i--) {
      const item = this.savedAttrs[i];
      if (!item) continue;
      if (item.prev === undefined) item.el.removeAttribute(item.name);
      else item.el.setAttribute(item.name, item.prev);
    }
    this.savedAttrs = [];
    const view = doc.defaultView ?? window;
    view.dispatchEvent(
      new view.CustomEvent('kumicraft:loading-preview', { detail: { active: false } }),
    );
  }

  public setStatePreview(doc: Document, payload: StudioSetStatePreviewPayload): void {
    this.clearState(doc);
    if (payload.ref === undefined || payload.state === undefined) return;
    const el = resolveElementsByRefs([payload.ref], doc)[0];
    if (el === undefined) return;

    const view = doc.defaultView ?? window;
    if (payload.state === 'loading') {
      this.saveAndSetAttr(el, 'data-kc-loading-preview', 'true');
      view.dispatchEvent(
        new view.CustomEvent('kumicraft:loading-preview', {
          detail: { active: true, loc: payload.ref.loc },
        }),
      );
      return;
    }

    this.applyDomStateAttrs(el, doc, payload);
    this.injectMatchingStateCss(doc, payload.state, el, view);
  }

  private applyDomStateAttrs(
    el: Element,
    doc: Document,
    payload: StudioSetStatePreviewPayload,
  ): void {
    this.saveAndSetAttr(el, TARGET_ATTR, '1');
    if (payload.state === 'selected') this.saveAndSetAttr(el, 'data-selected', 'true');
    if (payload.state === 'disabled') {
      this.saveAndSetAttr(el, 'disabled', '');
      this.saveAndSetAttr(el, 'aria-disabled', 'true');
    }
    if (payload.state === 'groupHover') {
      const groupEl =
        (payload.groupRef ? resolveElementsByRefs([payload.groupRef], doc)[0] : undefined) ??
        el.closest('.group') ??
        el.parentElement ??
        undefined;
      if (groupEl !== undefined) this.saveAndSetAttr(groupEl, GROUP_ATTR, '1');
    }
  }

  private injectMatchingStateCss(
    doc: Document,
    state: InspectorPreviewState,
    el: Element,
    view: Window,
  ): void {
    const cssBlocks: string[] = [];
    for (const sheet of Array.from(doc.styleSheets)) {
      try {
        collectSheetRules(sheet.cssRules, state, el, view, cssBlocks);
      } catch {
        // Cross-origin sheets cannot be inspected.
      }
    }
    if (cssBlocks.length > 0) {
      const style = doc.createElement('style');
      style.setAttribute(STATE_STYLE_ATTR, 'true');
      style.textContent = cssBlocks.join('\n');
      doc.head.appendChild(style);
      this.styleEl = style;
    }
  }

  public setSelectPanelPreview(doc: Document, groupRef: ElementRef, activeIndex?: number): void {
    const groupEl = resolveElementsByRefs([groupRef], doc)[0];
    if (groupEl === undefined || activeIndex === undefined) return;
    const view = doc.defaultView ?? window;
    groupEl.dispatchEvent(
      new view.CustomEvent('kumicraft:select-preview', { detail: { activeIndex } }),
    );
  }

  public destroy(doc: Document): void {
    this.clearState(doc);
    if (this.previewDark) {
      doc.documentElement.classList.remove('dark');
      this.previewDark = false;
    }
  }
}
