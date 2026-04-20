import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone } from "lucide-react";
import { invoke } from '@tauri-apps/api/core';

export function NetworkSecurity() {
    const [peers, setPeers] = useState<any[]>([]);

    const fetchPeers = async () => {
        try {
            // Updated to use our new list_network_peers command
            const res: any[] = await invoke('list_network_peers');
            setPeers(res);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchPeers();
        const interval = setInterval(fetchPeers, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Daftar Perangkat Jaringan</CardTitle>
                <CardDescription>
                    Daftar perangkat terhubung
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {peers.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Menunggu perangkat lain...</p>}
                {peers.map(peer => (
                    <div key={peer.id} className="flex items-center justify-between p-4 border rounded-xl bg-background">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Smartphone className={peer.is_online ? "text-primary" : "text-muted-foreground"} />
                                {/* Visual Indicator for Physical Presence */}
                                {peer.is_online && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold">{peer.name}</p>
                                <div className="flex gap-2 items-center">
                                    <Badge variant="success">
                                        Terhubung
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                {peer.id}
                            </div>
                        </div>

                    </div>
                ))}
            </CardContent>
        </Card>
    );
}