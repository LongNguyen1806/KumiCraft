// @vitest-environment happy-dom
import type { ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { DesignDirsForm } from './design-dirs-form.tsx';

const mockProjectInfo: ProjectInfo = {
  id: 'test-proj',
  name: 'Test Project',
  root: 'D:/test',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    language: 'ts',
    versions: {},
    styling: { systems: [{ id: 'css' }], editable: true, globalCss: [] },
  },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [],
  primaryFrameId: 'main',
  backends: [],
  trusted: true,
  designDirs: {
    pages: ['src/pages'],
    layouts: ['src/layouts'],
    components: ['src/components'],
    drafts: 'src/drafts',
  },
};

describe('DesignDirsForm [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('[WP-4.00] test 17: studio design-dirs-form test: Thêm thư mục thứ hai cho component, đưa lên đầu, xóa; không xóa được thư mục cuối cùng; lưu gửi đúng mảng', async () => {
    const saveSpy = vi.spyOn(projectClient, 'saveDesignDirs').mockResolvedValue(mockProjectInfo);

    render(
      <DesignDirsForm
        designDirs={{
          pages: ['src/pages'],
          layouts: ['src/layouts'],
          components: ['src/components'],
          drafts: 'src/drafts',
        }}
      />,
    );

    // Initial state: only 1 component dir
    const removeBtn0 = screen.getByTestId<HTMLButtonElement>('design-dirs-components-0-remove');
    expect(removeBtn0.disabled).toBe(true);

    // Add 2nd component dir
    const addCompBtn = screen.getByTestId('design-dirs-components-add');
    fireEvent.click(addCompBtn);

    const compInput1 = screen.getByTestId<HTMLInputElement>('design-dirs-components-1');
    expect(compInput1).toBeDefined();
    fireEvent.change(compInput1, { target: { value: 'src/widgets' } });

    // Move 2nd item to top
    const moveTopBtn1 = screen.getByTestId('design-dirs-components-1-top');
    fireEvent.click(moveTopBtn1);

    const compInput0After = screen.getByTestId<HTMLInputElement>('design-dirs-components-0');
    const compInput1After = screen.getByTestId<HTMLInputElement>('design-dirs-components-1');
    expect(compInput0After.value).toBe('src/widgets');
    expect(compInput1After.value).toBe('src/components');

    // Add 3rd item then delete it
    fireEvent.click(addCompBtn);
    const compInput2 = screen.getByTestId<HTMLInputElement>('design-dirs-components-2');
    expect(compInput2).toBeDefined();
    const removeBtn2 = screen.getByTestId('design-dirs-components-2-remove');
    fireEvent.click(removeBtn2);
    expect(screen.queryByTestId('design-dirs-components-2') ?? undefined).toBeUndefined();

    // Click Save
    const saveBtn = screen.getByTestId('design-dirs-save');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          components: ['src/widgets', 'src/components'],
        }),
        undefined,
      );
    });
  });
});
