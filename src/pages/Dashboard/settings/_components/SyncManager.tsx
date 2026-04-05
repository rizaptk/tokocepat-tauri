import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tablet, Crown } from "lucide-react";
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';

interface SyncManagerProps {
    isSyncAvailable: boolean;
    onSyncStatusChange: (active: boolean, isLeader: boolean) => void;
}


export function SyncManager({ isSyncAvailable, onSyncStatusChange }: SyncManagerProps) {
    const [enabled, setEnabled] = useState(false);
    const [isLeader, setIsLeader] = useState(false);
    const [leaderId, setLeaderId] = useState("");
    const [status, setStatus] = useState<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        const interval = setInterval(async () => {
            if (enabled) {
                const s = await invoke('get_sync_status');
                setStatus(s);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [enabled]);

    const handleToggle = async (val: boolean) => {
        try {
            const selfHwid = await invoke<string>('get_license_hwid');
            const targetLeader = isLeader ? selfHwid : leaderId;

            await invoke('toggle_net_sync', { 
                enabled: val, 
                isAuthority: isLeader, 
                leaderId: targetLeader,
                port: 8080 
            });
            
            setEnabled(val);
            // Notify parent here
            onSyncStatusChange(val, isLeader);
            
            toast({ title: val ? "Sync Aktif" : "Sync Mati" });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal", description: e });
        }
    };

    if (!isSyncAvailable) return null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Sinkronisasi Jaringan</CardTitle>
                    <CardDescription>Hubungkan tablet ke komputer utama (P2P).</CardDescription>
                </div>
                <Switch checked={enabled} onCheckedChange={handleToggle} />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                        <Crown className={isLeader ? "text-yellow-500" : "text-muted-foreground"} />
                        <div>
                            <p className="text-sm font-medium">Jadikan Perangkat Utama</p>
                            <p className="text-xs text-muted-foreground">Aktifkan hanya pada satu komputer kasir utama.</p>
                        </div>
                    </div>
                    <Switch disabled={enabled} checked={isLeader} onCheckedChange={setIsLeader} />
                </div>

                {!isLeader && !enabled && (
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Leader Device ID</label>
                        <input 
                            className="w-full p-2 text-sm border rounded bg-background"
                            placeholder="Masukkan ID komputer utama..."
                            value={leaderId}
                            onChange={(e) => setLeaderId(e.target.value)}
                        />
                    </div>
                )}

                {enabled && status && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                            <Badge variant="success" className="animate-pulse">ONLINE</Badge>
                            <span className="text-sm font-medium">{status.peer_count} Perangkat Terhubung</span>
                        </div>
                        <div className="grid gap-2">
                            {status.known_peers.map((peer: string) => (
                                <div key={peer} className="flex items-center gap-2 text-xs p-2 border rounded bg-background">
                                    <Tablet className="h-3 w-3" /> {peer}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}