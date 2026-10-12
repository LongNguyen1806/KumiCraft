import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { CreateWorkspaceForm } from './create-workspace-form.tsx';

const respond = (status: number, body: unknown) =>
  vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

/** JSON body of the n-th request sent through the mock. */
const sentBody = (fetchMock: ReturnType<typeof respond>, call = 0): unknown =>
  JSON.parse(fetchMock.mock.calls[call]?.[1]?.body as string);

const preview = () => screen.getByTestId('frames-preview').textContent;
const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
};

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.setItem('reactcraft.sessionToken', 'tok');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CreateWorkspaceForm', () => {
  it('previews the standard frames of the chosen mode [V-07]', () => {
    render(<CreateWorkspaceForm onCreated={vi.fn()} />);

    expect(preview()).toContain('Desktop 1440 × 900');
    expect(preview()).toContain('Mobile 375 × 812');

    fireEvent.click(screen.getByRole('radio', { name: /Mobile first/ }));

    expect(screen.getByRole('radio', { name: /Mobile\s*375/ })).toHaveProperty('checked', true);
    expect(preview()).toMatch(/Mobile 375 × 812.*Tablet 768 × 1024.*Desktop 1440 × 900/);
  });

  it('checks the name and a custom size before sending anything', () => {
    const fetchMock = respond(201, { data: {} });
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateWorkspaceForm onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '100' } });
    submit();

    expect(screen.getByText('Name the workspace, up to 64 characters.')).toBeDefined();
    expect(screen.getByText(/Frames are 320 to 3840 px wide/)).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates the workspace with the chosen options, then reads the session again', async () => {
    const fetchMock = respond(201, { data: { id: 'ws00000001' } });
    vi.stubGlobal('fetch', fetchMock);
    const onCreated = vi.fn();
    render(<CreateWorkspaceForm onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Shop' } });
    fireEvent.click(screen.getByRole('radio', { name: /Desktop\s*1920/ }));
    fireEvent.change(screen.getByLabelText('Content language'), { target: { value: 'vi-VN' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Follow the system' }));
    submit();

    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledOnce();
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/workspace');
    expect(sentBody(fetchMock)).toEqual({
      name: 'Shop',
      responsiveMode: 'desktop-first',
      primaryFrame: 'desktop-1920',
      contentLocale: 'vi-VN',
      darkMode: 'media',
    });
  });

  it('sends a custom frame as a full frame', async () => {
    const fetchMock = respond(201, { data: {} });
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateWorkspaceForm onCreated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Kiosk' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    submit();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });
    expect(sentBody(fetchMock)).toMatchObject({
      primaryFrame: { id: 'custom', label: 'Custom', width: 1366, height: 768 },
    });
  });

  it('shows the server error when the workspace cannot be created', async () => {
    vi.stubGlobal('fetch', respond(409, { error: { code: 'E018', details: [] } }));
    const onCreated = vi.fn();
    render(<CreateWorkspaceForm onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Shop' } });
    submit();

    expect((await screen.findByRole('alert')).textContent).toContain('(E018)');
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Create workspace' })).toHaveProperty(
      'disabled',
      false,
    );
  });
});
