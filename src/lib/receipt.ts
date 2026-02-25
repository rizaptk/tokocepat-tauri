
import { Transaction, StoreConfig } from './types';

const formatCurrency = (amount: number) => {
    // Simple formatter for receipt, no currency symbol
    return new Intl.NumberFormat('id-ID').format(amount);
};

export function generateReceiptText(transaction: Transaction, storeConfig: StoreConfig): string {
    const receiptWidth = 32; // Standard for 58mm thermal printers

    const center = (text: string) => text.padStart(Math.floor((receiptWidth + text.length) / 2), ' ').padEnd(receiptWidth, ' ');
    const line = (char = '-') => char.repeat(receiptWidth);
    const twoCols = (left: string, right: string) => {
        const space = receiptWidth - left.length - right.length;
        return left + ' '.repeat(Math.max(1, space)) + right;
    };

    let text = '';
    text += center(storeConfig.store_name) + '\n';
    text += center('Jl. Merdeka No. 45, Jakarta') + '\n\n';
    
    text += `Inv: ${transaction.invoice_number}\n`;
    text += `Date: ${new Date(transaction.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}\n`;
    text += line() + '\n';

    // Items
    transaction.items.forEach(item => {
        text += item.product_snapshot.name + '\n';
        if (item.selected_modifiers_snapshot && item.selected_modifiers_snapshot.length > 0) {
            item.selected_modifiers_snapshot.forEach(mod => {
                 text += `  + ${mod.item.name}\n`;
            });
        }
        const priceLine = `  ${item.qty} x ${formatCurrency(item.price_snapshot)}`;
        text += twoCols(priceLine, formatCurrency(item.subtotal)) + '\n';
    });

    text += line('-') + '\n';

    // Totals
    text += twoCols('Subtotal', formatCurrency(transaction.subtotal)) + '\n';
    text += twoCols(`Tax (${Math.round((storeConfig.tax_rate || 0.11) * 100)}%)`, formatCurrency(transaction.tax_amount)) + '\n';
    text += line('=') + '\n';
    text += twoCols('TOTAL', formatCurrency(transaction.total)) + '\n';
    text += twoCols('CASH', formatCurrency(transaction.cash_paid)) + '\n';
    text += twoCols('CHANGE', formatCurrency(transaction.change)) + '\n\n';

    // Footer
    text += center(storeConfig.receipt_footer || 'Thank You!') + '\n';
    
    return text;
}

export function printReceipt(receiptText: string) {
    const printWindow = window.open('', 'PRINT', 'height=600,width=400');
    
    if (printWindow) {
        printWindow.document.write('<html><head><title>Receipt</title>');
        printWindow.document.write('<style> body { font-family: "Courier New", monospace; font-size: 10pt; } pre { white-space: pre-wrap; } </style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write('<pre>');
        printWindow.document.write(receiptText);
        printWindow.document.write('</pre>');
        printWindow.document.write('</body></html>');

        printWindow.document.close();
        printWindow.focus();
        
        // Use a timeout to ensure content is loaded before printing
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    } else {
        alert('Please allow popups for printing.');
    }
}
