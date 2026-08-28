import { PageCard } from '@/components/PageCard';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';

export function DataTable({
  title,
  columns,
  children,
  emptyMessage = 'No records found.',
  isEmpty,
}: {
  title?: string;
  columns: string[];
  children: React.ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}) {
  return (
    <PageCard title={title} noPadding>
      <Table>
        <THead>
          <TR>
            {columns.map((col) => (
              <TH key={col}>{col}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {isEmpty ? (
            <TR>
              <TD colSpan={columns.length}>
                <p className="py-10 text-center text-sm text-hope-secondary">{emptyMessage}</p>
              </TD>
            </TR>
          ) : (
            children
          )}
        </TBody>
      </Table>
    </PageCard>
  );
}
