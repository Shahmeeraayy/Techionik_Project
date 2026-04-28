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

        // Navigate to admin preview mode (NOT technician portal)
        navigate(`/admin/tech-preview/${selectedTechId}`);
        onOpenChange(false);

        // Reset selection for next time
        setTimeout(() => setSelectedTechId(''), 300);
    };

    const handleCancel = () => {
        setSelectedTechId('');
        onOpenChange(false);
    };

    const selectedTech = technicians.find(t => t.id === selectedTechId);
    const activeTechnicians = technicians.filter((tech) => tech.isActive).length;
    const inactiveTechnicians = technicians.length - activeTechnicians;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(7,23,39,0.99),rgba(4,14,25,1))] p-0 text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:max-w-2xl">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,142,146,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_24%)]" />

                <div className="relative border-b border-white/10 px-6 py-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                                Preview Surface
                            </div>
                            <DialogHeader className="space-y-3 text-left">
                                <DialogTitle className="flex items-center gap-3 text-[2rem] font-semibold tracking-[-0.06em] text-white" style={displayFontStyle}>
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/12 text-cyan-100">
                                        <Eye className="h-5 w-5" />
                                    </div>
                                    Preview Technician Portal
                                </DialogTitle>
                                <DialogDescription className="max-w-xl text-sm leading-6 text-slate-300" style={bodyFontStyle}>
                                    Open a technician-facing preview without leaving the admin workspace. This keeps your admin role intact while you inspect the field portal experience.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="rounded-full border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                                    {technicians.length} roster entries
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                                    {activeTechnicians} active
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">
                                    {inactiveTechnicians} inactive
                                </Badge>
                            </div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Access Layer</div>
                            <div className="mt-2 flex items-center justify-end gap-2 text-sm font-medium text-emerald-100">
                                <Shield className="h-4 w-4 text-emerald-200" />
                                Admin protected preview
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative space-y-5 px-6 py-6">
                    <div className="rounded-[24px] border border-orange-300/18 bg-[linear-gradient(180deg,rgba(55,29,12,0.86),rgba(34,20,9,0.9))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-300/18 bg-orange-300/10 text-orange-100">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-semibold text-orange-50">Preview Mode Notice</p>
                                <p className="text-xs leading-6 text-orange-100/85" style={bodyFontStyle}>
                                    You remain logged in as admin. This view is for monitoring, QA, and support only. Technician permissions are not elevated and your admin session does not change.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <Label htmlFor="technician-select" className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                                    Select Technician
                                </Label>
                                <p className="mt-1 text-sm text-slate-300">Choose which portal state you want to inspect from the admin side.</p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-100">
                                <UserRound className="h-4 w-4" />
                            </div>
                        </div>
                        <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                            <SelectTrigger id="technician-select" className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white shadow-none focus:ring-cyan-300/20">
                                <SelectValue placeholder="Choose a technician..." />
                            </SelectTrigger>
                            <SelectContent>
                                {technicians.map((tech) => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2F8E92] text-[11px] font-bold text-white">
                                                {tech.avatar}
                                            </div>
                                            <div className="flex flex-col">
                                                <span>{tech.name}{tech.code ? ` (${tech.code})` : ''}</span>
                                                <span className="text-[11px] text-muted-foreground">{tech.email}</span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedTech ? (
                        <div className="rounded-[26px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(10,35,48,0.92),rgba(6,24,35,0.96))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-cyan-300/20 bg-cyan-300/12 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
                                        {selectedTech.avatar}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Previewing As</div>
                                        <div className="text-xl font-semibold tracking-[-0.04em] text-white" style={displayFontStyle}>
                                            {selectedTech.name}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className={selectedTech.isActive ? 'rounded-full border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100' : 'rounded-full border-slate-300/20 bg-slate-300/10 px-3 py-1 text-slate-300'}>
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
                                        <Mail className="h-4 w-4 text-cyan-200" />
                                        {selectedTech.email || 'No email on file'}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-emerald-200" />
                                        {selectedTech.phone || 'No phone on file'}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 rounded-[22px] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-6 text-slate-300" style={bodyFontStyle}>
                                You’ll see the technician’s assigned jobs, available jobs, and portal layout while preserving the admin session and monitoring context.
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
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-cyan-100">
                                <Eye className="h-5 w-5" />
                            </div>
                            <div className="mt-4 text-base font-semibold text-white" style={displayFontStyle}>Choose a technician to continue</div>
                            <p className="mt-2 text-sm leading-6 text-slate-400" style={bodyFontStyle}>
                                Once selected, you’ll get a live preview summary before entering the technician portal view.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t border-white/10 bg-black/10 px-6 py-5 sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] px-5 text-slate-100 hover:bg-white/[0.08] hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEnterPreview}
                        disabled={!selectedTechId || technicians.length === 0}
                        className="h-11 rounded-2xl bg-[linear-gradient(90deg,#18c8c8,#2ba0d7)] px-5 text-slate-950 hover:opacity-95"
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
