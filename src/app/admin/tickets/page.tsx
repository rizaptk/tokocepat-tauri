
'use client';

import { useState, useEffect, useTransition } from 'react';
import { PaymentTicket } from '@/lib/types';
import { getPaymentTicketsAction, updateTicketStatusAction, TicketStatusUpdate } from './_actions';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, Ticket, AlertTriangle, Loader2, User, Mail, MessageSquare, Monitor } from 'lucide-react';

type TicketStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

const statusConfig: Record<TicketStatus, { variant: 'default' | 'secondary' | 'destructive', label: string }> = {
    pending: { variant: 'secondary', label: 'Pending' },
    processing: { variant: 'default', label: 'Processing' },
    resolved: { variant: 'default', label: 'Resolved' },
    rejected: { variant: 'destructive', label: 'Rejected' },
};

function StatusBadge({ status }: { status: TicketStatus }) {
    const config = statusConfig[status];
    const className = status === 'resolved' ? 'bg-green-600 hover:bg-green-600' : status === 'processing' ? 'bg-blue-600 hover:bg-blue-600' : '';
    return <Badge variant={config.variant} className={className}>{config.label}</Badge>;
}

function TicketCard({ ticket, onStatusChange }: { ticket: PaymentTicket, onStatusChange: (data: TicketStatusUpdate) => void }) {
    const [isPending, startTransition] = useTransition();

    const handleAction = (newStatus: TicketStatusUpdate['newStatus']) => {
        startTransition(() => {
            onStatusChange({ ticketId: ticket.id, newStatus });
        });
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4"/> {ticket.customerName}</CardTitle>
                        <CardDescription>
                            Plan: <span className="font-semibold">{ticket.plan}</span>
                        </CardDescription>
                    </div>
                    <StatusBadge status={ticket.status} />
                </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> <span>{ticket.customerEmail}</span></div>
                    <div className="flex items-center gap-2 text-muted-foreground"><MessageSquare className="h-4 w-4" /> <span>{ticket.customerWhatsapp}</span></div>
                    {ticket.deviceId && <div className="flex items-center gap-2 text-muted-foreground"><Monitor className="h-4 w-4" /> <span className="font-mono text-xs">{ticket.deviceId.substring(0, 16)}...</span></div>}
                </div>

                <p className="text-muted-foreground italic border-l-2 pl-3">"{ticket.userNotes || 'No notes provided by user.'}"</p>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Submitted: {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                    <Button variant="ghost" size="sm" asChild>
                        <a href={ticket.proofOfPaymentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                            View Proof <ExternalLink className="h-3 w-3" />
                        </a>
                    </Button>
                </div>
                 {ticket.licenseKey && ticket.status === 'resolved' && (
                     <div className="text-xs text-muted-foreground pt-2 border-t">
                        <p>Linked License Key: <span className="font-mono font-semibold">{ticket.licenseKey}</span></p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex gap-2">
                {isPending && <Loader2 className="animate-spin h-4 w-4" />}
                {!isPending && ticket.status === 'pending' && (
                    <Button size="sm" onClick={() => handleAction('processing')}>Move to Processing</Button>
                )}
                 {!isPending && ticket.status === 'processing' && (
                    <>
                        <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction('resolved')}>Approve & Resolve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction('rejected')}>Reject</Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}


export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<PaymentTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        async function fetchTickets() {
            setLoading(true);
            const result = await getPaymentTicketsAction();
            if (result.error) {
                setError(result.error);
            } else {
                setTickets(result.tickets);
            }
            setLoading(false);
        }
        fetchTickets();
    }, []);

    const handleStatusChange = async (data: TicketStatusUpdate) => {
        const result = await updateTicketStatusAction(data);
        if (result.success) {
            toast({ title: 'Success', description: `Ticket status updated to ${data.newStatus}.`});
            // Refetch tickets to show the change
            const updatedData = await getPaymentTicketsAction();
            if (!updatedData.error) {
                setTickets(updatedData.tickets);
            }
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };
    
    const renderTicketList = (status: TicketStatus) => {
        const filteredTickets = tickets.filter(t => t.status === status);
        if (filteredTickets.length === 0) {
            return <div className="text-center text-muted-foreground p-8">No tickets in this category.</div>;
        }
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTickets.map(ticket => (
                    <TicketCard key={ticket.id} ticket={ticket} onStatusChange={handleStatusChange} />
                ))}
            </div>
        );
    };

    if (loading) {
        return (
             <>
                <h1 className="text-lg font-semibold md:text-2xl">Payment Tickets</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            </>
        )
    }

     if (error) {
        return (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Tickets</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )
    }

    return (
        <>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Payment Tickets</h1>
            </div>

             <Tabs defaultValue="pending" className="mt-4">
                <TabsList>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="processing">Processing</TabsTrigger>
                    <TabsTrigger value="resolved">Resolved</TabsTrigger>
                     <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-4">{renderTicketList('pending')}</TabsContent>
                <TabsContent value="processing" className="mt-4">{renderTicketList('processing')}</TabsContent>
                <TabsContent value="resolved" className="mt-4">{renderTicketList('resolved')}</TabsContent>
                <TabsContent value="rejected" className="mt-4">{renderTicketList('rejected')}</TabsContent>
            </Tabs>

        </>
    );
}
