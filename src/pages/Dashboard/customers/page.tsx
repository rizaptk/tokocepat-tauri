import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, Users, Layers, Search, CreditCard, Printer, Save, X, UserCog, ChevronRight } from 'lucide-react';
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

export default function CustomersPage() {
  const { customers, customerGroups, storeConfig } = useStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'customers' | 'groups'>('customers');
  const [selectedCard, setSelectedCard] = useState<Customer | null>(null);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isPrintingCard, setIsPrintingCard] = useState(false);
  const pdf = usePdfGeneration();

  // ===== Customer list state =====
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

  // ===== Customer form (right panel — tab Pelanggan) =====
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
    name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0,
  });
  const [isCustomerDirty, setIsCustomerDirty] = useState(false);
  const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingCustomer && !isCustomerDirty) {
      // No selection and form is clean — keep the empty form
      return;
    }
  }, [editingCustomer, isCustomerDirty]);

  const openNewCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0 });
    setIsCustomerDirty(true);
  };

  const openEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerForm({
      name: c.name, phone: c.phone || '', address: c.address || '',
      groupId: c.groupId || 'grp-umum', topDays: c.topDays ?? 0,
    });
    setIsCustomerDirty(false);
  };

  const clearCustomerForm = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0 });
    setIsCustomerDirty(false);
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
    setIsCustomerDirty(false);
  };

  const handleDeleteCustomer = async (id: string) => {
    await deleteCustomer(id);
    toast({ title: 'Pelanggan dihapus' });
    if (editingCustomer?.id === id) clearCustomerForm();
    setConfirmDeleteCustomerId(null);
  };

  // ===== Group form (right panel — tab Grup) =====
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [groupForm, setGroupForm] = useState<Partial<CustomerGroup>>({ name: '', topDays: 0, rank: 0 });
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  const sortedGroups = useMemo(
    () => [...customerGroups].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)),
    [customerGroups]
  );

  const openAddGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', topDays: 0, rank: customerGroups.length });
    setIsAddingGroup(true);
  };

  const openEditGroup = (g: CustomerGroup) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, topDays: g.topDays, rank: g.rank });
    setIsAddingGroup(false);
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
    setEditingGroup(grp);
    setIsAddingGroup(false);
  };

  const handleDeleteGroup = async (id: string) => {
    await deleteCustomerGroup(id);
    toast({ title: 'Grup dihapus' });
    if (editingGroup?.id === id) { setEditingGroup(null); setGroupForm({ name: '', topDays: 0, rank: 0 }); }
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

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); }} className="flex flex-1 min-h-0 flex-col">
        <div className="border-b border-border/60 bg-background/60 px-4 shrink-0">
          <TabsList className="h-10 bg-transparent p-0 gap-1">
            <TabsTrigger
              value="customers"
              className="data-[state=active]:bg-background data-[state=active]:shadow-none rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-3 h-10 gap-1.5"
            >
              <Users className="size-3.5" /> Pelanggan
            </TabsTrigger>
            <TabsTrigger
              value="groups"
              className="data-[state=active]:bg-background data-[state=active]:shadow-none rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-3 h-10 gap-1.5"
            >
              <Layers className="size-3.5" /> Grup
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ====== PELANGGAN TAB ====== */}
        <TabsContent value="customers" className="flex flex-1 min-h-0 mt-0">
          <div className="w-full h-[calc(100vh-5rem)] grid grid-cols-1 lg:grid-cols-10 min-h-0">
            {/* LEFT — search + table */}
            <div className="col-span-1 lg:col-span-6 h-full flex flex-col min-h-0 border-r border-border/60">
              <div className="px-4 pt-4 pb-2 flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Users className="size-4" /> Daftar Pelanggan
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {filteredCustomers.length} dari {customers.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Cari nama / telepon / ID..."
                    className="pl-8 h-9"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  <Button size="sm" variant={customerGroupFilter === 'all' ? 'default' : 'outline'} onClick={() => setCustomerGroupFilter('all')} className="h-7 text-xs shrink-0">Semua</Button>
                  {customerGroups.map(g => (
                    <Button key={g.id} size="sm" variant={customerGroupFilter === g.id ? 'default' : 'outline'} onClick={() => setCustomerGroupFilter(g.id)} className="h-7 text-xs shrink-0">{g.name}</Button>
                  ))}
                </div>
                <Button size="sm" onClick={openNewCustomer} className="self-start h-8">
                  <Plus className="h-4 w-4 mr-1" /> Pelanggan Baru
                </Button>
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
                          onClick={() => openEditCustomer(c)}
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
            </div>

            {/* RIGHT — form Pelanggan */}
            <aside className="col-span-1 lg:col-span-4 h-full min-h-0 flex flex-col bg-card">
              <div className="px-5 pt-4 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <UserCog className="size-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    {editingCustomer ? 'Ubah Pelanggan' : isCustomerDirty ? 'Pelanggan Baru' : 'Detail Pelanggan'}
                  </h3>
                </div>
                {(editingCustomer || isCustomerDirty) && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={clearCustomerForm} aria-label="Tutup form">
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-4">
                {editingCustomer || isCustomerDirty ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nama *</Label>
                      <Input
                        id="cust-name"
                        autoFocus
                        value={customerForm.name || ''}
                        onChange={e => { setCustomerForm({ ...customerForm, name: e.target.value }); setIsCustomerDirty(true); }}
                        placeholder="cth. Toko Sumber Rezeki"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grup</Label>
                      <Select value={customerForm.groupId || 'grp-umum'} onValueChange={v => { setCustomerForm({ ...customerForm, groupId: v }); setIsCustomerDirty(true); }}>
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
                        onChange={e => { setCustomerForm({ ...customerForm, topDays: Number(e.target.value) || 0 }); setIsCustomerDirty(true); }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telepon</Label>
                      <Input
                        value={customerForm.phone || ''}
                        onChange={e => { setCustomerForm({ ...customerForm, phone: e.target.value }); setIsCustomerDirty(true); }}
                        placeholder="08xxx"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alamat</Label>
                      <Input
                        value={customerForm.address || ''}
                        onChange={e => { setCustomerForm({ ...customerForm, address: e.target.value }); setIsCustomerDirty(true); }}
                        placeholder="(opsional)"
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
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 text-muted-foreground">
                    <Users className="size-10 mb-3 opacity-50" />
                    <p className="text-sm font-medium">Pilih pelanggan di daftar</p>
                    <p className="text-xs mt-1 max-w-xs">Atau klik "Pelanggan Baru" untuk membuat pelanggan grosir baru.</p>
                  </div>
                )}
              </div>

              {(editingCustomer || isCustomerDirty) && (
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
            </aside>
          </div>
        </TabsContent>

        {/* ====== GRUP TAB ====== */}
        <TabsContent value="groups" className="flex flex-1 min-h-0 mt-0">
          <div className="w-full h-[calc(100vh-5rem)] grid grid-cols-1 lg:grid-cols-10 min-h-0">
            {/* LEFT — list grup */}
            <div className="col-span-1 lg:col-span-6 h-full flex flex-col min-h-0 border-r border-border/60">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Layers className="size-4" /> Daftar Grup
                  </h2>
                  <span className="text-xs text-muted-foreground">{sortedGroups.length} grup</span>
                </div>
                <Button size="sm" onClick={openAddGroup} className="h-8">
                  <Plus className="h-4 w-4 mr-1" /> Grup Baru
                </Button>
              </div>
              <p className="px-4 pb-2 text-xs text-muted-foreground shrink-0">
                Harga grosir: Group Base → Qty Tier. TOP diatur per grup, bisa di-override per pelanggan.
              </p>
              <div className="grow min-h-0 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Nama Grup</TableHead>
                      <TableHead>Rank</TableHead>
                      <TableHead>TOP</TableHead>
                      <TableHead className="text-right">Pelanggan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedGroups.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Belum ada grup.</TableCell></TableRow>
                    ) : sortedGroups.map(g => {
                      const isSelected = editingGroup?.id === g.id;
                      const memberCount = customers.filter(c => c.groupId === g.id).length;
                      return (
                        <TableRow
                          key={g.id}
                          className={cn('cursor-pointer', isSelected && 'bg-primary/10 hover:bg-primary/15')}
                          onClick={() => openEditGroup(g)}
                        >
                          <TableCell className="font-medium py-2.5">
                            <div className="flex items-center gap-2">
                              {isSelected && <ChevronRight className="size-3.5 text-primary" />}
                              {g.name}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">{g.rank}</TableCell>
                          <TableCell className="py-2.5">{g.topDays === 0 ? 'COD' : `${g.topDays} hari`}</TableCell>
                          <TableCell className="py-2.5 text-right text-muted-foreground tabular-nums">{memberCount}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* RIGHT — form Grup */}
            <aside className="col-span-1 lg:col-span-4 h-full min-h-0 flex flex-col bg-card">
              <div className="px-5 pt-4 pb-3 border-b border-border/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    {editingGroup ? 'Ubah Grup' : isAddingGroup ? 'Grup Baru' : 'Detail Grup'}
                  </h3>
                </div>
                {(editingGroup || isAddingGroup) && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditingGroup(null); setIsAddingGroup(false); setGroupForm({ name: '', topDays: 0, rank: 0 }); }} aria-label="Tutup form">
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-4">
                {editingGroup || isAddingGroup ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="grp-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nama Grup *</Label>
                      <Input
                        id="grp-name"
                        autoFocus={isAddingGroup}
                        value={groupForm.name || ''}
                        onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                        placeholder="cth. Agen"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">TOP (hari, 0=COD)</Label>
                      <Input
                        type="number"
                        value={groupForm.topDays ?? 0}
                        onChange={e => setGroupForm({ ...groupForm, topDays: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank (urutan)</Label>
                      <Input
                        type="number"
                        value={groupForm.rank ?? 0}
                        onChange={e => setGroupForm({ ...groupForm, rank: Number(e.target.value) || 0 })}
                      />
                    </div>
                    {editingGroup && (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                        <div className="flex justify-between"><span>ID</span><span className="font-mono text-foreground">{editingGroup.id}</span></div>
                        <div className="flex justify-between mt-1"><span>Jumlah anggota</span><span className="tabular-nums text-foreground">{customers.filter(c => c.groupId === editingGroup.id).length}</span></div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 text-muted-foreground">
                    <Layers className="size-10 mb-3 opacity-50" />
                    <p className="text-sm font-medium">Pilih grup di daftar</p>
                    <p className="text-xs mt-1 max-w-xs">Atau klik "Grup Baru" untuk menambahkan grup grosir baru.</p>
                  </div>
                )}
              </div>

              {(editingGroup || isAddingGroup) && (
                <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex items-center gap-2 shrink-0">
                  <Button className="flex-1" onClick={handleSaveGroup}>
                    <Save className="mr-2 size-4" /> Simpan
                  </Button>
                  {editingGroup && (
                    <Button variant="outline" size="icon" className="shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setConfirmDeleteGroupId(editingGroup.id)} aria-label="Hapus grup" title="Hapus">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              )}
            </aside>
          </div>
        </TabsContent>
      </Tabs>

      {/* ====== DIALOGS ====== */}
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
