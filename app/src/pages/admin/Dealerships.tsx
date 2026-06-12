import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RefreshCw,
    Plus,
    MoreVertical,
    AlertCircle,
    Building2,
    Power,
    FileDown,
    MapPin,
    Mail,
    Phone,
    Clock3,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ColumnExportDialog from '@/components/modals/ColumnExportDialog';
import OverflowText from '@/components/common/overflow-text';
import {
    formatPhoneForDisplay,
    formatUsPhoneInput,
    getPhoneSearchToken,
    phoneExampleFormat,
    toUsPhoneFormat,
} from '@/lib/phone';
import {
    createAdminDealership,
    fetchAdminDealerships,
    getStoredAdminToken,
    updateAdminDealership,
    updateAdminDealershipStatus,
    type BackendDealership,
} from '@/lib/backend-api';
import { useAuth } from '@/contexts/AuthContext';

// --- Types ---

interface JobSummary {
    id: string;
    job_code: string;
    status: string;
    created_at: string;
    assigned_tech?: string;
}

interface Dealership {
    id: string;
    backend_id?: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    postal_code: string;
    status: 'active' | 'inactive';
    notes?: string;
    last_job_at?: string;
    recent_jobs: JobSummary[];
    allowed_actions: string[];
}

const mapBackendDealership = (item: BackendDealership): Dealership => ({
    id: item.code,
    backend_id: item.id,
    name: item.name,
    phone: formatPhoneForDisplay(item.phone ?? ''),
    email: item.email ?? '',
    address: item.address ?? '',
    city: item.city ?? '',
    postal_code: item.postal_code ?? '',
    status: item.status === 'active' ? 'active' : 'inactive',
    notes: item.notes ?? '',
    last_job_at: item.last_job_at ?? undefined,
    recent_jobs: (item.recent_jobs ?? []).map((job) => ({
        id: job.id,
        job_code: job.job_code,
        status: job.status,
        created_at: job.created_at,
        assigned_tech: job.assigned_tech ?? undefined,
    })),
    allowed_actions: ['view_details', 'edit', 'deactivate'],
});

// --- Mock Data ---

