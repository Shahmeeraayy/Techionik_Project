import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    RefreshCw,
    Plus,
    MoreVertical,
    CheckCircle2,
    DollarSign,
    FileText,
    Archive,
    Trash2,
    Edit2,
    Info,
    FileDown
} from 'lucide-react';
import { exportArrayData, selectColumnsForExport, type ExportFormat } from '@/lib/export';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ColumnExportDialog from '@/components/modals/ColumnExportDialog';
import OverflowText from '@/components/common/overflow-text';
import { useAuth } from '@/contexts/AuthContext';
import {
    createAdminService,
    fetchAdminServices,
    getStoredAdminToken,
    updateAdminService,
    updateAdminServiceStatus,
    type BackendServiceCatalogItem,
} from '@/lib/backend-api';

// --- Types ---

interface ServiceItem {
    id: string;
    code: string;
    name: string;
    sku?: string;
    description?: string;
    category: string;
    default_price: number;
    approval_required: boolean;
    status: 'active' | 'archived';
    notes?: string;
    updated_at: string;
    updated_by?: string;
    allowed_actions: string[];
}

type ServiceStatusFilter = 'all' | 'active' | 'archived';
type IndustryPresetKey = 'automotive' | 'hvac';

const toNumber = (value: string | number): number => {
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const mapBackendServiceToUi = (row: BackendServiceCatalogItem): ServiceItem => ({
    id: row.id,
    code: row.code,
    name: row.name,
    sku: row.sku ?? undefined,
    description: row.description ?? undefined,
    category: row.category || 'General',
    default_price: toNumber(row.default_price),
    approval_required: Boolean(row.approval_required),
    status: row.status === 'archived' ? 'archived' : 'active',
    notes: row.notes ?? undefined,
    updated_at: row.updated_at,
    updated_by: row.updated_by ?? undefined,
    allowed_actions: ['edit', row.status === 'active' ? 'archive' : 'unarchive', 'duplicate'],
});

type BusinessCategoryFilter =
    | 'all'
    | 'ppf'
    | 'window_tint'
    | 'engine_immobilizers'
    | 'remote_starters'
    | 'vehicle_tracking_systems'
    | 'windshield_repair'
    | 'windshield_replacement';

const normalizeFilterText = (value: string | undefined): string =>
    (value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const classifyBusinessCategory = (service: ServiceItem): BusinessCategoryFilter => {
    const category = normalizeFilterText(service.category);
    const name = normalizeFilterText(service.name);
    const code = normalizeFilterText(service.code);
    const description = normalizeFilterText(service.description);
    const haystack = [category, name, code, description].join(' ');

    if (haystack.includes('ppf')) return 'ppf';
    if (haystack.includes('window tint') || haystack.includes('teintage') || haystack.includes('tint')) {
        return 'window_tint';
    }
    if (
        haystack.includes('immobilizer') ||
        haystack.includes('anti-demarrage') ||
        haystack.includes('antidemarrage')
    ) {
        return 'engine_immobilizers';
    }
    if (
        haystack.includes('remote starter') ||
        haystack.includes('demarreur') ||
        haystack.includes('mycar')
    ) {
        return 'remote_starters';
    }
    if (
        haystack.includes('tracking') ||
        haystack.includes('reperage') ||
        haystack.includes('geotrac') ||
        haystack.includes('gps')
    ) {
        return 'vehicle_tracking_systems';
    }
    if (haystack.includes('windshield repair') || haystack.includes('reparation de pare-brise')) {
        return 'windshield_repair';
    }
    if (haystack.includes('windshield replacement') || haystack.includes('remplacement de pare-brise')) {
        return 'windshield_replacement';
    }
    return 'all';
};

const ADMIN_REFRESH_EVENT = 'sm-dispatch:admin-refresh';
const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';

function metricCardClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet'): string {
    return cn(
        'overflow-hidden rounded-[24px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        tone === 'cyan' && 'border-cyan-400/15 bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))]',
        tone === 'emerald' && 'border-emerald-400/15 bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))]',
        tone === 'amber' && 'border-amber-400/15 bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))]',
        tone === 'violet' && 'border-violet-400/15 bg-[linear-gradient(180deg,rgba(30,23,49,0.96),rgba(18,16,33,0.96))]',
    );
}

function metricIconClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet'): string {
    return cn(
        'rounded-2xl border p-3',
        tone === 'cyan' && 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
        tone === 'emerald' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
        tone === 'amber' && 'border-amber-300/20 bg-amber-300/10 text-amber-100',
        tone === 'violet' && 'border-violet-300/20 bg-violet-300/10 text-violet-100',
    );
}

