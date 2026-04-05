import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, KeyRound } from "lucide-react";
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';

export function RolesManager() {
    const [exists, setExists] = useState<boolean | null>(null);
    const [pin, setPin] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        invoke('check_roles_exist').then((res: any) => setExists(res));
    }, []);

    const handleInit = async () => {
        if (pin.length < 4) return;
        try {
            await invoke('init_roles', { pin });
            setExists(true);
            toast({ title: "Setup Berhasil", description: "PIN Keamanan telah diaktifkan." });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e });
        }
    };

    if (exists === false) {
        return (
            <Card className="border-primary">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                        <Lock className="h-5 w-5" /> Setup Keamanan
                    </CardTitle>
                    <CardDescription>Perangkat Leader harus mengatur PIN untuk mengamankan akses panel admin di perangkat lain.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Buat PIN Baru (Min. 4 angka)</label>
                        <Input 
                            type="password" 
                            placeholder="****" 
                            value={pin} 
                            onChange={(e) => setPin(e.target.value)} 
                        />
                    </div>
                    <Button className="w-full" onClick={handleInit} disabled={pin.length < 4}>
                        Aktifkan Kontrol Peran
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Keamanan & Peran</CardTitle>
                <CardDescription>PIN aktif digunakan untuk memverifikasi wewenang di jaringan.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
                    <KeyRound />
                    <p className="text-sm font-medium">PIN Keamanan terkonfigurasi secara terenkripsi.</p>
                </div>
            </CardContent>
        </Card>
    );
}