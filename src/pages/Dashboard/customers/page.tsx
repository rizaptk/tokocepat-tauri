import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, Layers, Search, CreditCard, Printer, Save, ChevronRight, UserCog, X } from 'lucide-react';
import { saveCustomer, deleteCustomer, saveCustomerGroup, deleteCustomerGroup, generateCustomerId, generateGroupId } from '@/services/customerService';
import { useToast } from '@/hooks/use-toast';
import { Customer, CustomerGroup } from '@/lib/types';
import { CustomerCardPreview } from '@/components/CustomerCardPreview';
import { buildCustomerCardPdfBytes } from '@/lib/customerCardPdf';
import { PdfPreviewSheet } from '@/components/PdfPreviewSheet';
import { usePdfGeneration, PdfGeneratingOverlay } from '@/hooks/usePdfGeneration';
import { TokoCepatLogo } from '@/components/TokoCepatLogo';
import { ThemeToggle } from '@/components/ThemeButtons';
import { NotificationBell } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';

type RightTab = 'customers' | 'groups';

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "rounded-md px-3 h-11 md:h-7 shrink-0 text-xs",
                active ? "bg-background text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "rounded-md px-3 h-11 md:h-7 shrink-0 text-xs gap-1.5 flex-1",
                active ? "bg-background text-foreground ring-1 ring-inset ring-border" : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

