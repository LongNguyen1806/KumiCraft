// Data source and field loader hooks for DataSourcePickerDialog (TK-33, TK-35).
import type { DataField, DataSourceItem } from '@kumicraft/shared';
import { useEffect, useState } from 'react';

import { fetchDataSourceFields, fetchDataSources } from '../../api/project-client.ts';

function toggleFieldInSet(prev: ReadonlySet<string>, name: string): ReadonlySet<string> {
  const next = new Set(prev);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
}

function swapFieldsOrder(
  fields: readonly DataField[],
  index: number,
  delta: -1 | 1,
): readonly DataField[] {
  const a = fields[index];
  const b = fields[index + delta];
  if (a === undefined || b === undefined) return fields;
  const copy = [...fields];
  copy[index] = b;
  copy[index + delta] = a;
  return copy;
}

/** Loads available project data sources whenever the picker opens. */
export function useDataSourcesLoader(open: boolean) {
  const [state, setState] = useState<{
    readonly loaded: boolean;
    readonly sources: readonly DataSourceItem[];
    readonly yamlFiles: readonly string[];
    readonly selectedId: string;
    readonly error?: string | undefined;
  }>({ loaded: false, sources: [], yamlFiles: [], selectedId: '' });

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchDataSources();
        if (cancelled) return;
        const first = res.sources[0];
        setState({
          loaded: true,
          sources: res.sources,
          yamlFiles: res.yamlUnsupportedFiles ?? [],
          selectedId: first !== undefined ? first.id : '',
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            loaded: true,
            sources: [],
            yamlFiles: [],
            selectedId: '',
            error: err instanceof Error ? err.message : 'Error',
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return {
    loading: open && !state.loaded,
    sources: state.sources,
    yamlFiles: state.yamlFiles,
    selectedId: state.selectedId,
    setSelectedId: (id: string) => {
      setState((prev) => ({ ...prev, selectedId: id }));
    },
    error: state.error,
  };
}

/** Loads editable field definitions for the currently selected data source. */
export function useSourceFieldsLoader(open: boolean, source: DataSourceItem | undefined) {
  const sourceKey = open && source !== undefined ? source.id : '';
  const [loaded, setLoaded] = useState<{
    readonly key: string;
    readonly fields: readonly DataField[];
    readonly enabledNames: ReadonlySet<string>;
  }>({ key: '', fields: [], enabledNames: new Set() });

  useEffect(() => {
    if (!sourceKey || source === undefined) return undefined;
    let cancelled = false;
    async function load(target: DataSourceItem, key: string) {
      try {
        const res = await fetchDataSourceFields({
          kind: target.kind,
          file: target.file,
          name: target.name,
        });
        if (!cancelled) {
          setLoaded({
            key,
            fields: res.fields,
            enabledNames: new Set(res.fields.map((f) => f.name)),
          });
        }
      } catch {
        if (!cancelled) setLoaded({ key, fields: [], enabledNames: new Set() });
      }
    }
    void load(source, sourceKey);
    return () => {
      cancelled = true;
    };
  }, [sourceKey, source]);

  return {
    loading: Boolean(sourceKey) && loaded.key !== sourceKey,
    fields: loaded.key === sourceKey ? loaded.fields : [],
    enabledNames: loaded.key === sourceKey ? loaded.enabledNames : new Set<string>(),
    toggleField: (name: string) => {
      setLoaded((prev) => ({ ...prev, enabledNames: toggleFieldInSet(prev.enabledNames, name) }));
    },
    moveField: (index: number, delta: -1 | 1) => {
      setLoaded((prev) => ({ ...prev, fields: swapFieldsOrder(prev.fields, index, delta) }));
    },
  };
}
