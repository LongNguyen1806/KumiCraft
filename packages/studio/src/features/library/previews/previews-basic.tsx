import type { JSX } from 'react';

import { WireBar, WireBox, WireSvg } from './preview-primitives.tsx';

export type PreviewRenderer = () => JSX.Element;

export const PREVIEWS_BASIC: Readonly<Record<string, PreviewRenderer>> = {
  'layout.row': () => (
    <WireSvg>
      <WireBox x={8} y={18} w={30} h={40} />
      <WireBox x={45} y={18} w={30} h={40} />
      <WireBox x={82} y={18} w={30} h={40} />
    </WireSvg>
  ),
  'layout.column': () => (
    <WireSvg>
      <WireBox x={16} y={8} w={88} h={16} />
      <WireBox x={16} y={30} w={88} h={16} />
      <WireBox x={16} y={52} w={88} h={16} />
    </WireSvg>
  ),
  'layout.grid': () => (
    <WireSvg>
      <WireBox x={10} y={10} w={46} h={25} />
      <WireBox x={64} y={10} w={46} h={25} />
      <WireBox x={10} y={41} w={46} h={25} />
      <WireBox x={64} y={41} w={46} h={25} />
    </WireSvg>
  ),
  'layout.section': () => (
    <WireSvg>
      <WireBox x={8} y={10} w={104} h={56} />
      <WireBar x={20} y={24} w={46} h={5} strong />
      <WireBar x={20} y={35} w={76} />
      <WireBar x={20} y={44} w={60} />
    </WireSvg>
  ),
  'content.heading': () => (
    <WireSvg>
      <WireBar x={12} y={24} w={88} h={9} strong />
      <WireBar x={12} y={41} w={62} h={5} />
    </WireSvg>
  ),
  'content.paragraph': () => (
    <WireSvg>
      <WireBar x={12} y={20} w={96} />
      <WireBar x={12} y={30} w={92} />
      <WireBar x={12} y={40} w={84} />
      <WireBar x={12} y={50} w={56} />
    </WireSvg>
  ),
  'content.image': () => (
    <WireSvg>
      <WireBox x={14} y={12} w={92} h={52} muted />
      <circle cx={34} cy={27} r={5} fill="currentColor" fillOpacity={0.35} />
      <path d="M22 56 L46 36 L64 49 L80 34 L98 56 Z" fill="currentColor" fillOpacity={0.28} />
    </WireSvg>
  ),
  'content.link': () => (
    <WireSvg>
      <WireBar x={22} y={33} w={76} h={5} strong />
      <line
        x1={22}
        y1={42}
        x2={98}
        y2={42}
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={1.5}
      />
    </WireSvg>
  ),
  'content.list': () => (
    <WireSvg>
      {[20, 36, 52].map((y) => (
        <g key={y}>
          <circle cx={20} cy={y + 2} r={2.5} fill="currentColor" fillOpacity={0.5} />
          <WireBar x={28} y={y} w={74} />
        </g>
      ))}
    </WireSvg>
  ),
  'content.list-ordered': () => (
    <WireSvg>
      {[20, 36, 52].map((y) => (
        <g key={y}>
          <WireBar x={18} y={y} w={6} strong />
          <WireBar x={29} y={y} w={72} />
        </g>
      ))}
    </WireSvg>
  ),
  'content.placeholder-image': () => (
    <WireSvg>
      <WireBox x={14} y={12} w={92} h={52} />
      <line x1={14} y1={12} x2={106} y2={64} stroke="currentColor" strokeOpacity={0.22} />
      <line x1={106} y1={12} x2={14} y2={64} stroke="currentColor" strokeOpacity={0.22} />
    </WireSvg>
  ),
  'content.quote': () => (
    <WireSvg>
      <WireBar x={16} y={18} w={4} h={40} strong />
      <WireBar x={28} y={24} w={76} strong />
      <WireBar x={28} y={35} w={64} />
      <WireBar x={28} y={48} w={38} />
    </WireSvg>
  ),
  'content.divider': () => (
    <WireSvg>
      <line x1={12} y1={38} x2={108} y2={38} stroke="currentColor" strokeOpacity={0.45} />
    </WireSvg>
  ),
  'content.spacer': () => (
    <WireSvg>
      <WireBox x={16} y={16} w={88} h={44} />
      <line x1={60} y1={22} x2={60} y2={54} stroke="currentColor" strokeDasharray="3 2" />
    </WireSvg>
  ),
  'content.video': () => (
    <WireSvg>
      <WireBox x={14} y={12} w={92} h={52} muted />
      <polygon points="54,29 54,47 70,38" fill="currentColor" fillOpacity={0.55} />
    </WireSvg>
  ),
  'data.table': () => (
    <WireSvg>
      <WireBox x={10} y={14} w={100} h={48} />
      <WireBar x={14} y={19} w={92} h={8} strong />
      <WireBar x={16} y={35} w={86} />
      <WireBar x={16} y={49} w={86} />
    </WireSvg>
  ),
  'composite.card': () => (
    <WireSvg>
      <WireBox x={18} y={10} w={84} h={56} rx={5} />
      <WireBox x={24} y={16} w={72} h={22} muted />
      <WireBar x={24} y={44} w={46} h={5} strong />
      <WireBar x={24} y={54} w={64} />
    </WireSvg>
  ),
  'composite.navbar': () => (
    <WireSvg>
      <WireBox x={8} y={24} w={104} h={26} />
      <WireBar x={14} y={34} w={18} h={6} strong />
      <WireBar x={48} y={35} w={14} />
      <WireBar x={66} y={35} w={14} />
      <WireBox x={88} y={31} w={18} h={12} accent />
    </WireSvg>
  ),
  'composite.footer': () => (
    <WireSvg>
      <WireBox x={8} y={38} w={104} h={28} muted />
      <WireBar x={16} y={48} w={26} strong />
      <WireBar x={56} y={48} w={14} />
      <WireBar x={76} y={48} w={26} />
    </WireSvg>
  ),
  'composite.hero': () => (
    <WireSvg>
      <WireBox x={8} y={10} w={104} h={56} />
      <WireBar x={30} y={22} w={60} h={6} strong />
      <WireBar x={24} y={33} w={72} />
      <WireBox x={44} y={44} w={32} h={12} accent />
    </WireSvg>
  ),
};
