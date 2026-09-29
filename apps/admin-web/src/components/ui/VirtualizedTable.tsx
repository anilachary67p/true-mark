'use client';

import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from './cn';
import { THead, TR, TH, TD } from './Table';

export type VirtualizedRowProps = {
  className?: string;
  onClick?: () => void;
};

export function VirtualizedTable<T>({
  columns,
  rows,
  rowKey,
  renderRow,
  getRowProps,
  estimateRowHeight = 52,
  getRowHeight,
  emptyMessage = 'No records found.',
  maxHeight = 520,
  className,
  columnClassNames,
}: {
  columns: string[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number) => ReactNode;
  getRowProps?: (row: T, index: number) => VirtualizedRowProps | undefined;
  estimateRowHeight?: number;
  getRowHeight?: (row: T, index: number) => number;
  emptyMessage?: string;
  maxHeight?: number;
  className?: string;
  columnClassNames?: Array<string | undefined>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => getRowHeight?.(rows[index], index) ?? estimateRowHeight,
    overscan: 10,
  });

  if (rows.length === 0) {
    return (
      <div className={cn('overflow-x-auto', className)}>
        <table className="w-full text-left text-sm">
          <THead>
            <TR>
              {columns.map((col, index) => (
                <TH key={col} className={columnClassNames?.[index]}>
                  {col}
                </TH>
              ))}
            </TR>
          </THead>
          <tbody>
            <tr>
              <TD colSpan={columns.length}>
                <p className="py-10 text-center text-sm text-hope-secondary">{emptyMessage}</p>
              </TD>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom =
    virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0);

  return (
    <div ref={parentRef} className={cn('overflow-auto', className)} style={{ maxHeight }}>
      <table className="w-full text-left text-sm">
        <THead className="sticky top-0 z-10">
          <TR>
            {columns.map((col, index) => (
              <TH key={col} className={columnClassNames?.[index]}>
                {col}
              </TH>
            ))}
          </TR>
        </THead>
        <tbody className="divide-y divide-slate-50">
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: 0 }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            const rowProps = getRowProps?.(row, virtualRow.index);
            return (
              <tr
                key={rowKey(row, virtualRow.index)}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn('transition hover:bg-hope-primary/5', rowProps?.className)}
                onClick={rowProps?.onClick}
              >
                {renderRow(row, virtualRow.index)}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td
                colSpan={columns.length}
                style={{ height: paddingBottom, padding: 0, border: 0 }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
