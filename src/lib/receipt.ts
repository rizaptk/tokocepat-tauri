/** @ts-ignore - No types available for this package */
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { Transaction, StoreConfig } from './types';

const formatCurrency = (amount: number) => {
    // Simple formatter for receipt, no currency symbol
    return new Intl.NumberFormat('id-ID').format(amount);
};

export function generateReceiptBinary(transaction: Transaction, storeConfig: StoreConfig): Uint8Array {
    
    // Set width (32 characters is standard for 58mm printers)
    // width: 42, // for 80mm
    const receiptWidth = 32;

    // Initialize the new encoder
    const encoder = new ReceiptPrinterEncoder({
        feedBeforeCut: 4,
        columns: receiptWidth
    });
    
    // Helper for two column layout
    const twoCols = (left: string, right: string) => {
        const space = receiptWidth - left.length - right.length;
        return left + ' '.repeat(Math.max(1, space)) + right;
    };

    encoder.initialize();

    // --- Header ---
    encoder
        .align('center')
        .bold(true)
        .line(storeConfig.store_name.toUpperCase())
        .bold(false);

    // Only print address if it exists and is not empty
    if (storeConfig.address && storeConfig.address.trim()) {
        encoder.line(storeConfig.address);
    }
    
    encoder.newline();

    // --- Transaction Info ---
    encoder
        .align('left')
        .line(`Inv: ${transaction.invoice_number}`)
        .line(`Date: ${new Date(transaction.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`)
        .rule({ char: '-' }); // Automatically draws ----------------

    // --- Items ---
    transaction.items.forEach(item => {
        // Product Name
        encoder.line(item.product_snapshot.name);
        
        // Modifiers
        if (item.selected_modifiers_snapshot && item.selected_modifiers_snapshot.length > 0) {
            item.selected_modifiers_snapshot.forEach(mod => {
                encoder.line(`  + ${mod.item.name}`);
            });
        }

        // Price details: "1 x 10.000          10.000"
        const priceDetail = `  ${item.qty} x ${formatCurrency(item.price_snapshot)}`;
        const subtotal = formatCurrency(item.subtotal);
        encoder.line(twoCols(priceDetail, subtotal));
    });

    encoder.rule({ char: '-' });

    // --- Totals ---
    encoder
        .line(twoCols('Subtotal', formatCurrency(transaction.subtotal)))
        .line(twoCols(`Tax (${Math.round((storeConfig.tax_rate || 0.11) * 100)}%)`, formatCurrency(transaction.tax_amount)))
        .rule({ char: '=' })
        .bold(true)
        .line(twoCols('TOTAL', formatCurrency(transaction.total)))
        .bold(false)
        .line(twoCols('CASH', formatCurrency(transaction.cash_paid)))
        .line(twoCols('CHANGE', formatCurrency(transaction.change)))
        .newline();

    // --- Footer ---
    encoder.align('center');

    if (storeConfig.receipt_footer && storeConfig.receipt_footer.trim()) {
        encoder.line(storeConfig.receipt_footer);
    } else {
        encoder.line('Thank You!');
    }
    
    encoder
        .newline()
        .newline()
        .cut(); // Native cut command

    // Returns a Uint8Array ready for WebUSBPrinter.print()
    return encoder.encode();
}
