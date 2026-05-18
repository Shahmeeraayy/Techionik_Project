import { useEffect, useMemo, useState } from 'react';
import { Download, Grid2X2, Sheet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ExportFormat } from '@/lib/export';

interface ColumnExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    availableColumns: string[];
    defaultSelectedColumns?: string[];
    onConfirm: (selectedColumns: string[], format?: ExportFormat) => void;
}

export default function ColumnExportDialog({
    open,
    onOpenChange,
    title,
    description,
    availableColumns,
    defaultSelectedColumns,
    onConfirm,
}: ColumnExportDialogProps) {
    const normalizedDefaultSelection = useMemo(() => {
        if (!defaultSelectedColumns || defaultSelectedColumns.length === 0) {
            return availableColumns;
        }

        const validDefaults = defaultSelectedColumns.filter((column) => availableColumns.includes(column));
        return validDefaults.length > 0 ? validDefaults : availableColumns;
    }, [availableColumns, defaultSelectedColumns]);

    const [selectedColumns, setSelectedColumns] = useState<string[]>(normalizedDefaultSelection);
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');

    useEffect(() => {
        if (open) {
            setSelectedColumns(normalizedDefaultSelection);
            setSelectedFormat('csv');
        }
    }, [open, normalizedDefaultSelection]);

    const selectedCount = selectedColumns.length;

    const toggleColumn = (column: string, checked: boolean) => {
        if (checked) {
            setSelectedColumns((prev) => {
                if (prev.includes(column)) return prev;
                return availableColumns.filter((item) => item === column || prev.includes(item));
            });
            return;
        }

        setSelectedColumns((prev) => prev.filter((item) => item !== column));
    };

    const handleExport = () => {
        if (selectedColumns.length === 0) {
            alert('Please select at least one column to export.');
            return;
        }

        onConfirm(selectedColumns, selectedFormat);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-1.5rem)] max-w-[36rem] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] p-0 shadow-[0_32px_110px_rgba(0,0,0,0.4)] sm:max-w-[36rem]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />

                <DialogHeader className="relative border-b border-white/10 px-6 pt-6 pb-5">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                        <Download className="h-3.5 w-3.5" />
                        Export Setup
                    </div>
                    <DialogTitle className="text-xl font-semibold text-white">{title}</DialogTitle>
                    <DialogDescription className="text-sm leading-6 text-slate-300">
                        {description || 'Select the columns you want to include in the CSV export.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="relative flex max-h-[65vh] min-h-0 flex-col gap-4 px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                            <Grid2X2 className="h-3.5 w-3.5 text-cyan-200" />
                            <span>{selectedCount} of {availableColumns.length} columns selected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-full border border-white/10 !bg-[#0b1424] px-3 text-xs !text-slate-200 hover:!bg-[#122039] hover:!text-white"
                                onClick={() => setSelectedColumns(availableColumns)}
                            >
                                Select all
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-full border border-white/10 !bg-[#0b1424] px-3 text-xs !text-slate-400 hover:!bg-[#122039] hover:!text-white"
                                onClick={() => setSelectedColumns([])}
                            >
                                Clear all
                            </Button>
                        </div>
                    </div>

                    <ScrollArea className="min-h-0 flex-1 pr-1">
                        <div className="grid grid-cols-1 gap-2">
                            {availableColumns.map((column) => {
                                const id = `export-column-${column.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                                return (
                                    <label
                                        key={column}
                                        htmlFor={id}
                                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 transition hover:bg-white/[0.06]"
                                    >
                                        <Checkbox
                                            id={id}
                                            checked={selectedColumns.includes(column)}
                                            onCheckedChange={(checked) => toggleColumn(column, checked === true)}
                                        />
                                        <span className="font-normal text-sm text-white">
                                            {column}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="relative border-t border-white/10 px-6 py-4">
                    <div className="mr-auto flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={selectedFormat === 'csv' ? 'default' : 'ghost'}
                            className="h-8 rounded-full px-3"
                            onClick={() => setSelectedFormat('csv')}
                        >
                            CSV
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={selectedFormat === 'excel' ? 'default' : 'ghost'}
                            className="h-8 rounded-full px-3"
                            onClick={() => setSelectedFormat('excel')}
                        >
                            <Sheet className="mr-1.5 h-3.5 w-3.5" />
                            Excel
                        </Button>
                    </div>
                    <Button type="button" variant="ghost" className="h-10 rounded-2xl border border-white/10 !bg-[#0b1424] !text-slate-100 hover:!bg-[#122039] hover:!text-white" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" className="h-10 min-w-32 rounded-2xl bg-gradient-to-r from-[#0ca6a6] to-[#149fcb] text-white shadow-[0_18px_44px_rgba(12,166,166,0.22)] hover:from-[#11b5b5] hover:to-[#1aaedf]" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        {selectedFormat === 'excel' ? 'Export Excel' : 'Export CSV'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
