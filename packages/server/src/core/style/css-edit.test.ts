// Minimal CSS edits of the style layer (SPEC-04 M-ST, R-ST-06, R-ST-09).
import { describe, expect, it } from 'vitest';

import { appendRule, setDeclarationAt, setRuleDeclaration } from './css-edit.ts';

const CSS = `.card {
  padding: 16px;
  border: 1px solid #e2e8f0
}

@media (max-width: 640px) {
  .card {
    padding: 8px;
  }
}
`;

const card = { selector: '.card', media: [], occurrence: 0 };

describe('setRuleDeclaration [R-ST-06]', () => {
  it('changes an existing declaration in place and nothing else', () => {
    const out = setRuleDeclaration(CSS, card, 'padding', '24px');
    expect(out.ok && out.value).toBe(CSS.replace('padding: 16px;', 'padding: 24px;'));
  });

  it('adds a longhand last, after a declaration without a semicolon, so it wins over the shorthand', () => {
    const out = setRuleDeclaration(CSS, card, 'padding-top', '24px');
    expect(out.ok && out.value).toBe(
      CSS.replace('solid #e2e8f0\n}', 'solid #e2e8f0;\n  padding-top: 24px;\n}'),
    );
  });

  it('edits the rule under @media the browser reported, and removes a declaration with its line', () => {
    const media = { selector: '.card', media: ['(max-width: 640px)'], occurrence: 0 };
    const set = setRuleDeclaration(CSS, media, 'padding', '4px');
    expect(set.ok && set.value).toBe(CSS.replace('padding: 8px;', 'padding: 4px;'));
    const removed = setRuleDeclaration(CSS, card, 'padding', undefined);
    expect(removed.ok && removed.value).toBe(CSS.replace('\n  padding: 16px;', ''));
  });

  it('refuses a rule the file no longer has, and keeps CRLF and an empty rule tidy', () => {
    expect(setRuleDeclaration(CSS, { ...card, occurrence: 3 }, 'color', 'red').ok).toBe(false);
    const empty = setRuleDeclaration(
      '.x {}\r\n',
      { selector: '.x', media: [], occurrence: 0 },
      'color',
      'red',
    );
    expect(empty.ok && empty.value).toBe('.x {\r\n  color: red;\r\n}\r\n');
  });
});

describe('setDeclarationAt [R-ST-06]', () => {
  it('changes an existing declaration in place or adds at end, and rejects non-existent index: setDeclarationAt đổi đúng chỗ / thêm cuối; index không tồn tại → E016 ruleNotFound [R-ST-06]', () => {
    const changed = setDeclarationAt(CSS, 0, 'padding', '24px');
    expect(changed.ok && changed.value).toBe(CSS.replace('padding: 16px;', 'padding: 24px;'));

    const added = setDeclarationAt(CSS, 0, 'padding-top', '24px');
    expect(added.ok && added.value).toBe(
      CSS.replace('solid #e2e8f0\n}', 'solid #e2e8f0;\n  padding-top: 24px;\n}'),
    );

    const mediaChanged = setDeclarationAt(CSS, 1, 'padding', '4px');
    expect(mediaChanged.ok && mediaChanged.value).toBe(
      CSS.replace('padding: 8px;', 'padding: 4px;'),
    );

    const notFound = setDeclarationAt(CSS, 99, 'color', 'red');
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) {
      expect(notFound.error).toEqual({ code: 'E016', params: { reason: 'ruleNotFound' } });
    }
  });
});

describe('appendRule [R-ST-06, R-ST-09]', () => {
  it('adds a rule at the end of the file', () => {
    const out = appendRule(CSS, '.card.card-a1b2', [{ property: 'padding-top', value: '24px' }]);
    expect(out.ok && out.value).toBe(`${CSS}\n.card.card-a1b2 {\n  padding-top: 24px;\n}\n`);
  });

  it('reuses a top-level @media block with the same condition, or opens a new one', () => {
    const into = appendRule(CSS, '.x', [{ property: 'color', value: 'red' }], '(max-width:640px)');
    expect(into.ok && into.value).toBe(
      CSS.replace(
        '    padding: 8px;\n  }\n}',
        '    padding: 8px;\n  }\n\n  .x {\n    color: red;\n  }\n}',
      ),
    );
    const fresh = appendRule(
      CSS,
      '.x',
      [{ property: 'color', value: 'red' }],
      '(min-width: 768px)',
    );
    expect(fresh.ok && fresh.value).toBe(
      `${CSS}\n@media (min-width: 768px) {\n  .x {\n    color: red;\n  }\n}\n`,
    );
  });
});
