import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldX, Smartphone, RefreshCw } from "lucide-react";
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';

export function NetworkSecurity({ isLeader }: { isLeader: boolean }) {
    const [peers, setPeers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const refreshPeers = async () => {
        setLoading(true);
        try {
            // Query the internal security collection
            const res: any = await invoke('firelite_exec', {
                op: {
                    op: "query",
                    collection: "__firelite_security",
                    filters: [{ field: "_id", op: "startswith", value: "peers:" }]
                }
            });
            setPeers(res.rows || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshPeers();
        const interval = setInterval(refreshPeers, 10000); // Auto refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const updatePeerStatus = async (id: string, newStatus: 'allowed' | 'blocked') => {
        try {
            await invoke('firelite_exec', {
                op: {
                    op: "patch",
                    collection: "__firelite_security",
                    doc_id: id.replace('peers:', ''),
                    data: { status: newStatus }
                }
            });
            toast({ title: "Status Diperbarui", description: `Perangkat ${newStatus === 'allowed' ? 'diizinkan' : 'diblokir'}.` });
            refreshPeers();
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal", description: e });
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Otorisasi Perangkat</CardTitle>
                    <CardDescription>
                        {isLeader ? "Kelola perangkat yang diizinkan sinkronisasi." : "Status otorisasi perangkat Anda."}
                    </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={refreshPeers} disabled={loading}>
                    <RefreshCw className={loading ? "animate-spin" : ""} />
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {peers.length === 0 && <p className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">Belum ada perangkat lain yang terdeteksi.</p>}
                {peers.map(peer => (
                    <div key={peer._id} className="flex items-center justify-between p-4 border rounded-xl bg-muted/20">
                        <div className="flex items-center gap-4">
                            <Smartphone className="text-muted-foreground" />
                            <div>
                                <p className="font-bold">{peer.name || peer._id.replace('peers:', '')}</p>
                                <Badge variant={peer.status === 'allowed' ? 'success' : 'destructive'}>
                                    {peer.status === 'allowed' ? 'Terverifikasi' : 'Menunggu / Terblokir'}
                                </Badge>
                            </div>
                        </div>

                        {isLeader && (
                            <div className="flex gap-2">
                                {peer.status === 'allowed' ? (
                                    <Button variant="outline" className="text-destructive hover:bg-destructive/10" size="sm" onClick={() => updatePeerStatus(peer._id, 'blocked')}>
                                        <ShieldX className="mr-2 h-4 w-4" /> Blokir
                                    </Button>
                                ) : (
                                    <Button variant="default" size="sm" onClick={() => updatePeerStatus(peer._id, 'allowed')}>
                                        <ShieldCheck className="mr-2 h-4 w-4" /> Izinkan
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}