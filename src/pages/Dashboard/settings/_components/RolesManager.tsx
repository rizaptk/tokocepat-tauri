import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, ShieldAlert, CheckCircle2, Crown } from "lucide-react";
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function RolesManager() {
    const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
    const [isLeader, setIsLeader] = useState(false);
    const [pin, setPin] = useState("");
    const { toast } = useToast();

    const checkStatus = async () => {
        const exists = await invoke('check_roles_exist');
        setSetupNeeded(!exists);
        if (exists) {
            const current: boolean = await invoke('is_current_leader');
            setIsLeader(current);
        }
    };

    useEffect(() => { checkStatus(); }, []);

    const handleInit = async () => {
        try {
            await invoke('init_roles', { pin });
            toast({ title: "PIN Diatur", description: "Perangkat ini sekarang menjadi Leader pertama." });
            checkStatus();
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal", description: e });
        }
    };

    const handleClaim = async () => {
        try {
            await invoke('claim_leadership', { pin });
            toast({ title: "Berhasil", description: "Anda sekarang mengendalikan jaringan." });
            setPin("");
            checkStatus();
        } catch (e: any) {
            toast({ variant: "destructive", title: "PIN Salah", description: "Gagal mengambil alih leadership." });
        }
    };

    if (setupNeeded === true) {
        return (
            <Card className="border-yellow-500 bg-yellow-50/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="text-yellow-600" /> Inisialisasi Keamanan</CardTitle>
                    <CardDescription>Atur PIN Admin untuk pertama kali guna mengamankan kontrol jaringan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input type="password" placeholder="Buat PIN Baru" value={pin} onChange={e => setPin(e.target.value)} />
                    <Button className="w-full bg-yellow-600 hover:bg-yellow-700" onClick={handleInit}>Aktifkan Keamanan</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={isLeader ? "border-primary" : "border-muted"}>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        {isLeader ? <Crown className="text-primary" /> : <ShieldAlert className="text-muted-foreground" />}
                        {isLeader ? "Kontrol Utama Aktif" : "Mode Akses Follower"}
                    </span>
                    {isLeader && <Badge variant="success">LEADER</Badge>}
                </CardTitle>
                <CardDescription>
                    {isLeader 
                        ? "Anda memiliki wewenang penuh untuk mengelola perangkat lain." 
                        : "Gunakan PIN untuk mengambil alih kendali jaringan dari perangkat ini."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!isLeader ? (
                    <div className="flex gap-2">
                        <Input type="password" placeholder="Masukkan PIN Leader" value={pin} onChange={e => setPin(e.target.value)} />
                        <Button onClick={handleClaim}>Ambil Alih</Button>
                    </div>
                ) : (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3">
                        <CheckCircle2 className="text-primary" />
                        <span className="text-sm font-medium text-primary">Sinkronisasi & Otorisasi tersedia di menu Jaringan.</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}