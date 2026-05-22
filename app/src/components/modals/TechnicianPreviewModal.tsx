import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, AlertTriangle, ArrowRight, Mail, Phone, Shield, Sparkles, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TechnicianPreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface PreviewTechnician {
    id: string;
    name: string;
    avatar: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
    code?: string;
}

const displayFontStyle: CSSProperties = {
    fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};

const bodyFontStyle: CSSProperties = {
    fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};

const getInitials = (name: string) =>
    name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

export function TechnicianPreviewModal({ open, onOpenChange }: TechnicianPreviewModalProps) {
    const { technicianAccounts } = useAuth();
    const [technicians, setTechnicians] = useState<PreviewTechnician[]>([]);
    const [selectedTechId, setSelectedTechId] = useState<string>('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!open) return;

        const mapped = technicianAccounts.map((tech) => ({
            id: tech.id,
            name: tech.name,
            avatar: getInitials(tech.name),
            email: tech.email,
            phone: tech.phone,
            isActive: tech.isActive,
            code: undefined,
        }));

        setTechnicians(mapped);
    }, [open, technicianAccounts]);

    useEffect(() => {
        if (!selectedTechId) return;
        if (technicians.some((tech) => tech.id === selectedTechId)) return;
        setSelectedTechId('');
    }, [technicians, selectedTechId]);

    const handleEnterPreview = () => {
        if (!selectedTechId) return;

        navigate(`/admin/tech-preview/${selectedTechId}`);
        onOpenChange(false);
        setTimeout(() => setSelectedTechId(''), 300);
    };

    const handleCancel = () => {
        setSelectedTechId('');
        onOpenChange(false);
    };

    const selectedTech = technicians.find((t) => t.id === selectedTechId);
    const activeTechnicians = technicians.filter((tech) => tech.isActive).length;
    const inactiveTechnicians = technicians.length - activeTechnicians;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,36,0.99),rgba(8,12,20,1))] p-0 text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:max-w-[760px]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.08),transparent_24%)]" />

                <div className="relative border-b border-white/10 px-6 py-6">
                    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start sm:gap-6">
                        <div className="min-w-0 space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                                <Sparkles className="h-3.5 w-3.5 text-white" />
                                Preview Surface
                            </div>
                            <DialogHeader className="space-y-3 text-left">
                                <DialogTitle className="flex items-center gap-4 text-[2rem] font-semibold tracking-[-0.06em] text-white" style={displayFontStyle}>
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
                                        <Eye className="h-5 w-5" />
                                    </div>
                                    Preview Technician Portal
                                </DialogTitle>
                                <DialogDescription className="max-w-xl text-sm leading-6 text-slate-300" style={bodyFontStyle}>
                                    Preview the technician portal.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-white">
                                    {technicians.length} roster entries
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-white">
                                    {activeTechnicians} active
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                                    {inactiveTechnicians} inactive
                                </Badge>
                            </div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <div className="text-right text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Access Layer</div>
                            <div className="mt-3 grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 text-sm font-medium text-white">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                                    <Shield className="h-4 w-4 text-white" />
                                </div>
                                <div className="text-right leading-6">
                                    Admin protected preview
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="admin-dark-scrollbar relative max-h-[calc(90vh-208px)] space-y-5 overflow-y-auto px-6 py-6">
                    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-semibold text-white">Preview Mode Notice</p>
                                <p className="text-xs leading-6 text-slate-300" style={bodyFontStyle}>
                                    Admin session stays active.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)]">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <Label htmlFor="technician-select" className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    Select Technician
                                </Label>
                                <p className="mt-1 text-sm text-slate-300">Choose a technician.</p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white">
                                <UserRound className="h-4 w-4" />
                            </div>
                        </div>
                        <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                            <SelectTrigger
                                id="technician-select"
                                className="h-14 rounded-[20px] border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] px-3 text-white shadow-none focus:border-[#7db0ff]/45 focus:ring-[#7db0ff]/20 data-[placeholder]:text-slate-400 [&_[data-slot=select-value]]:w-full [&_[data-slot=select-value]>div]:flex [&_[data-slot=select-value]>div]:min-w-0 [&_[data-slot=select-value]>div]:items-center [&_[data-slot=select-value]>div]:gap-3 [&_[data-slot=select-value]>div>div:last-child]:min-w-0 [&_[data-slot=select-value]>div>div:last-child]:text-left"
                            >
                                <SelectValue placeholder="Choose a technician..." />
                            </SelectTrigger>
                            <SelectContent className="admin-dark-scrollbar rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
                                {technicians.map((tech) => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold text-white">
                                                {tech.avatar}
                                            </div>
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate">{tech.name}{tech.code ? ` (${tech.code})` : ''}</span>
                                                <span className="truncate text-[11px] text-muted-foreground">{tech.email}</span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedTech ? (
                        <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.04] text-sm font-semibold uppercase tracking-[0.18em] text-white">
                                        {selectedTech.avatar}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Previewing As</div>
                                        <div className="text-xl font-semibold tracking-[-0.04em] text-white" style={displayFontStyle}>
                                            {selectedTech.name}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-white">
                                                {selectedTech.isActive ? 'Active account' : 'Inactive account'}
                                            </Badge>
                                            <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                                                Portal preview only
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-300">
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-white" />
                                        {selectedTech.email || 'No email on file'}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-white" />
                                        {selectedTech.phone || 'No phone on file'}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 rounded-[22px] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-6 text-slate-300" style={bodyFontStyle}>
                                You'll see the technician's assigned jobs, available jobs, and portal layout while preserving the admin session and monitoring context.
                            </div>
                        </div>
                    ) : technicians.length === 0 ? (
                        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.04] text-slate-300">
                                <UserRound className="h-5 w-5" />
                            </div>
                            <div className="mt-4 text-lg font-semibold text-white" style={displayFontStyle}>No technicians available to preview</div>
                            <p className="mt-2 text-sm leading-6 text-slate-400" style={bodyFontStyle}>
                                Add or sync technician accounts first, then reopen preview mode to inspect a live technician portal state.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-[26px] border border-dashed border-white/12 bg-white/[0.02] p-6 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white">
                                <Eye className="h-5 w-5" />
                            </div>
                            <div className="mt-4 text-base font-semibold text-white" style={displayFontStyle}>Choose a technician to continue</div>
                            <p className="mt-2 text-sm leading-6 text-slate-400" style={bodyFontStyle}>
                                Once selected, you'll get a live preview summary before entering the technician portal view.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-3 border-t border-white/10 bg-black/10 px-6 py-5 sm:flex-row">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="h-11 rounded-2xl border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-5 text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-[linear-gradient(180deg,rgba(24,38,64,0.98),rgba(12,20,34,0.98))] hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEnterPreview}
                        disabled={!selectedTechId || technicians.length === 0}
                        className="h-11 rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] px-5 text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105"
                    >
                        <Eye className="mr-2 h-4 w-4" />
                        Enter Preview Mode
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
