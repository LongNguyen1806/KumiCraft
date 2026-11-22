// Test A9: Studio viewOnly mode (SPEC-04, WP-4.00).
import type { ElementSource, ProjectInfo } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as editorClient from '../api/editor-client.ts';
import * as eventsClient from '../api/events-client.ts';
import * as sourceClient from '../api/source-client.ts';
import { BridgeChannel } from '../core/bridge-channel.ts';
import { useProjectStore } from '../core/project-store.ts';
import { useSelectionStore } from '../core/selection-store.ts';
import { initI18n } from '../i18n/i18n.ts';
import { useChatStore } from './chat/chat-store.ts';
import { CanvasArea } from './editor/canvas-area.tsx';
import { getRightPanelTab, setRightPanelTab } from './editor/right-panel-store.ts';
import { ViewOnlyInspector } from './inspector/components/view-only-inspector.tsx';
import { InspectorPanel } from './inspector/inspector-panel.tsx';
import type { InspectorTarget } from './inspector/types.ts';
import { PagesPanel } from './pages/pages-panel.tsx';
import { useCanvasTextEdit } from './text-edit/use-canvas-text-edit.ts';

const VIEW_ONLY_PROJECT: ProjectInfo = {
  id: 'express-pug-test',
  name: 'Express Pug App',
  root: '/workspace/express-pug',
  sourceDir: 'views',
  support: {
    supported: true,
    reasons: [],
    framework: 'express-pug',
    versions: { express: '^4.19.2', pug: '^3.0.3' },
    language: 'js',
    editMode: 'viewOnly',
    serverEntry: 'app.js',
    viewsDir: 'views',
  },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  trusted: true,
  designDirs: {
    pages: ['views'],
    layouts: [],
    components: [],
    drafts: 'views/drafts',
  },
};

const SAMPLE_SOURCE: ElementSource = {
  loc: 'views/index.pug:5:3',
  tag: 'h1',
  fileHash: 'f'.repeat(64),
  className: { kind: 'none' },
  text: { kind: 'none' },
  attributes: {},
  inLoop: false,
};

describe('Studio viewOnly mode [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  beforeEach(() => {
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(SAMPLE_SOURCE);
    useProjectStore.getState().setProject(VIEW_ONLY_PROJECT);
    useSelectionStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useProjectStore.getState().setProject(undefined);
  });

  it('[WP-4.00] A9: Studio viewOnly: có chip "Chỉ xem"; Inspector không có ô sửa class; nhấp đúp không bắt đầu sửa chữ; panel Trang không có nút thêm', () => {
    const openInEditorSpy = vi.spyOn(editorClient, 'openInEditor').mockResolvedValue(undefined);

    // 1. Canvas Toolbar chip "Chỉ xem"
    const { unmount: unmountCanvas } = render(
      <CanvasArea projectInfo={VIEW_ONLY_PROJECT} trusted={true} />,
    );
    const chip = screen.getByTestId('view-only-chip');
    expect(chip).toBeDefined();
    expect(chip.textContent).toContain('Chỉ xem');
    expect(chip.getAttribute('title')).toContain(
      'Dự án này KumiCraft chỉ xem được (Express + Pug); sửa trong editor hoặc nhờ AI.',
    );
    unmountCanvas();

    // 2. Inspector panel: no class edit fields, shows reason banner and "Mở trong editor"
    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'views/index.pug:5:3', index: 0 }]);
    });
    const { unmount: unmountInspector } = render(<InspectorPanel />);
    expect(screen.getByTestId('view-only-inspector-banner')).toBeDefined();
    expect(screen.queryByTestId('other-classes-input')).toBeNull();
    expect(screen.queryByTestId('property-field-fontSize')).toBeNull();
    expect(screen.queryByTestId('style-sources-section')).toBeNull();

    const openBtn = screen.getByTestId('open-in-editor-btn');
    expect(openBtn).toBeDefined();
    fireEvent.click(openBtn);
    expect(openInEditorSpy).toHaveBeenCalledWith('views/index.pug:5:3');
    unmountInspector();

    // 3. Double-click does not start text editing
    const channel = new BridgeChannel();
    const mockWindow = window;
    vi.spyOn(mockWindow, 'postMessage').mockImplementation(() => {});
    channel.attach(mockWindow, window.location.origin, 'test-nonce');

    const { result, unmount: unmountTextEdit } = renderHook(() => useCanvasTextEdit({ channel }));
    expect(result.current.isEditing).toBe(false);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          source: mockWindow,
          data: {
            rc: 1,
            nonce: 'test-nonce',
            type: 'textEdit:request',
            payload: { ref: { loc: 'views/index.pug:5:3', index: 0 } },
          },
        }),
      );
    });

    expect(result.current.isEditing).toBe(false);
    channel.detach();
    unmountTextEdit();

    // 4. Pages panel: no add page form, no rename/delete buttons, but page list is still shown
    const { unmount: unmountPages } = render(
      <PagesPanel
        pages={[
          { path: '/', component: 'Index', dynamic: false },
          { path: '/about', component: 'About', dynamic: false },
        ]}
      />,
    );

    expect(screen.queryByTestId('add-page-form')).toBeNull();
    expect(screen.queryByTestId('page-rename-/about')).toBeNull();
    expect(screen.queryByTestId('page-delete-/about')).toBeNull();
    expect(screen.getByText('Index')).toBeDefined();
    expect(screen.getByText('About')).toBeDefined();
    unmountPages();
  });

  it('Test M9 [WP-4.00]: Studio bấm ask-ai-element-btn trong ViewOnlyInspector → tab chat, unhide element, gợi ý draft, focus textarea', async () => {
    await i18next.changeLanguage('vi');
    setRightPanelTab('properties');
    useChatStore.getState().setHidden('element', true);
    useChatStore.getState().setDraft('');

    const target: Extract<InspectorTarget, { readonly kind: 'element' }> = {
      kind: 'element',
      ref: { loc: 'views/index.pug:5:3', index: 0 },
      locFile: 'views/index.pug',
      locLine: 5,
      locCol: 3,
      source: SAMPLE_SOURCE,
      loading: false,
      warnings: [],
      currentScope: { breakpoint: 'base' },
      writePrefix: '',
      setInteractionState: vi.fn(),
      refresh: vi.fn(),
    };

    const { unmount } = render(
      <div>
        <ViewOnlyInspector target={target} />
        <textarea data-testid="chat-input" />
      </div>,
    );

    const askBtn = screen.getByTestId('ask-ai-element-btn');
    expect(askBtn).toBeDefined();

    fireEvent.click(askBtn);

    expect(getRightPanelTab()).toBe('chat');
    expect(useChatStore.getState().hidden.element).toBe(false);
    expect(useChatStore.getState().draft).toBe('Sửa phần tử này: ');

    const textarea = screen.getByTestId<HTMLTextAreaElement>('chat-input');
    expect(document.activeElement).toBe(textarea);

    // Existing draft preserved when clicked again
    useChatStore.getState().setDraft('Hãy thêm viền xanh');
    fireEvent.click(askBtn);
    expect(useChatStore.getState().draft).toBe('Hãy thêm viền xanh');

    unmount();
  });
});