export default function CustomersPage() {
    const { customers, customerGroups, storeConfig } = useStore();
    const { toast } = useToast();
    const [rightTab, setRightTab] = useState<RightTab>('customers');
    const [selectedCard, setSelectedCard] = useState<Customer | null>(null);
    const [isCardOpen, setIsCardOpen] = useState(false);
    const [isPrintingCard, setIsPrintingCard] = useState(false);
    const pdf = usePdfGeneration();

    // ===== Customer list state (left panel, always visible) =====
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerGroupFilter, setCustomerGroupFilter] = useState<string>('all');
    const filteredCustomers = useMemo(() => {
        let list = customers;
        if (customerGroupFilter !== 'all') list = list.filter(c => c.groupId === customerGroupFilter);
        if (customerSearch.trim()) {
            const q = customerSearch.trim().toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.phone || '').toLowerCase().includes(q) ||
                c.id.toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }, [customers, customerSearch, customerGroupFilter]);

    // ===== Customer form (right panel — tab Pelanggan, always visible) =====
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
        name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0,
    });
    const canEditCustomer = !!editingCustomer || isCreatingCustomer;
    const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState<string | null>(null);

    const openNewCustomer = () => {
        setEditingCustomer(null);
        setIsCreatingCustomer(true);
        setCustomerForm({ name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0 });
    };

    const closeCustomerForm = () => {
        setEditingCustomer(null);
        setIsCreatingCustomer(false);
        setCustomerForm({ name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0 });
    };

    const openEditCustomer = (c: Customer) => {
        setEditingCustomer(c);
        setIsCreatingCustomer(false);
        setCustomerForm({
            name: c.name, phone: c.phone || '', address: c.address || '',
            groupId: c.groupId || 'grp-umum', topDays: c.topDays ?? 0,
        });
    };

    const handleSaveCustomer = async () => {
        if (!customerForm.name?.trim()) { toast({ variant: 'destructive', title: 'Nama wajib diisi' }); return; }
        const cust: Customer = {
            id: editingCustomer?.id || generateCustomerId(),
            name: customerForm.name!.trim(),
            phone: customerForm.phone?.trim() || undefined,
            address: customerForm.address?.trim() || undefined,
            groupId: customerForm.groupId || undefined,
            topDays: customerForm.topDays ?? 0,
            creditLimit: customerForm.creditLimit,
            is_active: true,
            created_at: editingCustomer?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await saveCustomer(cust);
        toast({ title: 'Pelanggan disimpan', description: cust.name });
        setEditingCustomer(cust);
        setIsCreatingCustomer(false);
        setCustomerForm({
            name: cust.name, phone: cust.phone || '', address: cust.address || '',
            groupId: cust.groupId || 'grp-umum', topDays: cust.topDays ?? 0,
        });
    };

    const handleDeleteCustomer = async (id: string) => {
        await deleteCustomer(id);
        toast({ title: 'Pelanggan dihapus' });
        if (editingCustomer?.id === id) closeCustomerForm();
        setConfirmDeleteCustomerId(null);
    };

    // ===== Group form (right panel — tab Grup, uses modal like Kategori) =====
    const sortedGroups = useMemo(
        () => [...customerGroups].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)),
        [customerGroups]
    );

    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
    const [groupForm, setGroupForm] = useState<Partial<CustomerGroup>>({ name: '', topDays: 0, rank: 0 });
    const [groupSearch, setGroupSearch] = useState('');
    const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

    const filteredGroups = useMemo(() => {
        if (!groupSearch.trim()) return sortedGroups;
        const q = groupSearch.trim().toLowerCase();
        return sortedGroups.filter(g => g.name.toLowerCase().includes(q));
    }, [sortedGroups, groupSearch]);

    const memberCountByGroup = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of customers) {
            const gid = c.groupId || 'grp-umum';
            m.set(gid, (m.get(gid) || 0) + 1);
        }
        return m;
    }, [customers]);

    const openAddGroup = () => {
        setEditingGroup(null);
        setGroupForm({ name: '', topDays: 0, rank: customerGroups.length });
        setGroupModalOpen(true);
    };

    const openEditGroup = (g: CustomerGroup) => {
        setEditingGroup(g);
        setGroupForm({ name: g.name, topDays: g.topDays, rank: g.rank });
        setGroupModalOpen(true);
    };

    const handleSaveGroup = async () => {
        if (!groupForm.name?.trim()) { toast({ variant: 'destructive', title: 'Nama grup wajib diisi' }); return; }
        const grp: CustomerGroup = {
            id: editingGroup?.id || generateGroupId(),
            name: groupForm.name!.trim(),
            rank: groupForm.rank ?? 0,
            topDays: groupForm.topDays ?? 0,
            is_active: true,
            created_at: editingGroup?.created_at || new Date().toISOString(),
        };
        await saveCustomerGroup(grp);
        toast({ title: 'Grup disimpan', description: grp.name });
        setGroupModalOpen(false);
    };

    const handleDeleteGroup = async (id: string) => {
        await deleteCustomerGroup(id);
        toast({ title: 'Grup dihapus' });
        setConfirmDeleteGroupId(null);
    };

    // ===== Print card =====
    const handlePrintCard = (customer: Customer) => {
        setSelectedCard(customer);
        setIsCardOpen(true);
    };

    const handleConfirmPrint = async () => {
        if (!selectedCard) return;
        try {
            setIsPrintingCard(true);
            const group = customerGroups.find(g => g.id === selectedCard.groupId);
            pdf.setTitle('CustomerCard');
            pdf.setFilename('customercard.pdf');
            pdf.start('CustomerCard');
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            const bytes = await buildCustomerCardPdfBytes(selectedCard, group, storeConfig as any);
            pdf.finish(bytes as unknown as Uint8Array);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Gagal cetak', description: e?.message || String(e) });
        } finally {
            setIsPrintingCard(false);
        }
    };

    return (
        <div className="flex h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 z-20 flex h-10 items-center gap-4 border-b border-border/60 bg-background/80 px-4 justify-between shrink-0 backdrop-blur-md">
                <Link to="/" aria-label="Kembali ke beranda">
                    <TokoCepatLogo />
                </Link>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            <div className="w-full min-h-0 flex-1 md:grid md:grid-cols-10">
                {/* LEFT: ALWAYS customers table + search/filter (mirrors Product page left panel) */}
                <div className="col-span-10 md:col-span-6 lg:col-span-6 flex h-full flex-col min-h-0 bg-background">
                    <div className="px-3 pt-3 pb-2 flex flex-col w-full gap-2 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" aria-hidden />
                            <Input
                                value={customerSearch}
                                onChange={e => setCustomerSearch(e.target.value)}
                                placeholder="Cari nama / telepon / scan ID..."
                                className="pl-9 pr-9 h-8 bg-card"
                                aria-label="Cari pelanggan"
                            />
                            {customerSearch && (
                                <button
                                    type="button"
                                    onClick={() => setCustomerSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    aria-label="Hapus pencarian"
                                >
                                    <X className="size-3.5" aria-hidden />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,black_88%,transparent)]" role="tablist" aria-label="Filter grup">
                            <FilterPill active={customerGroupFilter === 'all'} onClick={() => setCustomerGroupFilter('all')}>Semua</FilterPill>
                            {customerGroups.map(g => (
                                <FilterPill key={g.id} active={customerGroupFilter === g.id} onClick={() => setCustomerGroupFilter(g.id)}>{g.name}</FilterPill>
                            ))}
                        </div>
                    </div>
                    <div className="grow min-h-0 overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-card border-b">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Nama</TableHead>
                                    <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Grup</TableHead>
                                    <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">TOP</TableHead>
                                    <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Telepon</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-40 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                                                <Users className="size-8 opacity-30" aria-hidden />
                                                <p className="text-sm font-medium">{customers.length === 0 ? 'Belum ada pelanggan.' : 'Tidak ada pelanggan yang cocok.'}</p>
                                                <p className="text-xs max-w-[28ch]">{customers.length === 0 ? 'Tambah pelanggan pertama lewat panel kanan.' : `Tidak ada hasil untuk "${customerSearch}". Coba kata kunci lain atau filter grup.`}</p>
                                                {customerSearch && <Button variant="outline" size="sm" className="mt-1 h-7" onClick={() => setCustomerSearch('')}>Hapus filter</Button>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredCustomers.map(c => {
                                    const g = customerGroups.find(gr => gr.id === c.groupId);
                                    const top = c.topDays ?? g?.topDays ?? 0;
                                    const isSelected = editingCustomer?.id === c.id;
                                    return (
                                        <TableRow
                                            key={c.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-selected={isSelected}
                                            aria-label={`Pilih pelanggan ${c.name}`}
                                            onClick={() => { openEditCustomer(c); setRightTab('customers'); }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    openEditCustomer(c);
                                                    setRightTab('customers');
                                                }
                                            }}
                                            className={cn('cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset', isSelected && 'bg-primary/10 hover:bg-primary/15')}
                                        >
                                            <TableCell className="font-medium py-3 md:py-2.5">
                                                <span className="flex items-center gap-2">
                                                    {isSelected && <ChevronRight className="size-3.5 text-primary shrink-0" aria-hidden />}
                                                    {c.name}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-3 md:py-2.5">{g ? <Badge variant="secondary">{g.name}</Badge> : <span className="text-muted-foreground">Umum</span>}</TableCell>
                                            <TableCell className="py-3 md:py-2.5">{top === 0 ? 'COD' : `${top} hari`}</TableCell>
                                            <TableCell className="py-3 md:py-2.5 text-muted-foreground">{c.phone || '—'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="hidden md:flex px-3 pb-2 pt-1 items-center gap-3 text-[11px] text-muted-foreground shrink-0" aria-live="polite" aria-atomic="true">
                        <span className="flex items-center gap-1.5">
                            <Users className="size-3.5" aria-hidden /> {filteredCustomers.length} pelanggan
                        </span>
                        <span className="hidden lg:inline">Klik baris atau tekan Enter untuk mengedit.</span>
                    </div>
                    <div className="flex md:hidden px-3 pb-3 pt-1 text-[11px] text-muted-foreground shrink-0" aria-live="polite">
                        <span>{filteredCustomers.length} pelanggan · ketuk baris untuk mengedit.</span>
                    </div>
                </div>

                {/* RIGHT: tab Pelanggan | Grup + content (mirrors Product page right panel) */}
                <aside className="col-span-10 md:col-span-4 lg:col-span-4 h-full min-h-0 flex flex-col bg-card md:border-l border-border/60">
                    <div className="px-3 pt-3 pb-2 shrink-0">
                        <div className="flex items-center gap-1.5 bg-muted/60 rounded-md p-1" role="tablist" aria-label="Mode pelanggan">
                            <PillButton active={rightTab === 'customers'} onClick={() => setRightTab('customers')}>
                                <UserCog className="size-3.5" aria-hidden /> Pelanggan
                            </PillButton>
                            <PillButton active={rightTab === 'groups'} onClick={() => setRightTab('groups')}>
                                <Layers className="size-3.5" aria-hidden /> Grup
                            </PillButton>
                        </div>
                    </div>

                    {rightTab === 'customers' ? (
                        <>
                            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
                                <h2 className="font-semibold text-sm">
                                    {editingCustomer ? 'Ubah Pelanggan' : isCreatingCustomer ? 'Pelanggan Baru' : 'Detail Pelanggan'}
                                </h2>
                                {!editingCustomer && !isCreatingCustomer ? (
                                    <Button size="sm" onClick={openNewCustomer} className="h-9 md:h-7">
                                        <Plus className="mr-1 size-3.5" aria-hidden /> Baru
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="icon" className="size-11 md:size-7 shrink-0" onClick={closeCustomerForm} aria-label="Tutup form pelanggan">
                                        <ChevronRight className="size-4 md:size-3.5 rotate-90 md:rotate-0" aria-hidden />
                                        <span className="sr-only">Tutup</span>
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 overflow-auto p-5 space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="cust-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nama <span className="text-destructive" aria-hidden>*</span></Label>
                                    <Input
                                        id="cust-name"
                                        value={customerForm.name || ''}
                                        onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                                        placeholder="cth. Toko Sumber Rezeki"
                                        aria-required="true"
                                        disabled={!canEditCustomer}
                                    />
                                    {!canEditCustomer && (
                                        <p className="text-xs text-muted-foreground">Pilih baris di tabel atau klik Baru untuk mengisi form.</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cust-group" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grup</Label>
                                    <Select value={customerForm.groupId || 'grp-umum'} onValueChange={v => setCustomerForm({ ...customerForm, groupId: v })} disabled={!canEditCustomer}>
                                        <SelectTrigger id="cust-group" aria-label="Pilih grup pelanggan"><SelectValue placeholder="Umum" /></SelectTrigger>
                                        <SelectContent>
                                            {customerGroups.map(g => (
                                                <SelectItem key={g.id} value={g.id}>
                                                    {g.name} ({g.topDays === 0 ? 'COD' : `${g.topDays} hari`})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cust-top" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">TOP Override (0 = ikut grup)</Label>
                                    <Input
                                        id="cust-top"
                                        type="number"
                                        inputMode="numeric"
                                        value={customerForm.topDays ?? 0}
                                        onChange={e => setCustomerForm({ ...customerForm, topDays: Number(e.target.value) || 0 })}
                                        disabled={!canEditCustomer}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cust-phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telepon</Label>
                                    <Input
                                        id="cust-phone"
                                        type="tel"
                                        inputMode="tel"
                                        value={customerForm.phone || ''}
                                        onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                        placeholder="08xxx"
                                        disabled={!canEditCustomer}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cust-address" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alamat</Label>
                                    <Input
                                        id="cust-address"
                                        value={customerForm.address || ''}
                                        onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                                        placeholder="(opsional)"
                                        disabled={!canEditCustomer}
                                    />
                                </div>
                                {editingCustomer && (
                                    <dl className="rounded-md border bg-muted/30 p-3 text-xs">
                                        <div className="flex justify-between py-0.5"><dt className="text-muted-foreground">ID</dt><dd className="font-mono text-foreground">{editingCustomer.id}</dd></div>
                                        <div className="flex justify-between py-0.5"><dt className="text-muted-foreground">Dibuat</dt><dd className="text-foreground">{new Date(editingCustomer.created_at).toLocaleDateString('id-ID')}</dd></div>
                                        {editingCustomer.updated_at && (
                                            <div className="flex justify-between py-0.5"><dt className="text-muted-foreground">Diubah</dt><dd className="text-foreground">{new Date(editingCustomer.updated_at).toLocaleDateString('id-ID')}</dd></div>
                                        )}
                                    </dl>
                                )}
                            </div>

                            {canEditCustomer && (
                                <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex items-center gap-2 shrink-0">
                                    <Button className="flex-1 h-11 md:h-9" onClick={handleSaveCustomer} disabled={!customerForm.name?.trim()}>
                                        <Save className="mr-2 size-4" aria-hidden /> Simpan
                                    </Button>
                                    {editingCustomer && (
                                        <>
                                            <Button variant="outline" size="icon" className="shrink-0 size-11 md:size-9" onClick={() => handlePrintCard(editingCustomer)} aria-label={`Cetak kartu ${editingCustomer.name}`}>
                                                <CreditCard className="size-4" aria-hidden />
                                            </Button>
                                            <Button variant="outline" size="icon" className="shrink-0 size-11 md:size-9 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirmDeleteCustomerId(editingCustomer.id)} aria-label={`Hapus pelanggan ${editingCustomer.name}`}>
                                                <Trash2 className="size-4" aria-hidden />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 min-h-0 flex flex-col">
                            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
                                <h2 className="font-semibold text-sm">Kelola Grup</h2>
                                <Button size="sm" onClick={openAddGroup} className="h-9 md:h-7">
                                    <Plus className="mr-1 size-3.5" aria-hidden /> Tambah
                                </Button>
                            </div>
                            <div className="px-3 pt-2 pb-1 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" aria-hidden />
                                    <Input
                                        value={groupSearch}
                                        onChange={e => setGroupSearch(e.target.value)}
                                        placeholder="Cari nama grup..."
                                        className="pl-9 pr-9 h-8 bg-background"
                                        aria-label="Cari grup"
                                    />
                                    {groupSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setGroupSearch('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            aria-label="Hapus pencarian grup"
                                        >
                                            <X className="size-3.5" aria-hidden />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grow min-h-0 overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-card border-b">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6">Nama Grup</TableHead>
                                            <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6 text-right">Anggota</TableHead>
                                            <TableHead scope="col" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground h-6 w-24 text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredGroups.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-40 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                                                        <Layers className="size-8 opacity-30" aria-hidden />
                                                        <p className="text-sm font-medium">{groupSearch.trim() ? 'Tidak ada grup yang cocok.' : 'Belum ada grup.'}</p>
                                                        {groupSearch.trim() ? <Button variant="outline" size="sm" className="mt-1 h-7" onClick={() => setGroupSearch('')}>Hapus filter</Button> : <p className="text-xs">Klik Tambah untuk buat grup baru.</p>}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredGroups.map(g => {
                                            const memberCount = memberCountByGroup.get(g.id) || 0;
                                            return (
                                                <TableRow key={g.id} className="hover:bg-muted/40">
                                                    <TableCell className="font-medium py-3 md:py-2.5">
                                                        <div>{g.name}</div>
                                                        <div className="text-xs text-muted-foreground">Rank {g.rank} · {g.topDays === 0 ? 'COD' : `${g.topDays} hari`}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground py-3 md:py-2.5">{memberCount}</TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="size-11 md:size-8 shrink-0" onClick={() => openEditGroup(g)} aria-label={`Ubah grup ${g.name}`}>
                                                                <Save className="size-4 md:size-3.5" aria-hidden />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="size-11 md:size-8 shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirmDeleteGroupId(g.id)} aria-label={`Hapus grup ${g.name}`}>
                                                                <Trash2 className="size-4 md:size-3.5" aria-hidden />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* ====== MODAL: Group form (mirrors Product kategori pattern) ====== */}
            <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? 'Ubah Grup' : 'Tambah Grup'}</DialogTitle>
                        <DialogDescription className="sr-only">Form grup grosir</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="grp-name">Nama Grup <span className="text-destructive" aria-hidden>*</span></Label>
                            <Input
                                id="grp-name"
                                autoFocus
                                value={groupForm.name || ''}
                                onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                                placeholder="cth. Agen"
                                aria-required="true"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="grp-top">TOP (hari, 0=COD)</Label>
                            <Input
                                id="grp-top"
                                type="number"
                                inputMode="numeric"
                                value={groupForm.topDays ?? 0}
                                onChange={e => setGroupForm({ ...groupForm, topDays: Number(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="grp-rank">Rank (urutan)</Label>
                            <Input
                                id="grp-rank"
                                type="number"
                                inputMode="numeric"
                                value={groupForm.rank ?? 0}
                                onChange={e => setGroupForm({ ...groupForm, rank: Number(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setGroupModalOpen(false)}>Batal</Button>
                        <Button onClick={handleSaveGroup} disabled={!groupForm.name?.trim()}>
                            <Save className="mr-2 size-4" aria-hidden /> Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!confirmDeleteCustomerId} onOpenChange={(o) => !o && setConfirmDeleteCustomerId(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Hapus Pelanggan?</DialogTitle>
                        <DialogDescription>Tindakan ini tidak dapat dibatalkan. Pelanggan akan dihapus dari daftar.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setConfirmDeleteCustomerId(null)}>Batal</Button>
                        <Button variant="destructive" onClick={() => confirmDeleteCustomerId && handleDeleteCustomer(confirmDeleteCustomerId)}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!confirmDeleteGroupId} onOpenChange={(o) => !o && setConfirmDeleteGroupId(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Hapus Grup?</DialogTitle>
                        <DialogDescription>Grup yang dihapus akan melepas keanggotaan pelanggannya.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setConfirmDeleteGroupId(null)}>Batal</Button>
                        <Button variant="destructive" onClick={() => confirmDeleteGroupId && handleDeleteGroup(confirmDeleteGroupId)}>Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCardOpen} onOpenChange={setIsCardOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader><DialogTitle>Kartu Pelanggan — Kastoko</DialogTitle><DialogDescription>1 sisi · Desain premium ATM · ID &amp; barcode · Pratinjau PDF</DialogDescription></DialogHeader>
                    {selectedCard && <CustomerCardPreview customer={selectedCard} group={customerGroups.find(g => g.id === selectedCard.groupId)} />}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCardOpen(false)}>Tutup</Button>
                        <Button onClick={handleConfirmPrint} disabled={isPrintingCard}>
                            {isPrintingCard ? 'Memuat...' : <><Printer className="h-4 w-4 mr-1" aria-hidden /> Cetak</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <PdfPreviewSheet open={pdf.previewOpen} onOpenChange={pdf.setPreviewOpen} pdfBytes={pdf.pdfBytes} title={selectedCard ? `Kartu — ${selectedCard.name}` : 'Kartu Pelanggan'} filename={selectedCard ? `kartu-${selectedCard.id}.pdf` : 'kartu.pdf'} />
            <PdfGeneratingOverlay open={pdf.open} onCancel={pdf.cancel} title={pdf.title} elapsedMs={pdf.elapsedMs} pageCount={pdf.pageCount} />
        </div>
    );
}
