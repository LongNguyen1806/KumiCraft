// VG-14 by hand: serves the rich-text spike so a person can type the sample passage with a real
// Vietnamese input method (Unikey or EVKey on Windows, the built-in one on macOS). The page shows
// "KHỚP" when the typed text equals the passage: nothing lost, nothing doubled.
// Run with: node scripts/vg/vg-14-manual.mjs   (Ctrl+C to stop)
import { buildSpikes, serveSpikes } from './spike-server.mjs';

buildSpikes();
const { origin } = await serveSpikes();
const url = `${origin}/vg-14/index.html?manual=1`;
console.log(`VG-14 manual check: ${url}`);
console.log(
  'Double-click "Xin chào", delete it, type the yellow passage with your input method, press Esc.',
);
