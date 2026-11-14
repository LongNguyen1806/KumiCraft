// Source insertion builder for form-from-source and table-from-source library blocks (TK-33..35).
import {
  type DataField,
  generateFormFromFields,
  generateTableFromFields,
  lookFromTheme,
  primarySystem,
} from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { selectionAnchor } from '../design/selection-anchor.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';
import { determineInsertTarget, localizedBlockLang } from './insert-block.ts';
import { recordRecentBlock } from './library-favorites.ts';
import { getSelectedStyle } from './library-styles.ts';

export type DataPickerMode = 'form' | 'table';

function computeRelativeImport(fromFile: string, toNoExt: string): string {
  const fromParts = fromFile.replace(/\\/g, '/').split('/').slice(0, -1);
  const toParts = toNoExt.replace(/\\/g, '/').split('/');
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }
  const ups = fromParts.length - common;
  const rel = [...Array<string>(ups).fill('..'), ...toParts.slice(common)].join('/');
  return ups === 0 ? `./${rel}` : rel;
}

function buildTableInsertArgs(
  chosenFields: readonly DataField[],
  sourceName: string,
  file: string,
  lang: 'vi' | 'en',
) {
  const project = useProjectStore.getState().project;
  const system =
    project?.support.styling !== undefined ? primarySystem(project.support.styling) : 'tailwind4';
  const look = lookFromTheme(useThemeStore.getState().theme, getSelectedStyle(project?.id));
  const sourceDir = project?.sourceDir ?? 'src';
  const isTs = !file.endsWith('.js') && !file.endsWith('.jsx');
  const first = generateTableFromFields({ fields: chosenFields, system, lang, look, sourceName });
  const noExt = `${sourceDir}/kumicraft/data/${first.fileBaseName}.data`;
  const dataFile = `${noExt}.${isTs ? 'ts' : 'js'}`;
  const bundle = generateTableFromFields({
    fields: chosenFields,
    system,
    lang,
    look,
    sourceName,
    dataImportPath: computeRelativeImport(file, noExt),
  });
  return {
    output: bundle.rendered,
    dataArray: { file: dataFile, exportName: bundle.exportName, rows: bundle.dataRows },
  };
}

function buildInsertArgs(
  mode: DataPickerMode,
  sourceName: string,
  chosenFields: readonly DataField[],
  file: string,
  lang: string,
) {
  const project = useProjectStore.getState().project;
  const system =
    project?.support.styling !== undefined ? primarySystem(project.support.styling) : 'tailwind4';
  const look = lookFromTheme(useThemeStore.getState().theme, getSelectedStyle(project?.id));
  const locLang = localizedBlockLang(lang);
  return mode === 'form'
    ? {
        output: generateFormFromFields({
          fields: chosenFields,
          system,
          lang: locLang,
          look,
          uiKit: project?.support.uiKit,
        }),
      }
    : buildTableInsertArgs(chosenFields, sourceName, file, locLang);
}

export async function submitDataInsert(
  mode: DataPickerMode,
  sourceName: string,
  chosenFields: readonly DataField[],
  lang: string,
): Promise<boolean> {
  const selectedRef = useSelectionStore.getState().selectedRefs[0];
  if (selectedRef === undefined) return false;
  const resolved = selectionAnchor(selectedRef);
  if (!resolved.ok) return false;
  const target = determineInsertTarget(resolved.anchor, resolveTargetTag(resolved.anchor) ?? 'div');
  const loc = target.kind === 'sibling' ? target.ref.loc : target.parent.loc;
  const file = loc.split(':')[0] || 'src/App.tsx';
  const built = buildInsertArgs(mode, sourceName, chosenFields, file, lang);
  const { output } = built;
  const res = await applyStructureEdit({
    kind: 'insert',
    target,
    jsx: output.jsx,
    ...(output.rules.length > 0 ? { css: { rules: output.rules } } : {}),
    ...(output.imports !== undefined && output.imports.length > 0
      ? { from: { file, imports: [...output.imports] } }
      : {}),
    ...(output.kit !== undefined ? { kit: output.kit } : {}),
    ...('dataArray' in built ? { dataArray: built.dataArray } : {}),
  });
  recordRecentBlock(
    useProjectStore.getState().project?.id,
    mode === 'form' ? 'data.form-from-source' : 'data.table-from-source',
  );
  const nextLoc = res.locs[0];
  if (nextLoc !== undefined)
    useSelectionStore.getState().setSelectedRefs([{ loc: nextLoc, index: 0 }]);
  return true;
}
