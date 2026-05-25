// import { Link, useNavigate } from 'react-router-dom';
// import * as React from 'react';
// import { useState, useMemo, useRef } from 'react';
// import { DateRange } from 'react-day-picker';
// import { endOfDay, startOfDay, subDays, format } from 'date-fns';
// import { ArrowLeft, BarChart2, DollarSign, ReceiptText, Landmark, Search, Loader2, FileDown, FileText } from 'lucide-react';
// import { exportSalesToExcel, exportSalesToPdf } from '@/lib/export';
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// // 1. Import Virtualizer
// import { useVirtualizer } from '@tanstack/react-virtual';

// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import { Transaction } from '@/lib/types';
// import TransactionDetailDialog from '@/components/TransactionDetailDialog';
// import { DateRangeFilter } from '@/components/DateRangeFilter';
// // import { getTransactionsByDateRange } from '@/services/transactionService';
// import { useStore } from '@/lib/store';
// import { NotificationBell } from '@/components/NotificationBell';
// import { ThemeToggle } from '@/components/ThemeButtons';
// import { useLoadTransactions } from '@/hooks/useLoadTransaction';

// const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat('id-ID', {
//         style: 'currency',
//         currency: 'IDR',
//         minimumFractionDigits: 0,
//     }).format(amount);
// };


// // Pre-define the Memoized Row
// const TransactionRow = React.memo(({ 
//     tx, 
//     virtualRow, 
//     columnStyles, 
//     onClick 
// }: { 
//     tx: Transaction, 
//     virtualRow: any, 
//     columnStyles: any, 
//     onClick: (tx: Transaction) => void 
// }) => {
//     // Move logic inside the memoized component
//     const txCost = tx.items.reduce((sum, i) => sum + ((i.cost_snapshot || 0) * i.qty), 0);
//     const txProfit = tx.subtotal - txCost;

//     return (
//         <div
//             onClick={() => onClick(tx)}
//             className="flex items-center px-4 border-b hover:bg-muted/50 cursor-pointer transition-colors text-sm absolute top-0 left-0 w-full"
//             style={{
//                 height: `${virtualRow.size}px`,
//                 transform: `translateY(${virtualRow.start}px)`,
//             }}
//         >
//             <div className={columnStyles.waktu}>
//                 <div className="font-medium">{format(new Date(tx.created_at), 'dd MMM yyyy')}</div>
//                 <div className="text-[12px] text-muted-foreground">{format(new Date(tx.created_at), 'p')}</div>
//             </div>
//             <div className={`${columnStyles.invoice} font-mono text-[13px]`}>
//                 {tx.invoice_number}
//             </div>
//             <div className={columnStyles.subtotal}>
//                 {formatCurrency(tx.subtotal)}
//             </div>
//             <div className={`${columnStyles.hpp} text-destructive/80`}>
//                 {formatCurrency(txCost)}
//             </div>
//             <div className={`${columnStyles.laba} text-green-600 font-medium`}>
//                 {formatCurrency(txProfit)}
//             </div>
//             <div className={columnStyles.pajak}>
//                 {formatCurrency(tx.tax_amount)}
//             </div>
//             <div className={`${columnStyles.total} font-bold text-primary`}>
//                 {formatCurrency(tx.total)}
//             </div>
//         </div>
//     );
// });

// TransactionRow.displayName = 'TransactionRow';


// export default function SalesReportPage() {
//     const [date, setDate] = React.useState<DateRange | undefined>({
//       from: startOfDay(subDays(new Date(), 29)),
//       to: endOfDay(new Date()),
//     });
//     const [searchTerm, setSearchTerm] = useState('');
//     const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
//     // const [transactions, setTransactions] = useState<Transaction[]>([]);
//     // const [isLoading, setIsLoading] = useState(true);
//     const { storeConfig } = useStore();
//     const nav = useNavigate();

//     // 2. Setup Reference for the scrolling container
//     const parentRef = useRef<HTMLDivElement>(null);

//     const {transactions, isLoading} = useLoadTransactions(date);

//     // useEffect(() => {
//     //     if (!date?.from || !date?.to) return;
//     //     const fetchTransactions = async () => {
//     //         setIsLoading(true);
//     //         const data = await getTransactionsByDateRange(date.from!, date.to!);
//     //         setTransactions(data);
//     //         setIsLoading(false);
//     //     };
//     //     fetchTransactions();
//     // }, [date]);