export const MOCK_DEALERSHIPS: Dealership[] = [
    {
        id: "D-001",
        name: "D-001",
        phone: "14186558309",
        email: "",
        address: "",
        city: "",
        postal_code: "",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-002",
        name: "911 Pro",
        phone: "15148930911",
        email: "comptabilite@911pro.com",
        address: "1240 Rue Labelle",
        city: "Longueuil",
        postal_code: "J4N 1C7",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-003",
        name: "Agropur",
        phone: "14210071863",
        email: "factures.invoices@agropur.com",
        address: "",
        city: "",
        postal_code: "",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-004",
        name: "System Test",
        phone: "14186558309",
        email: "alexdesgagne@hotmail.com",
        address: "123 Test Drive",
        city: "Quebec",
        postal_code: "G1G 1G1",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-005",
        name: "Audi De Quebec",
        phone: "15817058089",
        email: "comptabilite@audidequebec.com, jvilleneuve@audidequebec.com",
        address: "5200 Rue John Molson",
        city: "Quebec",
        postal_code: "G1X 3X4",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-006",
        name: "Audi Levis",
        phone: "15815006545",
        email: "",
        address: "",
        city: "",
        postal_code: "",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-007",
        name: "Carrossier Procolor Portneuf",
        phone: "14182862323",
        email: "portneuf@carrossierprocolor.com",
        address: "140 Lucien-Thibodeau",
        city: "Portneuf",
        postal_code: "G0A 2Y0",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-008",
        name: "Clinique Dentaire Marchand Charest Dumas",
        phone: "14186549123",
        email: "julie.clinique@outlook.com",
        address: "2850 Chem. Saint-Louis",
        city: "Quebec",
        postal_code: "G1W 1P2",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-009",
        name: "Germain Nissan Donnacona",
        phone: "14182850970",
        email: "dthibault@germainnissan.ca",
        address: "104 Rue Commerciale",
        city: "Donnacona",
        postal_code: "G3M 1W1",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-010",
        name: "Donnacona Chrysler Jeep Dodge Ram",
        phone: "",
        email: "",
        address: "160 Rue Commerciale",
        city: "Donnacona",
        postal_code: "G3M 1W1",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-011",
        name: "Donnacona Ford",
        phone: "",
        email: "",
        address: "128 Bd Les Ecureuils",
        city: "Donnacona",
        postal_code: "G3M 0J2",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-012",
        name: "Donnacona Mazda",
        phone: "41852852020",
        email: "aprovost@donnaconamazda.com",
        address: "141 Rue Commerciale",
        city: "Donnacona",
        postal_code: "G3M 1W2",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-013",
        name: "Germain Chevrolet Buick Gmc",
        phone: "",
        email: "",
        address: "560 Cote Joyeuse",
        city: "Saint-Raymond",
        postal_code: "G3L 4B1",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-014",
        name: "Germain Nissan Donnacona",
        phone: "",
        email: "",
        address: "104 Rue Commerciale",
        city: "Donnacona",
        postal_code: "G3M 1W1",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-015",
        name: "Honda Donnacona",
        phone: "",
        email: "",
        address: "159 Rue Commerciale",
        city: "Donnacona",
        postal_code: "G3M 1W2",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-016",
        name: "Hyundai Saint-Raymond",
        phone: "",
        email: "",
        address: "484 Cote Joyeuse",
        city: "Saint-Raymond",
        postal_code: "G3L 4A7",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-017",
        name: "Kia Cap-Sante",
        phone: "14182855555",
        email: "dhuard@leprixdugros.com",
        address: "5 Bois De L Ail",
        city: "Cap-Sante",
        postal_code: "G0A 1L0",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-018",
        name: "Kia Cap-Sante",
        phone: "",
        email: "",
        address: "5 Chem. Du Bois De L'Ail",
        city: "Cap-Sante",
        postal_code: "G0A 1L0",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-019",
        name: "L'Expert Carrossier Rive-Sud",
        phone: "",
        email: "magasinierauto@corrossier.expert, adjointe@carrossier.expert, philippe.denoncourt@carrossier.expert",
        address: "250 Av. Taniata",
        city: "Levis",
        postal_code: "G6W 5M6",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-020",
        name: "Agropur/Natrel",
        phone: "",
        email: "",
        address: "2465 1 Ere Avenue",
        city: "Quebec",
        postal_code: "G1L 3M9",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-021",
        name: "Mag3",
        phone: "14188496919",
        email: "payable@sm-inc.com",
        address: "15971, Boul. De La Colline",
        city: "Quebec",
        postal_code: "G3G 3A7",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-022",
        name: "Ville De Quebec",
        phone: "",
        email: "karyne.legere@ville.quebec.qc.ca",
        address: "",
        city: "",
        postal_code: "",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-023",
        name: "Pagui",
        phone: "14188497104",
        email: "payable@sm-inc.com",
        address: "15971 Bd De La Colline",
        city: "Quebec",
        postal_code: "G3G 3A7",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-024",
        name: "Pg Solutions",
        phone: "",
        email: "cp@harriscomputer.com, rrutishauser@pgsolutions.com",
        address: "217 avenue Leonidas #13",
        city: "Rimouski",
        postal_code: "G5L 2T5",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-025",
        name: "Prest",
        phone: "14185591535",
        email: "admin@prest.ltd",
        address: "1550 Ave Diesel,",
        city: "Quebec",
        postal_code: "G1P 4J5",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-026",
        name: "Pro-Design",
        phone: "14182848894",
        email: "victorplamondon@videotron.ca",
        address: "",
        city: "",
        postal_code: "",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-027",
        name: "Remorquage Charles Parent",
        phone: "14189281797",
        email: "parent.charles@videotron.ca",
        address: "1443 St Olivier",
        city: "Ancienne Lorette",
        postal_code: "G2E 2N7",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-028",
        name: "Revenu Canada",
        phone: "",
        email: "",
        address: "",
        city: "",
        postal_code: "",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-029",
        name: "Serge Fontaine",
        phone: "",
        email: "",
        address: "",
        city: "",
        postal_code: "",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-030",
        name: "Services Mobiles Martin Després Inc.",
        phone: "14189984458",
        email: "martin.despres.83@gmail.com",
        address: "527 Rue Taschereau,",
        city: "Quebec City",
        postal_code: "G3G 1B4",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-031",
        name: "Sm Construction Inc",
        phone: "14188497104",
        email: "payable@sm-inc.com",
        address: "15971, Boul. De La Colline",
        city: "Quebec",
        postal_code: "G3G 3A7",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-032",
        name: "Solutech Gps",
        phone: "1888765",
        email: "facturation@solutechgps.com",
        address: "308 Chemin De La Traverse",
        city: "Sainte-Anne-des-Plaines",
        postal_code: "J6Y 1S9",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-033",
        name: "Services Sanitaire A.Deschesnes",
        phone: "",
        email: "ssad-inc@live.ca",
        address: "600 Chemin Riviere-Verte",
        city: "St-Antonin",
        postal_code: "G0L 2J0",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-034",
        name: "St-Raymond Toyota",
        phone: "",
        email: "",
        address: "565 Cote Joyeuse",
        city: "Saint-Raymond",
        postal_code: "G3L 4B2",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-035",
        name: "Tardif Métal Inc",
        phone: "",
        email: "payable@sm-inc.com",
        address: "15971, Boul. De La Colline",
        city: "Quebec",
        postal_code: "G3G 3A7",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-036",
        name: "Transport Guilmyr",
        phone: "",
        email: "Karl.martin@gilmyr.com",
        address: "315 Chemin Du Coteau",
        city: "Montmagny",
        postal_code: "G5V 3R8",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-037",
        name: "Ville De Quebec  Service De Finance",
        phone: "",
        email: "Karyne.legere@ville.quebec.qc.ca",
        address: "65 Rue Sainte-Anne,R-C",
        city: "Quebec",
        postal_code: "G1R 3X5",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    },
    {
        id: "D-038",
        name: "Vitroplus Ste-Foy",
        phone: "14186506996",
        email: "service@vpsf.info",
        address: "2866 Chemin St Louis",
        city: "Quebec",
        postal_code: "G1W 1P4",
        status: "active" as const,
        notes: "",
        recent_jobs: [],
        allowed_actions: ['view_details', 'edit', 'deactivate'],
    }
];
// --- Components ---

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
    if (status === 'active') return <Badge className="border border-emerald-300/20 bg-emerald-300/12 text-emerald-100 shadow-none hover:bg-emerald-300/12">Active</Badge>;
    return <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-slate-400">Inactive</Badge>;
}

