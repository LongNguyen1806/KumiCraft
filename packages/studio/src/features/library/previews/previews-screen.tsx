import type { JSX } from 'react';

import { WireBar, WireBox, WireSvg } from './preview-primitives.tsx';

type PreviewRenderer = () => JSX.Element;

export const PREVIEWS_SCREEN: Readonly<Record<string, PreviewRenderer>> = {
  'screen.login': () => (
    <WireSvg>
      <WireBox x={30} y={8} w={60} h={60} />
      <WireBar x={44} y={16} w={32} strong />
      <WireBox x={38} y={26} w={44} h={10} />
      <WireBox x={38} y={40} w={44} h={10} />
      <WireBox x={38} y={54} w={44} h={9} accent />
    </WireSvg>
  ),
  'screen.dashboard': () => (
    <WireSvg>
      <WireBox x={8} y={8} w={24} h={60} muted />
      <WireBox x={36} y={8} w={24} h={18} />
      <WireBox x={63} y={8} w={24} h={18} />
      <WireBox x={90} y={8} w={22} h={18} />
      <WireBox x={36} y={30} w={76} h={38} />
    </WireSvg>
  ),
  'screen.settings': () => (
    <WireSvg>
      <WireBox x={8} y={8} w={26} h={60} muted />
      <WireBox x={38} y={8} w={74} h={60} />
      <WireBar x={46} y={18} w={34} strong />
      <WireBox x={46} y={28} w={56} h={12} />
      <WireBox x={46} y={45} w={56} h={12} />
    </WireSvg>
  ),
  'screen.list-detail': () => (
    <WireSvg>
      <WireBox x={8} y={8} w={36} h={60} muted />
      <WireBar x={14} y={16} w={24} />
      <WireBar x={14} y={26} w={24} />
      <WireBar x={14} y={36} w={24} />
      <WireBox x={48} y={8} w={64} h={60} />
      <WireBar x={56} y={20} w={42} strong />
      <WireBar x={56} y={32} w={48} />
    </WireSvg>
  ),
  'screen.not-found': () => (
    <WireSvg>
      <WireBar x={42} y={18} w={36} h={14} strong />
      <WireBar x={32} y={38} w={56} />
      <WireBox x={44} y={48} w={32} h={12} accent />
    </WireSvg>
  ),
  'screen.landing-a': () => (
    <WireSvg>
      <WireBox x={10} y={8} w={100} h={10} />
      <WireBox x={10} y={21} w={100} h={22} accent />
      <WireBox x={10} y={46} w={48} h={20} />
      <WireBox x={62} y={46} w={48} h={20} />
    </WireSvg>
  ),
  'screen.landing-b': () => (
    <WireSvg>
      <WireBox x={10} y={8} w={100} h={9} />
      <WireBox x={10} y={20} w={100} h={18} accent />
      <WireBox x={10} y={41} w={31} h={16} />
      <WireBox x={44} y={41} w={32} h={16} />
      <WireBox x={80} y={41} w={30} h={16} />
      <WireBox x={10} y={60} w={100} h={8} muted />
    </WireSvg>
  ),
};
