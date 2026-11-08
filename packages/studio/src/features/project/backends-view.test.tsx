// @vitest-environment happy-dom
import type { BackendInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { BackendsView } from './backends-view.tsx';

describe('BackendsView [R-PJ-23]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(async () => {
    await i18next.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('lists backends with status and removes one only after confirming [R-PJ-23]', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true));

    const backends: BackendInfo[] = [
      {
        id: 'be1',
        label: 'API',
        path: '../api',
        status: 'ok',
        resolvedPath: '/w/api',
        outsideParent: false,
      },
      {
        id: 'be2',
        label: 'Old',
        path: '../old',
        status: 'missing',
        resolvedPath: '/w/old',
        outsideParent: false,
      },
    ];

    const onAdd = vi.fn(() => Promise.resolve());
    const onRemove = vi.fn(() => Promise.resolve());

    render(<BackendsView backends={backends} onAddBackend={onAdd} onRemoveBackend={onRemove} />);

    const itemBe2 = screen.getByTestId('backend-item-be2');
    expect(itemBe2.textContent).toContain('Old');
    expect(itemBe2.textContent).toContain('../old');
    expect(itemBe2.textContent).toContain(i18next.t('project.backends.statusMissing'));

    const removeBtnBe1 = screen.getByTestId('remove-backend-btn-be1');

    fireEvent.click(removeBtnBe1);
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.click(removeBtnBe1);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('be1');
  });
});
