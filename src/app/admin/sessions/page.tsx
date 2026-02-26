import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { db } from '@/lib/firebase-admin';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

async function getOnlineSessions() {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const sessionsSnapshot = await db.collection('online_sessions').where('lastSeen', '>', fiveMinutesAgo).orderBy('lastSeen', 'desc').get();
        if (sessionsSnapshot.empty) {
            return [];
        }
        return sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error: any) {
        console.error("Error fetching sessions: ", error);
        return { error: "Could not fetch session data." };
    }
}

export default async function AdminOnlineSessionsPage() {
    const sessions = await getOnlineSessions();
    const hasError = !Array.isArray(sessions);

    return (
        <>
            <div className="flex items-center">
                <h1 className="text-lg font-semibold md:text-2xl">Online Users</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>A list of devices that have been active in the last 5 minutes.</CardDescription>
                </CardHeader>
                <CardContent>
                    {hasError ? (
                         <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-8 text-center">
                            <p className="font-semibold text-destructive">Connection Error</p>
                            <p className="text-destructive/80 mt-2">{(sessions as any).error}</p>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="border border-dashed rounded-lg p-8 text-center flex flex-col items-center gap-4">
                            <WifiOff className="h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground">No users have been active recently.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>License Key</TableHead>
                                    <TableHead>Device ID</TableHead>
                                    <TableHead>Last Seen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map((session: any) => (
                                    <TableRow key={session.id}>
                                        <TableCell className="font-medium">{session.customerEmail || 'N/A'}</TableCell>
                                        <TableCell><Badge variant="secondary">{session.plan}</Badge></TableCell>
                                        <TableCell className="font-mono text-xs">{session.licenseKey}</TableCell>
                                        <TableCell className="font-mono text-xs">{session.id.substring(0, 12)}...</TableCell>
                                        <TableCell>
                                            {formatDistanceToNow(session.lastSeen.toDate(), { addSuffix: true })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