const INDUSTRY_PRESETS: Record<IndustryPresetKey, Array<{
    code: string;
    name: string;
    category: string;
    default_price: number;
    approval_required?: boolean;
    notes?: string;
}>> = {
    automotive: [
        { code: 'AUTO-DIAG', name: 'Vehicle Diagnostics', category: 'Diagnostics', default_price: 95, notes: 'Preset automotive diagnostics service.' },
        { code: 'AUTO-TINT-FRONT', name: 'Front Window Tint', category: 'Window Tint', default_price: 120 },
        { code: 'AUTO-REMOTE', name: 'Remote Starter Install', category: 'Remote Starter', default_price: 349, approval_required: true },
        { code: 'AUTO-TRACK', name: 'Vehicle Tracking Install', category: 'Tracking', default_price: 279, approval_required: true },
    ],
    hvac: [
        { code: 'HVAC-TUNEUP', name: 'Seasonal Tune-Up', category: 'Maintenance', default_price: 149 },
        { code: 'HVAC-DIAG', name: 'System Diagnostic Visit', category: 'Diagnostics', default_price: 119, approval_required: true },
        { code: 'HVAC-THERMO', name: 'Thermostat Installation', category: 'Installation', default_price: 199 },
        { code: 'HVAC-FILTER', name: 'Filter Replacement', category: 'Maintenance', default_price: 65 },
    ],
};

// --- Mock Data ---

