import { useEffect, useRef, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
    Send, Loader2, Info, WifiOff, Zap, 
    Clock, RefreshCw, CheckCircle, AlertTriangle, 
    ShieldAlert, HelpCircle, ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionPlan, PaymentInstructions, PaymentTicket } from '@/lib/types';
import { cn, formatDistanceToNowShort } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { generateDeviceFingerprint } from '@/lib/security';
import { apiFetch } from '@/lib/api-client';
import { invoke } from '@tauri-apps/api/core';
import { Link } from 'react-router-dom';

type TicketStatusInfo = { 
    ticketId: string; 
    status: PaymentTicket['status'] | 'action_required' | 'flagged'; 
    plan: string; 
    createdAt: string;
    rejectionReason?: string; // Menangkap alasan dari admin
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// --- Komponen Card Paket ---
const PlanCard = ({ plan, isSelected, onSelect }: { plan: SubscriptionPlan, isSelected: boolean, onSelect: () => void }) => {
    const durationText = plan.durationDays === -1 ? "Selamanya" : `${plan.durationDays} Hari`;
    return (
        <Card className={cn("cursor-pointer transition-all hover:shadow-md", isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:border-primary/50")} onClick={onSelect}>
            <CardHeader className="p-4">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{formatCurrency(plan.price)}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1 tracking-wider">
                    {durationText} • {plan.maxSeats} Perangkat
                </p>
            </CardContent>
        </Card>
    )
}

// --- Komponen Status Tiket ---
const TicketStatusCard = ({ statusInfo, onRefresh, onReSubmit }: { statusInfo: TicketStatusInfo, onRefresh: () => void, onReSubmit: () => void }) => {
    const [isRefreshing, startRefreshTransition] = useTransition();

    const statusMap = {
        pending: {
            title: "Tiket Terkirim",
            description: "Menunggu antrean verifikasi admin.",
            icon: <Clock className="h-10 w-10 text-yellow-500" />,
            color: "bg-yellow-500/10 border-yellow-500/20"
        },
        processing: {
            title: "Sedang Diverifikasi",
            description: "Admin sedang meninjau bukti pembayaran Anda.",
            icon: <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />,
            color: "bg-blue-500/10 border-blue-500/20"
        },
        resolved: {
            title: "Pembayaran Disetujui!",
            description: "Lisensi siap diaktifkan.",
            icon: <CheckCircle className="h-10 w-10 text-green-500" />,
            color: "bg-green-500/10 border-green-500/20"
        },
        action_required: {
            title: "Aksi Diperlukan",
            description: "Ada masalah dengan bukti pembayaran Anda.",
            icon: <HelpCircle className="h-10 w-10 text-orange-500" />,
            color: "bg-orange-500/10 border-orange-500/20"
        },
        rejected: {
            title: "Tiket Ditolak",
            description: "Mohon hubungi bantuan untuk informasi lebih lanjut.",
            icon: <WifiOff className="h-10 w-10 text-destructive" />,
            color: "bg-destructive/10 border-destructive/20"
        },
        flagged: {
            title: "Keamanan Terdeteksi",
            description: "Tiket ini ditandai oleh sistem keamanan.",
            icon: <ShieldAlert className="h-10 w-10 text-destructive" />,
            color: "bg-destructive/20 border-destructive"
        }
    };
    
    const current = statusMap[statusInfo.status as keyof typeof statusMap] || statusMap.pending;

    return (
        <Card className={cn("border-2", current.color)}>
            <CardContent className="text-center space-y-4 p-8">
                <div className="flex justify-center">{current.icon}</div>
                <h3 className="text-xl font-semibold">{current.title}</h3>
                <p className="text-muted-foreground text-sm">{current.description}</p>
                
                {statusInfo.rejectionReason && (
                    <Alert variant="destructive" className="text-left bg-background/50 border-destructive/20">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Alasan Admin:</AlertTitle>
                        <AlertDescription>{statusInfo.rejectionReason}</AlertDescription>
                    </Alert>
                )}

                <div className="text-xs pt-4 border-t border-black/5">
                    <p>Paket: <span className="font-semibold">{statusInfo.plan}</span></p>
                    <p>Dikirim: <span className="font-semibold">{formatDistanceToNowShort(new Date(statusInfo.createdAt))}</span></p>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
                {statusInfo.status === 'resolved' ? (
                     <Button asChild className="w-full bg-green-600 hover:bg-green-700" size="lg">
                        <Link to={`/aktivasi?ticket=${statusInfo.ticketId}`}>
                            Tinjau & Aktifkan Lisensi <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                ) : statusInfo.status === 'action_required' ? (
                    <Button className="w-full" variant="default" onClick={onReSubmit}>
                        Perbaiki Bukti Pembayaran
                    </Button>
                ) : (
                    <Button variant="outline" className="w-full bg-background" onClick={() => startRefreshTransition(onRefresh)} disabled={isRefreshing}>
                        {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Segarkan Status
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

export function SubscriptionManager() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<{ plans: SubscriptionPlan[], instructions: PaymentInstructions } | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
    const [isTrialUsed, setIsTrialUsed] = useState(true);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [ticketStatus, setTicketStatus] = useState<TicketStatusInfo | null>(null);
    const [_formErrors, setFormErrors] = useState<any>({});
    const [isSubmitting, startSubmitTransition] = useTransition();

    const formRef = useRef<HTMLFormElement>(null);

    const fetchStatusAndSettings = async () => {
        setLoading(true);
        try {
            const fingerprint = await generateDeviceFingerprint();
            setDeviceId(fingerprint);
            
            setIsOnline(true);
            const [settingsRes, statusRes] = await Promise.all([
                apiFetch('/api/settings'),
                apiFetch(`/api/settings?deviceId=${fingerprint}`)
            ]);

            const settingsData = await settingsRes.json();
            const statusData = await statusRes.json();

            setSettings(settingsData);
            setTicketStatus(statusData.status);
            
            // Check trial status from API result
            setIsTrialUsed(statusData.trialUsed || false);

        } catch (error) {
            setIsOnline(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatusAndSettings();
    }, []);

    const handleActivateTrial = async (planId: string) => {
        try {
            await invoke('activate_trial', { planId });
            toast({ title: 'Trial Aktif!' });
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Gagal', description: error });
        }
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        startSubmitTransition(async () => {
            const formData = new FormData(e.currentTarget);
            const data = Object.fromEntries(formData.entries());
            setFormErrors({});

            const response = await apiFetch('/api/tickets', {
                method: 'POST',
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setFormErrors(result.errors || { _form: [result.message || 'Gagal mengirim tiket.'] });
            } else {
                toast({ title: 'Tiket Terupdate!', description: 'Mohon tunggu verifikasi admin.' });
                fetchStatusAndSettings(); // Refresh view
            }
        });
    }

    if (loading) return <div className="p-4 space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-60 w-full" /></div>;
    
    if (!isOnline) return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-bold">Offline</h3>
                <p className="text-sm text-muted-foreground">Hubungkan ke internet untuk mengelola langganan.</p>
                <Button variant="outline" className="mt-4" onClick={fetchStatusAndSettings}>Coba Lagi</Button>
            </CardContent>
        </Card>
    );
    
    // Tampilkan status tiket jika ada (dan bukan sedang dalam mode resubmit)
    if (ticketStatus && selectedPlan === null) {
        return <TicketStatusCard 
            statusInfo={ticketStatus} 
            onRefresh={fetchStatusAndSettings} 
            onReSubmit={() => {
                // Cari plan yang sebelumnya dipilih untuk memunculkan form lagi
                const prevPlan = settings?.plans.find(p => p.name === ticketStatus.plan);
                if (prevPlan) setSelectedPlan(prevPlan);
            }} 
        />;
    }

    const trialPlans = settings?.plans.filter(p => p.isTrial) || [];
    const paidPlans = settings?.plans.filter(p => !p.isTrial) || [];
    const singlePlans = paidPlans.filter(p => p.maxSeats === 1);
    const multiPlans = paidPlans.filter(p => p.maxSeats > 1);

    return (
         <Card>
            <CardHeader>
                <CardTitle>Langganan TokoCepat</CardTitle>
                <CardDescription>Pilih paket yang sesuai dengan kebutuhan bisnis Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 {/* Bagian Trial */}
                 {!isTrialUsed && trialPlans.length > 0 && !selectedPlan && (
                    <div className="space-y-3">
                        {trialPlans.map(plan => (
                             <Card key={plan.id} className="border-primary/50 bg-primary/5 overflow-hidden">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary rounded-full text-white"><Zap size={16}/></div>
                                        <div>
                                            <h4 className="font-bold text-sm">{plan.name}</h4>
                                            <p className="text-xs text-muted-foreground">{plan.durationDays} Hari Trial Gratis</p>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => handleActivateTrial(plan.id)}>Aktifkan</Button>
                                </div>
                             </Card>
                        ))}
                    </div>
                 )}
                
                {/* Tabs untuk Single vs Multi Device */}
                {!selectedPlan && (
                    <Tabs defaultValue="single" className="w-full" layoutId='subscriptionManager'>
                        <TabsList defaultValue="single" className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="single">Perangkat Tunggal</TabsTrigger>
                            <TabsTrigger value="multi">Multi Perangkat (Sync)</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="single" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {singlePlans.map(plan => (
                                <PlanCard key={plan.id} plan={plan} isSelected={false} onSelect={() => setSelectedPlan(plan)} />
                            ))}
                        </TabsContent>

                        <TabsContent value="multi" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {multiPlans.map(plan => (
                                <PlanCard key={plan.id} plan={plan} isSelected={false} onSelect={() => setSelectedPlan(plan)} />
                            ))}
                        </TabsContent>
                    </Tabs>
                )}
                
                {selectedPlan && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between border-b pb-4">
                            <h3 className="font-bold">Konfirmasi Pembayaran: {selectedPlan.name}</h3>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(null)}>Ganti Paket</Button>
                        </div>

                        {ticketStatus?.status === 'action_required' && (
                             <Alert className="bg-orange-50 border-orange-200">
                                <Info className="h-4 w-4 text-orange-600" />
                                <AlertTitle className="text-orange-800">Perhatian</AlertTitle>
                                <AlertDescription className="text-orange-700">
                                    Admin meminta revisi bukti pembayaran. Mohon periksa catatan di bawah.
                                </AlertDescription>
                             </Alert>
                        )}
                        
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                            <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                <Info size={16}/> Instruksi Transfer
                            </h4>
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div><p className="text-xs text-blue-800/60 uppercase font-bold">Bank</p><p className="font-semibold">{settings?.instructions.bankName}</p></div>
                                <div><p className="text-xs text-blue-800/60 uppercase font-bold">No. Rekening</p><p className="font-semibold">{settings?.instructions.accountNumber}</p></div>
                                <div className="col-span-2"><p className="text-xs text-blue-800/60 uppercase font-bold">Atas Nama</p><p className="font-semibold">{settings?.instructions.accountName}</p></div>
                                <div className="col-span-2 pt-2 border-t border-blue-200/50 italic text-xs text-blue-800/80">
                                    "{settings?.instructions.message}"
                                </div>
                            </div>
                        </div>

                        <form ref={formRef} onSubmit={handleFormSubmit} className="space-y-4">
                            <input type="hidden" name="plan" value={selectedPlan.name} />
                            <input type="hidden" name="deviceId" value={deviceId || ''} />
                            {/* Jika resubmit, sertakan ID tiket lama agar admin tahu ini revisi */}
                            {ticketStatus && <input type="hidden" name="ticketId" value={ticketStatus.ticketId} />}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs">Nama Lengkap</Label>
                                    <Input name="customerName" placeholder="Nama sesuai KTP/Bank" required />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">No. WhatsApp</Label>
                                    <Input name="customerWhatsapp" type="tel" placeholder="08xxx" required />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Email</Label>
                                <Input name="customerEmail" type="email" placeholder="email@aktif.com" required />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-primary">Link Bukti Transfer</Label>
                                <Input name="proofOfPaymentUrl" type="url" placeholder="https://..." required />
                                <p className="text-[10px] text-muted-foreground italic">Unggah bukti ke Google Drive/Imgur/iCloud dan lampirkan link publiknya.</p>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs">Catatan Tambahan</Label>
                                <Textarea name="userNotes" placeholder="Opsional..." className="h-20" />
                            </div>

                            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</> : <><Send className="mr-2 h-4 w-4" /> Kirim Bukti Pembayaran</>}
                            </Button>
                        </form>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}