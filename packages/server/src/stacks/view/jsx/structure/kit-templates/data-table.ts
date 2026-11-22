// Self-contained DataTable kit template (TK-34): search, aria-sort columns, pagination, empty state.

const DATA_TABLE_TS = `import { useMemo, useState } from 'react';

export type DataTableColumn = {
  key: string;
  label: string;
};

export type DataTableRow = Record<string, string | number | boolean | undefined>;

export type DataTableProps = {
  data: readonly DataTableRow[];
  columns: readonly DataTableColumn[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  pageSize?: number;
  className?: string;
};

type SortDirection = 'ascending' | 'descending' | 'none';

function compareCells(a: DataTableRow[string], b: DataTableRow[string]): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a ?? '').localeCompare(String(b ?? ''));
}

export function DataTable({
  data,
  columns,
  searchPlaceholder = 'Tìm kiếm...',
  emptyMessage = 'Chưa có dữ liệu',
  pageSize = 10,
  className,
}: DataTableProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDirection>('none');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q)),
    );
  }, [data, columns, query]);

  const sorted = useMemo(() => {
    if (!sortKey || sortDir === 'none') return filtered;
    const copy = [...filtered];
    copy.sort((ra, rb) => {
      const cmp = compareCells(ra[sortKey], rb[sortKey]);
      return sortDir === 'ascending' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const safePageSize = pageSize > 0 ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * safePageSize, (currentPage + 1) * safePageSize);

  const cycleSort = (key: string) => {
    setPage(0);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('ascending');
      return;
    }
    if (sortDir === 'ascending') setSortDir('descending');
    else if (sortDir === 'descending') setSortDir('none');
    else setSortDir('ascending');
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          fontSize: '14px',
        }}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              {columns.map((col) => {
                const dir: SortDirection = sortKey === col.key ? sortDir : 'none';
                return (
                  <th key={col.key} aria-sort={dir} style={{ padding: '8px 10px' }}>
                    <button
                      type="button"
                      onClick={() => cycleSort(col.key)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {col.label}
                      {dir === 'ascending' ? ' ↑' : dir === 'descending' ? ' ↓' : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, columns.length)} style={{ padding: '16px 10px', textAlign: 'center', opacity: 0.7 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => (
                <tr key={String(row.id ?? idx)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: '8px 10px' }}>
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', fontSize: '13px' }}>
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Trang trước"
          >
            ‹
          </button>
          <span>{currentPage + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Trang sau"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
`;

const DATA_TABLE_JS = `import { useMemo, useState } from 'react';

function compareCells(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a ?? '').localeCompare(String(b ?? ''));
}

export function DataTable({
  data,
  columns,
  searchPlaceholder = 'Tìm kiếm...',
  emptyMessage = 'Chưa có dữ liệu',
  pageSize = 10,
  className,
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(undefined);
  const [sortDir, setSortDir] = useState('none');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q)),
    );
  }, [data, columns, query]);

  const sorted = useMemo(() => {
    if (!sortKey || sortDir === 'none') return filtered;
    const copy = [...filtered];
    copy.sort((ra, rb) => {
      const cmp = compareCells(ra[sortKey], rb[sortKey]);
      return sortDir === 'ascending' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const safePageSize = pageSize > 0 ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(sorted.length / safePageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * safePageSize, (currentPage + 1) * safePageSize);

  const cycleSort = (key) => {
    setPage(0);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('ascending');
      return;
    }
    if (sortDir === 'ascending') setSortDir('descending');
    else if (sortDir === 'descending') setSortDir('none');
    else setSortDir('ascending');
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          fontSize: '14px',
        }}
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              {columns.map((col) => {
                const dir = sortKey === col.key ? sortDir : 'none';
                return (
                  <th key={col.key} aria-sort={dir} style={{ padding: '8px 10px' }}>
                    <button
                      type="button"
                      onClick={() => cycleSort(col.key)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {col.label}
                      {dir === 'ascending' ? ' ↑' : dir === 'descending' ? ' ↓' : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, columns.length)} style={{ padding: '16px 10px', textAlign: 'center', opacity: 0.7 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => (
                <tr key={String(row.id ?? idx)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: '8px 10px' }}>
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', fontSize: '13px' }}>
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Trang trước"
          >
            ‹
          </button>
          <span>{currentPage + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Trang sau"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
`;

export function buildDataTableTemplate(typescript: boolean): string {
  return typescript ? DATA_TABLE_TS : DATA_TABLE_JS;
}
