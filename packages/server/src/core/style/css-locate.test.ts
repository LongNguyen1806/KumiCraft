// Tests #14 and #15: css-locate resolving nested selectors, mixins, and media (R-ST-04).
import type { Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

import { findRule, parseStylesheet, resolvedSelector, walkRulesWithMedia } from './css-locate.ts';

describe('css-locate [R-ST-04]', () => {
  it('.card { .title {…} &:hover {…} &-body {…} } → resolvedSelector là .card .title, .card:hover, .card-body [R-ST-04]', () => {
    const scss = `
.card {
  padding: 16px;
  .title {
    font-size: 18px;
  }
  &:hover {
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  &-body {
    color: #333;
  }
}
`;
    const root = parseStylesheet(scss, 'main.scss');

    const titleRule = findRule(root, { selector: '.card .title', media: [], occurrence: 0 });
    expect(titleRule).toBeDefined();
    if (titleRule !== undefined && titleRule.type === 'rule') {
      expect(resolvedSelector(titleRule as Rule)).toBe('.card .title');
    }

    const hoverRule = findRule(root, { selector: '.card:hover', media: [], occurrence: 0 });
    expect(hoverRule).toBeDefined();
    if (hoverRule !== undefined && hoverRule.type === 'rule') {
      expect(resolvedSelector(hoverRule as Rule)).toBe('.card:hover');
    }

    const bodyRule = findRule(root, { selector: '.card-body', media: [], occurrence: 0 });
    expect(bodyRule).toBeDefined();
    if (bodyRule !== undefined && bodyRule.type === 'rule') {
      expect(resolvedSelector(bodyRule as Rule)).toBe('.card-body');
    }
  });

  it('Rule trong @mixin và selector #{$x} → không tìm được; @media lồng trong rule tính là media của rule [R-ST-04]', () => {
    const scss = `
@mixin card-theme {
  .in-mixin {
    color: red;
  }
}

.box {
  #{$dynamic} {
    color: blue;
  }
  @media (min-width: 768px) {
    .inner {
      font-size: 16px;
    }
  }
}
`;
    const root = parseStylesheet(scss, 'main.scss');

    // Rule in @mixin must NOT be found
    const mixinRule = findRule(root, { selector: '.in-mixin', media: [], occurrence: 0 });
    expect(mixinRule).toBeUndefined();

    // Rule with interpolation #{$dynamic} must NOT be found
    let foundDynamic = false;
    root.walkRules((r) => {
      if (r.selector.includes('#{')) {
        const res = resolvedSelector(r);
        if (res !== undefined) foundDynamic = true;
      }
    });
    expect(foundDynamic).toBe(false);

    // Nested @media must count as media of the rule
    const innerRule = findRule(root, {
      selector: '.box .inner',
      media: ['(min-width: 768px)'],
      occurrence: 0,
    });
    expect(innerRule).toBeDefined();
    if (innerRule !== undefined && innerRule.type === 'rule') {
      expect(resolvedSelector(innerRule as Rule)).toBe('.box .inner');
    }
  });

  it('[R-ST-09] .card { @media (max-width: 640px) { padding: 8px; } }: sau khi duyệt, cây cú pháp in lại GIỐNG HỆT văn bản gốc', () => {
    const scss = [
      '.card {',
      '  padding: 16px;',
      '  @media (max-width: 640px) {',
      '    padding: 8px;',
      '  }',
      '}',
    ].join('\n');
    const root = parseStylesheet(scss, 'main.scss');
    let visitedCount = 0;
    walkRulesWithMedia(root, [], () => {
      visitedCount++;
      return false;
    });
    expect(visitedCount).toBeGreaterThan(0);
    expect(root.toString()).toBe(scss);
  });

  it('[R-ST-04] .list { .item:nth-child(2) { … } } → resolvedSelector .list .item:nth-child(2); .m() { … } (Less) → undefined', () => {
    const scss = ['.list {', '  .item:nth-child(2) {', '    color: red;', '  }', '}'].join('\n');
    const scssRoot = parseStylesheet(scss, 'main.scss');
    const nthRule = findRule(scssRoot, {
      selector: '.list .item:nth-child(2)',
      media: [],
      occurrence: 0,
    });
    expect(nthRule).toBeDefined();

    const less = ['.m() {', '  color: red;', '}'].join('\n');
    const lessRoot = parseStylesheet(less, 'main.less');
    const mixinRule = findRule(lessRoot, { selector: '.m()', media: [], occurrence: 0 });
    expect(mixinRule).toBeUndefined();
  });
});