//     const filteredTransactions = useMemo(() => {
//         const paidTransactions = transactions.filter(tx => tx.status === 'paid');
//         if (!searchTerm.trim()) return paidTransactions;
//         return paidTransactions.filter(tx => 
//             tx.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())
//         );
//     }, [transactions, searchTerm]);

//     const rowVirtualizer = useVirtualizer({
//         count: filteredTransactions.length,
//         getScrollElement: () => parentRef.current,
//         estimateSize: () => 60,
//         overscan: 10,
//     });

//     // Define columns to ensure header and body are ALWAYS identical
//     // We use Tailwind 'w-[px]' for fixed and 'flex-1' for relative columns
//     const columnStyles = {
//         waktu: "w-[200px] shrink-0",
//         invoice: "w-[160px] shrink-0",
//         subtotal: "flex-1 text-right",
//         hpp: "flex-1 text-right",
//         laba: "flex-1 text-right",
//         pajak: "flex-1 text-right",
//         total: "flex-1 shrink-0 text-right pr-6"
//     };

//     const stats = useMemo(() => {
//         const paidTransactions = transactions.filter(tx => tx.status === 'paid');
//         const totalRevenue = paidTransactions.reduce((sum, tx) => sum + tx.total, 0);
//         const totalSubtotal = paidTransactions.reduce((sum, tx) => sum + tx.subtotal, 0);
//         const totalTax = paidTransactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
//         const totalCost = paidTransactions.reduce((sum, tx) => {
//             return sum + tx.items.reduce((itemSum, item) => {
//                 return itemSum + ((item.cost_snapshot || 0) * item.qty);
//             }, 0);
//         }, 0);
//         const totalProfit = totalSubtotal - totalCost;

//         return [
//             { title: 'Total Omzet', value: formatCurrency(totalRevenue), icon: DollarSign },
//             { title: 'Laba Kotor', value: formatCurrency(totalProfit), icon: DollarSign },
//             { title: 'Total Pajak', value: formatCurrency(totalTax), icon: Landmark },
//             { title: 'Transaksi', value: paidTransactions.length, icon: ReceiptText },
//         ];
//     }, [transactions]);
    
//     const handleExcelExport = async () => {
//         const paidTransactions = transactions.filter(tx => tx.status === 'paid');
//         if (storeConfig && date?.from && date?.to) {
//             await exportSalesToExcel(paidTransactions, {from: date.from, to: date.to }, storeConfig.store_name);
//         } else {
//             alert("Konfigurasi toko atau periode tidak ditemukan.");
//         }
//     };
    
//     const handlePdfExport = async () => {
//         const paidTransactions = transactions.filter(tx => tx.status === 'paid');
//         if (storeConfig && date?.from && date?.to) {
//             await exportSalesToPdf(paidTransactions, {from: date.from, to: date.to }, storeConfig.store_name);
//         } else {
//             alert("Konfigurasi toko atau periode tidak ditemukan.");
//         }
//     }

//     const handleRowClick = React.useCallback((tx: Transaction) => {
//         setSelectedTx(tx);
//     }, []);

//     return (
//         <>
//         <div className="flex min-h-screen w-full flex-col bg-muted/40">
//            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
//                 <Button variant="outline" size="icon" className="shrink-0" asChild>
//                     <Link to="#" onClick={() => nav(-1)}>
//                         <ArrowLeft className="h-4 w-4" />
//                         <span className="sr-only">Kembali ke Laporan</span>
//                     </Link>
//                 </Button>
//                 <div className="flex-1">
//                     <h1 className="text-lg font-semibold flex items-center gap-2">
//                         <BarChart2 className="h-5 w-5" /> Laporan Penjualan
//                     </h1>
//                 </div>
//                 <div className="flex items-center gap-2">
//                     <DropdownMenu>
//                         <DropdownMenuTrigger asChild>
//                           <Button variant="outline" size="sm" disabled={transactions.length === 0}>
//                             <FileDown className="mr-2 h-4 w-4" />
//                             <span>Ekspor</span>
//                           </Button>
//                         </DropdownMenuTrigger>
//                         <DropdownMenuContent align="end">
//                             <DropdownMenuItem onSelect={handleExcelExport}>
//                                 <FileDown className="mr-2 h-4 w-4 text-green-500"/> Excel (.xlsx)
//                             </DropdownMenuItem>
//                             <DropdownMenuItem onSelect={handlePdfExport}>
//                                 <FileText className="mr-2 h-4 w-4 text-red-400"/> PDF (.pdf)
//                             </DropdownMenuItem>
//                         </DropdownMenuContent>
//                     </DropdownMenu>
//                     <NotificationBell />
//                     <ThemeToggle />
//                 </div>
//            </header>
//           <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
//             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
//                 {stats.map((stat, index) => (
//                     <Card key={index}>
//                         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//                             <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
//                             <stat.icon className="h-4 w-4 text-muted-foreground" />
//                         </CardHeader>
//                         <CardContent>
//                             <div className="text-2xl font-bold">{stat.value}</div>
//                         </CardContent>
//                     </Card>
//                 ))}
//             </div>

