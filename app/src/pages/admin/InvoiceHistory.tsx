import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import jsPDF from 'jspdf';
import {
    Activity,
    Search,
    Download,
    RefreshCw,
    Send,
    FileText,
    Building2,
    Calendar,
    ArrowUpRight,
    CheckCircle2,
    AlertTriangle,
    Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportArrayData, selectColumnsForExport, type ExportFormat } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ColumnExportDialog from '@/components/modals/ColumnExportDialog';
import OverflowText from '@/components/common/overflow-text';
import {
    fetchAdminDealerships,
    fetchInvoices,
    getStoredAdminToken,
    markInvoicePaid,
    sendInvoiceEmail,
    updateInvoice,
    voidInvoice,
    type BackendDealership,
    type BackendInvoice,
} from '@/lib/backend-api';

const INVOICE_HISTORY_EXPORT_COLUMNS = [
    'InvoiceID',
    'JobID',
    'Location',
    'Technician',
    'TotalValue',
    'GeneratedDate',
    'SentDate',
    'Status',
];

const displayFontStyle: CSSProperties = {
    fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};

const bodyFontStyle: CSSProperties = {
    fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};

type InvoiceHistoryMetricTone = 'cyan' | 'amber' | 'emerald' | 'violet';

function invoiceHistoryMetricCardClasses(tone: InvoiceHistoryMetricTone): string {
    return cn(
        'group relative overflow-hidden rounded-[26px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_24px_60px_rgba(0,0,0,0.28)]',
        tone === 'cyan' && 'border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] hover:border-slate-300 dark:border-cyan-400/20 dark:bg-[linear-gradient(180deg,rgba(8,31,45,0.96),rgba(7,23,34,0.96))] dark:hover:border-cyan-300/35',
        tone === 'amber' && 'border-amber-200 bg-[linear-gradient(180deg,#ffffff,#fdf9f4)] hover:border-amber-300 dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(47,28,13,0.96),rgba(27,18,8,0.96))] dark:hover:border-amber-300/35',
        tone === 'emerald' && 'border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f7fcfa)] hover:border-emerald-300 dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(12,34,28,0.96),rgba(8,22,18,0.96))] dark:hover:border-emerald-300/35',
        tone === 'violet' && 'border-violet-200 bg-[linear-gradient(180deg,#ffffff,#faf7fd)] hover:border-violet-300 dark:border-violet-400/20 dark:bg-[linear-gradient(180deg,rgba(28,20,49,0.96),rgba(19,17,34,0.96))] dark:hover:border-violet-300/35',
    );
}

function invoiceHistoryMetricTopLineClasses(tone: InvoiceHistoryMetricTone): string {
    if (tone === 'amber') return 'via-amber-400/55 dark:via-amber-300/80';
    if (tone === 'emerald') return 'via-emerald-400/55 dark:via-emerald-300/80';
    if (tone === 'violet') return 'via-violet-400/55 dark:via-violet-300/80';
    return 'via-slate-900/35 dark:via-cyan-300/80';
}

function invoiceHistoryMetricIconClasses(tone: InvoiceHistoryMetricTone): string {
    if (tone === 'amber') return 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/12 dark:text-amber-100';
    if (tone === 'emerald') return 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/12 dark:text-emerald-100';
    if (tone === 'violet') return 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/20 dark:bg-violet-300/12 dark:text-violet-100';
    return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-cyan-300/20 dark:bg-cyan-300/12 dark:text-cyan-100';
}

const formatDateTimeSafe = (value?: string | null, pattern = 'MMM dd, yyyy - HH:mm') => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, pattern);
};

const formatDateSafe = (value?: string | null, pattern = 'MMM dd, yyyy') => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, pattern);
};

type InvoiceStatusFilter = 'all' | 'draft' | 'approved' | 'sent' | 'paid' | 'void';
type InvoiceQuickRange = 'none' | 'today' | 'week' | 'month' | 'year';
type InvoiceDisplayStatus = Exclude<InvoiceStatusFilter, 'all'>;
type InvoiceActionPrompt = 'download' | 'send' | 'paid';

const toNumber = (value: string | number | null | undefined): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const formatTermsLabel = (terms?: string, customDays?: number | null) => {
    if (!terms) return 'Net 15';
    if (terms === 'NET_15') return 'Net 15';
    if (terms === 'NET_30') return 'Net 30';
    if (terms === 'CUSTOM') return `Custom (${customDays ?? 0} days)`;
    return terms;
};

const extractJobCodeFromInvoice = (invoice: BackendInvoice): string => {
    if (invoice.job_code && invoice.job_code.trim()) {
        return invoice.job_code.trim();
    }
    const regex = /SM2-\d{4}-\d+/i;
    for (const line of invoice.line_items || []) {
        const text = `${line.description || ''} ${line.product_service || ''}`;
        const match = text.match(regex);
        if (match) return match[0].toUpperCase();
    }
    return '-';
};

const resolveTechnician = (invoice: BackendInvoice): string => invoice.technician_name?.trim() || '-';

const resolveInvoiceLocation = (invoice: BackendInvoice, dealerships: BackendDealership[] = []): string => {
    const fromInvoice =
        invoice.bill_to?.city?.trim() ||
        invoice.ship_to?.city?.trim();
    if (fromInvoice) return fromInvoice;
    const matchedDealership = dealerships.find((dealer) => {
        const names = [dealer.name, dealer.code].filter(Boolean).map((value) => value!.trim().toLowerCase());
        const invoiceName = (invoice.dealership_name || invoice.bill_to?.name || '').trim().toLowerCase();
        return invoiceName.length > 0 && names.includes(invoiceName);
    });
    return matchedDealership?.city?.trim() || invoice.dealership_name?.trim() || invoice.bill_to?.name?.trim() || '-';
};

