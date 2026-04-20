import { useEffect, useState } from "react";
import { useDbStore } from "@/lib/db-store";
import { BarChartIcon, LayoutGrid, Package, Settings, ShoppingCart, Warehouse, Save, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CustomAccessType } from "@/lib/types";
import { generateDeviceFingerprint } from "@/lib/security";

export const CustomizeAccess = () => {
    const {db, firesqlite} = useDbStore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [access, setAccess] = useState<string[]>([]);
    const [layout, setLayout] = useState('classic');

    const navItems = [
        { menu: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
        { menu: 'cashier', label: 'Kasir', icon: ShoppingCart },
        { menu: 'product', label: 'Produk', icon: Package },
        { menu: 'inventory', label: 'Inventori', icon: Warehouse },
        { menu: 'reports', label: 'Laporan', icon: BarChartIcon },
        { menu: 'settings', label: 'Pengaturan', icon: Settings },
    ];

    const cashierLayout = [
        { name: 'default', label: 'Modern (Grid)', description: 'Layout modern dengan fokus pada visual produk.' },
        { name: 'classic', label: 'Classic', description: 'Layout kasir klasik.' }
    ];

    useEffect(() => {
        const load = async () => {
            if (!db || !firesqlite) return;
            const deviceId = await generateDeviceFingerprint();
            const { doc, getDocs, query, collection, where } = firesqlite;
            try {
                const col = collection(db, '__firelite_security');  
                const newquery = query(
                    col, 
                    where('type','match','access'),
                    where('peer','match', deviceId)
                );
                const snap = await getDocs(newquery);
                if (!snap.empty) {
                    const data = snap.docs[0].data() as CustomAccessType;
                    setAccess(data.access || []);
                    setLayout(data.cashier_layout || 'classic');
                } else {
                    // Default all access
                    setAccess(navItems.map(i => i.menu));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [db, firesqlite]);

    const handleSave = async () => {
        if (!db || !firesqlite) return;
        setSaving(true);
        const { doc, setDoc } = firesqlite;
        try {
            await setDoc(doc(db, '__firelite_security/access'), {
                access,
                cashier_layout: layout
            });
            toast({ title: "Berhasil", description: "Pengaturan akses disimpan. Muat ulang untuk melihat perubahan." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const toggleAccess = (menu: string) => {
        setAccess(prev => prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]);
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">Memuat pengaturan...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Navigasi & Menu</CardTitle>
                    <CardDescription>Pilih menu mana saja yang akan ditampilkan di navigasi utama.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {navItems.map((item) => (
                        <div key={item.menu} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                            <Checkbox 
                                id={`access-${item.menu}`} 
                                checked={access.includes(item.menu)} 
                                onCheckedChange={() => toggleAccess(item.menu)}
                            />
                            <item.icon className="h-4 w-4 text-muted-foreground" />
                            <Label htmlFor={`access-${item.menu}`} className="flex-1 cursor-pointer font-medium">
                                {item.label}
                            </Label>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Layout Kasir</CardTitle>
                    <CardDescription>Pilih tampilan antarmuka kasir yang paling nyaman untuk Anda.</CardDescription>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={layout} onValueChange={setLayout} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cashierLayout.map((l) => (
                            <Label
                                key={l.name}
                                htmlFor={`layout-${l.name}`}
                                className={ `flex flex-col gap-2 p-4 border-2 rounded-xl cursor-pointer transition-all ${layout === l.name ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/20'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold">{l.label}</span>
                                    <RadioGroupItem value={l.name} id={`layout-${l.name}`} />
                                </div>
                                <span className="text-xs text-muted-foreground">{l.description}</span>
                            </Label>
                        ))}
                    </RadioGroup>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Check className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                    Simpan Pengaturan Akses
                </Button>
            </div>
        </div>
    );
};