export const MOCK_SERVICES: ServiceItem[] = [
    { id: 's1', code: 'PPF-ALA-AILES-COMP-2', name: 'PPF ailes complètes (2)', category: 'PPF', default_price: 400, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's2', code: 'PPF-ALA-CAPOT-12', name: 'PPF bande de capot 12"', category: 'PPF', default_price: 120, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's3', code: 'PPF-ALA-CAPOT-18', name: 'PPF bande de capot 18"', category: 'PPF', default_price: 170, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's4', code: 'PPF-ALA-TOIT-12', name: 'PPF bande de toit 12"', category: 'PPF', default_price: 100, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's5', code: 'PPF-ALA-TOIT-4', name: 'PPF bande de toit 4"', category: 'PPF', default_price: 40, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's6', code: 'PPF-ALA-TOIT-6', name: 'PPF bande de toit 6"', category: 'PPF', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's7', code: 'PPF-ALA-TOIT-8', name: 'PPF bande de toit 8"', category: 'PPF', default_price: 75, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's8', code: 'PPF-OPT-BANDE-AR', name: 'PPF bande pare-chocs arrière (à partir de)', category: 'PPF', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's9', code: 'FORDDN-SVC-PPF-BANDE-AR', name: 'PPF bande pare-chocs arrière – Donnacona Ford', category: 'PPF', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's10', code: 'HONDA-DON-SVC-PPF-BANDE-AR', name: 'PPF bande pare-chocs arrière – Honda', category: 'PPF', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's11', code: 'PPF-ALA-BAS-CAISSES-12', name: 'PPF bas de caisses 12"', category: 'PPF', default_price: 375, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's12', code: 'PPF-ALA-BAS-CAISSES-8', name: 'PPF bas de caisses 8"', category: 'PPF', default_price: 240, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's13', code: 'PPF-PKG-CAPOT12-AILES', name: 'PPF capot 12" + ailes', category: 'PPF', default_price: 135, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's14', code: 'FORDDN-SVC-PPF-CAPOT12-AILES', name: 'PPF capot 12" + ailes – Donnacona Ford', category: 'PPF', default_price: 135, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's15', code: 'FORDDN-SVC-PPF-CAPOT12-F150', name: 'PPF capot 12" + ailes – F-150', category: 'PPF', default_price: 175, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's16', code: 'FORDDN-SVC-PPF-CAPOT12-F250', name: 'PPF capot 12" + ailes – F-250', category: 'PPF', default_price: 225, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's17', code: 'FORDDN-SVC-PPF-CAPOT12-COMBO-F150', name: 'PPF capot 12" + ailes + pare-chocs avant (combo) – F-150', category: 'PPF', default_price: 150, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's18', code: 'FORDDN-SVC-PPF-CAPOT12-COMBO-F250', name: 'PPF capot 12" + ailes + pare-chocs avant (combo) – F-250', category: 'PPF', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's19', code: 'PPF-PKG-CAPOT12-AILES-POINTE', name: 'PPF capot 12" + ailes + pointes (à partir de)', category: 'PPF', default_price: 185, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's20', code: 'FORDDN-SVC-PPF-CAPOT16-AUTRE', name: 'PPF capot 16" + ailes (autre)', category: 'PPF', default_price: 175, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's21', code: 'PPF-PKG-CAPOT16-AILES', name: 'PPF capot 16" + ailes (base)', category: 'PPF', default_price: 185, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's22', code: 'HONDA-DON-SVC-PPF-16-CRVHRV', name: 'PPF capot 16" + ailes – CRV/HRV/Ridgeline/Prologue', category: 'PPF', default_price: 170, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's23', code: 'FORDDN-SVC-PPF-CAPOT16-F150', name: 'PPF capot 16" + ailes – F-150', category: 'PPF', default_price: 225, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's24', code: 'FORDDN-SVC-PPF-CAPOT16-F250', name: 'PPF capot 16" + ailes – F-250', category: 'PPF', default_price: 250, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's25', code: 'HONDA-DON-SVC-PPF-16-ODY', name: 'PPF capot 16" + ailes – Odyssey', category: 'PPF', default_price: 180, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's26', code: 'FORDDN-SVC-PPF-CAPOT16-COMBO-F150', name: 'PPF capot 16" + ailes + pare-chocs avant (combo) – F-150', category: 'PPF', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's27', code: 'FORDDN-SVC-PPF-CAPOT16-COMBO-F250', name: 'PPF capot 16" + ailes + pare-chocs avant (combo) – F-250', category: 'PPF', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's28', code: 'PPF-PKG-CAPOT16-AILES-POINTE', name: 'PPF capot 16" + ailes + pointe (à partir de)', category: 'PPF', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's29', code: 'FORDDN-SVC-PPF-CAPOT16-AUTRE-POINTE', name: 'PPF capot 16" + ailes + pointe (autre)', category: 'PPF', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's30', code: 'PPF-PKG-CAPOT24-POINTE', name: 'PPF capot 24" + pointe', category: 'PPF', default_price: 225, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's31', code: 'HONDA-DON-SVC-PPF-CIVIC-24', name: 'PPF capot 24" + pointe – Civic', category: 'PPF', default_price: 225, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's32', code: 'FORDDN-SVC-PPF-CAPOT24-POINTE', name: 'PPF capot 24" + pointe – Donnacona Ford', category: 'PPF', default_price: 225, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's33', code: 'PPF-ALA-CAPOT-COMP', name: 'PPF capot complet (à partir de)', category: 'PPF', default_price: 325, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's34', code: 'PPF-ALA-POIGNEES', name: 'PPF intérieur de poignées (ch.)', category: 'PPF', default_price: 10, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's35', code: 'PPF-OPT-MIROIRS', name: 'PPF miroirs (2)', category: 'PPF', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's36', code: 'FORDDN-SVC-PPF-MIROIRS', name: 'PPF miroirs – Donnacona Ford', category: 'PPF', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's37', code: 'HONDA-DON-SVC-PPF-MIROIRS', name: 'PPF miroirs – Honda', category: 'PPF', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's38', code: 'PPF-ALA-MONTANT-PB', name: 'PPF montant de pare-brise (ch.)', category: 'PPF', default_price: 30, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's39', code: 'FORDDN-SVC-PPF-PARECHOCS-AV-AUTRE', name: 'PPF pare-chocs avant – autre modèle', category: 'PPF', default_price: 325, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's40', code: 'PPF-OPT-PARECHOCS-AV', name: 'PPF pare-chocs avant (base)', category: 'PPF', default_price: 350, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's41', code: 'FORDDN-SVC-PPF-PARECHOCS-AV-F150', name: 'PPF pare-chocs avant – F-150', category: 'PPF', default_price: 250, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's42', code: 'FORDDN-SVC-PPF-PARECHOCS-AV-F250', name: 'PPF pare-chocs avant – F-250', category: 'PPF', default_price: 300, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's43', code: 'HONDA-DON-SVC-PPF-PARECHOCS-AV', name: 'PPF pare-chocs avant – Honda', category: 'PPF', default_price: 325, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's44', code: 'PPF-ALA-PHARES-AJOUT', name: 'PPF phares (ajout)', category: 'PPF', default_price: 70, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's45', code: 'PPF-ALA-PHARES-SEUL', name: 'PPF phares (seul)', category: 'PPF', default_price: 110, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's46', code: 'PPF-ALA-SEUIL-COFFRE', name: 'PPF seuil de coffre', category: 'PPF', default_price: 45, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's47', code: 'PPF-ALA-SEUIL-PORTE', name: 'PPF seuil de porte (ch.)', category: 'PPF', default_price: 25, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's48', code: 'PPF-OPT-TOIT12-AJOUT', name: 'PPF toit 12" (ajout)', category: 'PPF', default_price: 90, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's49', code: 'FORDDN-SVC-PPF-TOIT12-AJOUT', name: 'PPF toit 12" (ajout) – Donnacona Ford', category: 'PPF', default_price: 90, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's50', code: 'HONDA-DON-SVC-PPF-TOIT12-AJOUT', name: 'PPF toit 12" (ajout) – Honda', category: 'PPF', default_price: 90, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's51', code: 'PPF-OPT-TOIT12-SEUL', name: 'PPF toit 12" (seul)', category: 'PPF', default_price: 115, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's52', code: 'FORDDN-SVC-PPF-TOIT12-SEUL', name: 'PPF toit 12" (seul) – Donnacona Ford', category: 'PPF', default_price: 115, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's53', code: 'HONDA-DON-SVC-PPF-TOIT12-SEUL', name: 'PPF toit 12" (seul) – Honda', category: 'PPF', default_price: 115, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's54', code: 'TEINTE-BANDE-PB', name: 'Bande pare-brise teintée', category: 'Window Tint', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's55', code: 'FORDDN-SVC-TINT-BANDE-PB', name: 'Bande pare-brise teintée (Ford)', category: 'Window Tint', default_price: 50, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's56', code: 'TEINTE-COMP-LIMO', name: 'Teintage complet – arrière limo', category: 'Window Tint', default_price: 240, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's57', code: 'FORDDN-SVC-TINT-COMP-LIMO', name: 'Teintage complet – arrière limo (Ford)', category: 'Window Tint', default_price: 240, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's58', code: 'TEINTE-COMP-STD', name: 'Teintage complet – standard', category: 'Window Tint', default_price: 225, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's59', code: 'FORDDN-SVC-TINT-COMP-STD', name: 'Teintage complet – standard (Ford)', category: 'Window Tint', default_price: 225, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's60', code: 'TEINTE-AR-LIMO', name: 'Teintage vitres arrière – limo', category: 'Window Tint', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's61', code: 'FORDDN-SVC-TINT-AR-LIMO', name: 'Teintage vitres arrière – limo (Ford)', category: 'Window Tint', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's62', code: 'TEINTE-AR-STD', name: 'Teintage vitres arrière – standard', category: 'Window Tint', default_price: 185, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's63', code: 'FORDDN-SVC-TINT-AR-STD', name: 'Teintage vitres arrière – standard (Ford)', category: 'Window Tint', default_price: 185, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's64', code: 'TEINTE-AV-CER', name: 'Teintage vitres avant – céramique', category: 'Window Tint', default_price: 100, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's65', code: 'FORDDN-SVC-TINT-AV-CER', name: 'Teintage vitres avant – céramique (Ford)', category: 'Window Tint', default_price: 100, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's66', code: 'TEINTE-AV-STD', name: 'Teintage vitres avant – standard', category: 'Window Tint', default_price: 90, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's67', code: 'FORDDN-SVC-TINT-AV-STD', name: 'Teintage vitres avant – standard (Ford)', category: 'Window Tint', default_price: 90, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's68', code: 'AUDI-SVC-2WAY', name: 'Démarreur 2-Way – Audi', category: 'Remote Starter', default_price: 480, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's69', code: 'AUDI-SVC-2WAY-S3RS3-2526', name: 'Démarreur 2-Way – Audi S3/RS3 2025-2026', category: 'Remote Starter', default_price: 580, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's70', code: 'AUDI-SVC-MYCAR2', name: 'Démarreur MyCar 2 – Audi', category: 'Remote Starter', default_price: 590, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's71', code: 'AUDI-SVC-MYCAR-S3RS3-2526', name: 'Démarreur MyCar – Audi S3/RS3 2025-2026', category: 'Remote Starter', default_price: 690, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's72', code: 'AUDI-SVC-DOMINO', name: 'Domino repérage – Audi', category: 'Remote Starter', default_price: 320, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
    { id: 's73', code: 'AUDI-SVC-PB-MO', name: 'Remplacement de pare-brise – Audi', category: 'Remote Starter', default_price: 200, approval_required: false, status: 'active', updated_at: '2024-02-11T12:00:00Z', updated_by: 'System Import', allowed_actions: ['edit', 'archive', 'duplicate'] },
];

// --- Components ---

function ApprovalBadge({ required }: { required: boolean }) {
    if (required) return <Badge variant="outline" className="border-amber-300/20 bg-amber-300/10 text-amber-100">Yes</Badge>;
    return <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-300">No</Badge>;
}

function StatusBadge({ status }: { status: 'active' | 'archived' }) {
    if (status === 'active') return <Badge className="border-cyan-300/20 bg-cyan-300/12 text-cyan-100 shadow-none hover:bg-cyan-300/12">Active</Badge>;
    return <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-300">Archived</Badge>;
}

const SERVICE_EXPORT_COLUMNS = [
    'Code',
    'Name',
    'SKU',
    'Category',
    'DefaultPrice',
    'Status',
];

export default function ServicesPage() {
    const { hasBackendAdminToken } = useAuth();
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<BusinessCategoryFilter>('all');
    const [filterStatus, setFilterStatus] = useState<ServiceStatusFilter>('all');
    const [minPrice, setMinPrice] = useState<string>('');
    const [maxPrice, setMaxPrice] = useState<string>('');
    const [presetIndustry, setPresetIndustry] = useState<IndustryPresetKey>('automotive');
    const [presetLoading, setPresetLoading] = useState(false);

    // Drawers & Modals
    const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // Forms
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        category: 'General',
        default_price: '',
        approval_required: false,
        notes: ''
    });

    // Initial Fetch
    const fetchServices = useCallback(async () => {
        setLoading(true);
        const token = getStoredAdminToken();
        if (!hasBackendAdminToken || !token) {
            setServices([]);
            setLoading(false);
            return;
        }
        try {
            const rows = await fetchAdminServices(token, true);
            setServices(rows.map(mapBackendServiceToUi));
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to load services';
            alert(detail);
            setServices([]);
        } finally {
            setLoading(false);
        }
    }, [hasBackendAdminToken]);

    useEffect(() => {
        void fetchServices();
    }, [fetchServices]);

    useEffect(() => {
        const handleAdminRefresh = () => {
            void fetchServices();
        };

        window.addEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
        return () => {
            window.removeEventListener(ADMIN_REFRESH_EVENT, handleAdminRefresh);
        };
    }, [fetchServices]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            void fetchServices();
        }, 15000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [fetchServices]);

    const getServiceExportRows = () => services.map(s => ({
            Code: s.code,
            Name: s.name,
            SKU: s.sku || '',
            Category: s.category,
            DefaultPrice: s.default_price,
            Status: s.status,
        }));

    const handleExport = (selectedColumns: string[], format: ExportFormat = 'csv') => {
        const exportData = selectColumnsForExport(getServiceExportRows(), selectedColumns);
        exportArrayData(exportData, 'services_pricing_export', format);
    };

    // Filter Logic
    const filteredServices = services.filter((s) => {
        const matchesSearch =
            s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
        const normalizedCategory = s.category.trim().toLowerCase();
        const normalizedName = s.name.trim().toLowerCase();
        const normalizedCode = s.code.trim().toLowerCase();
        let matchesCategory = true;
        if (filterCategory === 'ppf') {
            matchesCategory = normalizedCategory === 'ppf';
        }
        if (filterCategory === 'window_tint') {
            matchesCategory = normalizedCategory === 'window tint';
        }
        if (filterCategory === 'engine_immobilizers') {
            matchesCategory =
                normalizedName.includes('immobilizer') ||
                normalizedName.includes('anti-demarrage') ||
                normalizedName.includes('antidémarrage') ||
                normalizedName.includes('domino') ||
                normalizedCode.includes('immobil');
        }
        if (filterCategory === 'remote_starters') {
            matchesCategory =
                normalizedName.includes('remote starter') ||
                normalizedName.includes('demarreur') ||
                normalizedName.includes('démarreur') ||
                normalizedName.includes('mycar') ||
                normalizedName.includes('2-way') ||
                normalizedCode.includes('2way') ||
                normalizedCode.includes('mycar');
        }
        if (filterCategory === 'vehicle_tracking_systems') {
            matchesCategory =
                normalizedName.includes('tracking') ||
                normalizedName.includes('repérage') ||
                normalizedName.includes('reperage') ||
                normalizedCode.includes('tracking');
        }
        if (filterCategory === 'windshield_repair') {
            matchesCategory =
                normalizedName.includes('windshield repair') ||
                normalizedName.includes('pare-brise') ||
                normalizedCode.includes('pb');
        }
        if (filterCategory === 'windshield_replacement') {
            matchesCategory =
                normalizedName.includes('windshield replacement') ||
                normalizedName.includes('remplacement de pare-brise');
        }

        const min = minPrice.trim() === '' ? null : Number(minPrice);
        const max = maxPrice.trim() === '' ? null : Number(maxPrice);
        const matchesMin = min === null || (!Number.isNaN(min) && s.default_price >= min);
        const matchesMax = max === null || (!Number.isNaN(max) && s.default_price <= max);
        const matchesStatus = filterStatus === 'all' || s.status === filterStatus;

        return matchesSearch && matchesCategory && matchesStatus && matchesMin && matchesMax;
    });

    const activeServicesCount = services.filter((service) => service.status === 'active').length;
    const archivedServicesCount = services.filter((service) => service.status === 'archived').length;
    const approvalRequiredCount = services.filter((service) => service.approval_required).length;

    // Handlers
    const handleOpenDrawer = (s: ServiceItem) => {
        setSelectedService(s);
        setDrawerOpen(true);
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setFormData({ code: '', name: '', category: 'General', default_price: '', approval_required: false, notes: '' });
        setModalOpen(true);
    };

    const handleOpenEditModal = (s: ServiceItem) => {
        setModalMode('edit');
        setFormData({
            code: s.code,
            name: s.name,
            category: s.category || 'General',
            default_price: s.default_price.toString(),
            approval_required: s.approval_required,
            notes: s.notes || ''
        });
        setSelectedService(s);
        setModalOpen(true);
    };

    const handleSaveService = async () => {
        const token = getStoredAdminToken();
        if (!token) {
            alert('Admin session is required to save services.');
            return;
        }

        if (!formData.code || !formData.name || !formData.default_price) {
            alert("Code, Name, and Default Price are required.");
            return;
        }

        const normalizedCategory = formData.category.trim() || 'General';

        const price = parseFloat(formData.default_price);
        if (isNaN(price) || price < 0) {
            alert("Price must be a valid non-negative number.");
            return;
        }

        const normalizedCode = formData.code.trim().toLowerCase();

        if (modalMode === 'add') {
            if (services.some((s) => s.code.trim().toLowerCase() === normalizedCode)) {
                alert("Service code already exists.");
                return;
            }
            try {
                const created = await createAdminService(token, {
                    code: formData.code,
                    name: formData.name,
                    category: normalizedCategory,
                    default_price: price,
                    approval_required: formData.approval_required,
                    notes: formData.notes || null,
                });
                setServices(prev => [mapBackendServiceToUi(created), ...prev]);
            } catch (error) {
                const detail = error instanceof Error ? error.message : 'Unable to create service';
                alert(detail);
                return;
            }

        } else if (modalMode === 'edit' && selectedService) {
            if (
                services.some(
                    (s) => s.id !== selectedService.id && s.code.trim().toLowerCase() === normalizedCode,
                )
            ) {
                alert("Service code already exists.");
                return;
            }
            try {
                const updated = await updateAdminService(token, selectedService.id, {
                    code: formData.code,
                    name: formData.name,
                    category: normalizedCategory,
                    default_price: price,
                    approval_required: formData.approval_required,
                    notes: formData.notes || null,
                });
                const updatedService = mapBackendServiceToUi(updated);
                setServices(prev => prev.map(s => s.id === selectedService.id ? updatedService : s));
                setSelectedService(updatedService);
            } catch (error) {
                const detail = error instanceof Error ? error.message : 'Unable to update service';
                alert(detail);
                return;
            }
        }

        setModalOpen(false);
        // Toast success here
    };

    const handleArchiveToggle = async (s: ServiceItem) => {
        const token = getStoredAdminToken();
        if (!token) {
            alert('Admin session is required to change service status.');
            return;
        }
        const newStatus = s.status === 'active' ? 'archived' : 'active';
        try {
            const updated = await updateAdminServiceStatus(token, s.id, newStatus);
            const next = mapBackendServiceToUi(updated);
            setServices(prev => prev.map(item => item.id === s.id ? next : item));
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to update service status';
            alert(detail);
        }
    };

    const handleLoadIndustryPreset = async () => {
        const token = getStoredAdminToken();
        if (!token) {
            alert('Admin session is required to load service presets.');
            return;
        }
        const presetRows = INDUSTRY_PRESETS[presetIndustry];
        const existingCodes = new Set(services.map((service) => service.code.trim().toLowerCase()));
        const rowsToCreate = presetRows.filter((row) => !existingCodes.has(row.code.trim().toLowerCase()));

        if (rowsToCreate.length === 0) {
            alert('All preset services are already in the catalog.');
            return;
        }

        setPresetLoading(true);
        try {
            const createdRows: ServiceItem[] = [];
            for (const row of rowsToCreate) {
                const created = await createAdminService(token, {
                    code: row.code,
                    name: row.name,
                    category: row.category,
                    default_price: row.default_price,
                    approval_required: row.approval_required ?? false,
                    notes: row.notes ?? null,
                });
                createdRows.push(mapBackendServiceToUi(created));
            }
            setServices((current) => [...createdRows, ...current]);
            alert(`Loaded ${createdRows.length} ${presetIndustry} preset service${createdRows.length === 1 ? '' : 's'}.`);
        } catch (error) {
            const detail = error instanceof Error ? error.message : 'Unable to load industry preset';
            alert(detail);
        } finally {
            setPresetLoading(false);
        }
    };

    return (
        <div className="relative w-full pb-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] rounded-[34px] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),rgba(34,211,238,0)_34%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),rgba(52,211,153,0)_30%)]" />
            <div className="pointer-events-none absolute left-8 top-8 h-40 w-40 rounded-full bg-cyan-400/8 blur-3xl" />
            <div className="pointer-events-none absolute right-10 top-20 h-48 w-48 rounded-full bg-emerald-400/8 blur-3xl" />

            <div className="relative space-y-6">
                <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)]">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_26%)]" />
                    <div className="relative flex flex-col gap-5 p-6 xl:flex-row xl:items-end xl:justify-between xl:p-8">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                                <FileText className="h-3.5 w-3.5" />
                                Services Catalogue
                            </div>
                            <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                                Services
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                                Manage services, rates, and presets.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <Button variant="outline" size="sm" onClick={() => void fetchServices()} className="h-10 gap-2 rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white" disabled={loading}>
                                <RefreshCw className={cn('w-4 h-4 text-blue-600 dark:text-cyan-200', loading && 'animate-spin')} /> Refresh
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setExportModalOpen(true)} className="h-10 gap-2 rounded-full border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]">
                                <FileDown className="w-4 h-4" /> Export Excel
                            </Button>
                            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1">
                                <Select value={presetIndustry} onValueChange={(value) => setPresetIndustry(value as IndustryPresetKey)}>
                                    <SelectTrigger className="h-8 w-[148px] border-0 bg-transparent text-slate-100 shadow-none">
                                        <SelectValue placeholder="Preset" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="automotive">Automotive</SelectItem>
                                        <SelectItem value="hvac">HVAC</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="sm" onClick={() => void handleLoadIndustryPreset()} disabled={presetLoading} className="h-8 rounded-full px-3 text-slate-100 hover:bg-white/[0.08]">
                                    {presetLoading ? 'Loading...' : 'Load Preset'}
                                </Button>
                            </div>
                            <Button size="sm" onClick={handleOpenAddModal} className="h-10 gap-2 rounded-full bg-[#2F8E92] px-5 text-white shadow-[0_12px_30px_rgba(47,142,146,0.28)] hover:bg-[#267276]">
                                <Plus className="w-4 h-4" /> Add Service
                            </Button>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className={metricCardClass('cyan')}>
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Catalog Items</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{services.length}</p>
                                    <p className="text-sm text-slate-300">Services available in catalog</p>
                                </div>
                                <div className={metricIconClass('cyan')}>
                                    <FileText className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className={metricCardClass('emerald')}>
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Active Services</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{activeServicesCount}</p>
                                    <p className="text-sm text-slate-300">Live items available for jobs</p>
                                </div>
                                <div className={metricIconClass('emerald')}>
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className={metricCardClass('amber')}>
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Approval Flags</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{approvalRequiredCount}</p>
                                    <p className="text-sm text-slate-300">Services requiring invoice review</p>
                                </div>
                                <div className={metricIconClass('amber')}>
                                    <Info className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className={metricCardClass('violet')}>
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Archived</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{archivedServicesCount}</p>
                                    <p className="text-sm text-slate-300">Inactive catalog entries retained</p>
                                </div>
                                <div className={metricIconClass('violet')}>
                                    <Archive className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="rounded-[22px] border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
                    <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-200" />
                        <p>Price changes affect future jobs only. Previously approved invoices remain unchanged.</p>
                    </div>
                </div>

                <Card className={sectionCardClass}>
                    <div className={sectionHeaderClass}>
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-white">Catalogue Filters</h2>
                                <p className="mt-1 text-sm text-slate-300">
                                    Narrow the service catalogue by category, status, or unit price range.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                                    {filteredServices.length} visible
                                </Badge>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center">
                            <div className="relative min-w-0 flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Search by service name, category, code, or SKU..."
                                    className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500 transition-all focus:bg-white/[0.06]"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:items-center">
                                <Select value={filterCategory} onValueChange={(value) => setFilterCategory(value as BusinessCategoryFilter)}>
                                    <SelectTrigger className="h-11 w-full border-white/10 bg-white/[0.04] text-slate-100 lg:w-[230px]">
                                        <SelectValue placeholder="Business Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Business Categories</SelectItem>
                                        <SelectItem value="ppf">PPF</SelectItem>
                                        <SelectItem value="window_tint">Window Tint</SelectItem>
                                        <SelectItem value="engine_immobilizers">Engine immobilizers</SelectItem>
                                        <SelectItem value="remote_starters">Remote starters</SelectItem>
                                        <SelectItem value="vehicle_tracking_systems">Vehicle tracking systems</SelectItem>
                                        <SelectItem value="windshield_repair">Windshield repair</SelectItem>
                                        <SelectItem value="windshield_replacement">Windshield replacement</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as ServiceStatusFilter)}>
                                    <SelectTrigger className="h-11 w-full border-white/10 bg-white/[0.04] text-slate-100 lg:w-[150px]">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="h-11 w-full justify-start border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08] lg:w-[180px]">
                                            Prices
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 border-white/10 bg-[#091827] p-3 text-slate-100">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-400">Min Price</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="Min Price"
                                                data-admin-dark-input="true"
                                                className="[color-scheme:dark]"
                                                value={minPrice}
                                                onChange={(e) => setMinPrice(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2 mt-3">
                                            <Label className="text-xs text-slate-400">Max Price</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="Max Price"
                                                data-admin-dark-input="true"
                                                className="[color-scheme:dark]"
                                                value={maxPrice}
                                                onChange={(e) => setMaxPrice(e.target.value)}
                                            />
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className={cn(sectionCardClass, 'flex-1 flex flex-col')}>
                {loading ? (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full bg-white/10" />
                        ))}
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05]">
                            <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">No services found</h3>
                        <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
                        <Button variant="outline" className="mt-4 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterStatus('all'); setMinPrice(''); setMaxPrice(''); }}>Clear Filters</Button>
                    </div>
                ) : (
                    <div className="overflow-hidden">
                        <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-6 py-5">
                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Catalogue Board</div>
                                <div className="text-sm text-slate-200">Service records with category, unit pricing, and archive status.</div>
                            </div>
                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                {filteredServices.length} visible
                            </Badge>
                        </div>
                        <div className="overflow-auto">
                            <Table className="min-w-[1220px]">
                                <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                                    <TableRow className="border-white/0 hover:bg-transparent">
                                        <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Service Code</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Service Name</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">SKU</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Category</TableHead>
                                        <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Unit Price</TableHead>
                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Status</TableHead>
                                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Last Updated</TableHead>
                                        <TableHead className="w-[64px] pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Open</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredServices.map((service, index) => (
                                        <TableRow
                                            key={service.id}
                                            className={cn(
                                                'group cursor-pointer border-b border-white/6 transition-colors hover:bg-white/[0.045]',
                                                index % 2 === 1 && 'bg-white/[0.015]',
                                            )}
                                            onClick={() => handleOpenDrawer(service)}
                                        >
                                            <TableCell className="pl-6 py-4 text-sm font-semibold text-white">{service.code}</TableCell>
                                            <TableCell className="py-4">
                                                <OverflowText text={service.name} className="max-w-[28rem] text-sm font-medium text-slate-100" />
                                            </TableCell>
                                            <TableCell className="py-4 font-mono text-xs text-slate-400">{service.sku || '-'}</TableCell>
                                            <TableCell className="py-4 text-slate-300">{service.category}</TableCell>
                                            <TableCell className="py-4 pr-6 text-right font-mono text-sm text-amber-100">${service.default_price.toFixed(2)}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                <StatusBadge status={service.status} />
                                            </TableCell>
                                            <TableCell className="py-4 text-right font-mono text-xs text-slate-400">{new Date(service.updated_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 opacity-100 transition-all hover:bg-white/[0.08] hover:text-white">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="border-white/10 bg-[#091827] text-slate-100">
                                                            <DropdownMenuItem onClick={() => handleOpenEditModal(service)}>
                                                                <Edit2 className="mr-2 h-4 w-4" /> Edit Service
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleArchiveToggle(service)} className={service.status === 'active' ? 'text-rose-200' : ''}>
                                                                {service.status === 'active' ? (
                                                                    <><Archive className="mr-2 h-4 w-4" /> Archive</>
                                                                ) : (
                                                                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Unarchive</>
                                                                )}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                </Card>

            {/* 6. Add/Edit Service Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="text-white">{modalMode === 'add' ? 'Add New Service' : 'Edit Service'}</DialogTitle>
                        <DialogDescription className="text-slate-300">
                            Configure service details, category, and unit pricing. <br />
                            <span className="text-xs font-medium text-amber-200">Changes affect future jobs only.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-200">Service Code <span className="text-rose-300">*</span></Label>
                                <Input
                                    placeholder="e.g. SRV-001"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                                    disabled={modalMode === 'edit'} // Lock code on edit usually desirable
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-200">Unit Price ($) <span className="text-rose-300">*</span></Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.default_price}
                                        onChange={e => setFormData({ ...formData, default_price: e.target.value })}
                                        className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] pl-9 text-white placeholder:text-slate-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Service Name <span className="text-rose-300">*</span></Label>
                            <Input className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" placeholder="e.g. Standard Inspection" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-200">Category <span className="text-rose-300">*</span></Label>
                            <Input
                                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                                placeholder="e.g. PPF"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] p-3">
                            <div className="space-y-0.5">
                                <Label className="text-base text-white">Approval Required</Label>
                                <p className="text-xs text-slate-400">Flag invoices containing this service for review.</p>
                            </div>
                            <Switch
                                checked={formData.approval_required}
                                onCheckedChange={c => setFormData({ ...formData, approval_required: c })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-200">Description / Notes</Label>
                            <Textarea
                                className="rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                                placeholder="Add service description, pricing context, or restrictions..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveService} className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105">{modalMode === 'add' ? 'Create Service' : 'Save Changes'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ColumnExportDialog
                open={exportModalOpen}
                onOpenChange={setExportModalOpen}
                title="Export Services"
                description="Choose columns to export."
                availableColumns={SERVICE_EXPORT_COLUMNS}
                onConfirm={handleExport}
            />

            {/* 7. Service Drawer */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent className="sm:max-w-md w-full p-0 flex flex-col gap-0 border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    {selectedService && (
                        <>
                            <div className="border-b border-white/10 bg-white/[0.03] px-6 py-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <OverflowText text={selectedService.name} as="h2" className="max-w-[18rem] text-xl font-bold text-white" />
                                        </div>
                                        <div className="inline-block rounded bg-white/[0.05] px-2 py-0.5 text-sm font-mono text-slate-400">
                                            {selectedService.code}
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => { setDrawerOpen(false); handleOpenEditModal(selectedService); }}>
                                        <Edit2 className="w-3 h-3 mr-2" /> Edit
                                    </Button>
                                </div>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-6 space-y-6">
                                    <Card className="space-y-4 border-white/10 bg-white/[0.03] p-4 shadow-none">
                                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                                            <FileText className="w-4 h-4" /> Service Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="block text-slate-400">SKU</span>
                                                <span className="font-mono text-white">{selectedService.sku || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400">Default Price</span>
                                                <span className="font-mono font-medium text-white">${selectedService.default_price.toFixed(2)}</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400">Status</span>
                                                <StatusBadge status={selectedService.status} />
                                            </div>
                                            <div>
                                                <span className="block text-slate-400">Approval Required</span>
                                                <ApprovalBadge required={selectedService.approval_required} />
                                            </div>
                                            <div>
                                                <span className="block text-slate-400">Last Updated</span>
                                                <span className="text-white">{new Date(selectedService.updated_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        {selectedService.description && (
                                            <div className="border-t border-white/10 pt-4">
                                                {selectedService.description && (
                                                    <>
                                                        <span className="mb-1 block text-xs text-slate-400">Description</span>
                                                        <OverflowText
                                                            text={selectedService.description}
                                                            as="p"
                                                            lines={3}
                                                            className="rounded border border-cyan-300/20 bg-cyan-300/10 p-2 text-sm text-cyan-50"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </Card>

                                </div>
                            </ScrollArea>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            </div>
        </div>
    );
}
