import { type ReactNode } from 'react';
import { PageCard } from '@/components/PageCard';
import { TD } from '@/components/ui/Table';
import { VirtualizedTable } from '@/components/ui/VirtualizedTable';

export function DataTable<T>({
  title,
  columns,
  rows,
  rowKey,
  renderRow,
  getRowProps,
  getRowHeight,
  emptyMessage = 'No records found.',
  maxHeight = 520,
  estimateRowHeight = 52,
  columnClassNames,
}: {
  title?: string;
  columns: string[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number) => ReactNode;
  getRowProps?: (row: T, index: number) => { className?: string; onClick?: () => void };
  getRowHeight?: (row: T, index: number) => number;
  emptyMessage?: string;
  maxHeight?: number;
  estimateRowHeight?: number;
  columnClassNames?: Array<string | undefined>;
}) {
  return (
    <PageCard title={title} noPadding>
      <VirtualizedTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        renderRow={renderRow}
        getRowProps={getRowProps}
        getRowHeight={getRowHeight}
        emptyMessage={emptyMessage}
        maxHeight={maxHeight}
        estimateRowHeight={estimateRowHeight}
        columnClassNames={columnClassNames}
      />
    </PageCard>
  );
}

export { TD };
