// Foreign component overlay helper (SPEC-04 section 18A, R-CP-11, spec-log #23).

/**
 * Returns the base filename without extension for an element that belongs to a different file
 * than the currently designed file. Returns undefined if the element belongs to the design file
 * or if designFile is undefined.
 */
export function foreignLabel(loc: string, designFile: string | undefined): string | undefined {
  if (designFile === undefined || designFile === '') return undefined;
  const file = loc.split(':')[0];
  if (!file || file === designFile) return undefined;
  const lastSlash = file.lastIndexOf('/');
  const baseName = lastSlash >= 0 ? file.slice(lastSlash + 1) : file;
  return baseName.replace(/\.[^.]+$/, '');
}

export const OVERLAY_CSS = `
:host {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483647;
  overflow: hidden;
}

.box {
  position: absolute;
  pointer-events: none;
  box-sizing: border-box;
  transition: top 60ms ease-out, left 60ms ease-out, width 60ms ease-out, height 60ms ease-out;
}

.hover-box {
  border: 1px solid #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

.select-box-primary {
  border: 2px solid #2563eb;
  background: rgba(37, 99, 235, 0.12);
}

.select-box-secondary {
  border: 1.5px dashed rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.04);
}

.box.foreign {
  border-color: #9333ea !important;
  background: rgba(147, 51, 234, 0.08) !important;
}

.tag-label {
  position: absolute;
  top: -20px;
  left: -2px;
  background: #2563eb;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 3px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.box.foreign .tag-label,
.tag-label.foreign {
  background: #9333ea !important;
}

.drag-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #2563eb;
  color: #ffffff;
  border-radius: 3px;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.drop-line {
  position: absolute;
  pointer-events: none;
  background: #2563eb;
  display: none;
}

.drop-box {
  position: absolute;
  pointer-events: none;
  box-sizing: border-box;
  border: 2px dashed #2563eb;
  background: rgba(37, 99, 235, 0.06);
  display: none;
}
`;