//             <Card className="flex-1 flex flex-col overflow-hidden mb-4">
//                 <CardHeader className="shrink-0">
//                     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//                         <div>
//                             <CardTitle>Detail Transaksi</CardTitle>
//                             <CardDescription>
//                                 Menampilkan {filteredTransactions.length} transaksi.
//                             </CardDescription>
//                         </div>
//                         <div className="flex items-center gap-2">
//                             <DateRangeFilter date={date} setDate={setDate} preset='last30' />
//                             <div className="relative">
//                                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
//                                 <Input
//                                     type="search"
//                                     placeholder="Cari invoice..."
//                                     className="pl-8 w-64"
//                                     value={searchTerm}
//                                     onChange={(e) => setSearchTerm(e.target.value)}
//                                 />
//                             </div>
//                         </div>
//                     </div>
//                 </CardHeader>

//                 <CardContent className="py-0 px-6 flex-1 flex flex-col relative overflow-hidden">
//                     {/* TABLE HEADER (Separated to stay static) */}
//                     <div className="w-full border-b shrink-0">
//                         <div className="flex items-center h-12 px-4 pb-2 pt-4 text-sm font-medium text-muted-foreground hover:bg-muted/50">
//                             <div className={columnStyles.waktu}>Waktu</div>
//                             <div className={columnStyles.invoice}>Invoice</div>
//                             <div className={columnStyles.subtotal}>Subtotal</div>
//                             <div className={columnStyles.hpp}>HPP</div>
//                             <div className={columnStyles.laba}>Laba</div>
//                             <div className={columnStyles.pajak}>Pajak</div>
//                             <div className={columnStyles.total}>Total</div>
//                         </div>
//                     </div>

//                     {/* VIRTUALIZED BODY CONTAINER */}
//                     <div 
//                         ref={parentRef} 
//                         className="flex-1 overflow-auto scrollbar-thin relative"
//                     >
//                         <div
//                             style={{
//                                 height: `${rowVirtualizer.getTotalSize()}px`,
//                                 width: '100%',
//                                 position: 'relative',
//                             }}
//                         >
//                             {isLoading ? (
//                                 <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></div>
//                             ) : filteredTransactions.length > 0 ? (
//                                 rowVirtualizer.getVirtualItems().map((virtualRow) => 
//                                 <TransactionRow
//                                     key={filteredTransactions[virtualRow.index].id}
//                                     tx={filteredTransactions[virtualRow.index]}
//                                     virtualRow={virtualRow}
//                                     columnStyles={columnStyles}
//                                     onClick={handleRowClick}
//                                 />
//                                 )
//                             ) : (
//                                 <div className="p-20 text-center text-muted-foreground">Tidak ada data.</div>
//                             )}
//                         </div>
//                     </div>
//                 </CardContent>
//             </Card>
//           </main>
//         </div>
//         <TransactionDetailDialog transaction={selectedTx} onOpenChange={(isOpen) => !isOpen && setSelectedTx(null)} />
//         </>
//     );
// }

import { Link, useNavigate } from 'react-router-dom';
import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { DateRange } from 'react-day-picker';
import { endOfDay, startOfDay, subDays, format } from 'date-fns';
import { ArrowLeft, BarChart2, DollarSign, ReceiptText, Landmark, Search, Loader2, FileDown, FileText, Package, Wallet, TrendingUp } from 'lucide-react';
import { exportSalesToExcel, exportSalesToPdf } from '@/lib/export';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// 1. Import Virtualizer
import { useVirtualizer } from '@tanstack/react-virtual';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction } from '@/lib/types';
import TransactionDetailDialog from '@/components/TransactionDetailDialog';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useStore } from '@/lib/store';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeButtons';
import { useLoadTransactions } from '@/hooks/useLoadTransaction';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};


