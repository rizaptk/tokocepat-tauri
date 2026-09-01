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
import { Plus, Trash2, Users, Layers, Search, CreditCard, Printer, Save, Edit, ChevronRight, UserCog, PackageSearch } from 'lucide-react';
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
                "rounded-md px-2.5 h-7 shrink-0 text-xs",
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
                "rounded-md px-2.5 h-7 shrink-0 text-xs gap-1.5 flex-1",
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
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [customers, customerSearch, customerGroupFilter]);

    // ===== Customer form (right panel — tab Pelanggan, always visible) =====
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
        name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0,
    });
    const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState<string | null>(null);

    const openNewCustomer = () => {
        setEditingCustomer(null);
        setCustomerForm({ name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0 });
    };

    const openEditCustomer = (c: Customer) => {
        setEditingCustomer(c);
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
        setCustomerForm({
            name: cust.name, phone: cust.phone || '', address: cust.address || '',
            groupId: cust.groupId || 'grp-umum', topDays: cust.topDays ?? 0,
        });
    };

    const handleDeleteCustomer = async (id: string) => {
        await deleteCustomer(id);
        toast({ title: 'Pelanggan dihapus' });
        if (editingCustomer?.id === id) openNewCustomer();
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
            await new Promise(r => setTimeout(r, 30));
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
                <Link to="/">
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
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                            <Input
                                value={customerSearch}
                                onChange={e => setCustomerSearch(e.target.value)}
                                placeholder="Cari nama / telepon / ID..."
                                className="pl-9 h-8 bg-card"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Grup</TableHead>
                                    <TableHead>TOP</TableHead>
                                    <TableHead>Telepon</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCustomers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                            {customers.length === 0 ? 'Belum ada pelanggan.' : 'Tidak ada pelanggan yang cocok.'}
                                        </TableCell>
                                    </TableRow>
                                ) : filteredCustomers.map(c => {
                                    const g = customerGroups.find(gr => gr.id === c.groupId);
                                    const top = c.topDays ?? g?.topDays ?? 0;
                                    const isSelected = editingCustomer?.id === c.id;
                                    return (
                                        <TableRow
                                            key={c.id}
                                            className={cn('cursor-pointer', isSelected && 'bg-primary/10 hover:bg-primary/15')}
                                            onClick={() => { openEditCustomer(c); setRightTab('customers'); }}
                                        >
                                            <TableCell className="font-medium py-2.5">
                                                <div className="flex items-center gap-2">
                                                    {isSelected && <ChevronRight className="size-3.5 text-primary" />}
                                                    {c.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2.5">{g ? <Badge variant="secondary">{g.name}</Badge> : <span className="text-muted-foreground">Umum</span>}</TableCell>
                                            <TableCell className="py-2.5">{top === 0 ? 'COD' : `${top} hari`}</TableCell>
                                            <TableCell className="py-2.5 text-muted-foreground">{c.phone || '—'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    {window.innerWidth >= 768 && (
                        <div className="px-3 pb-2 pt-1 flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                            <span className="flex items-center gap-1.5">
                                <Users className="size-3.5" /> {filteredCustomers.length} pelanggan
                            </span>
                            <span>Klik baris untuk mengedit.</span>
                        </div>
                    )}
                </div>

                {/* RIGHT: tab Pelanggan | Grup + content (mirrors Product page right panel) */}
                <aside className="col-span-10 md:col-span-4 lg:col-span-4 h-full min-h-0 flex flex-col bg-card md:border-l border-border/60">
                    <div className="px-3 pt-3 pb-2 shrink-0">
                        <div className="flex items-center gap-1.5 bg-muted/60 rounded-md p-1">
                            <PillButton active={rightTab === 'customers'} onClick={() => setRightTab('customers')}>
                                <UserCog className="size-3.5" /> Pelanggan
                            </PillButton>
                            <PillButton active={rightTab === 'groups'} onClick={() => setRightTab('groups')}>
                                <Layers className="size-3.5" /> Grup
                            </PillButton>
                        </div>
                    </div>

                    {rightTab === 'customers' ? (
                        <>
                            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-sm">
                                    {editingCustomer ? 'Ubah Pelanggan' : 'Detail Pelanggan'}
                                </h3>
                                {!editingCustomer && (
                                    <Button size="sm" onClick={openNewCustomer} className="h-7">
                                        <Plus className="mr-1 size-3.5" /> Baru
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 overflow-auto p-5 space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="cust-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nama *</Label>
                                    <Input
                                        id="cust-name"
                                        value={customerForm.name || ''}
                                        onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                                        placeholder={editingCustomer ? '' : 'Pilih baris pelanggan atau klik Baru'}
                                        readOnly={!editingCustomer && !customerForm.id}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grup</Label>
                                    <Select value={customerForm.groupId || 'grp-umum'} onValueChange={v => setCustomerForm({ ...customerForm, groupId: v })} disabled={!editingCustomer && !customerForm.id}>
                                        <SelectTrigger><SelectValue placeholder="Umum" /></SelectTrigger>
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
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">TOP Override (0 = ikut grup)</Label>
                                    <Input
                                        type="number"
                                        value={customerForm.topDays ?? 0}
                                        onChange={e => setCustomerForm({ ...customerForm, topDays: Number(e.target.value) || 0 })}
                                        disabled={!editingCustomer && !customerForm.id}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telepon</Label>
                                    <Input
                                        value={customerForm.phone || ''}
                                        onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                        placeholder={editingCustomer ? '' : '08xxx'}
                                        readOnly={!editingCustomer && !customerForm.id}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alamat</Label>
                                    <Input
                                        value={customerForm.address || ''}
                                        onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                                        placeholder={editingCustomer ? '' : '(opsional)'}
                                        readOnly={!editingCustomer && !customerForm.id}
                                    />
                                </div>
                                {editingCustomer && (
                                    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                                        <div className="flex justify-between"><span>ID</span><span className="font-mono text-foreground">{editingCustomer.id}</span></div>
                                        <div className="flex justify-between"><span>Dibuat</span><span>{new Date(editingCustomer.created_at).toLocaleDateString('id-ID')}</span></div>
                                        {editingCustomer.updated_at && (
                                            <div className="flex justify-between"><span>Diubah</span><span>{new Date(editingCustomer.updated_at).toLocaleDateString('id-ID')}</span></div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(editingCustomer || customerForm.id) && (
                                <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex items-center gap-2 shrink-0">
                                    <Button className="flex-1" onClick={handleSaveCustomer}>
                                        <Save className="mr-2 size-4" /> Simpan
                                    </Button>
                                    {editingCustomer && (
                                        <>
                                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => handlePrintCard(editingCustomer)} aria-label="Cetak kartu" title="Cetak kartu">
                                                <CreditCard className="size-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" className="shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirmDeleteCustomerId(editingCustomer.id)} aria-label="Hapus pelanggan" title="Hapus">
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 min-h-0 flex flex-col">
                            <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
                                <h3 className="font-semibold text-sm">Kelola Grup</h3>
                                <Button size="sm" onClick={openAddGroup} className="h-7">
                                    <Plus className="mr-1 size-3.5" /> Tambah
                                </Button>
                            </div>
                            <div className="px-3 pt-2 pb-1 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                                    <Input
                                        value={groupSearch}
                                        onChange={e => setGroupSearch(e.target.value)}
                                        placeholder="Cari nama grup..."
                                        className="pl-9 h-8 bg-background"
                                    />
                                </div>
                            </div>
                            <div className="grow min-h-0 overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-card border-b">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Nama Grup</TableHead>
                                            <TableHead className="text-right">Produk</TableHead>
                                            <TableHead className="w-20 text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredGroups.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground">Belum ada grup.</TableCell></TableRow>
                                        ) : filteredGroups.map(g => {
                                            const memberCount = customers.filter(c => c.groupId === g.id).length;
                                            return (
                                                <TableRow key={g.id}>
                                                    <TableCell className="font-medium py-2.5">
                                                        <div>{g.name}</div>
                                                        <div className="text-xs text-muted-foreground">Rank {g.rank} · {g.topDays === 0 ? 'COD' : `${g.topDays} hari`}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground py-2.5">{memberCount}</TableCell>
                                                    <TableCell className="text-right py-2.5">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditGroup(g)} aria-label={`Ubah ${g.name}`} title="Ubah">
                                                                <Edit className="size-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirmDeleteGroupId(g.id)} aria-label={`Hapus ${g.name}`} title="Hapus">
                                                                <Trash2 className="size-3.5" />
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
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="grp-name">Nama Grup *</Label>
                            <Input
                                id="grp-name"
                                autoFocus
                                value={groupForm.name || ''}
                                onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                                placeholder="cth. Agen"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>TOP (hari, 0=COD)</Label>
                            <Input
                                type="number"
                                value={groupForm.topDays ?? 0}
                                onChange={e => setGroupForm({ ...groupForm, topDays: Number(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Rank (urutan)</Label>
                            <Input
                                type="number"
                                value={groupForm.rank ?? 0}
                                onChange={e => setGroupForm({ ...groupForm, rank: Number(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setGroupModalOpen(false)}>Batal</Button>
                        <Button onClick={handleSaveGroup}>
                            <Save className="mr-2 size-4" /> Simpan
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
                    <DialogHeader><DialogTitle>Kartu Pelanggan — Kastoko</DialogTitle><DialogDescription>1 sisi • Desain premium ATM • ID & barcode • Pratinjau PDF</DialogDescription></DialogHeader>
                    {selectedCard && <CustomerCardPreview customer={selectedCard} group={customerGroups.find(g => g.id === selectedCard.groupId)} />}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCardOpen(false)}>Tutup</Button>
                        <Button onClick={handleConfirmPrint} disabled={isPrintingCard}>
                            {isPrintingCard ? 'Memuat...' : <><Printer className="h-4 w-4 mr-1" /> Cetak</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <PdfPreviewSheet open={pdf.previewOpen} onOpenChange={pdf.setPreviewOpen} pdfBytes={pdf.pdfBytes} title={selectedCard ? `Kartu — ${selectedCard.name}` : 'Kartu Pelanggan'} filename={selectedCard ? `kartu-${selectedCard.id}.pdf` : 'kartu.pdf'} />
            <PdfGeneratingOverlay open={pdf.open} onCancel={pdf.cancel} title={pdf.title} elapsedMs={pdf.elapsedMs} pageCount={pdf.pageCount} />
        </div>
    );
}
