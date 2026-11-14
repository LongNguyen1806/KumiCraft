import type { JSX } from 'react';

import { WireBar, WireBox, WireSvg } from './preview-primitives.tsx';

type PreviewRenderer = () => JSX.Element;

export const PREVIEWS_DISPLAY_NAV: Readonly<Record<string, PreviewRenderer>> = {
  'display.badge': () => (
    <WireSvg>
      <WireBox x={34} y={29} w={52} h={18} rx={9} accent />
      <WireBar x={44} y={36} w={32} strong />
    </WireSvg>
  ),
  'display.avatar': () => (
    <WireSvg>
      <circle cx={40} cy={38} r={14} fill="currentColor" fillOpacity={0.18} stroke="currentColor" />
      <WireBar x={60} y={31} w={34} h={5} strong />
      <WireBar x={60} y={41} w={24} />
    </WireSvg>
  ),
  'display.stat': () => (
    <WireSvg>
      <WireBox x={20} y={14} w={80} h={48} />
      <WireBar x={30} y={24} w={30} />
      <WireBar x={30} y={34} w={46} h={9} strong />
      <WireBar x={30} y={49} w={24} />
    </WireSvg>
  ),
  'display.alert': () => (
    <WireSvg>
      <WireBox x={12} y={22} w={96} h={32} accent />
      <circle cx={24} cy={34} r={4} fill="currentColor" fillOpacity={0.5} />
      <WireBar x={34} y={31} w={48} strong />
      <WireBar x={34} y={41} w={62} />
    </WireSvg>
  ),
  'display.progress': () => (
    <WireSvg>
      <WireBar x={14} y={26} w={38} strong />
      <WireBox x={14} y={37} w={92} h={10} rx={5} />
      <WireBox x={14} y={37} w={58} h={10} rx={5} accent />
    </WireSvg>
  ),
  'form.button': () => (
    <WireSvg>
      <WireBox x={28} y={26} w={64} h={24} rx={5} accent />
      <WireBar x={42} y={36} w={36} strong />
    </WireSvg>
  ),
  'form.input': () => (
    <WireSvg>
      <WireBar x={16} y={21} w={30} strong />
      <WireBox x={16} y={30} w={88} h={22} />
      <WireBar x={23} y={39} w={42} />
    </WireSvg>
  ),
  'form.form': () => (
    <WireSvg>
      <WireBox x={18} y={8} w={84} h={60} />
      <WireBox x={26} y={16} w={68} h={12} />
      <WireBox x={26} y={33} w={68} h={12} />
      <WireBox x={26} y={50} w={34} h={11} accent />
    </WireSvg>
  ),
  'form.textarea': () => (
    <WireSvg>
      <WireBar x={16} y={14} w={34} strong />
      <WireBox x={16} y={22} w={88} h={40} />
      <WireBar x={24} y={30} w={56} />
    </WireSvg>
  ),
  'form.select': () => (
    <WireSvg>
      <WireBar x={16} y={21} w={32} strong />
      <WireBox x={16} y={30} w={88} h={22} />
      <WireBar x={24} y={39} w={44} />
      <path d="M90 38 L95 43 L100 38" stroke="currentColor" strokeOpacity={0.5} />
    </WireSvg>
  ),
  'form.checkbox': () => (
    <WireSvg>
      <WireBox x={24} y={29} w={16} h={16} accent />
      <path d="M28 37 L31 40 L37 33" stroke="currentColor" strokeWidth={1.5} />
      <WireBar x={46} y={35} w={48} strong />
    </WireSvg>
  ),
  'form.radio-group': () => (
    <WireSvg>
      {[24, 44].map((y, idx) => (
        <g key={y}>
          <circle cx={30} cy={y} r={6} stroke="currentColor" strokeOpacity={0.45} />
          {idx === 0 ? <circle cx={30} cy={y} r={3} fill="currentColor" /> : undefined}
          <WireBar x={42} y={y - 2} w={50} />
        </g>
      ))}
    </WireSvg>
  ),
  'form.switch': () => (
    <WireSvg>
      <WireBox x={24} y={29} w={30} h={16} rx={8} accent />
      <circle cx={46} cy={37} r={5} fill="currentColor" fillOpacity={0.65} />
      <WireBar x={60} y={35} w={36} strong />
    </WireSvg>
  ),
  'form.search': () => (
    <WireSvg>
      <WireBox x={14} y={26} w={92} h={24} rx={12} />
      <circle cx={27} cy={38} r={4} stroke="currentColor" strokeOpacity={0.5} />
      <WireBar x={36} y={36} w={46} />
    </WireSvg>
  ),
  'form.date': () => (
    <WireSvg>
      <WireBar x={16} y={20} w={32} strong />
      <WireBox x={16} y={29} w={88} h={22} />
      <WireBox x={84} y={34} w={12} h={12} muted />
    </WireSvg>
  ),
  'form.file': () => (
    <WireSvg>
      <WireBox x={16} y={14} w={88} h={48} />
      <path d="M60 28 L60 44 M54 34 L60 28 L66 34" stroke="currentColor" strokeOpacity={0.55} />
      <WireBar x={38} y={50} w={44} />
    </WireSvg>
  ),
  'navigation.breadcrumb': () => (
    <WireSvg>
      <WireBar x={14} y={36} w={20} />
      <WireBar x={40} y={36} w={4} strong />
      <WireBar x={50} y={36} w={22} />
      <WireBar x={78} y={36} w={4} strong />
      <WireBar x={88} y={36} w={20} strong />
    </WireSvg>
  ),
  'navigation.pagination': () => (
    <WireSvg>
      <WireBox x={16} y={28} w={18} h={18} />
      <WireBox x={38} y={28} w={18} h={18} accent />
      <WireBox x={60} y={28} w={18} h={18} />
      <WireBox x={82} y={28} w={18} h={18} />
    </WireSvg>
  ),
  'navigation.sidebar': () => (
    <WireSvg>
      <WireBox x={10} y={10} w={36} h={56} muted />
      <WireBar x={16} y={19} w={24} h={5} strong />
      <WireBar x={16} y={31} w={22} />
      <WireBar x={16} y={41} w={20} />
      <WireBox x={52} y={10} w={58} h={56} />
    </WireSvg>
  ),
};
