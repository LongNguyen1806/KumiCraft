import type { ProjectProbe } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { NewProjectForm } from './new-project-form.tsx';
import { ProjectDialog } from './project-dialog.tsx';
import { baseName, childPath, isValidFolderName, parentDir } from './project-paths.ts';

/** The server's probe answer for each folder path; any other folder does not exist yet. */
function stubProbe(folders: Readonly<Record<string, ProjectProbe>>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const query = new URL(url, 'http://127.0.0.1').searchParams.get('path') ?? '';
      const data: ProjectProbe = url.includes('/project/probe')
        ? (folders[query] ?? { kind: 'missing', canCreate: true })
        : { kind: 'other' };
      const body = url.includes('/fs/directories') ? { path: query, entries: [] } : data;
      return Promise.resolve(new Response(JSON.stringify({ data: body }), { status: 200 }));
    }),
  );
}

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.setItem('kumicraft.sessionToken', 'tok');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('New project, like the new-project window of an IDE [R-PJ-11]', () => {
  it('name + location make the new folder, shown before it is created', async () => {
    stubProbe({ 'D:/Demo/PRAM': { kind: 'other' } });
    const onCreate = vi.fn();
    render(<NewProjectForm initialPath="D:/Demo/PRAM" busy={false} onCreate={onCreate} />);
    fireEvent.change(screen.getByTestId('create-project-name'), {
      target: { value: 'AuthApi.Web' },
    });
    const target = await screen.findByTestId('create-project-target');
    expect(target.textContent).toContain('D:/Demo/PRAM/AuthApi.Web');
    expect(screen.getByTestId('create-project-location')).toHaveProperty('value', 'D:/Demo/PRAM');
    // Create opens once the server says the folder can still be made.
    await waitFor(() => {
      expect(screen.getByTestId('create-project-btn')).toHaveProperty('disabled', false);
    });
    fireEvent.click(screen.getByTestId('create-project-btn'));
    expect(onCreate).toHaveBeenCalledWith('D:/Demo/PRAM/AuthApi.Web', 'AuthApi.Web', 'pnpm');
  });

  it('started in an empty folder, that folder becomes the project', async () => {
    stubProbe({ '/home/me/shop': { kind: 'empty' } });
    render(<NewProjectForm initialPath="/home/me/shop" busy={false} onCreate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('create-project-name')).toHaveProperty('value', 'shop');
    });
    expect(screen.getByTestId('create-project-location')).toHaveProperty('value', '/home/me');
    expect((await screen.findByTestId('create-project-target')).textContent).toContain(
      '/home/me/shop',
    );
  });

  it('a folder that already has files is refused before Create', async () => {
    stubProbe({ '/w': { kind: 'other' }, '/w/my-app': { kind: 'other' } });
    render(<NewProjectForm initialPath="/w" busy={false} onCreate={vi.fn()} />);
    expect(await screen.findByTestId('create-project-taken')).toBeTruthy();
    expect(screen.getByTestId('create-project-btn')).toHaveProperty('disabled', true);
  });

  it('a location that does not exist is named, not created', async () => {
    stubProbe({ '/w': { kind: 'other' }, '/nope/my-app': { kind: 'missing', canCreate: false } });
    render(<NewProjectForm initialPath="/w" busy={false} onCreate={vi.fn()} />);
    fireEvent.change(screen.getByTestId('create-project-location'), { target: { value: '/nope' } });
    expect(await screen.findByTestId('create-project-no-location')).toBeTruthy();
    expect(screen.getByTestId('create-project-btn')).toHaveProperty('disabled', true);
  });

  it('a folder name no system accepts blocks Create and says why', () => {
    stubProbe({ '/w': { kind: 'other' } });
    render(<NewProjectForm initialPath="/w" busy={false} onCreate={vi.fn()} />);
    fireEvent.change(screen.getByTestId('create-project-name'), { target: { value: 'web:app' } });
    expect(screen.getByTestId('create-project-name-error')).toBeTruthy();
    expect(screen.getByTestId('create-project-btn')).toHaveProperty('disabled', true);
  });

  it('the dialog opens on the new-project form and goes back to opening one', () => {
    stubProbe({});
    render(
      <ProjectDialog
        open
        mode="new"
        initialPath="/w"
        onClose={vi.fn()}
        onProjectOpened={vi.fn()}
      />,
    );
    expect(screen.getByText('Create a new project')).toBeTruthy();
    fireEvent.click(screen.getByTestId('open-existing-btn'));
    expect(screen.getByText('Open project')).toBeTruthy();
    expect(screen.getByTestId('new-project-btn')).toBeTruthy();
  });

  it('paths follow the separator already used', () => {
    expect(isValidFolderName('AuthApi.Web')).toBe(true);
    expect(isValidFolderName('a/b')).toBe(false);
    expect(isValidFolderName('app.')).toBe(false);
    expect(isValidFolderName('..')).toBe(false);
    expect(childPath('D:/', 'web')).toBe('D:/web');
    expect(childPath('C:\\Users\\me', 'web')).toBe('C:\\Users\\me\\web');
    expect(childPath('/home/me/', 'web')).toBe('/home/me/web');
    expect(parentDir('D:/Demo/PRAM')).toBe('D:/Demo');
    expect(parentDir('D:/Demo')).toBe('D:/');
    expect(parentDir('/home')).toBe('/');
    expect(parentDir('D:/')).toBeUndefined();
    expect(baseName('/home/me/shop/')).toBe('shop');
  });
});
