import type { ReactNode } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type DataTableColumn = {
  key: string;
  label: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
};

type DataTableProps = {
  columns: DataTableColumn[];
  children: ReactNode;
  className?: string;
};

export function DataTable({ columns, children, className }: DataTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-[28px] border border-border/70 bg-background/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)]', className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  'h-12 px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.className,
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

