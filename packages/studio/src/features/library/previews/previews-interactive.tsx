import type { JSX } from 'react';

import { WireBar, WireBox, WireSvg } from './preview-primitives.tsx';

type PreviewRenderer = () => JSX.Element;

export const PREVIEWS_INTERACTIVE: Readonly<Record<string, PreviewRenderer>> = {
  'interactive.tabs': () => (
    <WireSvg>
      <WireBox x={12} y={12} w={30} h={13} accent />
      <WireBox x={45} y={12} w={30} h={13} />
      <WireBox x={78} y={12} w={30} h={13} />
      <WireBox x={12} y={29} w={96} h={35} />
      <WireBar x={20} y={39} w={68} />
      <WireBar x={20} y={49} w={48} />
    </WireSvg>
  ),
  'interactive.accordion': () => (
    <WireSvg>
      <WireBox x={12} y={10} w={96} h={32} accent />
      <WireBar x={20} y={18} w={48} strong />
      <WireBar x={20} y={29} w={74} />
      <WireBox x={12} y={48} w={96} h={16} />
      <WireBar x={20} y={54} w={54} />
    </WireSvg>
  ),
  'interactive.toggle': () => (
    <WireSvg>
      <WireBox x={28} y={26} w={64} h={24} rx={12} accent />
      <WireBar x={44} y={36} w={32} strong />
    </WireSvg>
  ),
  'interactive.choice': () => (
    <WireSvg>
      <WireBox x={14} y={26} w={28} h={24} accent />
      <WireBox x={46} y={26} w={28} h={24} />
      <WireBox x={78} y={26} w={28} h={24} />
    </WireSvg>
  ),
  'interactive.carousel': () => (
    <WireSvg>
      <WireBox x={18} y={12} w={84} h={42} muted />
      <WireBox x={8} y={28} w={10} h={12} accent />
      <WireBox x={102} y={28} w={10} h={12} accent />
      <circle cx={52} cy={63} r={2.5} fill="currentColor" fillOpacity={0.6} />
      <circle cx={60} cy={63} r={2.5} fill="currentColor" fillOpacity={0.25} />
      <circle cx={68} cy={63} r={2.5} fill="currentColor" fillOpacity={0.25} />
    </WireSvg>
  ),
  'interactive.modal': () => (
    <WireSvg>
      <WireBox x={8} y={8} w={104} h={60} muted />
      <WireBox x={24} y={16} w={72} h={44} />
      <WireBar x={32} y={24} w={36} strong />
      <WireBar x={32} y={34} w={52} />
      <WireBox x={64} y={44} w={24} h={10} accent />
    </WireSvg>
  ),
  'interactive.drawer': () => (
    <WireSvg>
      <WireBox x={8} y={8} w={104} h={60} muted />
      <WireBox x={64} y={8} w={48} h={60} />
      <WireBar x={72} y={18} w={30} strong />
      <WireBar x={72} y={29} w={32} />
      <WireBar x={72} y={38} w={26} />
    </WireSvg>
  ),
  'interactive.dropdown': () => (
    <WireSvg>
      <WireBox x={24} y={12} w={48} h={14} accent />
      <WireBox x={24} y={29} w={68} h={36} />
      <WireBar x={32} y={37} w={46} />
      <WireBar x={32} y={46} w={40} />
      <WireBar x={32} y={55} w={50} />
    </WireSvg>
  ),
  'interactive.tooltip': () => (
    <WireSvg>
      <WireBox x={30} y={14} w={60} h={18} rx={4} accent />
      <WireBar x={40} y={21} w={40} strong />
      <WireBox x={42} y={42} w={36} h={16} />
    </WireSvg>
  ),
  'interactive.mobile-menu': () => (
    <WireSvg>
      <WireBox x={10} y={10} w={100} h={16} />
      <WireBox x={90} y={14} w={14} h={8} accent />
      <WireBox x={10} y={30} w={100} h={36} muted />
      <WireBar x={20} y={38} w={44} />
      <WireBar x={20} y={48} w={36} />
      <WireBar x={20} y={58} w={50} />
    </WireSvg>
  ),
  'interactive.toast-demo': () => (
    <WireSvg>
      <WireBox x={14} y={14} w={40} h={14} rx={3} accent />
      <WireBox x={42} y={42} w={68} h={24} rx={4} />
      <WireBar x={48} y={49} w={38} strong />
      <WireBar x={48} y={57} w={52} />
    </WireSvg>
  ),
};
