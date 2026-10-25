// UI tests for sending chat images (R-CH-02, CW-52).
import type { ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as agentClient from '../../api/agent-client.ts';
import { ApiError } from '../../api/http.ts';
import * as projectClient from '../../api/project-client.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { DEFAULT_THEME } from '../inspector/use-project-theme.ts';
import { ChatPanel } from './chat-panel.tsx';
import { useChatStore } from './chat-store.ts';

const MOCK_PROJECT: ProjectInfo = {
  id: 'proj000001',
  name: 'Test Project',
  root: 'D:\\proj',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    framework: 'vite-react',
    versions: {},
    language: 'ts',
  },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  designDirs: {
    pages: ['src/pages'],
    layouts: ['src/layouts'],
    components: ['src/components'],
    drafts: 'src/drafts',
  },
  trusted: true,
};

function createPngFile(name = 'sample.png', size = 100): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type: 'image/png' });
}

describe('Chat Images UI Part B [R-CH-02]', () => {
  beforeAll(async () => {
    const { initI18n } = await import('../../i18n/i18n.ts');
    await initI18n();
    URL.createObjectURL = vi.fn().mockImplementation((file: File) => `blob:${file.name}`);
    URL.revokeObjectURL = vi.fn();
  });

  beforeEach(async () => {
    sessionStorage.setItem('kumicraft.sessionToken', 'tok-images-ui');
    localStorage.clear();
    await i18next.changeLanguage('vi');
    useAgentsStore.getState().reset();
    useChatStore.getState().reset();
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue(MOCK_PROJECT);
    vi.spyOn(agentClient, 'fetchTurns').mockResolvedValue([]);
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(DEFAULT_THEME);
    vi.spyOn(agentClient, 'fetchAgents').mockResolvedValue([
      { id: 'agy', installed: true, login: 'loggedIn', loginAvailable: true },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Situation 20: pastes a PNG file into input uploads and displays thumbnail [R-CH-02]', async () => {
    const uploadSpy = vi
      .spyOn(agentClient, 'uploadChatImage')
      .mockResolvedValue({ id: 'img0000001' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    const file = createPngFile('pasted.png');

    fireEvent.paste(input, {
      clipboardData: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith('png', expect.any(String));
    });
    const chip = await screen.findByTestId('chat-image-0');
    expect(chip).toBeDefined();
  });

  it('Situation 21: pastes text only into input does not trigger upload [R-CH-02]', async () => {
    const uploadSpy = vi.spyOn(agentClient, 'uploadChatImage');
    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');

    fireEvent.paste(input, {
      clipboardData: {
        files: [],
      },
    });

    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('Situation 22: drops a text file and an oversized image shows translated errors without upload [R-CH-02]', async () => {
    const uploadSpy = vi.spyOn(agentClient, 'uploadChatImage');
    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');

    const txtFile = new File(['abc'], 'readme.txt', { type: 'text/plain' });
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });

    const container = input.closest('div');
    if (container) {
      fireEvent.drop(container, {
        dataTransfer: {
          files: [txtFile, bigFile],
        },
      });
    }

    const errorEl = await screen.findByTestId('chat-image-error');
    expect(errorEl.textContent).toContain('5 MB');
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('Situation 23: adding 6 images only keeps 5 and displays max images error [R-CH-02]', async () => {
    vi.spyOn(agentClient, 'uploadChatImage').mockResolvedValue({ id: 'img0000001' });
    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    const container = input.closest('div');

    const sixFiles: File[] = [];
    for (let i = 0; i < 6; i += 1) {
      sixFiles.push(createPngFile(`p${String(i)}.png`));
    }

    if (container) {
      fireEvent.drop(container, {
        dataTransfer: {
          files: sixFiles,
        },
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('chat-image-4')).toBeDefined();
    });
    expect(screen.queryByTestId('chat-image-5')).toBeNull();
    const errorEl = await screen.findByTestId('chat-image-error');
    expect(errorEl.textContent).toContain('5 ảnh');
  });

  it('Situation 24: send button is disabled while image is uploading [R-CH-02]', async () => {
    let finishUpload: ((val: { id: string }) => void) | undefined;
    vi.spyOn(agentClient, 'uploadChatImage').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
    );

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Tin nhắn kèm ảnh' } });

    const file = createPngFile('uploading.png');
    fireEvent.paste(input, { clipboardData: { files: [file] } });

    await screen.findByTestId('chat-image-0');
    const sendBtn = screen.getByTestId('chat-send');
    expect(sendBtn).toHaveProperty('disabled', true);

    await waitFor(() => {
      expect(finishUpload).toBeDefined();
    });
    if (finishUpload) {
      finishUpload({ id: 'done000001' });
    }
    await waitFor(() => {
      expect(sendBtn).toHaveProperty('disabled', false);
    });
  });

  it('Situation 25: sends turn with 2 ready images and doc, renders thumbnails and clears image chips [R-CH-02]', async () => {
    let idCounter = 0;
    vi.spyOn(agentClient, 'uploadChatImage').mockImplementation(() => {
      idCounter += 1;
      return Promise.resolve({ id: `id0000000${String(idCounter)}` });
    });
    const startTurnSpy = vi.spyOn(agentClient, 'startTurn').mockResolvedValue({ jobId: 'j25' });

    render(<ChatPanel trusted />);
    fireEvent.click(await screen.findByTestId('chat-import'));
    fireEvent.change(await screen.findByTestId('chat-import-path'), {
      target: { value: 'src/pages' },
    });
    fireEvent.click(screen.getByTestId('chat-import-confirm'));

    const input = await screen.findByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Hãy xem hai ảnh này' } });

    const f1 = createPngFile('img1.png');
    const f2 = createPngFile('img2.png');
    fireEvent.paste(input, { clipboardData: { files: [f1, f2] } });

    await screen.findByTestId('chat-image-0');
    await screen.findByTestId('chat-image-1');
    await waitFor(() => {
      const imgs = useChatStore.getState().images;
      expect(imgs.length).toBe(2);
      expect(imgs.every((i) => i.state === 'ready')).toBe(true);
    });
    fireEvent.click(screen.getByTestId('chat-send'));

    await waitFor(() => {
      expect(startTurnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          images: ['id00000001', 'id00000002'],
          docs: ['src/pages'],
        }),
      );
    });

    expect(screen.queryByTestId('chat-image-0')).toBeNull();
    expect(screen.getByTestId('chat-doc-0').textContent).toContain('src/pages');
    const img1 = screen.getByAltText('attachment-0');
    expect(img1.getAttribute('src')).toBe('blob:img1.png');
  });

  it('Situation 26: clicks chat-add-image and selects file via hidden input triggers upload [R-CH-02]', async () => {
    const uploadSpy = vi
      .spyOn(agentClient, 'uploadChatImage')
      .mockResolvedValue({ id: 'img0000026' });

    render(<ChatPanel trusted />);
    const addImageBtn = await screen.findByTestId('chat-add-image');
    fireEvent.click(addImageBtn);

    const toolbar = screen.getByTestId('chat-toolbar');
    const hiddenInput = toolbar.querySelector('input[type="file"]');
    expect(hiddenInput).toBeDefined();

    if (hiddenInput) {
      const file = createPngFile('picked.png');
      fireEvent.change(hiddenInput, { target: { files: [file] } });
    }

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith('png', expect.any(String));
    });
    expect(await screen.findByTestId('chat-image-0')).toBeDefined();
  });

  it('keeps attached images when the server refuses the turn, and sends them again [R-CH-02]', async () => {
    vi.spyOn(agentClient, 'uploadChatImage').mockResolvedValue({ id: 'img0000009' });
    const startTurnSpy = vi
      .spyOn(agentClient, 'startTurn')
      .mockRejectedValueOnce(new ApiError(409, 'E018', { resource: 'agent.turn' }))
      .mockResolvedValueOnce({ jobId: 'job0000009' });

    render(<ChatPanel trusted />);
    const input = await screen.findByTestId('chat-input');
    fireEvent.paste(input, { clipboardData: { files: [createPngFile('shot.png')] } });
    await waitFor(() => {
      expect(useChatStore.getState().images[0]?.state).toBe('ready');
    });
    fireEvent.change(input, { target: { value: 'Làm giống ảnh' } });
    fireEvent.click(screen.getByTestId('chat-send'));

    await screen.findByTestId('chat-send-error');
    expect(await screen.findByTestId('chat-image-0')).toBeDefined();

    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => {
      expect(startTurnSpy).toHaveBeenCalledTimes(2);
    });
    expect(startTurnSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ prompt: 'Làm giống ảnh', images: ['img0000009'] }),
    );
  });
});
