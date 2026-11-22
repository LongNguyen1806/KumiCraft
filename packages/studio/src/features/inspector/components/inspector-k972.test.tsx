// Component tests for Inspector K9.7-2 features (tag switcher, list actions, attributes, image, effects, motion, reveal) (Tests 2, 9, 14, 15).
import { type ElementSource, type TreeNode } from '@kumicraft/shared';
import { type ClassContext, parseClasses } from '@kumicraft/style-tailwind';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../../api/source-client.ts';
import { studioBridgeChannel } from '../../../core/bridge-channel.ts';
import { useSelectionStore } from '../../../core/selection-store.ts';
import { initI18n } from '../../../i18n/i18n.ts';
import type { InspectorTarget } from '../types.ts';
import type { BatchPropEntry } from '../use-live-edit.ts';
import { AttributesEditorSection } from './attributes-editor.tsx';
import { InspectorEffectsExtra } from './inspector-effects-extra.tsx';
import { InspectorHeader } from './inspector-header.tsx';
import { InspectorImageSection } from './inspector-image-section.tsx';
import { InspectorMotionSection } from './inspector-motion-section.tsx';
import { TagTypeRow } from './tag-type-row.tsx';

const READ_CTX: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'desktop-first',
  breakpoints: {},
};

function makeElTarget(
  tag: string,
  loc = 'src/App.tsx:10:4',
  attributes: ElementSource['attributes'] = {},
): Extract<InspectorTarget, { readonly kind: 'element' }> {
  return {
    kind: 'element',
    ref: { loc, index: 0 },
    locFile: 'src/App.tsx',
    locLine: 10,
    locCol: 4,
    source: {
      loc,
      tag,
      fileHash: 'b'.repeat(64),
      className: { kind: 'static', value: '' },
      text: { kind: 'none' },
      attributes,
      inLoop: false,
    },
    loading: false,
    warnings: [],
    currentScope: { breakpoint: 'base' },
    writePrefix: '',
    setInteractionState: () => undefined,
    refresh: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useSelectionStore.setState({ selectedRefs: [], treeNodes: [] });
});

