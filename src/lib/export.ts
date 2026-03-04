
import * as XLSX from 'xlsx';
import { Transaction, Product, StoreConfig, StockMovement } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

export const exportSalesToExcel = (transactions: Transaction[], dateRange: { from: Date, to: Date }, storeName: string) => {
    
    const dataForExport = transactions.map(tx => {
        const txCost = tx.items.reduce((itemSum, item) => itemSum + ((item.cost_snapshot || 0) * item.qty), 0);
        const txProfit = tx.subtotal - txCost;

        return {
            'Date': format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
            'Invoice #': tx.invoice_number,
            'Items': tx.items.reduce((sum, item) => sum + item.qty, 0),
            'Subtotal': tx.subtotal,
            'Cost': txCost,
            'Profit': txProfit,
            'Tax': tx.tax_amount,
            'Total': tx.total,
        };
    });
    
    // Add summary row
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalProfit = dataForExport.reduce((sum, row) => sum + row.Profit, 0);
    const totalTax = transactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
    const totalSubtotal = transactions.reduce((sum, tx) => sum + tx.subtotal, 0);
    const totalCost = dataForExport.reduce((sum, row) => sum + row.Cost, 0);

    const summary = {
        'Date': 'TOTAL',
        'Invoice #': '',
        'Items': '',
        'Subtotal': totalSubtotal,
        'Cost': totalCost,
        'Profit': totalProfit,
        'Tax': totalTax,
        'Total': totalRevenue,
    };
    
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    XLSX.writeFile(workbook, `sales_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
};

export const exportInventoryToExcel = (products: (Product & { categoryName: string })[], storeName: string) => {
    const dataForExport = products.map(p => ({
        'Product Name': p.name,
        'Category': p.categoryName,
        'SKU': p.sku || 'N/A',
        'Current Stock': p.stock,
        'Cost Price': p.cost_price || 0,
        'Retail Price': p.price,
        'Value (Cost)': p.stock * (p.cost_price || 0),
        'Value (Retail)': p.stock * p.price,
    }));

    const totalValueCost = dataForExport.reduce((sum, row) => sum + row['Value (Cost)'], 0);
    const totalValueRetail = dataForExport.reduce((sum, row) => sum + row['Value (Retail)'], 0);
    const totalUnits = dataForExport.reduce((sum, row) => sum + row['Current Stock'], 0);

    const summary = {
        'Product Name': 'TOTAL',
        'Category': '',
        'SKU': '',
        'Current Stock': totalUnits,
        'Cost Price': '',
        'Retail Price': '',
        'Value (Cost)': totalValueCost,
        'Value (Retail)': totalValueRetail,
    };

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Report');

    const date = format(new Date(), 'yyyy-MM-dd');
    XLSX.writeFile(workbook, `inventory_report_${storeName.replace(/\s+/g, '_')}_${date}.xlsx`);
};

export const exportStockSummaryToExcel = (reportData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const dataForExport = reportData.map(item => ({
        'Product/Ingredient': item.name,
        'Type': item.type,
        'Opening Stock': item.openingStock,
        'Added (+)': item.added,
        'Sold (-)': item.sold,
        'Adjusted (+/-)': item.adjusted,
        'Closing Stock': item.closingStock,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Summary');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    XLSX.writeFile(workbook, `stock_summary_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
};

export const exportSalesToPdf = async (transactions: Transaction[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10;
    const margin = 50;
    let y = height - margin;

    // Title
    page.drawText(`${storeName} - Sales Report`, {
        x: margin,
        y,
        font: boldFont,
        size: 18,
    });
    y -= 30;

    // Date Range
    page.drawText(`Period: ${format(dateRange.from, 'PPP')} to ${format(dateRange.to, 'PPP')}`, {
        x: margin,
        y,
        font,
        size: 12,
    });
    y -= 20;

    // Summary
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalProfit = transactions.reduce((sum, tx) => {
        const txCost = tx.items.reduce((itemSum, item) => itemSum + ((item.cost_snapshot || 0) * item.qty), 0);
        return sum + (tx.subtotal - txCost);
    }, 0);
    const totalTax = transactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
    
    page.drawText(`Total Revenue: ${formatCurrency(totalRevenue)}`, { x: margin, y, font, size: fontSize });
    y -= 15;
    page.drawText(`Total Tax: ${formatCurrency(totalTax)}`, { x: margin, y, font, size: fontSize });
    y -= 15;
    page.drawText(`Total Profit: ${formatCurrency(totalProfit)}`, { x: margin, y, font, size: fontSize });
    y -= 15;
    page.drawText(`Total Transactions: ${transactions.length}`, { x: margin, y, font, size: fontSize });
    y -= 30;

    // Table Header
    const tableHeaders = ['Date', 'Invoice', 'Items', 'Subtotal', 'Cost', 'Profit', 'Tax', 'Total'];
    const colWidths = [70, 80, 30, 60, 60, 60, 60, 70];
    let x = margin;
    tableHeaders.forEach((header, i) => {
        page.drawText(header, { x, y, font: boldFont, size: fontSize });
        x += colWidths[i];
    });
    y -= 5;
    page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 1,
    });
    y -= 15;

    // Table Body
    for (const tx of transactions) {
        if (y < margin) {
            // For simplicity, we'll assume it fits on one page. 
            // A real implementation would add a new page here.
            break; 
        }
        const txCost = tx.items.reduce((itemSum, item) => itemSum + ((item.cost_snapshot || 0) * item.qty), 0);
        const txProfit = tx.subtotal - txCost;
        const row = [
            format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm'),
            tx.invoice_number,
            tx.items.reduce((sum, item) => sum + item.qty, 0).toString(),
            formatCurrency(tx.subtotal),
            formatCurrency(txCost),
            formatCurrency(txProfit),
            formatCurrency(tx.tax_amount),
            formatCurrency(tx.total)
        ];

        x = margin;
        row.forEach((cell, i) => {
            page.drawText(cell, { x, y, font, size: 8 });
            x += colWidths[i];
        });
        y -= 12;
    }

    const pdfBytes = await pdfDoc.save();
    
    // Trigger download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    link.download = `sales_report_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

type ReportRow = StockMovement & {
    referenceDisplay: string;
    openingStock: number;
    resultingStock: number;
    productType: 'Product' | 'Ingredient';
};

export const exportStockMovementToExcel = (movements: ReportRow[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const dataForExport = movements.map(m => ({
        'Date': format(new Date(m.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'Product': m.product_name_snapshot,
        'Product Type': m.productType,
        'Movement Type': m.type,
        'Opening Stock': m.openingStock,
        'Quantity Change': m.qty_change,
        'Resulting Stock': m.resultingStock,
        'Reason / Reference': m.referenceDisplay,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Movements');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    XLSX.writeFile(workbook, `stock_movement_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
};

export const exportStockMovementToPdf = async (movements: ReportRow[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const margin = 40;
    let y = height - margin;

    const drawHeader = () => {
        page.drawText(`${storeName} - Stock Movement Report`, { x: margin, y, font: boldFont, size: 16 });
        y -= 20;
        page.drawText(`Period: ${format(dateRange.from, 'PPP')} to ${format(dateRange.to, 'PPP')}`, { x: margin, y, font, size: 10 });
        y -= 25;
    };
    
    drawHeader();
    
    const tableHeaders = ['Date', 'Product', 'Type', 'Open', 'Qty', 'Result', 'Ref'];
    const colWidths = [70, 130, 55, 40, 40, 45, 150];
    let x = margin;
    
    // Draw table header
    tableHeaders.forEach((header, i) => {
        page.drawText(header, { x, y, font: boldFont, size: fontSize });
        x += colWidths[i];
    });
    y -= 5;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1 });
    y -= 15;
    
    for (const m of movements) {
        if (y < margin) {
            page = pdfDoc.addPage();
            y = height - margin;
            drawHeader();
            let x = margin;
            tableHeaders.forEach((header, i) => {
                page.drawText(header, { x, y, font: boldFont, size: fontSize });
                x += colWidths[i];
            });
            y -= 5;
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1 });
            y -= 15;
        }

        const row = [
            format(new Date(m.created_at), 'yy-MM-dd HH:mm'),
            m.product_name_snapshot,
            m.type,
            m.openingStock.toString(),
            m.qty_change.toString(),
            m.resultingStock.toString(),
            m.referenceDisplay,
        ];
        
        x = margin;
        row.forEach((cell, i) => {
            const textWidth = font.widthOfTextAtSize(cell, 8);
            const truncatedCell = textWidth > colWidths[i] - 5 ? cell.substring(0, Math.floor(cell.length * ((colWidths[i] - 5) / textWidth))) + '...' : cell;
            page.drawText(truncatedCell, { x, y, font, size: 8 });
            x += colWidths[i];
        });
        y -= 12;
    }

    const pdfBytes = await pdfDoc.save();
    
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    link.download = `stock_movement_report_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export const exportConsumptionToExcel = (reportData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const dataForExport = reportData.map(item => ({
        'Ingredient': item.name,
        'Opening Stock': item.openingStock,
        'Consumed (Sales)': item.consumed,
        'Consumed Value': item.costOfConsumed,
        'Adjusted (Manual)': item.adjusted,
        'Closing Stock': item.closingStock,
        'Unit': item.unit_type,
        'Closing Value': item.closingStock * item.cost_per_unit,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Consumption Report');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    XLSX.writeFile(workbook, `consumption_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
};

export const exportConsumptionToPdf = async (reportData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const margin = 40;
    let y = height - margin;

    const drawHeader = () => {
        page.drawText(`${storeName} - Ingredient Consumption Report`, { x: margin, y, font: boldFont, size: 16 });
        y -= 20;
        page.drawText(`Period: ${format(dateRange.from, 'PPP')} to ${format(dateRange.to, 'PPP')}`, { x: margin, y, font, size: 10 });
        y -= 25;
    };
    
    drawHeader();
    
    const tableHeaders = ['Ingredient', 'Opening', 'Consumed', 'Consumed Val', 'Adjusted', 'Closing', 'Closing Val'];
    const colWidths = [120, 60, 60, 70, 60, 60, 70];
    let x = margin;
    
    tableHeaders.forEach((header, i) => {
        page.drawText(header, { x, y, font: boldFont, size: fontSize });
        x += colWidths[i];
    });
    y -= 5;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1 });
    y -= 15;
    
    for (const item of reportData) {
        if (y < margin) {
            page = pdfDoc.addPage();
            y = height - margin;
            drawHeader();
            let x = margin;
            tableHeaders.forEach((header, i) => {
                page.drawText(header, { x, y, font: boldFont, size: fontSize });
                x += colWidths[i];
            });
            y -= 5;
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1 });
            y -= 15;
        }

        const row = [
            item.name,
            `${item.openingStock.toLocaleString()} ${item.unit_type}`,
            `${item.consumed > 0 ? `-${item.consumed.toLocaleString()}` : 0}`,
            formatCurrency(item.costOfConsumed),
            `${item.adjusted > 0 ? `+${item.adjusted.toLocaleString()}` : item.adjusted.toLocaleString()}`,
            `${item.closingStock.toLocaleString()} ${item.unit_type}`,
            formatCurrency(item.closingStock * item.cost_per_unit),
        ];
        
        x = margin;
        row.forEach((cell, i) => {
            page.drawText(cell, { x, y, font, size: 8 });
            x += colWidths[i];
        });
        y -= 12;
    }

    const pdfBytes = await pdfDoc.save();
    
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    link.download = `consumption_report_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportShiftDetailsToPdf = async (shift: any, transactions: Transaction[], storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10;
    const margin = 50;
    let y = height - margin;

    // Title
    page.drawText(`${storeName} - Shift Detail Report`, {
        x: margin,
        y,
        font: boldFont,
        size: 18,
    });
    y -= 30;

    // Shift Summary
    const openedAt = typeof shift.opened_at === 'string' ? parseISO(shift.opened_at) : new Date(shift.opened_at);
    const closedAt = shift.closed_at ? (typeof shift.closed_at === 'string' ? parseISO(shift.closed_at) : new Date(shift.closed_at)) : null;
    
    page.drawText(`Shift ID: ${shift.id}`, { x: margin, y, font, size: 12 });
    y -= 18;
    page.drawText(`Period: ${format(openedAt, 'PPP p')} to ${closedAt ? format(closedAt, 'PPP p') : 'Ongoing'}`, {
        x: margin,
        y,
        font,
        size: 12,
    });
    y -= 25;

    // Financial Summary
    const totalSales = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.total, 0);
    const totalVoid = transactions.filter(t => t.status === 'voided').reduce((sum, t) => sum + t.total, 0);
    const expectedCash = shift.opening_cash + totalSales;

    const summaryData = [
        { label: 'Opening Cash:', value: formatCurrency(shift.opening_cash) },
        { label: 'Total Sales:', value: formatCurrency(totalSales) },
        { label: 'Total Void:', value: formatCurrency(totalVoid), color: rgb(0.8, 0, 0) },
        { label: 'Expected in Drawer:', value: formatCurrency(expectedCash) },
        { label: 'Declared at Close:', value: formatCurrency(shift.declared_cash || 0) },
        { label: 'Variance:', value: formatCurrency(shift.variance || 0), color: shift.variance === 0 ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0) }
    ];

    let x = margin;
    summaryData.forEach(item => {
        page.drawText(item.label, { x, y, font, size: fontSize });
        page.drawText(item.value, { x: x + 120, y, font: boldFont, size: fontSize, color: item.color || rgb(0,0,0) });
        y -= 15;
    });
    y -= 15;


    // Transactions Table Header
    const tableHeaders = ['Time', 'Invoice #', 'Items', 'Total', 'Status'];
    const colWidths = [100, 150, 50, 100, 80];
    x = margin;
    tableHeaders.forEach((header, i) => {
        page.drawText(header, { x, y, font: boldFont, size: fontSize });
        x += colWidths[i];
    });
    y -= 5;
    page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 1,
    });
    y -= 15;

    // Transactions Table Body
    for (const tx of transactions) {
        if (y < margin) {
            // For simplicity, we'll assume it fits on one page. 
            // A real implementation would add a new page here.
            break; 
        }
        
        // Handle cases where created_at might be a UUID string or invalid date string
        let txDate = typeof tx.created_at === 'string' ? parseISO(tx.created_at) : new Date(tx.created_at);
        if (isNaN(txDate.getTime())) {
            // Fallback to current date if the stored value is not a valid date (e.g. a random UUID)
            txDate = new Date();
        }

        const row = [
            format(txDate, 'HH:mm:ss'),
            tx.invoice_number,
            tx.items.reduce((sum, item) => sum + item.qty, 0).toString(),
            formatCurrency(tx.total),
            tx.status
        ];

        x = margin;
        row.forEach((cell, i) => {
            page.drawText(cell, { x, y, font, size: 8, color: tx.status === 'voided' ? rgb(0.5, 0.5, 0.5) : rgb(0,0,0) });
            x += colWidths[i];
        });
        y -= 12;
    }

    const pdfBytes = await pdfDoc.save();
    
    // Trigger download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shift_report_${storeName.replace(/\s+/g, '_')}_${shift.id.substring(0,8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportBarcodeStickersToPdf = async (products: Product[]) => {
    // --- PDF Configuration ---
    const page = PageSizes.Letter; // [612, 792] points
    const pageMargin = 36; // 0.5 inch
    const stickerWidth = 192; // 2.66 inches
    const stickerHeight = 72; // 1 inch
    const gapX = 12;
    const gapY = 0;
    const cols = 3;
    const rows = 10;
    // -------------------------

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

    let productIndex = 0;
    
    while (productIndex < products.length) {
        const currentPage = pdfDoc.addPage(page);
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (productIndex >= products.length) break;

                const product = products[productIndex];
                if (!product.barcode) {
                    productIndex++;
                    c--; // Retry this cell with the next product
                    continue;
                }

                const x = pageMargin + c * (stickerWidth + gapX);
                const y = page[1] - pageMargin - stickerHeight - r * (stickerHeight + gapY);

                // --- Draw Sticker Content ---
                // Name (truncated)
                let productName = product.name;
                if (productName.length > 25) {
                    productName = productName.substring(0, 22) + '...';
                }
                currentPage.drawText(productName, {
                    x: x + 5,
                    y: y + stickerHeight - 20,
                    font: boldFont,
                    size: 10,
                });

                // Price
                currentPage.drawText(formatCurrency(product.price), {
                    x: x + 5,
                    y: y + stickerHeight - 38,
                    font,
                    size: 9,
                });
                
                // Barcode String
                currentPage.drawText(`*${product.barcode}*`, {
                    x: x + 5,
                    y: y + stickerHeight - 60,
                    font: monoFont, // Use monospaced for barcode-like appearance
                    size: 11,
                });

                productIndex++;
            }
            if (productIndex >= products.length) break;
        }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'barcode_labels.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
