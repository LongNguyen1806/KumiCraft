// A capitalised export is a component only when the file makes it one (spec-log #121).
import { describe, expect, it } from 'vitest';

import { asAstNode, parseJsxAst } from '../../../lib/ast-helpers.ts';
import { topLevelKinds } from './component-kinds.ts';

const kindsOf = (code: string) => topLevelKinds(asAstNode(parseJsxAst(code)['program']));

describe('topLevelKinds', () => {
  it('keeps functions, classes, wrapped components (memo, observer, connect, styled…) and renamed ones', () => {
    const { components } = kindsOf(`
import { memo, forwardRef, lazy } from 'react';
import styled from 'styled-components';
export function Header() { return <header />; }
export const Card = () => <div />;
export const Fancy = function () { return <p />; };
export class Legacy extends React.Component { render() { return <i />; } }
export const Fast = memo(() => <b />);
export const Wrapped = React.memo(Card);
export const Input = forwardRef((props, ref) => <input ref={ref} />);
export const Page = lazy(() => import('./Page'));
export const Box = styled.div\`padding: 4px;\`;
export const Big = styled(Card)\`margin: 0;\`;
export const Typed = (() => <u />) as React.FC;
export const Dialog = DialogPrimitive.Root;
export const Trigger = DialogPrimitive.Trigger;
export const Alias = Card;
export const Store = observer(() => <div />);
export const Connected = connect(mapState)(Panel);
export const Animated = motion(Card);
export const Guarded = withAuth(Panel);
export const Config = createConfig();
`);
    expect([...components].sort()).toEqual(
      [
        'Big',
        'Box',
        'Card',
        'Fancy',
        'Fast',
        'Header',
        'Input',
        'Legacy',
        'Page',
        'Typed',
        'Wrapped',
        'Dialog',
        'Trigger',
        'Alias',
        'Store',
        'Connected',
        'Animated',
        'Guarded',
        'Config',
      ].sort(),
    );
  });

  it('leaves out constants, objects, strings and arrays even when written in capitals', () => {
    const { declared, components } = kindsOf(`
export const AI_VERDICT = { approve: 'approve', reject: 'reject' };
export const ROLES = ['admin', 'user'];
export const Title = 'Dashboard';
export const MAX = 5;
export const API_URL = buildUrl();
export const Cache = new Map();
export const VN_PHONE = /^0\\d{9}$/;
export const PRIMARY = COLORS.PRIMARY;
export const LIMIT = MAX;
`);
    expect(components.size).toBe(0);
    expect([...declared].sort()).toEqual(
      [
        'AI_VERDICT',
        'API_URL',
        'Cache',
        'LIMIT',
        'MAX',
        'PRIMARY',
        'ROLES',
        'Title',
        'VN_PHONE',
      ].sort(),
    );
  });

  it('does not count a name the file only re-exports as declared here', () => {
    const { declared } = kindsOf("export { Button } from './button';\n");
    expect(declared.has('Button')).toBe(false);
  });
});
