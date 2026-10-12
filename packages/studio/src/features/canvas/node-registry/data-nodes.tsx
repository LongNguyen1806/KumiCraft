import { Children } from 'react';

import type { NodeRenderProps } from './layout-nodes.tsx';

const MOCK_ROWS = [1, 2, 3, 4, 5];

export function TableNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'table' ? node.content : undefined;
  const columns = content?.columns ?? [{ id: 'col1', header: 'Column 1' }];

  return (
    <div data-rc-node={node.id} className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-neutral-100 font-medium">
            {columns.map((col) => (
              <th key={col.id} className="p-2.5">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MOCK_ROWS.map((rowIdx) => (
            <tr key={String(rowIdx)} className="border-b hover:bg-neutral-50/50">
              {columns.map((col) => (
                <td key={col.id} className="p-2.5 text-neutral-600">
                  {col.header} {String(rowIdx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ListNode({ node, className, children }: NodeRenderProps) {
  const childArray = Children.toArray(children);

  return (
    <div data-rc-node={node.id} className={className}>
      {childArray}
      {childArray.map((child, i) => (
        <div key={`repeat-1-${String(i)}`} data-rc-repeat="1" className="opacity-60">
          {child}
        </div>
      ))}
      {childArray.map((child, i) => (
        <div key={`repeat-2-${String(i)}`} data-rc-repeat="2" className="opacity-60">
          {child}
        </div>
      ))}
    </div>
  );
}

export function DetailViewNode({ node, className, children }: NodeRenderProps) {
  return (
    <div data-rc-node={node.id} className={className}>
      {children}
    </div>
  );
}