// Pre-define the Memoized Row
const TransactionRow = React.memo(({ 
    tx, 
    virtualRow, 
    columnStyles, 
    onClick 
}: { 
    tx: Transaction, 
    virtualRow: any, 
    columnStyles: any, 
    onClick: (tx: Transaction) => void 
}) => {
    // --- SPLIT COSTS IN THE DETAILED ROW ---
    let standardCost = 0;
    let consignmentPayout = 0;
    
    tx.items.forEach(i => {
        const costVal = (i.cost_snapshot || 0) * i.qty;
        if (i.product_snapshot.is_consignment) {
            consignmentPayout += costVal;
        } else {
            standardCost += costVal;
        }
    });

    const txProfit = tx.subtotal - standardCost - consignmentPayout;

    return (
        <div
            onClick={() => onClick(tx)}
            className="flex items-center px-4 border-b hover:bg-muted/50 cursor-pointer transition-colors text-sm absolute top-0 left-0 w-full"
            style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
            }}
        >
            <div className={columnStyles.waktu}>
                <div className="font-medium">{format(new Date(tx.created_at), 'dd MMM yyyy')}</div>
                <div className="text-[12px] text-muted-foreground">{format(new Date(tx.created_at), 'p')}</div>
            </div>
            <div className={`${columnStyles.invoice} font-mono text-[13px]`}>
                {tx.invoice_number}
            </div>
            <div className={columnStyles.subtotal}>
                {formatCurrency(tx.subtotal)}
            </div>
            <div className={`${columnStyles.hpp} text-destructive/80`}>
                {formatCurrency(standardCost)}
            </div>
            <div className={`${columnStyles.titipan} text-amber-600 dark:text-amber-400`}>
                {formatCurrency(consignmentPayout)}
            </div>
            <div className={`${columnStyles.laba} text-green-600 font-medium`}>
                {formatCurrency(txProfit)}
            </div>
            <div className={columnStyles.pajak}>
                {formatCurrency(tx.tax_amount)}
            </div>
            <div className={`${columnStyles.total} font-bold text-primary`}>
                {formatCurrency(tx.total)}
            </div>
        </div>
    );
});

TransactionRow.displayName = 'TransactionRow';


