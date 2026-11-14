import type { JSX } from 'react';

import { WireBar, WireBox, WireSvg } from './preview-primitives.tsx';

type PreviewRenderer = () => JSX.Element;

export const PREVIEWS_LANDING: Readonly<Record<string, PreviewRenderer>> = {
  'landing.pricing': () => (
    <WireSvg>
      <WireBox x={8} y={16} w={31} h={46} />
      <WireBox x={44} y={10} w={32} h={56} accent />
      <WireBox x={81} y={16} w={31} h={46} />
    </WireSvg>
  ),
  'landing.testimonials': () => (
    <WireSvg>
      <WireBox x={10} y={16} w={46} h={44} />
      <WireBox x={64} y={16} w={46} h={44} />
      <WireBar x={16} y={26} w={34} />
      <WireBar x={70} y={26} w={34} />
      <circle cx={20} cy={49} r={4} fill="currentColor" fillOpacity={0.4} />
      <circle cx={74} cy={49} r={4} fill="currentColor" fillOpacity={0.4} />
    </WireSvg>
  ),
  'landing.faq': () => (
    <WireSvg>
      <WireBox x={12} y={10} w={96} h={22} accent />
      <WireBox x={12} y={36} w={96} h={13} />
      <WireBox x={12} y={53} w={96} h={13} />
    </WireSvg>
  ),
  'landing.stats': () => (
    <WireSvg>
      {[12, 46, 80].map((x) => (
        <g key={x}>
          <WireBox x={x} y={18} w={28} h={40} />
          <WireBar x={x + 5} y={29} w={18} h={7} strong />
          <WireBar x={x + 5} y={42} w={16} />
        </g>
      ))}
    </WireSvg>
  ),
  'landing.logos': () => (
    <WireSvg>
      <WireBar x={38} y={18} w={44} />
      {[12, 38, 64, 90].map((x) => (
        <WireBox key={x} x={x} y={32} w={18} h={16} muted />
      ))}
    </WireSvg>
  ),
  'landing.team': () => (
    <WireSvg>
      {[24, 60, 96].map((cx) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy={30}
            r={10}
            fill="currentColor"
            fillOpacity={0.18}
            stroke="currentColor"
          />
          <WireBar x={cx - 10} y={46} w={20} strong />
          <WireBar x={cx - 8} y={54} w={16} />
        </g>
      ))}
    </WireSvg>
  ),
  'landing.features': () => (
    <WireSvg>
      <WireBox x={10} y={12} w={46} h={24} />
      <WireBox x={64} y={12} w={46} h={24} />
      <WireBox x={10} y={42} w={46} h={24} />
      <WireBox x={64} y={42} w={46} h={24} />
    </WireSvg>
  ),
  'landing.cta': () => (
    <WireSvg>
      <WireBox x={10} y={14} w={100} h={48} accent />
      <WireBar x={26} y={26} w={68} h={6} strong />
      <WireBox x={42} y={42} w={36} h={12} accent />
    </WireSvg>
  ),
  'landing.comparison': () => (
    <WireSvg>
      <WireBox x={10} y={12} w={100} h={52} />
      <line x1={62} y1={12} x2={62} y2={64} stroke="currentColor" strokeOpacity={0.28} />
      <line x1={86} y1={12} x2={86} y2={64} stroke="currentColor" strokeOpacity={0.28} />
      <WireBar x={16} y={24} w={38} />
      <WireBar x={16} y={38} w={34} />
      <WireBar x={16} y={52} w={40} />
    </WireSvg>
  ),
  'landing.timeline': () => (
    <WireSvg>
      <line x1={26} y1={14} x2={26} y2={62} stroke="currentColor" strokeOpacity={0.4} />
      {[18, 38, 58].map((y) => (
        <g key={y}>
          <circle cx={26} cy={y} r={4} fill="currentColor" fillOpacity={0.55} />
          <WireBar x={36} y={y - 2} w={64} />
        </g>
      ))}
    </WireSvg>
  ),
  'landing.blog-card': () => (
    <WireSvg>
      <WireBox x={18} y={8} w={84} h={60} />
      <WireBox x={24} y={13} w={72} h={22} muted />
      <WireBar x={24} y={41} w={24} strong />
      <WireBar x={24} y={50} w={68} h={5} strong />
      <WireBar x={24} y={59} w={46} />
    </WireSvg>
  ),
  'landing.footer-columns': () => (
    <WireSvg>
      <WireBox x={8} y={22} w={104} h={44} muted />
      {[16, 44, 72].map((x) => (
        <g key={x}>
          <WireBar x={x} y={30} w={20} strong />
          <WireBar x={x} y={40} w={18} />
          <WireBar x={x} y={48} w={16} />
        </g>
      ))}
    </WireSvg>
  ),
  'landing.hero-image': () => (
    <WireSvg>
      <WireBar x={12} y={22} w={42} h={6} strong />
      <WireBar x={12} y={33} w={40} />
      <WireBox x={12} y={44} w={28} h={11} accent />
      <WireBox x={62} y={14} w={48} h={48} muted />
    </WireSvg>
  ),
  'landing.hero-form': () => (
    <WireSvg>
      <WireBar x={26} y={16} w={68} h={6} strong />
      <WireBar x={22} y={27} w={76} />
      <WireBox x={18} y={40} w={54} h={16} />
      <WireBox x={76} y={40} w={26} h={16} accent />
    </WireSvg>
  ),
};
