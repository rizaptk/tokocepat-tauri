
import * as XLSX from 'xlsx';
import { Transaction } from '@/lib/types';
import { format } from 'date-fns';

export const exportSalesToExcel = (transactions: Transaction[], dateRange: { from: Date, to: Date }, storeName: string) => {
    
    const dataForExport = transactions.map(tx => {
        const txCost = tx.items.reduce((itemSum, item) => itemSum + ((item.cost_snapshot || 0) * item.qty), 0);
        const txProfit = tx.subtotal - txCost;

        return {
            'Date': format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
            'Invoice #': tx.invoice_number,
            'Items': tx.items.reduce((sum, item) => sum + item.qty, 0),
            'Subtotal': tx.subtotal,
            'Tax': tx.tax_amount,
            'Profit': txProfit,
            'Total': tx.total,
        };
    });
    
    // Add summary row
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalProfit = dataForExport.reduce((sum, row) => sum + row.Profit, 0);
    const totalTax = transactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
    const totalSubtotal = transactions.reduce((sum, tx) => sum + tx.subtotal, 0);

    const summary = {
        'Date': 'TOTAL',
        'Invoice #': '',
        'Items': '',
        'Subtotal': totalSubtotal,
        'Tax': totalTax,
        'Profit': totalProfit,
        'Total': totalRevenue,
    };
    
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    XLSX.writeFile(workbook, `sales_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
};