export default function SalesReportPage() {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const { storeConfig } = useStore();
    const nav = useNavigate();

    // 2. Setup Reference for the scrolling container
    const parentRef = useRef<HTMLDivElement>(null);

    const {transactions, isLoading} = useLoadTransactions(date);

    const filteredTransactions = useMemo(() => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (!searchTerm.trim()) return paidTransactions;
        return paidTransactions.filter(tx => 
            tx.invoice_number.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [transactions, searchTerm]);

    const rowVirtualizer = useVirtualizer({
        count: filteredTransactions.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 10,
    });

    // Define columns to ensure header and body are ALWAYS identical
    const columnStyles = {
        waktu: "w-[150px] shrink-0",
        invoice: "w-[130px] shrink-0",
        subtotal: "flex-1 text-right",
        hpp: "flex-1 text-right",
        titipan: "flex-1 text-right",
        laba: "flex-1 text-right",
        pajak: "flex-1 text-right",
        total: "flex-1 shrink-0 text-right pr-6"
    };

    const stats = useMemo(() => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        const totalRevenue = paidTransactions.reduce((sum, tx) => sum + tx.total, 0);
        const totalSubtotal = paidTransactions.reduce((sum, tx) => sum + tx.subtotal, 0);
        const totalTax = paidTransactions.reduce((sum, tx) => sum + tx.tax_amount, 0); // Restored calculation
        
        let totalStandardCost = 0;
        let totalConsignmentPayout = 0;

        paidTransactions.forEach(tx => {
            tx.items.forEach(item => {
                const costVal = (item.cost_snapshot || 0) * item.qty;
                if (item.product_snapshot.is_consignment) {
                    totalConsignmentPayout += costVal;
                } else {
                    totalStandardCost += costVal;
                }
            });
        });

        const totalProfit = totalSubtotal - totalStandardCost - totalConsignmentPayout;

        return [
            { title: 'Total Omzet', value: formatCurrency(totalRevenue), icon: DollarSign },
            { title: 'HPP Standar Toko', value: formatCurrency(totalStandardCost), icon: Package },
            { title: 'Bagi Hasil Titipan', value: formatCurrency(totalConsignmentPayout), icon: Wallet },
            { title: 'Margin Laba Kotor', value: formatCurrency(totalProfit), icon: TrendingUp },
            { title: 'Total Pajak', value: formatCurrency(totalTax), icon: Landmark }, // Restored Card
            { title: 'Transaksi', value: paidTransactions.length.toString(), icon: ReceiptText }, // Restored Card
        ];
    }, [transactions]);
    
    const handleExcelExport = async () => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (storeConfig && date?.from && date?.to) {
            await exportSalesToExcel(paidTransactions, {from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            alert("Konfigurasi toko atau periode tidak ditemukan.");
        }
    };
    
    const handlePdfExport = async () => {
        const paidTransactions = transactions.filter(tx => tx.status === 'paid');
        if (storeConfig && date?.from && date?.to) {
            await exportSalesToPdf(paidTransactions, {from: date.from, to: date.to }, storeConfig.store_name);
        } else {
            alert("Konfigurasi toko atau periode tidak ditemukan.");
        }
    }

    const handleRowClick = React.useCallback((tx: Transaction) => {
        setSelectedTx(tx);
    }, []);

    return (
        <>
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-10">
                <Button variant="outline" size="icon" className="shrink-0" asChild>
                    <Link to="#" onClick={() => nav(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Kembali ke Laporan</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <BarChart2 className="h-5 w-5" /> Laporan Penjualan
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={transactions.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            <span>Ekspor</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={handleExcelExport}>
                                <FileDown className="mr-2 h-4 w-4 text-green-500"/> Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={handlePdfExport}>
                                <FileText className="mr-2 h-4 w-4 text-red-400"/> PDF (.pdf)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <NotificationBell />
                    <ThemeToggle />
                </div>
           </header>
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden mb-4">
                <CardHeader className="shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <CardTitle>Detail Transaksi</CardTitle>
                            <CardDescription>
                                Menampilkan {filteredTransactions.length} transaksi.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <DateRangeFilter date={date} setDate={setDate} preset='last30' />
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Cari invoice..."
                                    className="pl-8 w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="py-0 px-6 flex-1 flex flex-col relative overflow-hidden">
                    {/* TABLE HEADER (Separated to stay static) */}
                    <div className="w-full border-b shrink-0">
                        <div className="flex items-center h-12 px-4 pb-2 pt-4 text-sm font-medium text-muted-foreground hover:bg-muted/50">
                            <div className={columnStyles.waktu}>Waktu</div>
                            <div className={columnStyles.invoice}>Invoice</div>
                            <div className={columnStyles.subtotal}>Subtotal</div>
                            <div className={columnStyles.hpp}>HPP Toko</div>
                            <div className={columnStyles.titipan}>Bagi Hasil</div>
                            <div className={columnStyles.laba}>Laba</div>
                            <div className={columnStyles.pajak}>Pajak</div>
                            <div className={columnStyles.total}>Total</div>
                        </div>
                    </div>

                    {/* VIRTUALIZED BODY CONTAINER */}
                    <div 
                        ref={parentRef} 
                        className="flex-1 overflow-auto scrollbar-thin relative"
                    >
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {isLoading ? (
                                <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></div>
                            ) : filteredTransactions.length > 0 ? (
                                rowVirtualizer.getVirtualItems().map((virtualRow) => 
                                <TransactionRow
                                    key={filteredTransactions[virtualRow.index].id}
                                    tx={filteredTransactions[virtualRow.index]}
                                    virtualRow={virtualRow}
                                    columnStyles={columnStyles}
                                    onClick={handleRowClick}
                                />
                                )
                            ) : (
                                <div className="p-20 text-center text-muted-foreground">Tidak ada data.</div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
          </main>
        </div>
        <TransactionDetailDialog transaction={selectedTx} onOpenChange={(isOpen) => !isOpen && setSelectedTx(null)} />
        </>
    );
}