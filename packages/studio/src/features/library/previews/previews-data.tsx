import { WireBar, WireBox, WireSvg } from './preview-primitives.tsx';
import type { PreviewRenderer } from './previews-basic.tsx';

export const PREVIEWS_DATA: Readonly<Record<string, PreviewRenderer>> = {
  'data.form-from-source': () => (
    <WireSvg>
      <WireBox x={10} y={8} w={100} h={60} muted />
      <WireBar x={18} y={14} w={36} h={4} strong />
      <WireBox x={18} y={22} w={84} h={10} />
      <WireBar x={18} y={36} w={30} h={4} strong />
      <WireBox x={18} y={44} w={84} h={10} />
      <rect x={68} y={58} width={34} height={7} rx={2} fill="currentColor" fillOpacity={0.55} />
    </WireSvg>
  ),
  'data.table-from-source': () => (
    <WireSvg>
      <WireBox x={8} y={10} w={104} h={56} />
      <rect x={8} y={10} width={104} height={13} rx={2} fill="currentColor" fillOpacity={0.14} />
      <WireBar x={14} y={15} w={24} h={3} strong />
      <WireBar x={48} y={15} w={24} h={3} strong />
      <WireBar x={82} y={15} w={22} h={3} strong />
      {[29, 41, 53].map((y) => (
        <g key={y}>
          <WireBar x={14} y={y} w={26} />
          <WireBar x={48} y={y} w={24} />
          <WireBar x={82} y={y} w={20} />
        </g>
      ))}
    </WireSvg>
  ),
  'data.states': () => (
    <WireSvg>
      <WireBox x={8} y={12} w={32} h={52} />
      <WireBox x={44} y={12} w={32} h={52} />
      <WireBox x={80} y={12} w={32} h={52} />
      <WireBar x={13} y={24} w={22} strong />
      <circle cx={60} cy={32} r={6} fill="currentColor" fillOpacity={0.22} />
      <WireBar x={85} y={36} w={22} strong />
    </WireSvg>
  ),
  'data.loading': () => (
    <WireSvg>
      <WireBox x={12} y={12} w={96} h={52} muted />
      <rect x={20} y={20} width={80} height={8} rx={3} fill="currentColor" fillOpacity={0.2} />
      <rect x={20} y={34} width={64} height={8} rx={3} fill="currentColor" fillOpacity={0.16} />
      <rect x={20} y={48} width={48} height={8} rx={3} fill="currentColor" fillOpacity={0.12} />
    </WireSvg>
  ),
  'data.empty': () => (
    <WireSvg>
      <WireBox x={12} y={10} w={96} h={56} muted />
      <circle cx={60} cy={27} r={8} fill="currentColor" fillOpacity={0.18} />
      <WireBar x={36} y={41} w={48} strong />
      <WireBar x={28} y={50} w={64} />
    </WireSvg>
  ),
  'data.error': () => (
    <WireSvg>
      <WireBox x={12} y={12} w={96} h={52} muted />
      <circle cx={60} cy={26} r={7} fill="currentColor" fillOpacity={0.38} />
      <WireBar x={34} y={39} w={52} strong />
      <rect x={44} y={49} width={32} height={8} rx={2} fill="currentColor" fillOpacity={0.4} />
    </WireSvg>
  ),
};