const resolveInvoiceSentDate = (invoice: BackendInvoice): string | null => {
    if (invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue') {
        return invoice.updated_at;
    }
    return invoice.voided_at || null;
};

const resolveInvoiceCustomerEmail = (invoice: BackendInvoice, dealerships: BackendDealership[] = []): string => {
    if (invoice.customer_email?.trim()) {
        return invoice.customer_email.trim();
    }
    const invoiceName = (invoice.dealership_name || invoice.bill_to?.name || '').trim().toLowerCase();
    const matchedDealership = dealerships.find((dealer) => {
        const names = [dealer.name, dealer.code].filter(Boolean).map((value) => value!.trim().toLowerCase());
        return invoiceName.length > 0 && names.includes(invoiceName);
    });
    return matchedDealership?.email?.split(',')[0]?.trim() || '';
};

const resolveInvoiceDisplayStatus = (
    invoice: BackendInvoice,
): {
    value: InvoiceDisplayStatus;
    label: string;
    badgeClassName: string;
} => {
    if (invoice.status === 'paid') {
        return {
            value: 'paid',
            label: 'Paid',
            badgeClassName: 'border-emerald-300/20 bg-emerald-300/12 text-emerald-100',
        };
    }
    if (invoice.status === 'sent') {
        return {
            value: 'sent',
            label: 'Sent',
            badgeClassName: 'border-blue-300/20 bg-blue-300/12 text-blue-100',
        };
    }
    if (invoice.status === 'overdue') {
        return {
            value: 'sent',
            label: 'Sent',
            badgeClassName: 'border-orange-300/20 bg-orange-300/12 text-orange-100',
        };
    }
    if (invoice.status === 'cancelled') {
        return {
            value: 'void',
            label: 'Void',
            badgeClassName: 'border-red-300/20 bg-red-300/12 text-red-100',
        };
    }
    return {
        value: 'approved',
        label: 'Approved',
        badgeClassName: 'border-slate-300/20 bg-slate-300/10 text-slate-200',
    };
};

const toAddressLines = (party?: {
    name?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
}) => {
    if (!party) return [];
    const lines: string[] = [];
    if (party.name) lines.push(party.name);
    if (party.street) lines.push(party.street);
    const cityStateZip = [party.city, party.state, party.zip_code].filter(Boolean).join(', ').replace(', ,', ',');
    if (cityStateZip) lines.push(cityStateZip);
    return lines;
};

