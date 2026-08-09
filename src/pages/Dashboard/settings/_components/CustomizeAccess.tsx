import { useEffect, useState } from "react";
import { useDbStore } from "@/lib/db-store";
import { BarChartIcon, LayoutGrid, Package, Settings, ShoppingCart, Warehouse, Save, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateDeviceFingerprint } from "@/lib/security";
import { useStore } from "@/lib/store";

export const CustomizeAccess = () => {
    const {db, firesqlite} = useDbStore();
    const { customAccess } = useStore();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [access, setAccess] = useState<string[]>([]);

    const navItems = [
        { menu: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
        { menu: 'kasir', label: 'Kasir', icon: ShoppingCart },
        { menu: 'produk', label: 'Produk', icon: Package },
        { menu: 'inventori', label: 'Inventori', icon: Warehouse },
        { menu: 'laporan', label: 'Laporan', icon: BarChartIcon },
        { menu: 'pengaturan', label: 'Pengaturan', icon: Settings },
    ];

    useEffect(() => {
        setAccess(customAccess?.access||navItems.map(m => m.menu));
    }, [customAccess]);

    const handleSave = async () => {
        if (!db || !firesqlite) return;
        const hwid = await generateDeviceFingerprint();
        setSaving(true);
        const { doc, setDoc } = firesqlite;
        try {
            await setDoc(doc(db, '__firelite_security', hwid), 
                {
                    access
                },
                { merge: true }
            );
            toast({ title: "Berhasil", description: "Pengaturan akses disimpan." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal", description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const toggleAccess = (menu: string) => {
        setAccess(prev => prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]);
    };

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

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Check className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                    Simpan Pengaturan Akses
                </Button>
            </div>
        </div>
    );
};