const sectionCardClass = 'overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]';
const sectionHeaderClass = 'border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6';

function metricCardClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet'): string {
    return cn(
        'overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        tone === 'cyan' && 'dark:border-cyan-400/15 dark:bg-[linear-gradient(180deg,rgba(12,36,55,0.96),rgba(8,24,39,0.96))]',
        tone === 'emerald' && 'dark:border-emerald-400/15 dark:bg-[linear-gradient(180deg,rgba(10,37,45,0.96),rgba(7,25,31,0.96))]',
        tone === 'amber' && 'dark:border-amber-400/15 dark:bg-[linear-gradient(180deg,rgba(41,28,15,0.94),rgba(27,18,10,0.96))]',
        tone === 'violet' && 'dark:border-violet-400/15 dark:bg-[linear-gradient(180deg,rgba(30,23,49,0.96),rgba(18,16,33,0.96))]',
    );
}

function metricIconClass(tone: 'cyan' | 'emerald' | 'amber' | 'violet'): string {
    return cn(
        'rounded-2xl border p-3',
        tone === 'cyan' && 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100',
        tone === 'emerald' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100',
        tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100',
        tone === 'violet' && 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-100',
    );
}

const DEALERSHIP_EXPORT_COLUMNS = [
    'ID',
    'LocationName',
    'ContactName',
    'City',
    'Phone',
    'Email',
    'Address',
    'ActiveJobCount',
    'Status',
    'Notes',
];

