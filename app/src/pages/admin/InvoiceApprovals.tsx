import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
    Activity,
    CheckCircle2,
    Save,
    Plus,
    Trash2,
    Download,
    Filter,
    RefreshCw,
    Search,
    ShieldAlert,
    User,
    ChevronRight,
    DollarSign,
    AlertTriangle,
    Pencil,
    X,
    Sparkles,
    Clock3,
    MapPin,
    Calendar,
} from 'lucide-react';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ColumnExportDialog from '@/components/modals/ColumnExportDialog';
import OverflowText from '@/components/common/overflow-text';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    createInvoice,
    fetchPendingInvoiceApprovalDetail,
    fetchServicesCatalog,
    savePendingInvoiceApprovalDraft,
    fetchPendingInvoiceApprovalIssues,
    fetchPendingInvoiceApprovals,
    getStoredAdminToken,
    type BackendPendingInvoiceApprovalDetail,
    type BackendPendingInvoiceApprovalIssue,
    type BackendPendingInvoiceApproval,
} from '@/lib/backend-api';

const INVOICE_APPROVAL_EXPORT_COLUMNS = [
    'JobCode',
    'Location',
    'Technician',
    'Service',
    'SubmittedDate',
    'TimeInQueue',
    'EstimatedTotal',
    'InvoiceState',
    'BlockingReasons',
];

const displayFontStyle: CSSProperties = {
    fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};

const bodyFontStyle: CSSProperties = {
    fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};

type InvoiceMetricTone = 'amber' | 'cyan' | 'emerald' | 'violet';

function invoiceMetricCardClasses(tone: InvoiceMetricTone): string {
    return cn(
        'group relative overflow-hidden rounded-[26px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_24px_60px_rgba(0,0,0,0.28)]',
        tone === 'amber' && 'border-amber-200 bg-[linear-gradient(180deg,#ffffff,#fdf9f4)] hover:border-amber-300 dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(47,28,13,0.96),rgba(27,18,8,0.96))] dark:hover:border-amber-300/35',
        tone === 'cyan' && 'border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] hover:border-slate-300 dark:border-cyan-400/20 dark:bg-[linear-gradient(180deg,rgba(8,31,45,0.96),rgba(7,23,34,0.96))] dark:hover:border-cyan-300/35',
        tone === 'emerald' && 'border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f7fcfa)] hover:border-emerald-300 dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(12,34,28,0.96),rgba(8,22,18,0.96))] dark:hover:border-emerald-300/35',
        tone === 'violet' && 'border-violet-200 bg-[linear-gradient(180deg,#ffffff,#faf7fd)] hover:border-violet-300 dark:border-violet-400/20 dark:bg-[linear-gradient(180deg,rgba(28,20,49,0.96),rgba(19,17,34,0.96))] dark:hover:border-violet-300/35',
    );
}

function invoiceMetricTopLineClasses(tone: InvoiceMetricTone): string {
    if (tone === 'amber') return 'via-amber-400/55 dark:via-amber-300/80';
    if (tone === 'emerald') return 'via-emerald-400/55 dark:via-emerald-300/80';
    if (tone === 'violet') return 'via-violet-400/55 dark:via-violet-300/80';
    return 'via-slate-900/35 dark:via-cyan-300/80';
}

function invoiceMetricIconClasses(tone: InvoiceMetricTone): string {
    if (tone === 'amber') return 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/12 dark:text-amber-100';
    if (tone === 'emerald') return 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/12 dark:text-emerald-100';
    if (tone === 'violet') return 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/20 dark:bg-violet-300/12 dark:text-violet-100';
    return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-cyan-300/20 dark:bg-cyan-300/12 dark:text-cyan-100';
}

type PendingInvoice = BackendPendingInvoiceApproval;
type BlockedInvoice = BackendPendingInvoiceApprovalIssue;
type ApprovalDrawerInvoice = BackendPendingInvoiceApprovalDetail;
type EditableServiceLine = {
    id: string;
    name: string;
    quantity: number;
    price: number;
    tax_code: string;
    tax_rate: number;
};
type ServiceCatalogOption = {
    name: string;
    default_price: number;
};

type QueueTab = 'approval' | 'blocked';

const toNumber = (value: string | number | null | undefined): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const formatTaxCodeLabel = (taxCode: string, taxRate: number) => {
    const normalizedCode = taxCode.trim().toUpperCase();
    const percentage = `${(taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%`;
    if (normalizedCode === 'GST_QST') return `GST + QST (${percentage})`;
    if (normalizedCode === 'GST') return `GST (${percentage})`;
    if (normalizedCode === 'QST') return `QST (${percentage})`;
    if (normalizedCode === 'EXEMPT' || taxRate === 0) return 'Tax Exempt';
    if (normalizedCode === 'ZERO') return 'Zero Rated';
    if (normalizedCode === 'CUSTOM') return `Custom Tax (${percentage})`;
    return `${normalizedCode} (${percentage})`;
};

const getApprovalLocationLabel = (
    invoice: Pick<BackendPendingInvoiceApproval, 'bill_to' | 'ship_to' | 'dealership_name'>,
) => {
    const preferred = invoice.bill_to?.city || invoice.ship_to?.city || '';
    const trimmed = preferred.trim();
    return trimmed || invoice.dealership_name;
};

const getBlockedLocationLabel = (
    invoice: Pick<BackendPendingInvoiceApprovalIssue, 'dealership_name'>,
) => invoice.dealership_name;

const toLocalDateValue = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatQueueDuration = (value?: string | null) => {
    if (!value) return 'N/A';
    const started = new Date(value).getTime();
    if (Number.isNaN(started)) return 'N/A';
    const diffMs = Date.now() - started;
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};

