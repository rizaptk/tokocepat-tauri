

import * as XLSX from 'xlsx';
import { Transaction, Product, StoreConfig, StockMovement } from '@/lib/types';
import { format } from 'date-fns';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
        'Adjusted (Manual)': item.adjusted,
        'Closing Stock': item.closingStock,
        'Unit': item.unit_type,
        'Value (Cost)': item.closingStock * item.cost_per_unit,
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
    
    const tableHeaders = ['Ingredient', 'Opening', 'Consumed', 'Adjusted', 'Closing', 'Cost Value'];
    const colWidths = [150, 70, 70, 70, 70, 80];
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