export default function DealershipsPage() {
    const { hasBackendAdminToken } = useAuth();
    const navigate = useNavigate();
    const [dealerships, setDealerships] = useState<Dealership[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastSuccessfulFetchAt, setLastSuccessfulFetchAt] = useState<Date | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterCity, setFilterCity] = useState<string>('all');

    // Drawers & Modals
    const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [confirmStatusModalOpen, setConfirmStatusModalOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // Forms
    const [addForm, setAddForm] = useState({ name: '', phone: '', email: '', address: '', city: '', postal_code: '', notes: '' });
    const [editForm, setEditForm] = useState<Dealership | null>(null);

    // Initial Fetch
    const fetchDealerships = async () => {
        setLoading(true);
        const adminToken = getStoredAdminToken();

        if (!hasBackendAdminToken || !adminToken) {
            setDealerships([]);
            setLoading(false);
            return;
        }

        try {
            const rows = await fetchAdminDealerships(adminToken);
            setDealerships(rows.map(mapBackendDealership));
            setLastSuccessfulFetchAt(new Date());
        } catch {
            setDealerships([]);
        } finally {
            setLoading(false);
        }
    };

    const reloadDealerships = async () => {
        await fetchDealerships();
    };

    useEffect(() => {
        void fetchDealerships();
    }, [hasBackendAdminToken]);

    const cityFilterOptions = Array.from(
        new Set(
            dealerships
                .map((d) => d.city.trim())
                .filter((city) => city.length > 0),
        ),
    ).sort((a, b) => a.localeCompare(b));

    // Filter Logic
    const filteredDealerships = dealerships.filter(d => {
        const query = searchQuery.toLowerCase();
        const queryPhoneToken = getPhoneSearchToken(searchQuery);
        const matchesSearch =
            d.name.toLowerCase().includes(query) ||
            d.phone.includes(searchQuery) ||
            d.email.toLowerCase().includes(query) ||
            d.city.toLowerCase().includes(query) ||
            (queryPhoneToken.length > 0 && getPhoneSearchToken(d.phone).includes(queryPhoneToken));
        const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
        const matchesCity = filterCity === 'all' || d.city.trim().toLowerCase() === filterCity.toLowerCase();
        return matchesSearch && matchesStatus && matchesCity;
    });

    // Handlers
    const handleOpenDrawer = (d: Dealership) => {
        setSelectedDealership(d);
        setEditForm({ ...d, phone: formatPhoneForDisplay(d.phone) }); // Initialize edit form
        setDrawerOpen(true);
    };

    const handleAddDealership = async () => {
        const formattedPhone = toUsPhoneFormat(addForm.phone);

        if (!addForm.name || !addForm.phone || !addForm.email) {
            // Simple validation feedback (in real app use toast)
            alert("Name, Phone, and Domain Email are required.");
            return;
        }
        if (!formattedPhone || formattedPhone !== addForm.phone.trim()) {
            alert(`Phone must be in this format: ${phoneExampleFormat}.`);
            return;
        }

        const adminToken = getStoredAdminToken();
        if (!adminToken) {
            alert('Admin backend connection is required to create a dealership.');
            return;
        }

        try {
            const created = await createAdminDealership(adminToken, {
                name: addForm.name.trim(),
                phone: formattedPhone,
                email: addForm.email.trim(),
                address: addForm.address.trim(),
                city: addForm.city.trim(),
                postal_code: addForm.postal_code.trim(),
                notes: addForm.notes.trim(),
            });
            const mapped = mapBackendDealership(created);
            setAddModalOpen(false);
            setAddForm({ name: '', phone: '', email: '', address: '', city: '', postal_code: '', notes: '' });
            await reloadDealerships();
            setTimeout(() => handleOpenDrawer(mapped), 300);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to create dealership.');
        }
    };

    const handleSaveEdit = async () => {
        if (!editForm || !selectedDealership) return;

        const rawPhone = editForm.phone.trim();
        const previousPhoneDisplay = formatPhoneForDisplay(selectedDealership.phone);
        let persistedPhone = selectedDealership.phone;

        if (rawPhone.length > 0) {
            const normalizedPhone = toUsPhoneFormat(rawPhone);
            if (!normalizedPhone) {
                // Allow legacy invalid value if unchanged, so non-phone fields can still be edited.
                if (rawPhone !== previousPhoneDisplay) {
                    alert(`Phone must be in this format: ${phoneExampleFormat}.`);
                    return;
                }
            } else {
                persistedPhone = normalizedPhone;
            }
        } else {
            persistedPhone = '';
        }

        const normalizedEdit: Dealership = {
            ...editForm,
            name: editForm.name.trim(),
            phone: persistedPhone,
            email: editForm.email.trim(),
            address: editForm.address.trim(),
            city: editForm.city.trim(),
            postal_code: editForm.postal_code.trim(),
            notes: (editForm.notes || '').trim(),
        };

        const adminToken = getStoredAdminToken();
        if (!adminToken || !selectedDealership.backend_id) {
            alert('Admin backend connection is required to update a dealership.');
            return;
        }

        try {
            const updated = await updateAdminDealership(
                adminToken,
                selectedDealership.backend_id,
                {
                    name: normalizedEdit.name,
                    phone: normalizedEdit.phone || undefined,
                    email: normalizedEdit.email || undefined,
                    address: normalizedEdit.address || undefined,
                    city: normalizedEdit.city || undefined,
                    postal_code: normalizedEdit.postal_code || undefined,
                    notes: normalizedEdit.notes || undefined,
                    status: normalizedEdit.status,
                },
            );
            const mapped = mapBackendDealership(updated);
            await reloadDealerships();
            setSelectedDealership(mapped);
            setEditForm({ ...mapped, phone: formatPhoneForDisplay(mapped.phone) });
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to update dealership.');
        }
    };

    const handleCancelEdit = () => {
        if (!selectedDealership) return;
        setEditForm({ ...selectedDealership, phone: formatPhoneForDisplay(selectedDealership.phone) });
    };

    const handleToggleStatus = () => {
        setConfirmStatusModalOpen(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!selectedDealership) return;
        const newStatus: 'active' | 'inactive' = selectedDealership.status === 'active' ? 'inactive' : 'active';
        const adminToken = getStoredAdminToken();

        if (!adminToken || !selectedDealership.backend_id) {
            alert('Admin backend connection is required to change dealership status.');
            return;
        }

        try {
            const updatedResponse = await updateAdminDealershipStatus(
                adminToken,
                selectedDealership.backend_id,
                newStatus,
            );
            const mapped = mapBackendDealership(updatedResponse);
            await reloadDealerships();
            setSelectedDealership(mapped);
            setEditForm({ ...mapped, phone: formatPhoneForDisplay(mapped.phone) });
            setConfirmStatusModalOpen(false);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Failed to change dealership status.');
        }
    };

    const getDealershipExportRows = () => dealerships.map(d => ({
            ID: d.id,
            LocationName: d.name,
            ContactName: '',
            City: d.city,
            Phone: formatPhoneForDisplay(d.phone),
            Email: d.email,
            Address: d.address,
            ActiveJobCount: getActiveJobCount(d),
            Status: d.status,
            Notes: d.notes || ''
        }));

    const handleExport = (selectedColumns: string[], format: ExportFormat = 'csv') => {
        const exportData = selectColumnsForExport(getDealershipExportRows(), selectedColumns);
        exportArrayData(exportData, 'dealerships_export', format);
    };

    const activeCount = dealerships.filter(d => d.status === 'active').length;
    const inactiveCount = dealerships.filter(d => d.status === 'inactive').length;
    const withNotesCount = dealerships.filter(d => Boolean(d.notes?.trim())).length;
    const getActiveJobCount = (dealership: Dealership) =>
        dealership.recent_jobs.filter((job) => !['completed', 'cancelled', 'refused'].includes(job.status.toLowerCase())).length;

    const handleViewLocationJobs = (dealership: Dealership) => {
        const query = encodeURIComponent(dealership.city || dealership.name);
        navigate(`/admin/jobs?location=${query}`);
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
                                <Building2 className="h-3.5 w-3.5" />
                                Location directory
                            </div>
                            <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.8rem]">
                                Locations
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                                Manage service locations and contacts.
                            </p>
                        </div>
                        <div className="w-full max-w-[680px] xl:self-stretch">
                            <div className="flex h-full flex-col gap-4 xl:items-end xl:justify-between">
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
                                        Last updated: {lastSuccessfulFetchAt ? lastSuccessfulFetchAt.toLocaleTimeString() : 'Never'}
                                    </span>
                                    <Button variant="outline" size="sm" onClick={fetchDealerships} disabled={loading} className="h-10 gap-2 rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white">
                                        <RefreshCw className={cn("w-4 h-4 text-blue-600 dark:text-cyan-200", loading && "animate-spin")} />
                                        Refresh
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setExportModalOpen(true)} className="h-10 gap-2 rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/[0.08] dark:hover:text-white">
                                        <FileDown className="w-4 h-4" /> Export
                                    </Button>
                                    <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" className="h-10 gap-2 rounded-full border border-blue-600 bg-blue-600 px-5 text-white shadow-[0_12px_30px_rgba(37,99,235,0.22)] hover:bg-blue-700 hover:text-white dark:border-[#7db0ff]/40 dark:bg-[#2F8E92] dark:shadow-[0_12px_30px_rgba(47,142,146,0.28)] dark:hover:bg-[#267276]">
                                                <Plus className="w-4 h-4" /> Add Location
                                            </Button>
                                        </DialogTrigger>
                                <DialogContent className="sm:max-w-xl border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                                    <DialogHeader>
                                        <DialogTitle className="text-white">Add New Location</DialogTitle>
                                        <DialogDescription className="text-slate-300">Create a new location profile for dispatch and billing workflows.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <Label className="text-slate-200">Location Name <span className="text-rose-300">*</span></Label>
                                            <Input className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" placeholder="e.g. Metro Ford" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-200">Phone <span className="text-rose-300">*</span></Label>
                                            <Input
                                                className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                                                placeholder={phoneExampleFormat}
                                                value={addForm.phone}
                                                onChange={e => setAddForm({ ...addForm, phone: formatUsPhoneInput(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-200">Email <span className="text-rose-300">*</span></Label>
                                            <Input className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" placeholder="e.g. info@location.com" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-slate-200">City</Label>
                                                <Input className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" placeholder="e.g. Quebec" value={addForm.city} onChange={e => setAddForm({ ...addForm, city: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-200">Postal Code</Label>
                                                <Input className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" placeholder="e.g. G1X 3X4" value={addForm.postal_code} onChange={e => setAddForm({ ...addForm, postal_code: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-200">Address</Label>
                                            <Input className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" placeholder="e.g. 123 Main St" value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-200">Notes</Label>
                                            <Textarea className="rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" placeholder="Access codes, preferred hours, etc." value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                                        <Button onClick={handleAddDealership} className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105">Add Location</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                                </div>
                                <div className="flex w-full flex-col gap-3 xl:max-w-[620px]">
                                    <div className="relative w-full">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            placeholder="Search by location name, contact name, phone, email, or city..."
                                            className="h-11 rounded-full border-white/10 bg-white/[0.04] pl-9 text-slate-100 placeholder:text-slate-500 transition-all focus:bg-white/[0.06]"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger className="h-11 w-full border-white/10 bg-white/[0.04] text-slate-100 sm:w-[160px]">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Status</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select value={filterCity} onValueChange={setFilterCity}>
                                            <SelectTrigger className="h-11 w-full border-white/10 bg-white/[0.04] text-slate-100 sm:w-[190px]">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4" />
                                                    <SelectValue placeholder="City" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Cities</SelectItem>
                                                {cityFilterOptions.map((city) => (
                                                    <SelectItem key={city} value={city}>
                                                        {city}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Card className={metricCardClass('cyan')}>
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Locations</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{dealerships.length}</p>
                                    <p className="text-sm text-slate-300">Total location profiles tracked</p>
                                </div>
                                <div className={metricIconClass('cyan')}>
                                    <Building2 className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className={metricCardClass('emerald')}>
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Active Locations</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{activeCount}</p>
                                    <p className="text-sm text-slate-300">Currently available for dispatch intake</p>
                                </div>
                                <div className={metricIconClass('emerald')}>
                                    <Power className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className={metricCardClass('violet')}>
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Operational Notes</p>
                                    <p className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.06em] text-white">{withNotesCount}</p>
                                    <p className="text-sm text-slate-300">Locations with special dispatch instructions</p>
                                </div>
                                <div className={metricIconClass('violet')}>
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

            {/* 3. Dealerships Table */}
            <Card className={cn(sectionCardClass, 'flex-1 flex flex-col')}>
                <div className={cn(sectionHeaderClass, 'flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between')}>
                    <div>
                        <h2 className="text-base font-semibold text-white">Location Directory</h2>
                        <p className="mt-1 text-sm text-slate-300">Review contact data, routing, job counts, and availability from the live location directory.</p>
                    </div>
                    <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                        {filteredDealerships.length} visible
                    </Badge>
                </div>
                {loading ? (
                    <div className="p-4 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full bg-white/10" />
                        ))}
                    </div>
                ) : filteredDealerships.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="w-16 h-16 bg-white/[0.05] rounded-full flex items-center justify-center mb-4">
                            <Building2 className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">No locations found</h3>
                        <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
                        <Button variant="outline" className="mt-4 border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => { setSearchQuery(''); setFilterStatus('all'); setFilterCity('all'); }}>Clear Filters</Button>
                    </div>
                ) : (
                    <div className="overflow-hidden">
                        <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-6 py-5">
                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Location Board</div>
                                <div className="text-sm text-slate-200">Location records with contact routing, active job counts, and availability status.</div>
                            </div>
                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                                {filteredDealerships.length} visible
                            </Badge>
                        </div>
                        <div className="overflow-auto">
                            <Table className="min-w-[1180px]">
                                <TableHeader className="sticky top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.92))] backdrop-blur-xl">
                                    <TableRow className="border-white/0 hover:bg-transparent">
                                        <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Location Name</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Contact Name</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">City</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Phone</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Email</TableHead>
                                        <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Active Jobs</TableHead>
                                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Status</TableHead>
                                        <TableHead className="w-[64px] pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Open</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDealerships.map((dealer, index) => (
                                        <TableRow
                                            key={dealer.id}
                                            className={cn(
                                                'group cursor-pointer border-b border-white/6 transition-colors hover:bg-white/[0.045]',
                                                index % 2 === 1 && 'bg-white/[0.015]',
                                            )}
                                            onClick={() => handleOpenDrawer(dealer)}
                                        >
                                            <TableCell className="pl-6 py-4">
                                                <div className="space-y-1.5">
                                                    <OverflowText text={dealer.name} className="max-w-[16rem] text-sm font-semibold text-white group-hover:text-cyan-100" />
                                                    <div className="text-xs font-mono text-slate-500">ID: {dealer.id}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="text-sm text-slate-400">Not set</div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-200 capitalize">
                                                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                                                    <span>{dealer.city || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-200">
                                                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                                                    <span>{formatPhoneForDisplay(dealer.phone) || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                                                    <OverflowText text={dealer.email || '-'} className="max-w-[12rem]" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center text-sm text-slate-200">
                                                {getActiveJobCount(dealer)}
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <StatusBadge status={dealer.status} />
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 opacity-100 transition-all hover:bg-white/[0.08] hover:text-white">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="border-white/10 bg-[#091827] text-slate-100">
                                                            <DropdownMenuItem onClick={() => handleOpenDrawer(dealer)}>View Details</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleOpenDrawer(dealer)}>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleViewLocationJobs(dealer)}>View Location Jobs</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className={dealer.status === 'active' ? 'text-rose-200' : ''}
                                                                onClick={() => {
                                                                    handleOpenDrawer(dealer);
                                                                    setConfirmStatusModalOpen(true);
                                                                }}
                                                            >
                                                                {dealer.status === 'active' ? 'Deactivate' : 'Activate'}
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

            {/* 4. Dealership Drawer */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col gap-0 border-white/10 bg-[linear-gradient(180deg,rgba(7,21,37,0.99),rgba(4,13,24,1))] text-slate-100">
                    {selectedDealership && editForm && (
                        <>
                            <div className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <OverflowText text={selectedDealership.name} as="h2" className="max-w-[18rem] text-xl font-bold text-white" />
                                        <StatusBadge status={selectedDealership.status} />
                                    </div>
                                    <div className="text-sm text-slate-400">
                                        {selectedDealership.city || 'No city provided'}
                                    </div>
                                    </div>
                                    <div className="flex items-center justify-start sm:justify-end">
                                        <Button
                                            variant={selectedDealership.status === 'active' ? "outline" : "default"}
                                            size="sm"
                                            className="min-w-[112px] h-10 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                                            onClick={handleToggleStatus}
                                        >
                                            {selectedDealership.status === 'active' ? 'Deactivate' : 'Activate'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-6 space-y-5">

                                    {/* A) Contact Info (Editable) */}
                                    <Card className="border-white/10 bg-white/[0.03] shadow-none">
                                        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2 leading-none">
                                                <Building2 className="w-4 h-4" /> Contact Information
                                            </h3>
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="outline" size="sm" className="h-9 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 text-xs text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white" onClick={handleCancelEdit}>
                                                    Cancel
                                                </Button>
                                                <Button size="sm" className="h-9 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-4 text-xs text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105" onClick={handleSaveEdit}>
                                                    Save Changes
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-slate-400">Location Name</Label>
                                                <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-slate-400">Phone</Label>
                                                <Input
                                                    placeholder={phoneExampleFormat}
                                                    value={editForm.phone}
                                                    onChange={e => setEditForm({ ...editForm, phone: formatUsPhoneInput(e.target.value) })}
                                                    className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                                                />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label className="text-xs text-slate-400">Email</Label>
                                                <Input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-slate-400">City</Label>
                                                <Input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-slate-400">Postal Code</Label>
                                                <Input value={editForm.postal_code} onChange={e => setEditForm({ ...editForm, postal_code: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <Label className="text-xs text-slate-400">Address</Label>
                                                <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500" />
                                            </div>
                                        </div>
                                    </Card>

                                    {/* B) Operational Notes */}
                                    <Card className="border-white/10 bg-white/[0.03] shadow-none">
                                        <div className="border-b border-white/10 px-5 py-4">
                                            <h3 className="text-sm font-bold text-white flex items-center gap-2 leading-none">
                                                <AlertCircle className="w-4 h-4" /> Operational Notes
                                            </h3>
                                        </div>
                                        <div className="px-5 py-5">
                                            <Textarea
                                                value={editForm.notes || ''}
                                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                                className="min-h-[120px] rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500"
                                                placeholder="Gate codes, special instructions, preferred technicians..."
                                            />
                                        </div>
                                    </Card>
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <ColumnExportDialog
                open={exportModalOpen}
                onOpenChange={setExportModalOpen}
                title="Export Locations"
                description="Choose columns to export."
                availableColumns={DEALERSHIP_EXPORT_COLUMNS}
                onConfirm={handleExport}
            />

            {/* 5. Confirm Status Modal */}
            <Dialog open={confirmStatusModalOpen} onOpenChange={setConfirmStatusModalOpen}>
                <DialogContent className="border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.98),rgba(6,17,29,0.98))] text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Power className="w-5 h-5 text-cyan-200" /> Confirm Status Change
                        </DialogTitle>
                        <DialogDescription className="text-slate-300">
                            Are you sure you want to change the status of <strong>{selectedDealership?.name}</strong> to <strong>{selectedDealership?.status === 'active' ? 'Inactive' : 'Active'}</strong>?
                            <br /><br />
                            {selectedDealership?.status === 'active' ? 'Inactive locations cannot receive new jobs.' : 'Active locations will be available for new jobs immediately.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.08]" onClick={() => setConfirmStatusModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmStatusChange} className="bg-[#2F8E92] hover:bg-[#267276]">Confirm Change</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            </div>
        </div>
    );
}
