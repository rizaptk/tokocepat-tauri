import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/hooks/use-toast';
import { useSyncStore } from '@/lib/sync-store'; // Import store
// import { useLicense } from '@/hooks/useLicense';
import { Input } from '@/components/ui/input';
import { SyncIden } from '@/services/syncService';
import { Button } from '@/components/ui/button';
import { PencilIcon, X } from 'lucide-react';
import { generateDeviceFingerprint } from '@/lib/security';

export function SyncManager() {
    const store = useSyncStore();
    const [myHwid, setMyHwid] = useState("");
    const [isBusy, setIsBusy] = useState(false); 
    const [editNama, setEditName] = useState(false);
    const [device, setDevice] = useState('');
    const [isLoaded, setIsloaded] = useState(false);

    const { toast } = useToast();

    const getName = async () => {
        const id = await generateDeviceFingerprint();
        const data = await SyncIden(id);
        setMyHwid(id);
        setDevice(data?.name);
    }

    // 1. Initial Data Fetch

    useEffect(() => {
        getName();
    },[]);

    const setName = async (id: string, name: string) => {
        const out = await SyncIden(id, name);
        setDevice(out?.name);
        toast({
            title: 'Nama Perangkat',
            description: 'Nama perangkat dsimpan!'
        })
    }

    useEffect(() => {
        invoke('get_sync_status').then((status: any) => {
            console.log(status);
            if (!status) {
                store.setIsNetworkEnable(false);
            }
            // setIsOnline(status.status === 'connected');
            setIsloaded(true);
        });
    },[device])

    // 2. Handle Toggle via Store
    const handleToggle = async (val: boolean) => {
        setIsBusy(true);
        try {
            await store.toggleSync(val);
            store.setIsSyncEnabled(val);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal Mengubah Status", description: e });
        } finally {
            setTimeout(() => setIsBusy(false), 800);
        }
    };

    // Use store helper to check license permission
    // if (!licenseDetails?.isSyncAvailable) return null;

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-md">Koneksi Jaringan</CardTitle>
                    <CardDescription className="text-xs">
                        ID: <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono">{myHwid}</code>
                    </CardDescription>
                </div>
                <Switch 
                    disabled={isBusy || !isLoaded}  
                    checked={store.isNetworkEnable} 
                    onCheckedChange={handleToggle} 
                />
            </CardHeader>
            
            {/* Animate height expansion when online */}
            <CardContent className={`transition-all duration-300 ${store.isNetworkEnable ? 'opacity-100' : 'opacity-50'}`}>
                <div className="pt-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {store.isNetworkEnable ? (
                            <>
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 animate-pulse py-0">
                                    ONLINE
                                </Badge>
                            </>
                        ) : (
                            <>
                                <Badge variant="outline" className="text-muted-foreground py-0">
                                    OFFLINE
                                </Badge>
                                <span className="text-xs text-muted-foreground italic">
                                    Aktifkan untuk mulai sinkronisasi
                                </span>
                            </>
                        )}
                    </div>
                    {
                        editNama ?
                        <div className='flex items-center gap-2'>
                            <Input type="text" size="sm" placeholder='Nama penrangkat' value={device} onChange={e => setDevice(e.target.value)} />
                            <Button variant="outline" size="sm" onClick={() => setName(myHwid, device)}>Simpan</Button>
                            <Button variant="ghost" size="sm" onClick={() =>setEditName(false)} title='Tutup'>
                                <X size="8" />
                            </Button>
                        </div> :
                        <div className='flex items-center gap-2'>
                            <span>{device}</span>
                            <Button variant="ghost" size="sm" onClick={() => setEditName(true)}>
                                <PencilIcon size="8" />
                            </Button>
                        </div>
                    }
                </div>
            </CardContent>
        </Card>
    );
}