export default function InvoiceHistoryPage() {
    const [history, setHistory] = useState<BackendInvoice[]>([]);
    const [dealerships, setDealerships] = useState<BackendDealership[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<InvoiceStatusFilter>('all');
    const [quickRange, setQuickRange] = useState<InvoiceQuickRange>('none');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<BackendInvoice | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [actionLoading, setActionLoading] = useState<'paid' | 'void' | 'send' | null>(null);
    const [actionPrompt, setActionPrompt] = useState<InvoiceActionPrompt | null>(null);
    const [actionNotice, setActionNotice] = useState<{ title: string; description: string } | null>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const adminToken = getStoredAdminToken();
            if (!adminToken) {
                setHistory([]);
                setDealerships([]);
                return;
            }
            const [rows, dealershipRows] = await Promise.all([
                fetchInvoices(adminToken),
                fetchAdminDealerships(adminToken).catch(() => [] as BackendDealership[]),
            ]);
            setHistory(rows);
            setDealerships(dealershipRows);
        } catch (error) {
            console.error(error);
            setHistory([]);
            setDealerships([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchHistory();
    }, []);

    const resolvedRange = useMemo(() => {
        if (quickRange === 'none') {
            return { from: fromDate, to: toDate };
        }
        const now = new Date();
        const end = format(now, 'yyyy-MM-dd');
        if (quickRange === 'today') {
            return { from: end, to: end };
        }
        if (quickRange === 'week') {
            const start = new Date(now);
            start.setDate(now.getDate() - 6);
            return { from: format(start, 'yyyy-MM-dd'), to: end };
        }
        if (quickRange === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { from: format(start, 'yyyy-MM-dd'), to: end };
        }
        return { from: `${now.getFullYear()}-01-01`, to: end };
    }, [fromDate, quickRange, toDate]);

    const filteredHistory = useMemo(() => history.filter((inv) => {
        const query = searchQuery.toLowerCase().trim();
        const generatedDate = new Date(inv.created_at);

        const jobCode = extractJobCodeFromInvoice(inv).toLowerCase();
        const location = resolveInvoiceLocation(inv, dealerships).toLowerCase();
        const technician = resolveTechnician(inv).toLowerCase();

        const matchesSearch =
            query.length === 0 ||
            jobCode.includes(query) ||
            location.includes(query) ||
            technician.includes(query) ||
            inv.invoice_number.toLowerCase().includes(query);

        const displayStatus = resolveInvoiceDisplayStatus(inv);
        const matchesStatus =
            filterStatus === 'all' ||
            displayStatus.value === filterStatus ||
            (filterStatus === 'draft' && inv.status === 'draft');

        const generatedKey = Number.isNaN(generatedDate.getTime()) ? '' : format(generatedDate, 'yyyy-MM-dd');
        const matchesFrom = !resolvedRange.from || (generatedKey !== '' && generatedKey >= resolvedRange.from);
        const matchesTo = !resolvedRange.to || (generatedKey !== '' && generatedKey <= resolvedRange.to);

        return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    }), [dealerships, filterStatus, history, resolvedRange.from, resolvedRange.to, searchQuery]);

    const archiveValue = useMemo(
        () => filteredHistory.reduce((sum, inv) => sum + toNumber(inv.total), 0),
        [filteredHistory],
    );

    const sentCount = useMemo(
        () => filteredHistory.filter((inv) => resolveInvoiceDisplayStatus(inv).value === 'sent').length,
        [filteredHistory],
    );

    const paidCount = useMemo(
        () => filteredHistory.filter((inv) => resolveInvoiceDisplayStatus(inv).value === 'paid').length,
        [filteredHistory],
    );

    const voidCount = useMemo(
        () => filteredHistory.filter((inv) => resolveInvoiceDisplayStatus(inv).value === 'void').length,
        [filteredHistory],
    );

    const clearFilters = () => {
        setSearchQuery('');
        setFilterStatus('all');
        setQuickRange('none');
        setFromDate('');
        setToDate('');
    };

    const handleViewInvoice = (invoice: BackendInvoice) => {
        setSelectedInvoice(invoice);
        setDrawerOpen(true);
    };

    const getInvoiceHistoryExportRows = () => filteredHistory.map((invoice) => ({
        InvoiceID: invoice.invoice_number,
        JobID: extractJobCodeFromInvoice(invoice),
        Location: resolveInvoiceLocation(invoice, dealerships),
        Technician: resolveTechnician(invoice),
        TotalValue: toNumber(invoice.total),
        GeneratedDate: formatDateTimeSafe(invoice.created_at),
        SentDate: formatDateTimeSafe(resolveInvoiceSentDate(invoice)),
        Status: resolveInvoiceDisplayStatus(invoice).label,
    }));

    const handleExport = (selectedColumns: string[], format: ExportFormat = 'csv') => {
        const exportData = selectColumnsForExport(getInvoiceHistoryExportRows(), selectedColumns);
        exportArrayData(exportData, 'invoice_history_export', format);
    };

    const refreshSelectedInvoice = (updatedInvoice: BackendInvoice) => {
        setHistory((current) => current.map((invoice) => (invoice.id === updatedInvoice.id ? updatedInvoice : invoice)));
        setSelectedInvoice(updatedInvoice);
    };

    const handleSendInvoiceEmail = async (invoice: BackendInvoice) => {
        const adminToken = getStoredAdminToken();
        if (!adminToken) {
            setActionNotice({ title: 'Admin session required', description: 'Please sign in again before sending invoice email.' });
            return;
        }
        const recipient = resolveInvoiceCustomerEmail(invoice, dealerships);
        if (!recipient) {
            setActionNotice({ title: 'No email available', description: 'Add a customer or dealership email before sending this invoice.' });
            return;
        }
        setActionLoading('send');
        try {
            const updatedInvoice = await sendInvoiceEmail(adminToken, invoice.id);
            refreshSelectedInvoice(updatedInvoice);
            setActionPrompt(null);
            setActionNotice({ title: 'Invoice email sent', description: `The invoice was sent to ${recipient} directly from your NexusOps workspace email identity.` });
        } catch (error) {
            setActionNotice({ title: 'Email not sent', description: error instanceof Error ? error.message : 'Unable to send invoice email.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleMarkAsPaid = async (invoice: BackendInvoice) => {
        const adminToken = getStoredAdminToken();
        if (!adminToken) {
            setActionNotice({ title: 'Admin session required', description: 'Please sign in again before updating invoice status.' });
            return;
        }
        setActionLoading('paid');
        try {
            const updatedInvoice = await markInvoicePaid(adminToken, invoice.id, new Date().toISOString());
            refreshSelectedInvoice(updatedInvoice);
            setActionPrompt(null);
            setActionNotice({ title: 'Invoice marked paid', description: `${invoice.invoice_number} is now recorded as paid.` });
        } catch (error) {
            setActionNotice({ title: 'Could not mark paid', description: error instanceof Error ? error.message : 'Unable to mark invoice as paid.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleVoidInvoice = async () => {
        if (!selectedInvoice) return;
        const reason = voidReason.trim();
        if (!reason) {
            setActionNotice({ title: 'Void reason required', description: 'Please enter a reason before voiding this invoice.' });
            return;
        }
        const adminToken = getStoredAdminToken();
        if (!adminToken) {
            setActionNotice({ title: 'Admin session required', description: 'Please sign in again before voiding invoices.' });
            return;
        }
        setActionLoading('void');
        try {
            await updateInvoice(adminToken, selectedInvoice.id, {
                approval_note: reason,
            });
            const updatedInvoice = await voidInvoice(adminToken, selectedInvoice.id);
            refreshSelectedInvoice(updatedInvoice);
            setVoidReason('');
            setVoidDialogOpen(false);
            setActionNotice({ title: 'Invoice voided', description: `${selectedInvoice.invoice_number} has been marked void.` });
        } catch (error) {
            setActionNotice({ title: 'Could not void invoice', description: error instanceof Error ? error.message : 'Unable to void invoice.' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownloadPdf = (invoice: BackendInvoice) => {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const left = 48;
        const pageWidth = doc.internal.pageSize.getWidth();
        const rowHeight = 22;

        const lineItems = invoice.line_items.map((item) => ({
            product_service: item.product_service || 'Service',
            description: item.description || '',
            qty: toNumber(item.qty ?? item.quantity),
            rate: toNumber(item.rate),
            amount: toNumber(item.amount),
        }));

        const subtotal = toNumber(invoice.subtotal);
        const salesTax = toNumber(invoice.sales_tax_total ?? invoice.sales_tax);
        const shipping = toNumber(invoice.shipping);
        const total = toNumber(invoice.total);

        const company = invoice.company_info || {
            logo_url: '',
            name: '',
            street_address: '',
            city: '',
            state: '',
            zip_code: '',
            phone: '',
            email: '',
            website: '',
        };

        const invoiceDate = new Date(invoice.invoice_date);
        const dueDate = new Date(invoice.due_date);

        let y = 52;

        if (company.logo_url) {
            doc.setDrawColor(200, 200, 200);
            doc.rect(left, y - 8, 54, 30);
            doc.setFontSize(8);
            doc.setTextColor(110, 110, 110);
            doc.text('Logo', left + 20, y + 10);
            doc.setTextColor(0, 0, 0);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(company.name || '', left + 64, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(company.street_address || '', left + 64, y + 14);
        doc.text(`${company.city || ''}, ${company.state || ''} ${company.zip_code || ''}`.trim(), left + 64, y + 27);
        doc.text(`${company.phone || ''}  |  ${company.email || ''}`.trim(), left + 64, y + 40);
        doc.text(company.website || '', left + 64, y + 53);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text('INVOICE', pageWidth - left, y, { align: 'right' });

        y += 76;
        doc.setDrawColor(220, 220, 220);
        doc.line(left, y, pageWidth - left, y);
        y += 22;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('BILL TO', left, y);
        doc.text('SHIP TO', left + 240, y);
        y += 14;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const billToLines = toAddressLines(invoice.bill_to || undefined);
        const shipToLines = toAddressLines(invoice.ship_to || undefined);
        const maxAddressLines = Math.max(billToLines.length, shipToLines.length, 1);
        for (let i = 0; i < maxAddressLines; i += 1) {
            doc.text(billToLines[i] || '', left, y);
            doc.text(shipToLines[i] || '', left + 240, y);
            y += 14;
        }

        const panelTop = y - maxAddressLines * 14 - 14;
        const panelX = pageWidth - 220;
        const panelWidth = 172;
        doc.setDrawColor(220, 220, 220);
        doc.rect(panelX, panelTop - 4, panelWidth, 82);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Invoice #', panelX + 8, panelTop + 10);
        doc.text('Invoice Date', panelX + 8, panelTop + 26);
        doc.text('Terms', panelX + 8, panelTop + 42);
        doc.text('Due Date', panelX + 8, panelTop + 58);

        doc.setFont('helvetica', 'normal');
        doc.text(invoice.invoice_number, panelX + panelWidth - 8, panelTop + 10, { align: 'right' });
        doc.text(Number.isNaN(invoiceDate.getTime()) ? '-' : format(invoiceDate, 'yyyy-MM-dd'), panelX + panelWidth - 8, panelTop + 26, { align: 'right' });
        doc.text(formatTermsLabel(invoice.terms, invoice.custom_term_days), panelX + panelWidth - 8, panelTop + 42, { align: 'right' });
        doc.text(Number.isNaN(dueDate.getTime()) ? '-' : format(dueDate, 'yyyy-MM-dd'), panelX + panelWidth - 8, panelTop + 58, { align: 'right' });

        y += 20;
        doc.setDrawColor(220, 220, 220);
        doc.line(left, y, pageWidth - left, y);
        y += 18;

        const colProduct = left;
        const colDescription = left + 150;
        const colQty = pageWidth - 230;
        const colRate = pageWidth - 150;
        const colAmount = pageWidth - left;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Product/Service', colProduct, y);
        doc.text('Description', colDescription, y);
        doc.text('Qty/Hrs', colQty, y, { align: 'right' });
        doc.text('Rate', colRate, y, { align: 'right' });
        doc.text('Amount', colAmount, y, { align: 'right' });
        y += 10;
        doc.line(left, y, pageWidth - left, y);
        y += 14;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        lineItems.forEach((item) => {
            if (y > doc.internal.pageSize.getHeight() - 160) {
                doc.addPage();
                y = 56;
            }
            doc.text(item.product_service.slice(0, 26), colProduct, y);
            doc.text(item.description.slice(0, 32), colDescription, y);
            doc.text(item.qty.toFixed(2), colQty, y, { align: 'right' });
            doc.text(`$${item.rate.toFixed(2)}`, colRate, y, { align: 'right' });
            doc.text(`$${item.amount.toFixed(2)}`, colAmount, y, { align: 'right' });
            y += rowHeight;
        });

        y += 4;
        doc.line(left, y, pageWidth - left, y);
        y += 18;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Subtotal', colRate - 40, y, { align: 'right' });
        doc.text(`$${subtotal.toFixed(2)}`, colAmount, y, { align: 'right' });
        y += 16;
        doc.text('Sales Tax', colRate - 40, y, { align: 'right' });
        doc.text(`$${salesTax.toFixed(2)}`, colAmount, y, { align: 'right' });
        y += 16;
        doc.text('Shipping', colRate - 40, y, { align: 'right' });
        doc.text(`$${shipping.toFixed(2)}`, colAmount, y, { align: 'right' });
        y += 18;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Total', colRate - 40, y, { align: 'right' });
        doc.text(`$${total.toFixed(2)}`, colAmount, y, { align: 'right' });

        if (invoice.customer_message?.trim()) {
            y += 28;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('Customer Message', left, y);
            y += 14;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const lines = doc.splitTextToSize(invoice.customer_message, pageWidth - (left * 2));
            doc.text(lines, left, y);
        }

        doc.save(`${invoice.invoice_number}.pdf`);
        setActionPrompt(null);
        setActionNotice({ title: 'PDF downloaded', description: `${invoice.invoice_number}.pdf has been generated.` });
    };

    const handleConfirmActionPrompt = () => {
        if (!selectedInvoice || !actionPrompt) return;
        if (actionPrompt === 'download') {
            handleDownloadPdf(selectedInvoice);
            return;
        }
        if (actionPrompt === 'send') {
            void handleSendInvoiceEmail(selectedInvoice);
            return;
        }
        if (actionPrompt === 'paid') {
            void handleMarkAsPaid(selectedInvoice);
        }
    };

    const actionPromptCopy = selectedInvoice && actionPrompt ? {
        download: {
            title: 'Download invoice PDF?',
            description: `Generate and download ${selectedInvoice.invoice_number}.pdf using the current invoice details.`,
            confirm: 'Download PDF',
        },
        send: {
            title: 'Send invoice email?',
            description: `Send ${selectedInvoice.invoice_number} with a PDF attachment to ${resolveInvoiceCustomerEmail(selectedInvoice, dealerships) || 'the customer email on file'}.`,
            confirm: actionLoading === 'send' ? 'Sending...' : 'Send Email',
        },
        paid: {
            title: 'Mark invoice as paid?',
            description: `Record ${selectedInvoice.invoice_number} as paid now. This updates the invoice status immediately.`,
            confirm: actionLoading === 'paid' ? 'Marking...' : 'Mark Paid',
        },
    }[actionPrompt] : null;

    const summaryCards = [
        {
            key: 'history',
            label: 'Invoice records',
            value: filteredHistory.length.toString(),
            description: 'Invoices visible in the current history view.',
            icon: FileText,
            tone: 'cyan' as const,
        },
        {
            key: 'value',
            label: 'Total value',
            value: `$${archiveValue.toFixed(2)}`,
            description: 'Total invoice amount across the current filtered history.',
            icon: Download,
            tone: 'amber' as const,
        },
        {
            key: 'sent',
            label: 'Sent to client',
            value: sentCount.toString(),
            description: 'Invoices already issued and awaiting final settlement.',
            icon: Send,
            tone: 'emerald' as const,
        },
        {
            key: 'void',
            label: 'Paid / void',
            value: `${paidCount} / ${voidCount}`,
            description: `${paidCount} paid and ${voidCount} void invoice${voidCount === 1 ? '' : 's'} in the filtered result set.`,
            icon: AlertTriangle,
            tone: 'violet' as const,
        },
    ];

    return (
        <div className="flex h-full flex-col gap-6">
            <section className="relative overflow-hidden rounded-[32px] border border-black/8 bg-[linear-gradient(135deg,#ffffff,#fbfbfb)] px-6 py-6 shadow-[0_32px_110px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(7,24,41,0.98),rgba(5,15,29,0.98))] dark:shadow-[0_32px_110px_rgba(0,0,0,0.32)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-300/70" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.05),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.05),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
                <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b1424] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                            Billing archive
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-slate-900 dark:text-white md:text-[2.8rem]" style={displayFontStyle}>
                                Invoice History
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-[15px]" style={bodyFontStyle}>
                                Search, resend, download, and update invoices.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="h-9 rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 text-cyan-100">
                                <Activity className="mr-1.5 h-3.5 w-3.5" />
                                {filteredHistory.length} records
                            </Badge>
                            <Badge variant="outline" className="h-9 rounded-full border-emerald-300/20 bg-emerald-300/10 px-3 text-emerald-100">
                                <Send className="mr-1.5 h-3.5 w-3.5 text-emerald-200" />
                                {sentCount} sent
                            </Badge>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void fetchHistory()}
                            className="h-11 gap-2 rounded-2xl border-white/10 bg-[#0b1424] px-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[#122039] hover:text-white"
                        >
                            <RefreshCw className={cn('h-4 w-4 text-slate-500 dark:text-slate-300', loading && 'animate-spin')} />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-11 gap-2 rounded-2xl border-white/10 bg-[#0b1424] px-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[#122039] hover:text-white"
                            onClick={() => setExportModalOpen(true)}
                        >
                            <Download className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                            Export Excel
                        </Button>
                    </div>
                </div>
            </section>

            <ColumnExportDialog
                open={exportModalOpen}
                onOpenChange={setExportModalOpen}
                title="Export Invoice History"
                description="Choose columns to export."
                availableColumns={INVOICE_HISTORY_EXPORT_COLUMNS}
                onConfirm={handleExport}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.key} className={invoiceHistoryMetricCardClasses(card.tone)}>
                            <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent', invoiceHistoryMetricTopLineClasses(card.tone))} />
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                        {card.label}
                                    </div>
                                    <div className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-slate-900 dark:text-white" style={displayFontStyle}>
                                        {card.value}
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">{card.description}</p>
                                </div>
                                <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', invoiceHistoryMetricIconClasses(card.tone))}>
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-r from-[#2F8E92]/6 via-transparent to-blue-500/5" />
                <div className="relative p-4 md:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input
                                placeholder="Search by invoice ID, job ID, location, or technician..."
                                className="h-11 rounded-2xl border-white/10 bg-[#0b1424] pl-9 text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-visible:border-cyan-300/35 focus-visible:ring-cyan-300/15"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as InvoiceStatusFilter)}>
                                <SelectTrigger className="h-11 w-full rounded-2xl border-white/10 bg-[#0b1424] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:w-[170px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="sent">Sent</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="void">Void</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1424] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                {([
                                    ['today', 'Today'],
                                    ['week', 'This week'],
                                    ['month', 'This month'],
                                    ['year', 'This year'],
                                ] as const).map(([value, label]) => (
                                    <Button
                                        key={value}
                                        type="button"
                                        variant="ghost"
                                        className={cn(
                                            'h-9 rounded-xl px-3 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white',
                                            quickRange === value && 'bg-cyan-300/12 text-cyan-100',
                                        )}
                                        onClick={() => setQuickRange(quickRange === value ? 'none' : value)}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1424] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">From</span>
                                <Input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => {
                                        setQuickRange('none');
                                        setFromDate(e.target.value);
                                    }}
                                    className="h-8 w-[138px] border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"
                                />
                            </div>
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1424] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">To</span>
                                <Input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => {
                                        setQuickRange('none');
                                        setToDate(e.target.value);
                                    }}
                                    className="h-8 w-[138px] border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"
                                />
                            </div>
                            {(searchQuery || filterStatus !== 'all' || quickRange !== 'none' || fromDate || toDate) ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="h-11 rounded-2xl px-3 text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                                >
                                    <AlertTriangle className="mr-1 h-4 w-4" />
                                    Clear
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative flex min-h-[540px] flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,22,39,0.98),rgba(5,15,28,0.99))] shadow-[0_34px_110px_rgba(0,0,0,0.34)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,142,146,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.08),transparent_26%)]" />
                <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Invoice ledger</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Searchable invoice records with lifecycle status, dates, downloadable detail, and row-level admin actions.</div>
                    </div>
                    <Badge variant="outline" className="h-9 rounded-full border-cyan-300/18 bg-cyan-300/10 px-3 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        {filteredHistory.length} visible
                    </Badge>
                </div>
                {loading ? (
                    <div className="p-5 space-y-3">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-[20px] bg-white/[0.05]" />)}
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <Table className="min-w-[1120px]">
                            <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                                <TableRow className="border-white/0 hover:bg-transparent">
                                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Invoice ID</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Job ID</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Location</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Total Value</TableHead>
                                    <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Status</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Generated Date</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Sent Date</TableHead>
                                    <TableHead className="w-[90px] pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Open</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistory.length === 0 ? (
                                    <TableRow className="border-white/0 hover:bg-transparent">
                                        <TableCell colSpan={9} className="px-6 py-16">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                                    <FileText className="h-8 w-8 text-cyan-200/80" />
                                                </div>
                                                <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white" style={displayFontStyle}>
                                                    No invoices in this view
                                                </h3>
                                                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400" style={bodyFontStyle}>
                                                    Adjust the history filters or refresh the dataset to widen the visible invoice ledger.
                                                </p>
                                                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                                                    <Badge variant="outline" className="border-white/10 bg-white/[0.03] px-3 py-1 text-slate-300">PDF download</Badge>
                                                    <Badge variant="outline" className="border-white/10 bg-white/[0.03] px-3 py-1 text-slate-300">Send email</Badge>
                                                    <Badge variant="outline" className="border-white/10 bg-white/[0.03] px-3 py-1 text-slate-300">Mark paid</Badge>
                                                    <Badge variant="outline" className="border-white/10 bg-white/[0.03] px-3 py-1 text-slate-300">Void with reason</Badge>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="mt-6 h-11 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-slate-100 hover:bg-white/[0.08] hover:text-white"
                                                    onClick={clearFilters}
                                                >
                                                    Reset filters
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredHistory.map((inv, index) => {
                                    const displayStatus = resolveInvoiceDisplayStatus(inv);
                                    return (
                                        <TableRow
                                            key={inv.id}
                                            className={cn(
                                                'group cursor-pointer border-b border-white/6 transition-colors hover:bg-white/[0.045]',
                                                index % 2 === 1 && 'bg-white/[0.015]',
                                            )}
                                            onClick={() => handleViewInvoice(inv)}
                                        >
                                            <TableCell className="pl-6 py-4">
                                                <div className="text-base font-semibold tracking-[-0.03em] text-slate-900 transition-colors group-hover:text-slate-700 dark:text-white dark:group-hover:text-cyan-100" style={displayFontStyle}>
                                                    {inv.invoice_number}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="text-xs font-mono text-slate-300">{extractJobCodeFromInvoice(inv)}</div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-100">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <OverflowText text={resolveInvoiceLocation(inv, dealerships)} className="max-w-[14rem] text-sm font-medium text-slate-800 dark:text-slate-100" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-300/18 dark:bg-emerald-300/[0.08]">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-300/20 dark:text-emerald-100">
                                                        {resolveTechnician(inv).substring(0, 2)}
                                                    </div>
                                                    <span className="text-sm text-emerald-700 dark:text-emerald-50">{resolveTechnician(inv)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-right">
                                                <div className="text-lg font-semibold tracking-[-0.04em] text-amber-700 dark:text-amber-100" style={displayFontStyle}>
                                                    ${toNumber(inv.total).toFixed(2)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={cn('rounded-full px-3 py-1 text-[10px] backdrop-blur-sm', displayStatus.badgeClassName)}
                                                >
                                                    {displayStatus.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-4 text-sm text-slate-300">
                                                {formatDateTimeSafe(inv.created_at)}
                                            </TableCell>
                                            <TableCell className="py-4 text-sm text-slate-300">
                                                {formatDateTimeSafe(resolveInvoiceSentDate(inv))}
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 opacity-100 transition-all hover:bg-white/[0.08] hover:text-white"
                                                >
                                                    <ArrowUpRight className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent className="flex w-full flex-col overflow-hidden border-l border-white/10 bg-[linear-gradient(180deg,rgba(7,21,37,0.99),rgba(4,13,24,1))] p-0 text-white sm:max-w-2xl">
                    {selectedInvoice && (
                        (() => {
                            const displayStatus = resolveInvoiceDisplayStatus(selectedInvoice);
                            const customerEmail = resolveInvoiceCustomerEmail(selectedInvoice, dealerships);
                            const summaryTiles = [
                                { label: 'Job ID', value: extractJobCodeFromInvoice(selectedInvoice) },
                                { label: 'Location', value: resolveInvoiceLocation(selectedInvoice, dealerships) },
                                { label: 'Technician', value: resolveTechnician(selectedInvoice) },
                                { label: 'Customer email', value: customerEmail || 'No email on file' },
                                { label: 'Generated', value: formatDateTimeSafe(selectedInvoice.created_at) },
                                { label: 'Invoice total', value: `$${toNumber(selectedInvoice.total).toFixed(2)}` },
                            ];
                            return (
                        <>
                            <div className="relative overflow-hidden border-b border-white/10 px-6 py-6">
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/75 to-transparent" />
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.12),transparent_28%)]" />
                                <div className="relative space-y-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="space-y-3">
                                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                                                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                                                Invoice detail
                                            </div>
                                            <SheetHeader className="space-y-2 text-left">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] backdrop-blur-sm',
                                                            displayStatus.badgeClassName,
                                                        )}
                                                    >
                                                        {displayStatus.value === 'void' ? (
                                                            <AlertTriangle className="mr-1.5 h-3 w-3" />
                                                        ) : (
                                                            <CheckCircle2 className="mr-1.5 h-3 w-3" />
                                                        )}
                                                        {displayStatus.label}
                                                    </Badge>
                                                    <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                                        Source: Backend
                                                    </Badge>
                                                </div>
                                                <SheetTitle className="text-[2rem] font-semibold leading-none tracking-[-0.06em] text-white" style={displayFontStyle}>
                                                    {selectedInvoice.invoice_number}
                                                </SheetTitle>
                                                <SheetDescription className="max-w-xl text-sm leading-6 text-slate-300" style={bodyFontStyle}>
                                                    Full invoice record with line items, lifecycle timestamps, and admin actions for payment, resend, and void handling.
                                                </SheetDescription>
                                            </SheetHeader>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {summaryTiles.map((tile) => (
                                            <div key={tile.label} className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{tile.label}</div>
                                                <div className="mt-2 text-sm font-medium text-white md:text-[15px]">{tile.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <ScrollArea className="min-h-0 flex-1">
                                <div className="space-y-6 p-6">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Generated Date</div>
                                            <div className="mt-2 text-sm text-white">{formatDateTimeSafe(selectedInvoice.created_at, 'PPPP - HH:mm')}</div>
                                        </div>
                                        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Sent Date</div>
                                            <div className="mt-2 text-sm text-white">{formatDateTimeSafe(resolveInvoiceSentDate(selectedInvoice))}</div>
                                        </div>
                                        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Due Date / Terms</div>
                                            <div className="mt-2 text-sm text-white">{formatDateSafe(selectedInvoice.due_date)}</div>
                                            <div className="mt-1 text-xs text-slate-400">{formatTermsLabel(selectedInvoice.terms, selectedInvoice.custom_term_days)}</div>
                                        </div>
                                        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Payment / Void</div>
                                            <div className="mt-2 text-sm text-white">{formatDateTimeSafe(selectedInvoice.payment_recorded_at) || '-'}</div>
                                            <div className="mt-1 text-xs text-slate-400">Void: {formatDateTimeSafe(selectedInvoice.voided_at)}</div>
                                        </div>
                                    </div>

                                    <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Line items</div>
                                                <div className="mt-1 text-sm text-slate-300">Archived work logged to this invoice.</div>
                                            </div>
                                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                                                {selectedInvoice.line_items.length} item{selectedInvoice.line_items.length === 1 ? '' : 's'}
                                            </Badge>
                                        </div>
                                        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/10">
                                            <Table>
                                                <TableHeader className="bg-white/[0.04]">
                                                    <TableRow className="border-white/10 hover:bg-transparent">
                                                        <TableHead className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Service</TableHead>
                                                        <TableHead className="w-[84px] text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Qty</TableHead>
                                                        <TableHead className="w-[108px] text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Unit Price</TableHead>
                                                        <TableHead className="w-[108px] text-right text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedInvoice.line_items.map((item, index) => (
                                                        <TableRow key={item.id} className={cn('border-white/8 hover:bg-white/[0.03]', index % 2 === 1 && 'bg-white/[0.015]')}>
                                                            <TableCell className="py-4 text-sm text-white">
                                                                <div className="space-y-1">
                                                                    <OverflowText
                                                                        text={item.description || item.product_service}
                                                                        className="max-w-[18rem] font-medium"
                                                                    />
                                                                    {item.product_service && item.description && item.product_service !== item.description ? (
                                                                        <OverflowText
                                                                            text={item.product_service}
                                                                            className="max-w-[18rem] text-xs text-slate-500"
                                                                        />
                                                                    ) : null}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="py-4 text-center text-sm text-slate-300">{toNumber(item.qty ?? item.quantity).toFixed(2)}</TableCell>
                                                            <TableCell className="py-4 text-right text-sm text-slate-200">${toNumber(item.rate).toFixed(2)}</TableCell>
                                                            <TableCell className="py-4 text-right text-sm font-semibold text-amber-100">${toNumber(item.amount).toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-4 py-4">
                                                <span className="text-sm font-semibold text-slate-200">Invoice Total</span>
                                                <span className="text-xl font-semibold tracking-[-0.04em] text-cyan-200" style={displayFontStyle}>
                                                    ${toNumber(selectedInvoice.total).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Billing snapshot</div>
                                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div className="rounded-[20px] border border-white/10 bg-black/10 p-4">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Bill To</div>
                                                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                                                        {toAddressLines(selectedInvoice.bill_to || undefined).length > 0 ? (
                                                            toAddressLines(selectedInvoice.bill_to || undefined).map((line) => (
                                                                <div key={`bill-${line}`}>{line}</div>
                                                            ))
                                                        ) : (
                                                            <div>-</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-[20px] border border-white/10 bg-black/10 p-4">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Ship To</div>
                                                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                                                        {toAddressLines(selectedInvoice.ship_to || undefined).length > 0 ? (
                                                            toAddressLines(selectedInvoice.ship_to || undefined).map((line) => (
                                                                <div key={`ship-${line}`}>{line}</div>
                                                            ))
                                                        ) : (
                                                            <div>-</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Metadata & notes</div>
                                            <div className="mt-4 space-y-4">
                                                <div className="rounded-[20px] border border-cyan-300/16 bg-cyan-300/[0.06] p-4">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">Customer Message</div>
                                                    <p className="mt-2 text-sm leading-6 text-cyan-50/90">
                                                        {selectedInvoice.customer_message?.trim() || 'No customer message was attached to this invoice.'}
                                                    </p>
                                                </div>
                                                <div className="rounded-[20px] border border-white/10 bg-black/10 p-4">
                                                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Approval / Void Note</div>
                                                    <p className="mt-2 text-sm leading-6 text-slate-200">
                                                        {selectedInvoice.approval_note?.trim() || 'No approval or void note has been recorded.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="shrink-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(7,21,37,0.96),rgba(4,13,24,1))] p-4 shadow-[0_-18px_45px_rgba(0,0,0,0.32)]">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Button
                                        className="h-12 min-w-0 gap-2 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-3 text-sm text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                                        variant="outline"
                                        onClick={() => setActionPrompt('download')}
                                    >
                                        <Download className="h-4 w-4 shrink-0" />
                                        <span className="truncate">Download PDF</span>
                                    </Button>
                                    <Button
                                        className="h-12 min-w-0 gap-2 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-3 text-sm text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                                        variant="outline"
                                        onClick={() => setActionPrompt('send')}
                                        disabled={actionLoading === 'send' || !customerEmail}
                                    >
                                        <Send className="h-4 w-4 shrink-0" />
                                        <span className="truncate">{actionLoading === 'send' ? 'Sending Email' : 'Send Invoice Email'}</span>
                                    </Button>
                                    <Button
                                        className="h-12 min-w-0 gap-2 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-3 text-sm text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105"
                                        variant="outline"
                                        onClick={() => setActionPrompt('paid')}
                                        disabled={actionLoading === 'paid' || displayStatus.value === 'paid' || displayStatus.value === 'void'}
                                    >
                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                        <span className="truncate">{actionLoading === 'paid' ? 'Marking Paid' : 'Mark as Paid'}</span>
                                    </Button>
                                    <Button
                                        className="h-12 min-w-0 gap-2 rounded-2xl border border-rose-400/30 bg-[linear-gradient(180deg,rgba(61,18,28,0.92),rgba(36,12,20,0.98))] px-3 text-sm text-rose-100 shadow-[0_16px_34px_rgba(127,29,29,0.22)] hover:bg-[linear-gradient(180deg,rgba(76,23,35,0.94),rgba(48,15,26,0.99))] hover:text-white"
                                        variant="outline"
                                        onClick={() => setVoidDialogOpen(true)}
                                        disabled={actionLoading === 'void' || displayStatus.value === 'void'}
                                    >
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span className="truncate">Void Invoice</span>
                                    </Button>
                                </div>
                            </div>
                        </>
                            );
                        })()
                    )}
                </SheetContent>
            </Sheet>

            <Dialog open={actionPrompt !== null} onOpenChange={(open) => !open && setActionPrompt(null)}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle>{actionPromptCopy?.title}</DialogTitle>
                        <DialogDescription className="text-slate-300">
                            {actionPromptCopy?.description}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                            onClick={() => setActionPrompt(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105"
                            onClick={handleConfirmActionPrompt}
                            disabled={actionLoading === 'send' || actionLoading === 'paid'}
                        >
                            {actionPromptCopy?.confirm || 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Void invoice</DialogTitle>
                        <DialogDescription className="text-slate-300">
                            Enter the required reason for voiding this invoice. The note will be saved before the invoice is marked void.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        placeholder="Reason for voiding this invoice..."
                        className="min-h-[120px] rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                    />
                    <DialogFooter>
                        <Button variant="outline" className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white" onClick={() => setVoidDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="h-11 rounded-2xl border border-rose-400/30 bg-[linear-gradient(180deg,rgba(61,18,28,0.92),rgba(36,12,20,0.98))] px-5 text-rose-100 shadow-[0_16px_34px_rgba(127,29,29,0.22)] hover:bg-[linear-gradient(180deg,rgba(76,23,35,0.94),rgba(48,15,26,0.99))] hover:text-white" onClick={() => void handleVoidInvoice()} disabled={actionLoading === 'void'}>
                            Confirm Void
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={actionNotice !== null} onOpenChange={(open) => !open && setActionNotice(null)}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle>{actionNotice?.title}</DialogTitle>
                        <DialogDescription className="text-slate-300">
                            {actionNotice?.description}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105"
                            onClick={() => setActionNotice(null)}
                        >
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
