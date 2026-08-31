import { useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, Layers, Search, CreditCard, Printer } from 'lucide-react';
import { saveCustomer, deleteCustomer, saveCustomerGroup, deleteCustomerGroup, generateCustomerId, generateGroupId } from '@/services/customerService';
import { useToast } from '@/hooks/use-toast';
import { Customer, CustomerGroup } from '@/lib/types';
import { CustomerCardPreview } from '@/components/CustomerCardPreview';
import { buildCustomerCardPdfBytes } from '@/lib/customerCardPdf';
import { PdfPreviewSheet } from '@/components/PdfPreviewSheet';

export default function CustomersPage() {
  const { customers, customerGroups, storeConfig } = useStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<'customers' | 'groups'>('customers');
  const [selectedCard, setSelectedCard] = useState<Customer | null>(null);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isPrintingCard, setIsPrintingCard] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerGroupFilter, setCustomerGroupFilter] = useState<string>('all');
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (customerGroupFilter !== 'all') list = list.filter(c => c.groupId === customerGroupFilter);
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || c.id.toLowerCase().includes(q));
    }
    return list;
  }, [customers, customerSearch, customerGroupFilter]);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({ name: '', phone: '', address: '', groupId: '', topDays: 0 });
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [groupForm, setGroupForm] = useState<Partial<CustomerGroup>>({ name: '', topDays: 0, rank: 0 });

  const openAddCustomer = () => { setEditingCustomer(null); setCustomerForm({ name: '', phone: '', address: '', groupId: 'grp-umum', topDays: 0 }); setIsCustomerOpen(true); };
  const openEditCustomer = (c: Customer) => { setEditingCustomer(c); setCustomerForm(c); setIsCustomerOpen(true); };
  const handleSaveCustomer = async () => {
    if (!customerForm.name?.trim()) { toast({ variant: 'destructive', title: 'Nama wajib diisi' }); return; }
    const cust: Customer = {
      id: editingCustomer?.id || generateCustomerId(),
      name: customerForm.name!.trim(),
      phone: customerForm.phone?.trim(),
      address: customerForm.address?.trim(),
      groupId: customerForm.groupId || undefined,
      topDays: customerForm.topDays ?? 0,
      creditLimit: customerForm.creditLimit,
      is_active: true,
      created_at: editingCustomer?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveCustomer(cust);
    toast({ title: 'Pelanggan disimpan' });
    setIsCustomerOpen(false);
  };

  const openAddGroup = () => { setEditingGroup(null); setGroupForm({ name: '', topDays: 0, rank: customerGroups.length }); setIsGroupOpen(true); };
  const openEditGroup = (g: CustomerGroup) => { setEditingGroup(g); setGroupForm(g); setIsGroupOpen(true); };
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
    toast({ title: 'Grup disimpan' });
    setIsGroupOpen(false);
  };

  const handlePrintCard = (customer: Customer) => {
    setSelectedCard(customer);
    setIsCardOpen(true);
  };
  const handleConfirmPrint = async () => {
    if (!selectedCard) return;
    try {
      setIsPrintingCard(true);
      const group = customerGroups.find(g => g.id === selectedCard.groupId);
      const bytes = await buildCustomerCardPdfBytes(selectedCard, group, storeConfig as any);
      setPdfBytes(bytes as unknown as Uint8Array);
      setPreviewOpen(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal cetak', description: e?.message || String(e) });
    } finally {
      setIsPrintingCard(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-muted/40">
      <header className="flex h-12 items-center gap-4 border-b bg-background px-4">
        <h1 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Pelanggan & Grup Grosir</h1>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant={tab === 'customers' ? 'default' : 'outline'} onClick={() => setTab('customers')}><Users className="h-4 w-4 mr-1" /> Pelanggan</Button>
          <Button size="sm" variant={tab === 'groups' ? 'default' : 'outline'} onClick={() => setTab('groups')}><Layers className="h-4 w-4 mr-1" /> Grup</Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'customers' ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Cari nama / hp / scan barcode ID..." className="pl-8 h-8" />
                </div>
                <Button size="sm" onClick={openAddCustomer}><Plus className="h-4 w-4 mr-1" /> Tambah Pelanggan</Button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <Button size="sm" variant={customerGroupFilter==='all'?'default':'outline'} onClick={()=>setCustomerGroupFilter('all')} className="h-7 text-xs">Semua</Button>
                {customerGroups.map(g=>(
                  <Button key={g.id} size="sm" variant={customerGroupFilter===g.id?'default':'outline'} onClick={()=>setCustomerGroupFilter(g.id)} className="h-7 text-xs">{g.name}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{filteredCustomers.length} dari {customers.length} pelanggan</p>
            </div>
            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Grup</TableHead><TableHead>TOP</TableHead><TableHead>Telepon</TableHead><TableHead className="w-32 text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Belum ada pelanggan</TableCell></TableRow> : filteredCustomers.map(c => {
                    const g = customerGroups.find(gr => gr.id === c.groupId);
                    const top = c.topDays ?? g?.topDays ?? 0;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => openEditCustomer(c)}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{g ? <Badge variant="secondary">{g.name}</Badge> : <span className="text-muted-foreground">Umum</span>}</TableCell>
                        <TableCell>{top === 0 ? 'COD' : `${top} hari`}</TableCell>
                        <TableCell>{c.phone || '—'}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()} className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" title="Cetak kartu" onClick={() => handlePrintCard(c)}><CreditCard className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteCustomer(c.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Harga grosir: Group Base → Qty Tier. TOP diatur per grup, bisa di-override per pelanggan.</p>
              <Button size="sm" onClick={openAddGroup}><Plus className="h-4 w-4 mr-1" /> Tambah Grup</Button>
            </div>
            <div className="rounded-md border bg-card overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Nama Grup</TableHead><TableHead>Rank</TableHead><TableHead>TOP (hari)</TableHead><TableHead className="w-20">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...customerGroups].sort((a,b)=>a.rank-b.rank).map(g => (
                    <TableRow key={g.id} className="cursor-pointer" onClick={() => openEditGroup(g)}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>{g.rank}</TableCell>
                      <TableCell>{g.topDays === 0 ? 'COD' : `${g.topDays} hari`}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" onClick={() => deleteCustomerGroup(g.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingCustomer ? 'Ubah' : 'Tambah'} Pelanggan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={customerForm.name || ''} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} /></div>
            <div><Label>Grup</Label>
              <Select value={customerForm.groupId || ''} onValueChange={v => setCustomerForm({ ...customerForm, groupId: v })}>
                <SelectTrigger><SelectValue placeholder="Umum" /></SelectTrigger>
                <SelectContent>{customerGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name} ({g.topDays === 0 ? 'COD' : `${g.topDays} hari`})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>TOP Override (0 = ikut grup)</Label><Input type="number" value={customerForm.topDays ?? 0} onChange={e => setCustomerForm({ ...customerForm, topDays: Number(e.target.value) || 0 })} /></div>
            <div><Label>Telepon</Label><Input value={customerForm.phone || ''} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
            <div><Label>Alamat</Label><Input value={customerForm.address || ''} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveCustomer}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGroupOpen} onOpenChange={setIsGroupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingGroup ? 'Ubah' : 'Tambah'} Grup</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Grup</Label><Input value={groupForm.name || ''} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Agen" /></div>
            <div><Label>TOP (hari, 0=COD)</Label><Input type="number" value={groupForm.topDays ?? 0} onChange={e => setGroupForm({ ...groupForm, topDays: Number(e.target.value) || 0 })} /></div>
            <div><Label>Rank</Label><Input type="number" value={groupForm.rank ?? 0} onChange={e => setGroupForm({ ...groupForm, rank: Number(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveGroup}>Simpan</Button></DialogFooter>
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
      <PdfPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} pdfBytes={pdfBytes} title={selectedCard ? `Kartu — ${selectedCard.name}` : 'Kartu Pelanggan'} filename={selectedCard ? `kartu-${selectedCard.id}.pdf` : 'kartu.pdf'} />
    </div>
  );
}