function StatusBadge({ status }: { status: string }) {
    if (status === 'blocked') {
        return (
            <Badge variant="outline" className="rounded-full border-red-300/20 bg-red-300/12 text-red-100 backdrop-blur-sm">
                Blocked
            </Badge>
        );
    }
    if (status === 'creating') {
        return (
            <Badge variant="outline" className="animate-pulse rounded-full border-cyan-300/20 bg-cyan-300/12 text-cyan-100 backdrop-blur-sm">
                Generating...
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="rounded-full border-amber-300/20 bg-amber-300/12 text-amber-100 backdrop-blur-sm">
            Needs Approval
        </Badge>
    );
}

export default function InvoiceApprovalsPage() {
    const isMobile = useIsMobile();
    const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [blockedInvoices, setBlockedInvoices] = useState<BlockedInvoice[]>([]);
    const [queueTab, setQueueTab] = useState<QueueTab>('approval');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDealership, setFilterDealership] = useState<string>('all');
    const [filterTechnician, setFilterTechnician] = useState<string>('all');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<ApprovalDrawerInvoice | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [isEditingInvoice, setIsEditingInvoice] = useState(false);
    const [editableServices, setEditableServices] = useState<EditableServiceLine[]>([]);
    const [serviceSuggestions, setServiceSuggestions] = useState<string[]>([]);
    const [serviceCatalogOptions, setServiceCatalogOptions] = useState<ServiceCatalogOption[]>([]);

    const fetchInvoicesData = async () => {
        setLoading(true);
        try {
            const adminToken = getStoredAdminToken();
            if (!adminToken) {
                setInvoices([]);
                setBlockedInvoices([]);
                setServiceSuggestions([]);
                setServiceCatalogOptions([]);
                return;
            }
            const [rows, blockedRows, serviceRows] = await Promise.all([
                fetchPendingInvoiceApprovals(adminToken),
                fetchPendingInvoiceApprovalIssues(adminToken),
                fetchServicesCatalog(adminToken),
            ]);
            setInvoices(rows);
            setBlockedInvoices(blockedRows);
            const catalogOptions = serviceRows.map((service) => ({
                name: service.name.trim(),
                default_price: toNumber(service.default_price),
            })).filter((service) => service.name.length > 0);
            const nextSuggestions = Array.from(
                new Set(
                    catalogOptions
                        .map((service) => service.name.trim())
                        .filter((serviceName) => serviceName.length > 0),
                ),
            ).sort((a, b) => a.localeCompare(b));
            setServiceSuggestions(nextSuggestions);
            setServiceCatalogOptions(catalogOptions);
        } catch (error) {
            console.error(error);
            setInvoices([]);
            setBlockedInvoices([]);
            setServiceSuggestions([]);
            setServiceCatalogOptions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchInvoicesData();
    }, []);

    const dealershipOptions = useMemo(() => Array.from(
        new Set(
            [...invoices.map((invoice) => getApprovalLocationLabel(invoice)), ...blockedInvoices.map((invoice) => getBlockedLocationLabel(invoice))]
                .map((location) => location.trim())
                .filter((dealership) => dealership.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b)), [invoices]);

    const technicianOptions = useMemo(() => Array.from(
        new Set(
            [...invoices, ...blockedInvoices]
                .map((invoice) => (invoice.technician_name || '').trim())
                .filter((technician) => technician.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b)), [blockedInvoices, invoices]);

    const matchesCommonFilters = (
        query: string,
        location: string,
        technicianName: string,
        submittedAt?: string | null,
    ) => {
        const matchesLocation =
            filterDealership === 'all' ||
            location.toLowerCase() === filterDealership.toLowerCase();
        const matchesTechnician =
            filterTechnician === 'all' ||
            technicianName.toLowerCase() === filterTechnician.toLowerCase();
        const localDate = toLocalDateValue(submittedAt);
        const matchesFromDate = !filterFromDate || (localDate !== '' && localDate >= filterFromDate);
        const matchesToDate = !filterToDate || (localDate !== '' && localDate <= filterToDate);
        return matchesLocation && matchesTechnician && matchesFromDate && matchesToDate;
    };

    const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
        const query = searchQuery.toLowerCase().trim();
        const technicianName = invoice.technician_name || '';
        const locationLabel = getApprovalLocationLabel(invoice);
        const matchesSearch =
            query.length === 0 ||
            invoice.job_code.toLowerCase().includes(query) ||
            locationLabel.toLowerCase().includes(query) ||
            technicianName.toLowerCase().includes(query) ||
            invoice.service_summary.toLowerCase().includes(query);
        return matchesSearch && matchesCommonFilters(query, locationLabel, technicianName, invoice.completed_at);
    }), [filterDealership, filterFromDate, filterTechnician, filterToDate, invoices, searchQuery]);

    const filteredBlockedInvoices = useMemo(() => blockedInvoices.filter((invoice) => {
        const query = searchQuery.toLowerCase().trim();
        const technicianName = invoice.technician_name || '';
        const locationLabel = getBlockedLocationLabel(invoice);
        const matchesSearch =
            query.length === 0 ||
            invoice.job_code.toLowerCase().includes(query) ||
            locationLabel.toLowerCase().includes(query) ||
            technicianName.toLowerCase().includes(query);
        return matchesSearch && matchesCommonFilters(query, locationLabel, technicianName, invoice.completed_at);
    }), [blockedInvoices, filterDealership, filterFromDate, filterTechnician, filterToDate, searchQuery]);

    const visibleEstimatedTotal = useMemo(
        () => filteredInvoices.reduce((sum, invoice) => sum + toNumber(invoice.estimated_total), 0),
        [filteredInvoices],
    );

    const uniqueDealershipCount = useMemo(
        () => new Set(filteredInvoices.map((invoice) => invoice.dealership_name.trim()).filter(Boolean)).size,
        [filteredInvoices],
    );

    const clearFilters = () => {
        setSearchQuery('');
        setFilterDealership('all');
        setFilterTechnician('all');
        setFilterFromDate('');
        setFilterToDate('');
    };

    const serviceNameOptions = useMemo(() => {
        const combined = [...serviceSuggestions, ...editableServices.map((service) => service.name)];
        return Array.from(new Set(combined.map((name) => name.trim()).filter((name) => name.length > 0)))
            .sort((a, b) => a.localeCompare(b));
    }, [editableServices, serviceSuggestions]);

    const toEditableServices = (
        invoice: Pick<BackendPendingInvoiceApproval, 'services'>,
    ): EditableServiceLine[] => invoice.services.map((service) => ({
        id: service.id,
        name: service.name,
        quantity: toNumber(service.quantity),
        price: toNumber(service.price),
        tax_code: service.tax_code,
        tax_rate: toNumber(service.tax_rate),
    }));

    const handleOpenDrawer = async (invoice: PendingInvoice | BlockedInvoice) => {
        const adminToken = getStoredAdminToken();
        if (!adminToken) {
            alert('Admin session missing. Please login again.');
            return;
        }
        try {
            const detail = await fetchPendingInvoiceApprovalDetail(adminToken, invoice.job_id);
            setSelectedInvoice(detail);
            setEditableServices(toEditableServices(detail));
            setIsEditingInvoice(false);
            setDrawerOpen(true);
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to load invoice approval detail.';
            alert(detail);
        }
    };

    const totals = useMemo(() => {
        if (!selectedInvoice) {
            return { subtotal: 0, tax: 0, total: 0, taxBreakdown: [] as Array<{ key: string; label: string; amount: number }> };
        }
        const subtotal = editableServices.reduce(
            (acc, service) => acc + Math.max(0, service.quantity) * Math.max(0, service.price),
            0,
        );
        const taxBuckets = new Map<string, { label: string; amount: number }>();
        const tax = editableServices.reduce((acc, service) => {
            const lineSubtotal = Math.max(0, service.quantity) * Math.max(0, service.price);
            const lineTax = lineSubtotal * Math.max(0, service.tax_rate);
            const key = `${service.tax_code}:${service.tax_rate}`;
            const existing = taxBuckets.get(key);
            if (existing) {
                existing.amount += lineTax;
            } else {
                taxBuckets.set(key, {
                    label: formatTaxCodeLabel(service.tax_code, service.tax_rate),
                    amount: lineTax,
                });
            }
            return acc + lineTax;
        }, 0);
        const total = subtotal + tax;
        return {
            subtotal,
            tax,
            total,
            taxBreakdown: Array.from(taxBuckets.entries()).map(([key, value]) => ({
                key,
                label: value.label,
                amount: value.amount,
            })),
        };
    }, [editableServices, selectedInvoice]);

    const resetEditableServices = () => {
        if (!selectedInvoice) return;
        setEditableServices(toEditableServices(selectedInvoice));
    };

    const handleUpdateService = (serviceId: string, field: 'quantity' | 'price', rawValue: string) => {
        const parsedValue = Number(rawValue);
        const nextValue = Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
        setEditableServices((prev) => prev.map((service) => (
            service.id === serviceId ? { ...service, [field]: nextValue } : service
        )));
    };

    const resolveCatalogOption = (value: string): ServiceCatalogOption | null => {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return null;
        const exact = serviceCatalogOptions.find((service) => service.name.toLowerCase() === normalized);
        if (exact) return exact;
        const startsWith = serviceCatalogOptions.filter((service) => service.name.toLowerCase().startsWith(normalized));
        return startsWith.length === 1 ? startsWith[0] : null;
    };

    const handleUpdateServiceName = (serviceId: string, rawValue: string) => {
        setEditableServices((prev) => prev.map((service) => {
            if (service.id !== serviceId) return service;

            const resolved = resolveCatalogOption(rawValue);
            if (!resolved) {
                return { ...service, name: rawValue };
            }
            const shouldAutofillPrice = service.price <= 0 || service.id.startsWith('manual-');
            return {
                ...service,
                name: resolved.name,
                price: shouldAutofillPrice ? resolved.default_price : service.price,
            };
        }));
    };

    const handleAddService = () => {
        const nextLine: EditableServiceLine = {
            id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: 'New Service',
            quantity: 1,
            price: 0,
            tax_code: editableServices[0]?.tax_code || selectedInvoice?.services[0]?.tax_code || 'EXEMPT',
            tax_rate: toNumber(editableServices[0]?.tax_rate ?? selectedInvoice?.services[0]?.tax_rate ?? 0),
        };
        setEditableServices((prev) => [...prev, nextLine]);
    };

    const handleDeleteService = (serviceId: string) => {
        setEditableServices((prev) => prev.filter((service) => service.id !== serviceId));
    };

    const handleSaveDraftEdits = () => {
        const run = async () => {
            if (!selectedInvoice) return;
            const adminToken = getStoredAdminToken();
            if (!adminToken) {
                alert('Admin session missing. Please login again.');
                return;
            }
            if (editableServices.length === 0) {
                alert('Invoice must include at least one service line.');
                return;
            }
            const hasMissingNames = editableServices.some((service) => service.name.trim().length === 0);
            if (hasMissingNames) {
                alert('All service lines must have a service name.');
                return;
            }
            const hasInvalidLines = editableServices.some((service) => service.quantity <= 0 || service.price <= 0);
            if (hasInvalidLines) {
                alert('All service quantities and prices must be greater than 0.');
                return;
            }

            setIsSavingDraft(true);
            try {
                await savePendingInvoiceApprovalDraft(adminToken, selectedInvoice.job_id, {
                    line_items: editableServices.map((service) => ({
                        product_service: service.name,
                        quantity: service.quantity,
                        qty: service.quantity,
                        rate: service.price,
                        tax_code: service.tax_code,
                        tax_rate: service.tax_rate,
                    })),
                });
                const detail = await fetchPendingInvoiceApprovalDetail(adminToken, selectedInvoice.job_id);
                setSelectedInvoice(detail);
                setEditableServices(toEditableServices(detail));
                await fetchInvoicesData();
                setIsEditingInvoice(false);
            } catch (error) {
                const detail = error instanceof Error ? error.message : 'Unable to save invoice draft.';
                alert(`Save failed: ${detail}`);
            } finally {
                setIsSavingDraft(false);
            }
        };
        void run();
    };

    const handleApprove = async () => {
        if (!selectedInvoice) return;
        const adminToken = getStoredAdminToken();
        if (!adminToken) {
            alert('Admin session missing. Please login again.');
            return;
        }
        if (editableServices.length === 0) {
            alert('Invoice must include at least one service line.');
            return;
        }
        const hasMissingNames = editableServices.some((service) => service.name.trim().length === 0);
        if (hasMissingNames) {
            alert('All service lines must have a service name.');
            return;
        }
        const hasInvalidLines = editableServices.some((service) => service.quantity <= 0 || service.price <= 0);
        if (hasInvalidLines) {
            alert('All service quantities and prices must be greater than 0.');
            return;
        }
        setIsApproving(true);
        setConfirmDialogOpen(false);
        try {
            await createInvoice(adminToken, {
                dispatch_job_ids: [selectedInvoice.job_id],
                replace_dispatch_line_items: true,
                line_items: editableServices.map((service) => ({
                    product_service: service.name,
                    quantity: service.quantity,
                    qty: service.quantity,
                    rate: service.price,
                    tax_code: service.tax_code,
                    tax_rate: service.tax_rate,
                })),
                status: 'sent',
                terms: 'NET_15',
                shipping: 0,
            });

            setInvoices((prev) => prev.filter((inv) => inv.job_id !== selectedInvoice.job_id));
            setBlockedInvoices((prev) => prev.filter((inv) => inv.job_id !== selectedInvoice.job_id));
            setDrawerOpen(false);
            setSelectedInvoice(null);
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to approve invoice.';
            alert(`Invoice approval failed: ${detail}`);
        } finally {
            setIsApproving(false);
        }
    };

    const getInvoiceApprovalExportRows = () => (
        queueTab === 'approval'
            ? filteredInvoices.map((invoice) => ({
                JobCode: invoice.job_code,
                Location: getApprovalLocationLabel(invoice),
                Technician: invoice.technician_name || '',
                Service: invoice.service_summary,
                SubmittedDate: invoice.completed_at ? new Date(invoice.completed_at).toLocaleString() : '',
                TimeInQueue: formatQueueDuration(invoice.completed_at),
                EstimatedTotal: toNumber(invoice.estimated_total),
                InvoiceState: invoice.invoice_state,
                BlockingReasons: '',
            }))
            : filteredBlockedInvoices.map((invoice) => ({
                JobCode: invoice.job_code,
                Location: getBlockedLocationLabel(invoice),
                Technician: invoice.technician_name || '',
                Service: invoice.service_summary,
                SubmittedDate: invoice.completed_at ? new Date(invoice.completed_at).toLocaleString() : '',
                TimeInQueue: formatQueueDuration(invoice.completed_at),
                EstimatedTotal: 0,
                InvoiceState: 'blocked',
                BlockingReasons: invoice.blocking_reasons.join(' | '),
            }))
    );

    const handleExport = (selectedColumns: string[], format: ExportFormat = 'csv') => {
        const exportData = selectColumnsForExport(getInvoiceApprovalExportRows(), selectedColumns);
        exportArrayData(exportData, queueTab === 'approval' ? 'invoice_approval_queue_export' : 'invoice_blocked_queue_export', format);
    };

    const activeQueueCount = queueTab === 'approval' ? filteredInvoices.length : filteredBlockedInvoices.length;

    const summaryCards = [
        {
            key: 'pending',
            label: 'Pending approval',
            value: filteredInvoices.length.toString(),
            description: 'Invoices ready for admin review and invoice creation.',
            icon: CheckCircle2,
            tone: 'cyan' as const,
        },
        {
            key: 'value',
            label: 'Queue value',
            value: `$${visibleEstimatedTotal.toFixed(2)}`,
            description: 'Estimated amount across the current approval queue.',
            icon: DollarSign,
            tone: 'amber' as const,
        },
        {
            key: 'blocked',
            label: 'Blocked jobs',
            value: blockedInvoices.length.toString(),
            description: 'Completed jobs held back until missing invoice data is fixed.',
            icon: AlertTriangle,
            tone: 'violet' as const,
        },
        {
            key: 'dealerships',
            label: 'Active dealers',
            value: uniqueDealershipCount.toString(),
            description: 'Distinct partner stores represented in this view.',
            icon: User,
            tone: 'emerald' as const,
        },
    ];

    return (
        <div className="flex h-full flex-col gap-6">
            <section className="relative overflow-hidden rounded-[32px] border border-black/8 bg-[linear-gradient(135deg,#ffffff,#fbfbfb)] px-6 py-6 shadow-[0_32px_110px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(7,24,41,0.98),rgba(5,15,29,0.98))] dark:shadow-[0_32px_110px_rgba(0,0,0,0.32)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/20 to-transparent dark:via-cyan-300/70" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.05),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.03),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
                <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0b1424] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                            Approval Control
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-slate-900 dark:text-white md:text-[2.8rem]" style={displayFontStyle}>
                                Invoice approvals
                                <br />
                                at review depth.
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-[15px]" style={bodyFontStyle}>
                                Review pricing, catch blockers, and move completed jobs into invoice generation from one premium approval surface.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="h-9 rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 text-cyan-100">
                                <Activity className="mr-1.5 h-3.5 w-3.5" />
                                {filteredInvoices.length} ready for approval
                            </Badge>
                            <Badge variant="outline" className="h-9 rounded-full border-amber-300/20 bg-amber-300/10 px-3 text-amber-100">
                                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                                {blockedInvoices.length} blocked
                            </Badge>
                            <Badge variant="outline" className="h-9 rounded-full border-emerald-300/20 bg-emerald-300/10 px-3 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                <DollarSign className="mr-1.5 h-3.5 w-3.5 text-emerald-200" />
                                ${visibleEstimatedTotal.toFixed(2)} queue value
                            </Badge>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        <div className="rounded-full border border-white/10 bg-[#0b1424] px-4 py-2 text-xs font-medium text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            Last updated: {new Date().toLocaleTimeString()}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-11 gap-2 rounded-2xl border-white/10 bg-[#0b1424] px-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-[#122039] hover:text-white"
                            onClick={() => void fetchInvoicesData()}
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
                            Export CSV / Excel
                        </Button>
                    </div>
                </div>
            </section>

            <ColumnExportDialog
                open={exportModalOpen}
                onOpenChange={setExportModalOpen}
                title={queueTab === 'approval' ? 'Export Approval Queue' : 'Export Blocked Queue'}
                description="Select the invoice approval columns you want in your export."
                availableColumns={INVOICE_APPROVAL_EXPORT_COLUMNS}
                onConfirm={handleExport}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.key} className={invoiceMetricCardClasses(card.tone)}>
                            <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent', invoiceMetricTopLineClasses(card.tone))} />
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
                                <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', invoiceMetricIconClasses(card.tone))}>
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,23,38,0.98),rgba(7,18,31,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-r from-[#2F8E92]/6 via-transparent to-amber-500/5" />
                <div className="relative p-4 md:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                                placeholder="Search by job ID, location, technician name, or service..."
                                className="h-11 rounded-2xl border-white/10 bg-[#0b1424] pl-9 text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-visible:border-cyan-300/35 focus-visible:ring-cyan-300/15"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={filterDealership} onValueChange={setFilterDealership}>
                                <SelectTrigger className="h-11 w-full rounded-2xl border-white/10 bg-[#0b1424] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:w-[180px]">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-slate-400" />
                                        <SelectValue placeholder="Dealership" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All locations</SelectItem>
                                    {dealershipOptions.map((location) => (
                                        <SelectItem key={location} value={location}>
                                            {location}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={filterTechnician} onValueChange={setFilterTechnician}>
                                <SelectTrigger className="h-11 w-full rounded-2xl border-white/10 bg-[#0b1424] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:w-[170px]">
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-slate-400" />
                                        <SelectValue placeholder="Technician" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All technicians</SelectItem>
                                    {technicianOptions.map((technician) => (
                                        <SelectItem key={technician} value={technician}>
                                            {technician}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b1424] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-2 py-1">
                                        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">From</span>
                                        <Input
                                            type="date"
                                            value={filterFromDate}
                                            onChange={(event) => setFilterFromDate(event.target.value)}
                                            className="h-7 w-[132px] border-0 bg-transparent p-0 text-sm text-white shadow-none focus-visible:ring-0"
                                            aria-label="Filter approvals from date"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-2 py-1">
                                        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">To</span>
                                        <Input
                                            type="date"
                                            value={filterToDate}
                                            onChange={(event) => setFilterToDate(event.target.value)}
                                            className="h-7 w-[132px] border-0 bg-transparent p-0 text-sm text-white shadow-none focus-visible:ring-0"
                                            aria-label="Filter approvals to date"
                                        />
                                    </div>
                                </div>
                            </div>
                            <Badge variant="outline" className="h-11 rounded-2xl border-amber-300/20 bg-amber-300/10 px-4 text-amber-100">
                                {queueTab === 'approval' ? `Approval queue (${filteredInvoices.length})` : `Blocked queue (${filteredBlockedInvoices.length})`}
                            </Badge>
                            {(searchQuery || filterDealership !== 'all' || filterTechnician !== 'all' || filterFromDate || filterToDate) ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="h-11 rounded-2xl px-3 text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                                >
                                    <X className="mr-1 h-4 w-4" />
                                    Clear
                                </Button>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant={queueTab === 'approval' ? 'secondary' : 'outline'}
                            className={cn(
                                'h-10 rounded-2xl px-4',
                                queueTab === 'approval' ? 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-[#0b1424] text-slate-200 hover:bg-[#122039]',
                            )}
                            onClick={() => setQueueTab('approval')}
                        >
                            Approval Queue
                            <Badge variant="outline" className="ml-2 h-6 rounded-full border-current/15 bg-white/10 px-2 text-[10px] text-current">
                                {filteredInvoices.length}
                            </Badge>
                        </Button>
                        <Button
                            type="button"
                            variant={queueTab === 'blocked' ? 'secondary' : 'outline'}
                            className={cn(
                                'h-10 rounded-2xl px-4',
                                queueTab === 'blocked' ? 'border-red-300/25 bg-red-500/10 text-red-100' : 'border-white/10 bg-[#0b1424] text-slate-200 hover:bg-[#122039]',
                            )}
                            onClick={() => setQueueTab('blocked')}
                        >
                            Blocked Queue
                            <Badge variant="outline" className="ml-2 h-6 rounded-full border-current/15 bg-white/10 px-2 text-[10px] text-current">
                                {filteredBlockedInvoices.length}
                            </Badge>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="relative flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,22,39,0.98),rgba(5,15,28,0.99))] shadow-[0_34px_110px_rgba(0,0,0,0.34)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(47,142,146,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.08),transparent_26%)]" />
                <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                            {queueTab === 'approval' ? 'Approval Queue' : 'Blocked Queue'}
                        </div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {queueTab === 'approval'
                                ? 'Completed jobs currently staged for invoice creation.'
                                : 'Invoices with validation issues that must be fixed before approval.'}
                        </div>
                    </div>
                    <Badge variant="outline" className="h-9 rounded-full border-cyan-300/18 bg-cyan-300/10 px-3 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        {activeQueueCount} visible
                    </Badge>
                </div>
                {loading ? (
                    <div className="p-5 space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full rounded-[20px] bg-white/[0.05]" />
                        ))}
                    </div>
                ) : queueTab === 'approval' && filteredInvoices.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <CheckCircle2 className="h-8 w-8 text-cyan-200/80" />
                        </div>
                        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white" style={displayFontStyle}>
                            No approvals in this view
                        </h3>
                        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400" style={bodyFontStyle}>
                            {filteredBlockedInvoices.length > 0
                                ? 'Completed jobs exist, but they are blocked from invoice approval until required data is fixed.'
                                : 'Adjust your filters or refresh the queue to widen the current approval scope.'}
                        </p>
                        <Button
                            variant="outline"
                            className="mt-6 h-11 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-slate-100 hover:bg-white/[0.08] hover:text-white"
                            onClick={clearFilters}
                        >
                            Reset filters
                        </Button>
                    </div>
                ) : queueTab === 'blocked' && filteredBlockedInvoices.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <ShieldAlert className="h-8 w-8 text-red-200/80" />
                        </div>
                        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white" style={displayFontStyle}>
                            No blocked invoices in this view
                        </h3>
                        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400" style={bodyFontStyle}>
                            The blocked queue is clear for the current filters.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-6 h-11 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-slate-100 hover:bg-white/[0.08] hover:text-white"
                            onClick={clearFilters}
                        >
                            Reset filters
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <Table className={cn('min-w-[1120px]', queueTab === 'blocked' && 'min-w-[1240px]')}>
                            <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                                <TableRow className="border-white/0 hover:bg-transparent">
                                    <TableHead className="w-[170px] pl-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Job ID</TableHead>
                                    <TableHead className="w-[190px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Location</TableHead>
                                    <TableHead className="w-[190px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Technician</TableHead>
                                    <TableHead className="w-[240px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Service Type</TableHead>
                                    <TableHead className="w-[150px] text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Total Value</TableHead>
                                    <TableHead className="w-[170px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Submitted Date</TableHead>
                                    <TableHead className="w-[130px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Time in Queue</TableHead>
                                    {queueTab === 'blocked' ? (
                                        <TableHead className="w-[280px] text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Blocking Reasons</TableHead>
                                    ) : null}
                                    <TableHead className="w-[150px] text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Status</TableHead>
                                    <TableHead className="w-[110px] pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(queueTab === 'approval' ? filteredInvoices : filteredBlockedInvoices).map((inv, index) => (
                                    <TableRow
                                        key={inv.job_id}
                                        className={cn(
                                            'group cursor-pointer border-b border-white/6 transition-colors hover:bg-white/[0.045]',
                                            index % 2 === 1 && 'bg-white/[0.015]',
                                        )}
                                        onClick={() => void handleOpenDrawer(inv)}
                                    >
                                        <TableCell className="pl-6 py-4">
                                            <div className="space-y-1.5">
                                                <div className="text-base font-semibold tracking-[-0.03em] text-slate-900 transition-colors group-hover:text-slate-700 dark:text-white dark:group-hover:text-cyan-100" style={displayFontStyle}>
                                                    {inv.job_code}
                                                </div>
                                                <div className="text-xs text-slate-500">{inv.job_id}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="space-y-1">
                                                <OverflowText text={queueTab === 'approval' ? getApprovalLocationLabel(inv as PendingInvoice) : getBlockedLocationLabel(inv as BlockedInvoice)} className="max-w-[14rem] text-sm font-medium text-slate-800 dark:text-slate-100" />
                                                <div className="text-xs text-slate-500">{inv.dealership_name}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-300/18 dark:bg-emerald-300/[0.08]">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-300/20 dark:text-emerald-100">
                                                    {inv.technician_name?.substring(0, 2) || 'NA'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-emerald-700 dark:text-emerald-50">{inv.technician_name || 'Unassigned'}</div>
                                                    <div className="text-[11px] text-emerald-600/80 dark:text-emerald-200/70">Submitting technician</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <OverflowText text={inv.service_summary} className="max-w-[240px] text-sm text-slate-600 dark:text-slate-300" />
                                        </TableCell>
                                        <TableCell className="py-4 text-right">
                                            <div className="text-lg font-semibold tracking-[-0.04em] text-amber-700 dark:text-amber-100" style={displayFontStyle}>
                                                ${queueTab === 'approval' ? toNumber((inv as PendingInvoice).estimated_total).toFixed(2) : '0.00'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-slate-700 dark:text-slate-100">
                                                    {inv.completed_at ? new Date(inv.completed_at).toLocaleDateString() : '-'}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {inv.completed_at ? new Date(inv.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'No timestamp'}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300">
                                                <Clock3 className="h-3.5 w-3.5 text-cyan-200" />
                                                {formatQueueDuration(inv.completed_at)}
                                            </div>
                                        </TableCell>
                                        {queueTab === 'blocked' ? (
                                            <TableCell className="py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {(inv as BlockedInvoice).blocking_reasons.map((reason) => (
                                                        <Badge key={`${inv.job_id}-${reason}`} variant="outline" className="rounded-full border-red-300/20 bg-red-300/10 text-red-100">
                                                            {reason}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                        ) : null}
                                        <TableCell className="py-4 text-center">
                                            <StatusBadge status={queueTab === 'approval' ? (inv as PendingInvoice).invoice_state : 'blocked'} />
                                        </TableCell>
                                        <TableCell className="py-4 pr-6 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] p-0 text-slate-300 hover:bg-white/[0.08] hover:text-white"
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {false && blockedInvoices.length > 0 && (
                <section className="relative overflow-hidden rounded-[32px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(48,28,14,0.94),rgba(24,16,11,0.98))] px-5 py-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/12 text-amber-100">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold tracking-[-0.03em] text-white" style={displayFontStyle}>
                                    Blocked invoice jobs
                                </h2>
                                <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-100/75" style={bodyFontStyle}>
                                    These completed jobs are not visible in the approval queue because required invoice data is missing.
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className="h-9 rounded-full border-amber-300/20 bg-amber-300/10 px-3 text-amber-100">
                            {blockedInvoices.length} blocked item{blockedInvoices.length === 1 ? '' : 's'}
                        </Badge>
                    </div>
                    <div className="mt-5 grid gap-3">
                        {blockedInvoices.map((invoice) => (
                            <div key={invoice.job_id} className="rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-base font-semibold tracking-[-0.03em] text-white" style={displayFontStyle}>
                                                {invoice.job_code}
                                            </span>
                                            <Badge variant="outline" className="rounded-full border-amber-300/20 bg-amber-300/10 text-amber-100">
                                                Blocked
                                            </Badge>
                                        </div>
                                        <OverflowText text={`${invoice.dealership_name}${invoice.technician_name ? ` • ${invoice.technician_name}` : ''}`} as="p" className="max-w-[32rem] text-sm text-amber-50/85" />
                                        <OverflowText text={invoice.service_summary} as="p" className="max-w-[32rem] text-sm text-amber-100/70" />
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {invoice.blocking_reasons.map((reason) => (
                                        <Badge key={`${invoice.job_id}-${reason}`} variant="outline" className="rounded-full border-red-300/20 bg-red-300/10 text-red-100">
                                            {reason}
                                        </Badge>
                                    ))}
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 gap-2 rounded-2xl border-amber-300/20 bg-amber-300/10 px-4 text-amber-50 hover:bg-amber-300/16"
                                        onClick={() => void handleOpenDrawer(invoice)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Review & Edit
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-l border-border/60 bg-[#07101f] p-0 text-foreground shadow-2xl sm:max-w-xl">
                    {selectedInvoice && (
                        <>
                            <div className="border-b border-border/60 bg-slate-950/80 p-6 backdrop-blur">
                                <SheetHeader>
                                    <div className="flex items-center justify-between mb-2">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'border-amber-500/30 bg-amber-500/10 text-amber-300',
                                                selectedInvoice.blocking_reasons.length > 0 && 'border-red-500/30 bg-red-500/10 text-red-200',
                                            )}
                                        >
                                            {selectedInvoice.blocking_reasons.length > 0 ? 'Blocked Approval' : 'Pending Approval'}
                                        </Badge>
                                        <span className="text-xs font-mono text-muted-foreground">ID: {selectedInvoice.job_id}</span>
                                    </div>
                                    <SheetTitle className="text-xl font-bold text-foreground">Invoice Preview - {selectedInvoice.job_code}</SheetTitle>
                                    <SheetDescription className="text-sm text-muted-foreground">
                                        {selectedInvoice.blocking_reasons.length > 0
                                            ? 'Review blockers, fix service lines, and recheck invoice readiness.'
                                            : 'Review and approve services for invoice generation.'}
                                    </SheetDescription>
                                </SheetHeader>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-6 space-y-8">
                                    {selectedInvoice.blocking_reasons.length > 0 && (
                                        <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-300" />
                                                <div className="space-y-3">
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-red-100">Approval blockers</h3>
                                                        <p className="text-sm text-red-200/80">
                                                            This job cannot be approved until the blocking issues below are resolved.
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedInvoice.blocking_reasons.map((reason) => (
                                                            <Badge
                                                                key={`${selectedInvoice.job_id}-${reason}`}
                                                                variant="outline"
                                                                className="border-red-500/30 bg-red-500/10 text-red-200"
                                                            >
                                                                {reason}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    )}
                                    <section className="grid grid-cols-2 gap-4 rounded-xl border border-cyan-500/15 bg-slate-900/80 p-4 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]">
                                        <div>
                                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Location</h4>
                                            <div className="font-medium text-slate-100">{getApprovalLocationLabel(selectedInvoice)}</div>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Dealership</h4>
                                            <OverflowText text={selectedInvoice.dealership_name} className="max-w-[15rem] font-medium text-slate-100" />
                                        </div>
                                        <div>
                                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Service</h4>
                                            <OverflowText text={selectedInvoice.service_summary} className="max-w-[15rem] font-medium text-slate-100" />
                                        </div>
                                        <div>
                                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Vehicle</h4>
                                            <div className="font-medium text-slate-100">{selectedInvoice.vehicle_summary}</div>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Technician</h4>
                                            <div className="font-medium text-slate-100">{selectedInvoice.technician_name || 'Unassigned'}</div>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Completion Timestamp</h4>
                                            <div className="font-medium text-slate-100">
                                                {selectedInvoice.completed_at ? new Date(selectedInvoice.completed_at).toLocaleString() : '-'}
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                                                <DollarSign className="h-4 w-4 text-cyan-300" /> Billable Items
                                            </h3>
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                {totals.taxBreakdown.length > 0 ? (
                                                    totals.taxBreakdown.map((taxLine) => (
                                                        <Badge
                                                            key={taxLine.key}
                                                            variant="outline"
                                                            className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                                                        >
                                                            {taxLine.label}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge variant="outline" className="border-slate-500/40 bg-slate-500/10 text-slate-300">
                                                        Tax Exempt
                                                    </Badge>
                                                )}
                                                {!isEditingInvoice ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 gap-2 border-cyan-500/40 bg-transparent text-cyan-200 hover:bg-cyan-500/10"
                                                        onClick={() => setIsEditingInvoice(true)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Edit
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 gap-2 border-border/60 bg-transparent text-slate-200 hover:bg-slate-900"
                                                            onClick={() => {
                                                                resetEditableServices();
                                                                setIsEditingInvoice(false);
                                                            }}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                            Cancel Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-8 gap-2 bg-[#2F8E92] text-white hover:bg-[#267276]"
                                                            onClick={handleSaveDraftEdits}
                                                            disabled={isSavingDraft}
                                                        >
                                                            <Save className="h-3.5 w-3.5" />
                                                            {isSavingDraft ? 'Saving...' : 'Save'}
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-border/60 bg-slate-950/70">
                                            {isEditingInvoice && isMobile ? (
                                                <div className="space-y-3 p-3">
                                                    {editableServices.map((item) => (
                                                        <div key={item.id} className="rounded-lg border border-border/60 bg-slate-900/70 p-3">
                                                            <div className="mb-2">
                                                                <Label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Service</Label>
                                                                <Input
                                                                    className="h-8 border-border/60 bg-slate-900 text-slate-100"
                                                                    value={item.name}
                                                                    list="invoice-service-suggestions"
                                                                    onChange={(e) => handleUpdateServiceName(item.id, e.target.value)}
                                                                    placeholder="Service name"
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <Label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Qty</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        className="h-8 border-border/60 bg-slate-900 text-right text-slate-100"
                                                                        value={item.quantity}
                                                                        onChange={(e) => handleUpdateService(item.id, 'quantity', e.target.value)}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Price</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        className="h-8 border-border/60 bg-slate-900 text-right text-slate-100"
                                                                        value={item.price}
                                                                        onChange={(e) => handleUpdateService(item.id, 'price', e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex items-center justify-between">
                                                                <span className="text-xs uppercase tracking-wide text-slate-400">Line Total</span>
                                                                <span className="font-mono text-sm text-cyan-200">${(item.quantity * item.price).toFixed(2)}</span>
                                                            </div>
                                                            <div className="mt-2 flex justify-end">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 gap-1 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                                                                    onClick={() => handleDeleteService(item.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <Table className="table-fixed">
                                                    <TableHeader className="bg-slate-900/90">
                                                        <TableRow>
                                                            <TableHead className={cn('h-10 text-xs font-semibold text-slate-300', isEditingInvoice ? 'w-[28%]' : 'w-[48%]')}>
                                                                Service
                                                            </TableHead>
                                                            <TableHead className="h-10 w-[14%] text-center text-xs font-semibold text-slate-300">Qty</TableHead>
                                                            <TableHead className="h-10 w-[14%] text-right text-xs font-semibold text-slate-300">Price</TableHead>
                                                            <TableHead className="h-10 w-[14%] text-right text-xs font-semibold text-slate-300">Total</TableHead>
                                                            {isEditingInvoice && <TableHead className="h-10 w-[6%] text-right text-xs font-semibold text-slate-300">Del</TableHead>}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {editableServices.map((item) => (
                                                            <TableRow key={item.id} className="border-border/50">
                                                                <TableCell className="align-middle py-3 text-sm text-slate-100">
                                                                    {isEditingInvoice ? (
                                                                        <Input
                                                                            className="h-8 border-border/60 bg-slate-900 text-slate-100"
                                                                            value={item.name}
                                                                            list="invoice-service-suggestions"
                                                                            onChange={(e) => handleUpdateServiceName(item.id, e.target.value)}
                                                                            placeholder="Service name"
                                                                        />
                                                                    ) : (
                                                                        <div className="space-y-1">
                                                                            <OverflowText text={item.name} className="max-w-[16rem]" />
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="align-middle py-3 text-center text-sm text-slate-200">
                                                                    {isEditingInvoice ? (
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            className="ml-auto h-8 w-[88px] border-border/60 bg-slate-900 text-right text-slate-100"
                                                                            value={item.quantity}
                                                                            onChange={(e) => handleUpdateService(item.id, 'quantity', e.target.value)}
                                                                        />
                                                                    ) : (
                                                                        item.quantity.toFixed(2)
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="align-middle py-3 text-right text-sm text-slate-100">
                                                                    {isEditingInvoice ? (
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            className="ml-auto h-8 w-[96px] border-border/60 bg-slate-900 text-right text-slate-100"
                                                                            value={item.price}
                                                                            onChange={(e) => handleUpdateService(item.id, 'price', e.target.value)}
                                                                        />
                                                                    ) : (
                                                                        `$${item.price.toFixed(2)}`
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="align-middle py-3 text-right font-mono text-sm text-cyan-200">
                                                                    ${(item.quantity * item.price).toFixed(2)}
                                                                </TableCell>
                                                                {isEditingInvoice && (
                                                                    <TableCell className="align-middle py-3 text-right">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                                                                            onClick={() => handleDeleteService(item.id)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </TableCell>
                                                                )}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                            {isEditingInvoice && (
                                                <div className="border-t border-border/60 bg-slate-900/80 px-4 py-3">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 gap-2 border-cyan-500/40 bg-transparent text-cyan-200 hover:bg-cyan-500/10"
                                                        onClick={handleAddService}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        Add Service
                                                    </Button>
                                                </div>
                                            )}
                                            <datalist id="invoice-service-suggestions">
                                                {serviceNameOptions.map((name) => (
                                                    <option key={name} value={name} />
                                                ))}
                                            </datalist>
                                            <div className="space-y-2 border-t border-border/60 bg-slate-900/90 p-4">
                                                <div className="flex justify-between text-sm text-slate-300">
                                                    <span>Subtotal</span>
                                                    <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
                                                </div>
                                                {totals.taxBreakdown.map((taxLine) => (
                                                    <div key={taxLine.key} className="flex justify-between text-sm text-slate-300">
                                                        <span>{taxLine.label}</span>
                                                        <span className="font-mono">${taxLine.amount.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between text-sm text-slate-300">
                                                    <span>Total Tax</span>
                                                    <span className="font-mono">${totals.tax.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-border/60 pt-2 text-lg font-bold text-slate-50">
                                                    <span>Total</span>
                                                    <span className="font-mono text-cyan-200">${totals.total.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                </div>
                            </ScrollArea>

                            <div className="sticky bottom-0 z-20 border-t border-border/60 bg-slate-950/95 p-6 backdrop-blur">
                                <div className="flex gap-3">
                                    <Button variant="outline" className="flex-1 border-border/70 bg-transparent text-slate-200 hover:bg-slate-900 hover:text-white" onClick={() => setDrawerOpen(false)}>Cancel</Button>
                                        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                                            <DialogTrigger asChild>
                                            <Button
                                                className="flex-[2] bg-[#2F8E92] hover:bg-[#267276] text-white shadow-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                                disabled={selectedInvoice.blocking_reasons.length > 0}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Approve & Generate
                                            </Button>
                                            </DialogTrigger>
                                        <DialogContent className="border-border/60 bg-slate-950 text-foreground">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2 text-foreground">
                                                    <ShieldAlert className="h-5 w-5 text-amber-300" /> Confirm Invoice Generation
                                                </DialogTitle>
                                                <DialogDescription className="pt-2 text-muted-foreground">
                                                    This will immediately create an invoice for <strong>{selectedInvoice.job_code}</strong> with a total of <strong>${totals.total.toFixed(2)}</strong>.
                                                    <br /><br />
                                                    This action cannot be undone from the portal. Are you sure?
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter className="mt-4">
                                                <Button variant="outline" className="border-border/70 bg-transparent text-slate-200 hover:bg-slate-900 hover:text-white" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                                                <Button onClick={() => void handleApprove()} disabled={isApproving} className="bg-[#2F8E92] hover:bg-[#267276]">
                                                    {isApproving ? 'Processing...' : 'Yes, Create Invoice'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
