// Recognizes an ASP.NET Core project (docs/architecture/03c section 3.1): a web .csproj
// (`Sdk="Microsoft.NET.Sdk.Web"`) with Razor Pages (`Pages/`) or MVC views (`Views/` and
// `Controllers/`). Read-only: the .NET SDK itself is checked when the project runs.
import type { StylingReport, StylingSystem, SupportReport } from '@kumicraft/shared';

import type { DetectInput } from '../../../kernel/stacks.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

export type RazorKind = 'pages' | 'mvc';

const TAILWIND_IMPORT = /@import\s+["']tailwindcss["']|@tailwind\s+base/;
const CSS_DIRS = ['wwwroot/css', 'Styles', 'styles', 'wwwroot'];

/** The project's web .csproj at its root, with its text. */
export async function webProject(
  fs: FileSystemPort,
  root: string,
): Promise<{ readonly file: string; readonly xml: string } | undefined> {
  const entries = await fs.readDir(root, '.');
  if (!entries.ok) return undefined;
  for (const entry of entries.value) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.csproj')) continue;
    const read = await fs.readText(root, entry.name, { maxBytes: 512 * 1024 });
    if (read.ok && /Sdk="Microsoft\.NET\.Sdk\.(Web|Razor)"/.test(read.value)) {
      return { file: entry.name, xml: read.value };
    }
  }
  return undefined;
}

/** Whether the project has views of this kind. */
async function hasViews(fs: FileSystemPort, root: string, kind: RazorKind): Promise<boolean> {
  if (kind === 'pages') {
    const pages = await fs.readDir(root, 'Pages');
    return pages.ok && pages.value.some((e) => e.name.endsWith('.cshtml'));
  }
  const views = await fs.readDir(root, 'Views');
  return views.ok && views.value.length > 0 && (await fs.exists(root, 'Controllers'));
}

async function cssFiles(
  fs: FileSystemPort,
  root: string,
): Promise<{ path: string; text: string }[]> {
  const out: { path: string; text: string }[] = [];
  // `Styles` and `styles` are one folder on Windows and macOS: each file is read once.
  const seen = new Set<string>();
  for (const dir of CSS_DIRS) {
    const entries = await fs.readDir(root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      const path = `${dir}/${entry.name}`;
      if (entry.kind !== 'file' || !entry.name.endsWith('.css') || entry.name.endsWith('.min.css'))
        continue;
      if (seen.has(path.toLowerCase())) continue;
      seen.add(path.toLowerCase());
      const read = await fs.readText(root, path, { maxBytes: 2 * 1024 * 1024 });
      if (read.ok) out.push({ path, text: read.value });
    }
  }
  return out;
}

function packageDeps(packageJson: unknown): Record<string, string> {
  if (typeof packageJson !== 'object' || !packageJson) return {};
  const pick = (key: string): Record<string, string> => {
    const value: unknown = Reflect.get(packageJson, key);
    return typeof value === 'object' && value
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]))
      : {};
  };
  return { ...pick('dependencies'), ...pick('devDependencies') };
}

/** Style systems of an ASP.NET project: Tailwind (its CLI), Bootstrap in wwwroot/lib, plain CSS. */
async function razorStyling(input: DetectInput): Promise<{
  styling: StylingReport;
  tailwindCss: string | undefined;
  tailwind: string | undefined;
}> {
  const { fs, root } = input;
  const css = await cssFiles(fs, root);
  const entry = css.find((c) => TAILWIND_IMPORT.test(c.text));
  const tailwind = packageDeps(input.packageJson)['tailwindcss'];
  const systems: StylingSystem[] = [];
  if (entry !== undefined && tailwind !== undefined)
    systems.push({ id: 'tailwind', version: tailwind.replace(/^[^\d]*/, '') });
  if (await fs.exists(root, 'wwwroot/lib/bootstrap')) systems.push({ id: 'bootstrap' });
  if (css.some((c) => c !== entry)) systems.push({ id: 'css' });
  const primary = systems[0]?.id;
  // The CSS the pages load: the built output for Tailwind (not its input), the others as they are.
  const globalCss = css
    .filter((c) => c !== entry)
    .map((c) => c.path)
    .slice(0, 20);
  const styling: StylingReport = { systems, primary, editable: primary === 'tailwind', globalCss };
  return { styling, tailwindCss: primary === 'tailwind' ? entry?.path : undefined, tailwind };
}

/** The support report of an ASP.NET project of one kind (Razor Pages or MVC). */
export async function detectRazor(input: DetectInput, kind: RazorKind): Promise<SupportReport> {
  const project = await webProject(input.fs, input.root);
  if (project === undefined) return { supported: false, reasons: [], versions: {}, language: 'js' };
  const framework = kind === 'pages' ? 'aspnet-razor-pages' : 'aspnet-mvc';
  const dotnet = /<TargetFramework>([^<]+)<\/TargetFramework>/.exec(project.xml)?.[1];
  if (!(await hasViews(input.fs, input.root, kind))) {
    return {
      supported: false,
      reasons: ['noRazorViews'],
      framework,
      versions: { dotnet },
      language: 'js',
    };
  }
  const { styling, tailwindCss, tailwind } = await razorStyling(input);
  return {
    supported: true,
    reasons: [],
    framework,
    versions: { dotnet, ...(tailwind === undefined ? {} : { tailwindcss: tailwind }) },
    language: 'js',
    styling,
    sourceDir: '.',
    serverEntry: project.file,
    ...(tailwindCss === undefined ? {} : { tailwindCss }),
  };
}