describe('Inspector K9.7-2 controls (Tests 2, 9, 14, 15)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  it('Test 2: Tag switcher sends setTag and list-remove-item disables when <= 1 li item', async () => {
    const spy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue({
      changed: true,
      file: 'src/App.tsx',
      fileHash: 'b'.repeat(64),
      element: {
        loc: 'src/App.tsx:10:4',
        tag: 'section',
        fileHash: 'b'.repeat(64),
        className: { kind: 'static', value: '' },
        text: { kind: 'none' },
        attributes: {},
        inLoop: false,
      },
    });
    const treeOneLi: TreeNode[] = [
      { ref: { loc: 'src/App.tsx:10:4', index: 0 }, tag: 'ul', instances: 1 },
      { ref: { loc: 'src/App.tsx:11:6', index: 0 }, parent: 0, tag: 'li', instances: 1 },
    ];
    useSelectionStore.setState({ treeNodes: treeOneLi });

    const ulTarget = makeElTarget('ul');
    render(
      <>
        <InspectorHeader target={ulTarget} />
        <TagTypeRow target={ulTarget} />
      </>,
    );

    const removeBtn = screen.getByTestId<HTMLButtonElement>('list-remove-item');
    expect(removeBtn.disabled).toBe(true);

    const tagSelect = screen.getByTestId('inspector-tag-select');
    fireEvent.change(tagSelect, { target: { value: 'section' } });
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(spy.mock.calls[0]?.[0].edit).toEqual({
      kind: 'setTag',
      loc: 'src/App.tsx:10:4',
      tag: 'ul',
      after: 'section',
    });
  });

  it('Test 2b: header shows the tag as text; the tag row in Attributes keeps the href hint and lock', () => {
    const linkTarget = makeElTarget('a');
    const { unmount } = render(<InspectorHeader target={linkTarget} />);
    expect(screen.queryByTestId('inspector-tag-select')).toBeNull();
    expect(screen.queryByTestId('link-href-hint')).toBeNull();
    expect(screen.getByText('<a>')).toBeDefined();
    unmount();

    const { unmount: unmountRow } = render(<TagTypeRow target={linkTarget} />);
    expect(screen.getByTestId<HTMLSelectElement>('inspector-tag-select').disabled).toBe(false);
    expect(screen.getByTestId('link-href-hint')).toBeDefined();
    unmountRow();

    const withHref = makeElTarget('a', 'src/App.tsx:10:4', {
      href: { kind: 'static', value: '/' },
    });
    const { unmount: unmountHref } = render(<TagTypeRow target={withHref} />);
    expect(screen.queryByTestId('link-href-hint')).toBeNull();
    unmountHref();

    const locked = { ...makeElTarget('a'), lockReason: 'outsideSource' as const };
    render(<TagTypeRow target={locked} />);
    expect(screen.getByTestId<HTMLSelectElement>('inspector-tag-select').disabled).toBe(true);
    expect(screen.queryByTestId('link-href-hint')).toBeNull();
  });

  it('Test 4/6 client guard: blocks unsafe attribute names like onClick and data-rc-loc', () => {
    const onAttr = vi.fn();
    render(
      <AttributesEditorSection
        tag="div"
        attributes={{}}
        disabled={false}
        onAttributeChange={onAttr}
      />,
    );

    const nameInput = screen.getByTestId('attr-add-name');
    const valInput = screen.getByTestId('attr-add-value');
    const submitBtn = screen.getByTestId('attr-add-submit');

    fireEvent.change(nameInput, { target: { value: 'onClick' } });
    fireEvent.change(valInput, { target: { value: 'alert(1)' } });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('attr-add-error')).toBeDefined();
    expect(onAttr).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: 'aria-label' } });
    fireEvent.change(valInput, { target: { value: 'Close' } });
    fireEvent.click(submitBtn);

    expect(onAttr).toHaveBeenCalledWith('aria-label', 'Close');
  });

  it('Test 9: InspectorImageSection reads/updates objectFit & aspectRatio', () => {
    const onPropChange = vi.fn();
    render(
      <InspectorImageSection
        tag="img"
        editable={true}
        disabled={false}
        tokens={[]}
        currentScope={{ breakpoint: 'base' }}
        onPropChange={onPropChange}
      />,
    );

    fireEvent.change(screen.getByTestId('image-object-fit'), { target: { value: 'cover' } });
    expect(onPropChange).toHaveBeenCalledWith('objectFit', { kind: 'keyword', name: 'cover' });

    fireEvent.change(screen.getByTestId('image-aspect-ratio'), { target: { value: 'video' } });
    expect(onPropChange).toHaveBeenCalledWith('aspectRatio', { kind: 'keyword', name: 'video' });
  });

  it('Test 14 & 15: Gradient toggles in one batch, Motion preset batches in one call, and Preview avoids file writes', () => {
    const onBatchProps = vi.fn<(entries: readonly BatchPropEntry[]) => void>();
    const editSpy = vi.spyOn(sourceClient, 'editSource');
    const previewSpy = vi
      .spyOn(studioBridgeChannel, 'sendMotionPreview')
      .mockImplementation(() => undefined);

    const target = makeElTarget('div');
    if (target.source === undefined) throw new Error('expected element source');
    render(
      <>
        <InspectorEffectsExtra
          editable={true}
          disabled={false}
          tokens={[]}
          currentScope={{ breakpoint: 'base', state: 'hover' }}
          onPropChange={vi.fn()}
          onBatchProps={onBatchProps}
        />
        <InspectorMotionSection
          refTarget={target.ref}
          source={target.source}
          editable={true}
          disabled={false}
          tokens={[]}
          currentScope={{ breakpoint: 'base' }}
          onPropChange={vi.fn()}
          onBatchProps={onBatchProps}
          onRefresh={vi.fn()}
        />
      </>,
    );

    fireEvent.click(screen.getByTestId('effect-gradient-toggle'));
    expect(onBatchProps).toHaveBeenCalledTimes(1);

    // One select for the whole effect (owner, 2026-11-18): a preset, or "None" to take it off.
    fireEvent.change(screen.getByTestId('motion-preset-select'), {
      target: { value: 'hover-lift' },
    });
    expect(onBatchProps).toHaveBeenCalledTimes(2);
    const presetEntries = onBatchProps.mock.calls[1]?.[0];
    expect(presetEntries?.length).toBeGreaterThanOrEqual(4);

    // Preview plays what the element has (owner, 2026-11-18): nothing set, nothing to play.
    expect(screen.getByTestId('motion-preview')).toHaveProperty('disabled', true);
    cleanup();
    render(
      <InspectorMotionSection
        refTarget={target.ref}
        source={target.source}
        editable={true}
        disabled={false}
        tokens={parseClasses('transition-all duration-200 hover:shadow-lg', READ_CTX)}
        currentScope={{ breakpoint: 'base' }}
        onPropChange={vi.fn()}
        onBatchProps={onBatchProps}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('motion-preview'));
    expect(previewSpy).toHaveBeenCalledWith(target.ref);
    expect(editSpy).not.toHaveBeenCalled();
  });
});
