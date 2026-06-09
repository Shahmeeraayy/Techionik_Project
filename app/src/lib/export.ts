import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export type ExportRow = Record<string, unknown>;
export type ExportFormat = 'csv' | 'excel' | 'pdf';

export function selectColumnsForExport<T extends ExportRow>(data: T[], selectedColumns: string[]): ExportRow[] {
    if (!Array.isArray(selectedColumns) || selectedColumns.length === 0) {
        return [];
    }

    return data.map((row) => {
        const selected: ExportRow = {};
        selectedColumns.forEach((column) => {
            selected[column] = row[column];
        });
        return selected;
    });
}

export function convertArrayToCSV<T extends object>(data: T[], filename: string) {
    if (!data || data.length === 0) {
        alert("No data to export.");
        return;
    }

    // Get headers from the first object keys
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        headers.join(','), // Header row
        ...data.map(row =>
            headers.map(fieldName => {
                const value = (row as any)[fieldName];

                if (value === null || value === undefined) {
                    return '';
                }

                // Handle strings with commas or quotes by wrapping in quotes and escaping internal quotes
                if (typeof value === 'string') {
                    return `"${value.replace(/"/g, '""')}"`;
                }

                if (typeof value === 'boolean') {
                    return value ? 'Yes' : 'No';
                }

                // Handle arrays (like zones or skills)
                if (Array.isArray(value)) {
                    return `"${value.join('; ')}"`;
                }
                // Handle objects (basic JSON stringify for now, or just [Object])
                if (typeof value === 'object' && value !== null) {
                    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                }
                return `${value}`;
            }).join(',')
        )
    ].join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function convertArrayToExcel<T extends object>(data: T[], filename: string) {
    if (!data || data.length === 0) {
        alert("No data to export.");
        return;
    }

    const normalized = data.map((row) => {
        const next: Record<string, unknown> = {};
        Object.entries(row).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                next[key] = '';
            } else if (typeof value === 'boolean') {
                next[key] = value ? 'Yes' : 'No';
            } else if (Array.isArray(value)) {
                next[key] = value.join('; ');
            } else if (typeof value === 'object') {
                next[key] = JSON.stringify(value);
            } else {
                next[key] = value;
            }
        });
        return next;
    });

    const worksheet = XLSX.utils.json_to_sheet(normalized);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function convertArrayToPdf<T extends object>(data: T[], filename: string) {
    if (!data || data.length === 0) {
        alert("No data to export.");
        return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const headers = Object.keys(data[0]);
    const left = 40;
    const top = 48;
    const lineHeight = 16;
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = doc.internal.pageSize.getWidth() - left * 2;

    const normalizeValue = (value: unknown): string => {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (Array.isArray(value)) {
            return value.join('; ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    };

    let y = top;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(filename.replace(/_/g, ' '), left, y);
    y += 24;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rows: ${data.length}`, left, y);
    y += 24;

    for (const [index, row] of data.entries()) {
        const rowLines = headers.flatMap((header) => {
            const content = `${header}: ${normalizeValue((row as Record<string, unknown>)[header])}`;
            return doc.splitTextToSize(content, maxWidth);
        });

        const requiredHeight = Math.max(lineHeight, rowLines.length * lineHeight) + 10;
        if (y + requiredHeight > pageHeight - 40) {
            doc.addPage();
            y = top;
        }

        doc.setFont('helvetica', 'bold');
        doc.text(`Row ${index + 1}`, left, y);
        y += lineHeight;

        doc.setFont('helvetica', 'normal');
        for (const line of rowLines) {
            doc.text(line, left, y);
            y += lineHeight;
        }

        y += 8;
    }

    doc.save(`${filename}.pdf`);
}

export function exportArrayData<T extends object>(data: T[], filename: string, format: ExportFormat = 'csv') {
    if (format === 'excel') {
        convertArrayToExcel(data, filename);
        return;
    }
    if (format === 'pdf') {
        convertArrayToPdf(data, filename);
        return;
    }
    convertArrayToCSV(data, filename);
}
