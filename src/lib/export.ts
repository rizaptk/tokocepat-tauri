
import { formatIDR as formatCurrency } from "@/lib/format";
import * as XLSX from 'xlsx';
import { Transaction, Product, StockMovement, Shift } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';

/** @ts-ignore - bwip-js does not provide types for browser-side buffer generation */
import bwipjs from 'bwip-js';

import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';



// --- NEW HELPER: Native Save Function ---
async function saveFileNative(data: Uint8Array, defaultFilename: string, extensions: { name: string, extensions: string[] }[]) {
    try {
        const path = await save({
            defaultPath: defaultFilename,
            filters: extensions
        });

        if (path) {
            await writeFile(path, data);
            return true;
        }
    } catch (err) {
        console.error("Failed to save file natively:", err);
    }
    return false;
}


// sales export
// lib/export.ts

export const exportSalesToExcel = async (transactions: Transaction[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const dataForExport = transactions.map(tx => {
        let stdCost = 0;
        let consPayout = 0;
        
        tx.items.forEach(item => {
            const costVal = (item.cost_snapshot || 0) * item.qty;
            if (item.product_snapshot.is_consignment) {
                consPayout += costVal;
            } else {
                stdCost += costVal;
            }
        });

        const txProfit = tx.subtotal - (tx.discount_total || 0) - stdCost - consPayout;

        return {
            'Date': format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm:ss'),
            'Invoice #': tx.invoice_number,
            'Items': tx.items.reduce((sum, item) => sum + item.qty, 0),
            'Subtotal': tx.subtotal,
            'Diskon': tx.discount_total || 0,
            'HPP Standar Toko': stdCost,
            'Bagi Hasil Titipan': consPayout,
            'Profit': txProfit,
            'Tax (Pajak)': tx.tax_amount, // Preserved Tax Column
            'Total': tx.total,
        };
    });

    // Calculate totals summary row
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalTax = transactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
    const totalSubtotal = transactions.reduce((sum, tx) => sum + tx.subtotal, 0);
    const totalDiscount = transactions.reduce((sum, tx) => sum + (tx.discount_total || 0), 0);
    const totalItems = transactions.reduce((sum, tx) => sum + tx.items.reduce((s, item) => s + item.qty, 0), 0);
    const totalStandardCost = dataForExport.reduce((sum, row) => sum + row['HPP Standar Toko'], 0);
    const totalConsignmentPayout = dataForExport.reduce((sum, row) => sum + row['Bagi Hasil Titipan'], 0);
    const totalProfit = dataForExport.reduce((sum, row) => sum + row.Profit, 0);

    const summary = {
        'Date': 'TOTAL',
        'Invoice #': '',
        'Items': totalItems,
        'Subtotal': totalSubtotal,
        'Diskon': totalDiscount,
        'HPP Standar Toko': totalStandardCost,
        'Bagi Hasil Titipan': totalConsignmentPayout,
        'Profit': totalProfit,
        'Tax (Pajak)': totalTax,
        'Total': totalRevenue,
    };

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    const filename = `sales_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`;
    await saveFileNative(uint8Array, filename, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportSalesToPdf = async (transactions: Transaction[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const fontSize = 9;
    const bodyFontSize = 7; // Font size slightly reduced to 7pt to comfortably fit all 9 columns
    const margin = 35;
    
    // Printable A4 width is 595 - 70 = 525 units.
    // Sum of colWidths below is 518 units, ensuring complete alignment without overflow.
    const tableHeaders = ['Tanggal', 'Invoice', 'Qty', 'Subtotal', 'Diskon', 'HPP Toko', 'Titipan', 'Laba', 'Pajak', 'Total'];
    const colWidths = [66, 70, 16, 54, 46, 54, 54, 54, 48, 56];

    const drawTableHeader = (page: any, yPos: number) => {
        const { width } = page.getSize();
        let currentX = margin;
        tableHeaders.forEach((header, i) => {
            page.drawText(header, { x: currentX, y: yPos, font: boldFont, size: fontSize });
            currentX += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({
            start: { x: margin, y: lineY },
            end: { x: width - margin, y: lineY },
            thickness: 1,
        });
        return lineY - 15;
    };

    let currentPage = pdfDoc.addPage();
    const { height } = currentPage.getSize();
    let y = height - margin;

    currentPage.drawText(`${storeName} - Laporan Penjualan`, { x: margin, y: y, font: boldFont, size: 16 });
    y -= 25;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y: y, font: font, size: 10 });
    y -= 30;

    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);
    const totalTax = transactions.reduce((sum, tx) => sum + tx.tax_amount, 0);
    
    currentPage.drawText(`Total Omzet: ${formatCurrency(totalRevenue)}`, { x: margin, y: y, font: font, size: 9 });
    currentPage.drawText(`Total Transaksi: ${transactions.length}`, { x: margin + 200, y: y, font: font, size: 9 });
    y -= 15;
    currentPage.drawText(`Total Pajak: ${formatCurrency(totalTax)}`, { x: margin, y: y, font: font, size: 9 });
    
    y -= 40; 
    y = drawTableHeader(currentPage, y);

    for (const tx of transactions) {
        if (y < 50) {
            currentPage = pdfDoc.addPage();
            y = height - margin;
            y = drawTableHeader(currentPage, y);
        }

        let stdCost = 0;
        let consPayout = 0;
        
        tx.items.forEach(item => {
            const costVal = (item.cost_snapshot || 0) * item.qty;
            if (item.product_snapshot.is_consignment) {
                consPayout += costVal;
            } else {
                stdCost += costVal;
            }
        });

        const txProfit = tx.subtotal - (tx.discount_total || 0) - stdCost - consPayout;

        const row = [
            format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm'),
            tx.invoice_number,
            tx.items.reduce((sum, item) => sum + item.qty, 0).toString(),
            formatCurrency(tx.subtotal),
            formatCurrency(tx.discount_total || 0),
            formatCurrency(stdCost),
            formatCurrency(consPayout),
            formatCurrency(txProfit),
            formatCurrency(tx.tax_amount), // Re-introduced Tax Column
            formatCurrency(tx.total)
        ];

        let currentX = margin;
        row.forEach((cell, i) => {
            currentPage.drawText(cell, { x: currentX, y: y, font: font, size: bodyFontSize });
            currentX += colWidths[i];
        });

        y -= 14; 
    }

    // --- Grand Total Row ---
    const grandTotal = transactions.reduce((acc, tx) => {
        let stdCost = 0;
        let consPayout = 0;
        tx.items.forEach(item => {
            const costVal = (item.cost_snapshot || 0) * item.qty;
            if (item.product_snapshot.is_consignment) {
                consPayout += costVal;
            } else {
                stdCost += costVal;
            }
        });
        acc.subtotal += tx.subtotal;
        acc.discount += tx.discount_total || 0;
        acc.stdCost += stdCost;
        acc.consPayout += consPayout;
        acc.tax += tx.tax_amount;
        acc.total += tx.total;
        acc.qty += tx.items.reduce((sum, item) => sum + item.qty, 0);
        return acc;
    }, { subtotal: 0, discount: 0, stdCost: 0, consPayout: 0, tax: 0, total: 0, qty: 0 });

    if (y < 50) {
        currentPage = pdfDoc.addPage();
        y = height - margin;
        y = drawTableHeader(currentPage, y);
    }

    const pageSize = currentPage.getSize();
    currentPage.drawLine({
        start: { x: margin, y: y + 6 },
        end: { x: pageSize.width - margin, y: y + 6 },
        thickness: 1,
    });

    const grandRow = [
        'TOTAL',
        '',
        grandTotal.qty.toString(),
        formatCurrency(grandTotal.subtotal),
        formatCurrency(grandTotal.discount),
        formatCurrency(grandTotal.stdCost),
        formatCurrency(grandTotal.consPayout),
        formatCurrency(grandTotal.subtotal - grandTotal.discount - grandTotal.stdCost - grandTotal.consPayout),
        formatCurrency(grandTotal.tax),
        formatCurrency(grandTotal.total)
    ];

    let grandX = margin;
    grandRow.forEach((cell, i) => {
        currentPage.drawText(cell, { x: grandX, y: y, font: boldFont, size: bodyFontSize });
        grandX += colWidths[i];
    });

    const pdfBytes = await pdfDoc.save();
    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const filename = `sales_report_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);
};

// stock summary
export const exportStockSummaryToExcel = async (reportData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
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
    // XLSX.writeFile(workbook, `stock_summary_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    const filename = `stock_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`;
    await saveFileNative(uint8Array, filename, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

type ReportRow = StockMovement & {
    referenceDisplay: string;
    openingStock: number;
    resultingStock: number;
    productType: 'Product' | 'Ingredient' | 'Variant';
};

export const exportStockMovementToExcel = async (movements: ReportRow[], dateRange: { from: Date, to: Date }, storeName: string) => {
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
    // XLSX.writeFile(workbook, `stock_movement_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    const filename = `stock_movement_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`;
    await saveFileNative(uint8Array, filename, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportStockMovementToPdf = async (movements: ReportRow[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const fontSize = 9;
    const bodyFontSize = 8;
    const margin = 40;
    
    // Sesuaikan lebar kolom agar pas dengan lebar kertas A4 (total ~515 unit)
    const tableHeaders = ['Waktu', 'Produk', 'Tipe', 'Awal', 'Ubah', 'Akhir', 'Ref'];
    const colWidths = [75, 120, 45, 35, 35, 35, 170]; 

    // --- HELPER: Fungsi menggambar Header Tabel ---
    const drawTableHeader = (page: any, yPos: number) => {
        const { width } = page.getSize();
        let xPos = margin;
        tableHeaders.forEach((header, i) => {
            page.drawText(header, { x: xPos, y: yPos, font: boldFont, size: fontSize });
            xPos += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({
            start: { x: margin, y: lineY },
            end: { x: width - margin, y: lineY },
            thickness: 1,
        });
        return lineY - 15; // Posisi Y untuk data pertama
    };

    // --- HALAMAN 1: Judul & Info ---
    let currentPage = pdfDoc.addPage();
    const { height } = currentPage.getSize();
    let y = height - margin;

    // Gambar Judul Laporan (Hanya di halaman 1)
    currentPage.drawText(`${storeName} - Laporan Mutasi Stok`, { x: margin, y, font: boldFont, size: 16 });
    y -= 20;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}`, { x: margin, y, font, size: 10 });
    y -= 35; // Jarak sebelum tabel

    // Gambar Header Tabel Halaman 1
    y = drawTableHeader(currentPage, y);

    // --- LOOP DATA ---
    for (const m of movements) {
        // Cek batas bawah halaman (threshold 50)
        if (y < 50) {
            currentPage = pdfDoc.addPage();
            y = height - margin; // Reset Y ke paling atas di halaman baru
            y = drawTableHeader(currentPage, y); // Gambar ulang header tabel di halaman baru
        }

        const row = [
            format(new Date(m.created_at), 'yy-MM-dd HH:mm'),
            m.product_name_snapshot,
            m.productType === 'Product' ? 'Produk' : m.productType === 'Ingredient' ? 'Bahan' : 'Varian',
            m.openingStock.toString(),
            (m.qty_change > 0 ? '+' : '') + m.qty_change.toString(),
            m.resultingStock.toString(),
            m.referenceDisplay,
        ];

        let xPos = margin;
        row.forEach((cell, i) => {
            // Logika Truncate agar teks tidak menabrak kolom sebelah
            const text = String(cell || '');
            const textWidth = font.widthOfTextAtSize(text, bodyFontSize);
            const maxWidth = colWidths[i] - 8;
            
            let displayHeader = text;
            if (textWidth > maxWidth) {
                // Truncate sederhana jika terlalu panjang
                displayHeader = text.substring(0, Math.floor(text.length * (maxWidth / textWidth))) + '..';
            }

            currentPage.drawText(displayHeader, { x: xPos, y, font, size: bodyFontSize });
            xPos += colWidths[i];
        });

        y -= 14; // Tinggi baris
    }

    const pdfBytes = await pdfDoc.save();
    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const filename = `mutasi_stok_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);
}

export const exportConsumptionToExcel = async (reportData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
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
    // XLSX.writeFile(workbook, `consumption_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`);
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    const filename = `consumption_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`;
    await saveFileNative(uint8Array, filename, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportConsumptionToPdf = async (reportData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const bodyFontSize = 8;
    const margin = 40;

    const tableHeaders = ['Bahan', 'Awal', 'Keluar', 'Nilai Keluar', 'Adj', 'Akhir', 'Nilai Akhir'];
    const colWidths = [120, 60, 60, 75, 50, 60, 75];

    const drawTableHeader = (page: any, yPos: number) => {
        let x = margin;
        tableHeaders.forEach((header, i) => {
            page.drawText(header, { x, y: yPos, font: boldFont, size: fontSize });
            x += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    let y = height - margin;
    page.drawText(`${storeName} - Laporan Konsumsi Bahan`, { x: margin, y, font: boldFont, size: 16 });
    y -= 20;
    page.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y, font, size: 10 });
    y -= 30;

    y = drawTableHeader(page, y);

    for (const item of reportData) {
        if (y < 50) {
            page = pdfDoc.addPage();
            y = height - margin;
            y = drawTableHeader(page, y);
        }

        const row = [
            item.name,
            `${item.openingStock.toLocaleString()}`,
            `${item.consumed > 0 ? `-${item.consumed.toLocaleString()}` : '0'}`,
            formatCurrency(item.costOfConsumed),
            `${item.adjusted > 0 ? `+${item.adjusted.toLocaleString()}` : item.adjusted.toLocaleString()}`,
            `${item.closingStock.toLocaleString()}`,
            formatCurrency(item.closingStock * item.cost_per_unit),
        ];

        let x = margin;
        row.forEach((cell, i) => {
            page.drawText(cell, { x, y, font, size: bodyFontSize });
            x += colWidths[i];
        });
        y -= 12;
    }

    const pdfBytes = await pdfDoc.save();

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const filename = `consumption_report_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);
};

export const exportStockSummaryToPdf = async (reportData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const bodyFontSize = 8;
    const margin = 40;

    const tableHeaders = ['Produk/Bahan', 'Tipe', 'Awal', 'Masuk', 'Keluar', 'Adj', 'Akhir'];
    const colWidths = [180, 60, 55, 55, 55, 55, 55];

    const drawTableHeader = (page: any, yPos: number) => {
        let x = margin;
        tableHeaders.forEach((header, i) => {
            page.drawText(header, { x, y: yPos, font: boldFont, size: fontSize });
            x += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    let y = height - margin;
    page.drawText(`${storeName} - Ringkasan Stok`, { x: margin, y, font: boldFont, size: 16 });
    y -= 20;
    page.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y, font, size: 10 });
    y -= 30;

    y = drawTableHeader(page, y);

    for (const item of reportData) {
        if (y < 50) {
            page = pdfDoc.addPage();
            y = height - margin;
            y = drawTableHeader(page, y);
        }

        const row = [
            item.name,
            item.type === 'product' ? 'Produk' : 'Bahan',
            item.openingStock.toLocaleString(),
            item.added > 0 ? `+${item.added.toLocaleString()}` : '0',
            item.sold > 0 ? `-${item.sold.toLocaleString()}` : '0',
            item.adjusted !== 0 ? item.adjusted.toLocaleString() : '0',
            item.closingStock.toLocaleString(),
        ];

        let x = margin;
        row.forEach((cell, i) => {
            page.drawText(cell, { x, y, font, size: bodyFontSize });
            x += colWidths[i];
        });
        y -= 12;
    }

    const pdfBytes = await pdfDoc.save();

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const filename = `stocks_summary_report_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);
};

// individual shift detail
export const exportShiftDetailsToPdf = async (shift: any, transactions: Transaction[], storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10;
    const bodyFontSize = 8;
    const margin = 50;

    const tableHeaders = ['Waktu', 'Invoice', 'Item', 'Total', 'Status'];
    const colWidths = [80, 150, 50, 100, 80];

    const drawTableHeader = (page: any, yPos: number) => {
        let x = margin;
        tableHeaders.forEach((header, i) => {
            page.drawText(header, { x, y: yPos, font: boldFont, size: fontSize });
            x += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    let y = height - margin;
    page.drawText(`${storeName} - Detail Sif`, { x: margin, y, font: boldFont, size: 18 });
    y -= 30;

    // Info Sif
    const openedAt = typeof shift.opened_at === 'string' ? parseISO(shift.opened_at) : new Date(shift.opened_at);
    const closedAt = shift.closed_at ? (typeof shift.closed_at === 'string' ? parseISO(shift.closed_at) : new Date(shift.closed_at)) : null;

    page.drawText(`Shift ID: ${shift.id}`, { x: margin, y, font, size: 12 });
    y -= 18;
    page.drawText(`Periode: ${format(openedAt, 'PPP p')} s.d. ${closedAt ? format(closedAt, 'PPP p') : 'Berjalan'}`, {
        x: margin,
        y,
        font,
        size: 12,
    });
    y -= 25;

    // Ringkasan Keuangan
    const totalSales = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.total, 0);
    const totalVoid = transactions.filter(t => t.status === 'voided').reduce((sum, t) => sum + t.total, 0);
    const expectedCash = shift.opening_cash + totalSales;

    const summaryData = [
        { label: 'Kas Awal:', value: formatCurrency(shift.opening_cash) },
        { label: 'Total Penjualan:', value: formatCurrency(totalSales) },
        { label: 'Total Batal:', value: formatCurrency(totalVoid), color: rgb(0.8, 0, 0) },
        { label: 'Ekspektasi Kas:', value: formatCurrency(expectedCash) },
        { label: 'Kas Aktual:', value: formatCurrency(shift.declared_cash || 0) },
        { label: 'Selisih:', value: formatCurrency(shift.variance || 0), color: shift.variance === 0 ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0) }
    ];

    const x = margin;
    summaryData.forEach(item => {
        page.drawText(item.label, { x, y, font, size: fontSize });
        page.drawText(item.value, { x: x + 120, y, font: boldFont, size: fontSize, color: item.color || rgb(0, 0, 0) });
        y -= 15;
    });

    y = drawTableHeader(page, y);

    // Tabel Transaksi
    let activePage = page;
    for (const tx of transactions) {
        if (y < 50) {
            activePage = pdfDoc.addPage();
            y = height - margin;
            y = drawTableHeader(activePage, y);
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
            tx.status === 'paid' ? 'Lunas' : 'Void'
        ];

        let x = margin;
        row.forEach((cell, i) => {
            activePage.drawText(cell, { x, y, font, size: bodyFontSize, color: tx.status === 'voided' ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0) });
            x += colWidths[i];
        });
        y -= 12;
    }

    const pdfBytes = await pdfDoc.save();

    const filename = `shift_report_${storeName.replace(/\s+/g, '_')}_${shift.id.substring(0, 8)}.pdf`;
    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);
};

export const exportShiftsToExcel = async (shifts: Shift[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const dataForExport = shifts.map(s => ({
        'Date': s.closed_at ? format(new Date(s.closed_at), 'yyyy-MM-dd') : '-',
        'Time Range': (s.opened_at && s.closed_at) 
            ? `${format(new Date(s.opened_at), 'HH:mm')} - ${format(new Date(s.closed_at), 'HH:mm')}`
            : '-',
        'Opening Cash': s.opening_cash,
        'Expected Cash': s.system_cash || 0,
        'Declared Cash': s.declared_cash || 0,
        'Variance': s.variance || 0,
    }));

    // Add summary row
    const totalOpening = shifts.reduce((sum, s) => sum + s.opening_cash, 0);
    const totalExpected = shifts.reduce((sum, s) => sum + (s.system_cash || 0), 0);
    const totalDeclared = shifts.reduce((sum, s) => sum + (s.declared_cash || 0), 0);
    const totalVariance = shifts.reduce((sum, s) => sum + (s.variance || 0), 0);

    const summary = {
        'Date': 'TOTAL',
        'Time Range': '',
        'Opening Cash': totalOpening,
        'Expected Cash': totalExpected,
        'Declared Cash': totalDeclared,
        'Variance': totalVariance,
    };

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shift Report');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    const filename = `shift_history_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`;
    await saveFileNative(uint8Array, filename, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportShiftsToPdf = async (shifts: Shift[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 9;
    const bodyFontSize = 8;
    const margin = 40;

    const tableHeaders = ['Tanggal', 'Jam', 'Modal', 'Ekspetasi', 'Deklarasi', 'Selisih'];
    const colWidths = [75, 85, 85, 85, 85, 85];

    const drawTableHeader = (page: any, yPos: number) => {
        const { width } = page.getSize();
        let xPos = margin;
        tableHeaders.forEach((header, i) => {
            page.drawText(header, { x: xPos, y: yPos, font: boldFont, size: fontSize });
            xPos += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({
            start: { x: margin, y: lineY },
            end: { x: width - margin, y: lineY },
            thickness: 1,
        });
        return lineY - 15;
    };

    let currentPage = pdfDoc.addPage();
    const { height } = currentPage.getSize();
    let y = height - margin;

    currentPage.drawText(`${storeName} - Laporan Riwayat Sif`, { x: margin, y, font: boldFont, size: 16 });
    y -= 20;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y, font, size: 10 });
    y -= 35;

    y = drawTableHeader(currentPage, y);

    for (const s of shifts) {
        if (y < 50) {
            currentPage = pdfDoc.addPage();
            y = height - margin;
            y = drawTableHeader(currentPage, y);
        }

        const row = [
            s.closed_at ? format(new Date(s.closed_at), 'dd/MM/yy') : '-',
            (s.opened_at && s.closed_at) ? `${format(new Date(s.opened_at), 'HH:mm')}-${format(new Date(s.closed_at), 'HH:mm')}` : 'Aktif',
            formatCurrency(s.opening_cash),
            formatCurrency(s.system_cash || 0),
            formatCurrency(s.declared_cash || 0),
            formatCurrency(s.variance || 0)
        ];

        let xPos = margin;
        row.forEach((cell, i) => {
            currentPage.drawText(cell, { 
                x: xPos, 
                y, 
                font, 
                size: bodyFontSize,
                color: i === 5 && (s.variance || 0) !== 0 ? rgb(0.8, 0, 0) : rgb(0, 0, 0)
            });
            xPos += colWidths[i];
        });
        y -= 14;
    }

    const pdfBytes = await pdfDoc.save();
    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const filename = `shift_history_${storeName.replace(/\s+/g, '_')}_${range}.pdf`;
    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);
};

export const exportVoidToExcel = async (transactions: Transaction[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const dataForExport = transactions.map(tx => ({
        'Void Date': tx.voided_at ? format(new Date(tx.voided_at), 'yyyy-MM-dd HH:mm') : '-',
        'Invoice #': tx.invoice_number,
        'Reason': tx.void_reason || 'No reason provided',
        'Amount': tx.total,
    }));

    // Add summary row
    const totalVoidedAmount = transactions.reduce((sum, tx) => sum + tx.total, 0);

    const summary = {
        'Void Date': 'TOTAL VOIDED',
        'Invoice #': '',
        'Reason': `${transactions.length} Transactions`,
        'Amount': totalVoidedAmount,
    };

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Void Report');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    const filename = `void_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`;
    await saveFileNative(uint8Array, filename, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportVoidToPdf = async (transactions: Transaction[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const fontSize = 9;
    const margin = 40;
    const tableHeaders = ['Waktu', 'No. Faktur', 'Alasan Void', 'Total'];
    const colWidths = [90, 100, 225, 100];

    const drawTableHeader = (page: any, yPos: number) => {
        const { width } = page.getSize();
        let xPos = margin;
        tableHeaders.forEach((h, i) => {
            page.drawText(h, { x: xPos, y: yPos, font: boldFont, size: fontSize });
            xPos += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    let currentPage = pdfDoc.addPage();
    const { width, height } = currentPage.getSize();
    let y = height - margin;

    // Header Laporan
    currentPage.drawText(`${storeName} - LAPORAN VOID`, { x: margin, y, font: boldFont, size: 16 });
    y -= 20;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`, { x: margin, y, font, size: 10 });
    y -= 35;

    y = drawTableHeader(currentPage, y);

    for (const tx of transactions) {
        if (y < 50) {
            currentPage = pdfDoc.addPage();
            y = height - margin;
            y = drawTableHeader(currentPage, y);
        }

        const row = [
            tx.voided_at ? format(new Date(tx.voided_at), 'dd/MM/yy HH:mm') : '-',
            tx.invoice_number,
            tx.void_reason || '-',
            formatCurrency(tx.total)
        ];

        let xPos = margin;
        row.forEach((cell, i) => {
            const text = cell.length > 45 ? cell.substring(0, 42) + "..." : cell;
            currentPage.drawText(text, { x: xPos, y, font, size: 8 });
            xPos += colWidths[i];
        });
        y -= 15;
    }

    // --- Total Voided Row ---
    const totalVoidedAmount = transactions.reduce((sum, tx) => sum + tx.total, 0);

    if (y < 50) {
        currentPage = pdfDoc.addPage();
        y = height - margin;
        y = drawTableHeader(currentPage, y);
    }

    currentPage.drawLine({
        start: { x: margin, y: y + 6 },
        end: { x: width - margin, y: y + 6 },
        thickness: 1,
    });

    const totalRow = ['TOTAL', '', `${transactions.length} Transaksi`, formatCurrency(totalVoidedAmount)];
    let totalX = margin;
    totalRow.forEach((cell, i) => {
        currentPage.drawText(cell, { x: totalX, y, font: boldFont, size: 8 });
        totalX += colWidths[i];
    });

    const pdfBytes = await pdfDoc.save();
    const range = format(dateRange.from, 'yyyyMMdd') + '_' + format(dateRange.to, 'yyyyMMdd');
    await saveFileNative(pdfBytes, `laporan_void_${range}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
};

export const exportAuditReportToExcel = async (auditData: any[], dateRange: { from: Date, to: Date }, _storeName: string) => {
    const dataForExport = auditData.map(row => ({
        'Date': format(new Date(row.date), 'yyyy-MM-dd'),
        'Shift ID': row.shiftId,
        'Revenue': row.revenue,
        'HPP Standar Toko': row.standardHPP,
        'Bagi Hasil Titipan': row.consignmentPayout,
        'Margin Laba (Paper Profit)': row.paperProfit,
        'Cash Variance': row.variance,
        'Net Realized Profit': row.actualProfit,
        'TX Count': row.txCount
    }));

    // Add totals summary row
    const totalRevenue = auditData.reduce((sum, row) => sum + row.revenue, 0);
    const totalStandardHPP = auditData.reduce((sum, row) => sum + row.standardHPP, 0);
    const totalConsignmentPayout = auditData.reduce((sum, row) => sum + row.consignmentPayout, 0);
    const totalPaperProfit = auditData.reduce((sum, row) => sum + row.paperProfit, 0);
    const totalVariance = auditData.reduce((sum, row) => sum + row.variance, 0);
    const totalActualProfit = auditData.reduce((sum, row) => sum + row.actualProfit, 0);
    const totalTXCount = auditData.reduce((sum, row) => sum + row.txCount, 0);

    const summary = {
        'Date': 'TOTAL',
        'Shift ID': '',
        'Revenue': totalRevenue,
        'HPP Standar Toko': totalStandardHPP,
        'Bagi Hasil Titipan': totalConsignmentPayout,
        'Margin Laba (Paper Profit)': totalPaperProfit,
        'Cash Variance': totalVariance,
        'Net Realized Profit': totalActualProfit,
        'TX Count': totalTXCount
    };

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Report');

    const range = format(dateRange.from!, 'yyyy-MM-dd') + '_to_' + format(dateRange.to!, 'yyyy-MM-dd');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    await saveFileNative(uint8Array, `audit_report_${range}.xlsx`, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportAuditReportToPdf = async (auditData: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const margin = 35;
    // Standard A4 printable width is 595 - 70 = 525 unit. 
    // We adjust table widths and decrease cell sizes to ensure standardHPP and consignmentPayout fit.
    const tableHeaders = ['Tanggal', 'Omzet', 'HPP Toko', 'Titipan', 'Margin', 'Selisih', 'Laba Riil'];
    const colWidths = [70, 75, 75, 75, 75, 75, 80];

    const drawTableHeader = (page: any, yPos: number) => {
        const { width } = page.getSize();
        let xPos = margin;
        tableHeaders.forEach((h, i) => {
            page.drawText(h, { x: xPos, y: yPos, font: boldFont, size: 8 });
            xPos += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    let currentPage = pdfDoc.addPage(PageSizes.A4);
    const { height } = currentPage.getSize();
    let y = height - margin;

    currentPage.drawText(`${storeName.toUpperCase()} - AUDIT BISNIS`, { x: margin, y: y, font: boldFont, size: 16 });
    y -= 20;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y: y, font: font, size: 9 });
    y -= 35;

    y = drawTableHeader(currentPage, y);

    auditData.forEach(row => {
        if (y < 60) {
            currentPage = pdfDoc.addPage(PageSizes.A4);
            y = height - margin;
            y = drawTableHeader(currentPage, y);
        }

        const cells = [
            format(new Date(row.date), 'dd/MM/yyyy'),
            formatCurrency(row.revenue),
            formatCurrency(row.standardHPP),
            formatCurrency(row.consignmentPayout),
            formatCurrency(row.paperProfit),
            formatCurrency(row.variance),
            formatCurrency(row.actualProfit)
        ];

        let xPos = margin;
        cells.forEach((c, i) => {
            currentPage.drawText(c, { 
                x: xPos, 
                y: y, 
                font: i === 6 ? boldFont : font, 
                size: 7.5,
                color: i === 5 && row.variance !== 0 ? rgb(0.8, 0, 0) : rgb(0, 0, 0)
            });
            xPos += colWidths[i];
        });
        y -= 15;
    });

    const pdfBytes = await pdfDoc.save();
    const range = format(dateRange.from, 'yyyyMMdd');
    await saveFileNative(pdfBytes, `audit_bisnis_${range}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
};


// Add to lib/export.ts

export const exportTaxAuditToExcel = async (taxGroups: any[], transactions: Transaction[], dateRange: { from: Date, to: Date }, _storeName: string) => {
    // Sheet 1: Summary by Rate
    const summaryData = taxGroups.map(g => ({
        'Tax Rate': `${(g.rate * 100).toFixed(1)}%`,
        'Taxable Amount (DPP)': g.taxableAmount,
        'Tax Collected': g.taxAmount,
        'Gross Total': g.taxableAmount + g.taxAmount
    }));

    // Sheet 2: Transaction Details
    const detailedData = transactions.map(tx => ({
        'Date': format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm'),
        'Invoice': tx.invoice_number,
        'Status': tx.status.toUpperCase(),
        'Net Sales': tx.subtotal,
        'Tax': tx.tax_amount,
        'Total': tx.total
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(detailedData);
    
    XLSX.utils.book_append_sheet(wb, ws1, "Tax Summary");
    XLSX.utils.book_append_sheet(wb, ws2, "Invoice Details");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const range = format(dateRange.from, 'yyyyMMdd') + '-' + format(dateRange.to, 'yyyyMMdd');
    await saveFileNative(new Uint8Array(excelBuffer), `tax_audit_${range}.xlsx`, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportTaxSummaryToPdf = async (dailyStats: any[], dateRange: { from: Date, to: Date }, storeName: string) => {
    const pdfDoc = await PDFDocument.create();
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    const margin = 50;
    const tableHeaders = ['Tanggal', 'DPP (Dasar Pajak)', 'Terpungut', 'Void/Batal', 'Pajak Bersih'];
    const colWidths = [90, 110, 100, 100, 100];

    const drawTableHeader = (page: any, yPos: number) => {
        const { width } = page.getSize();
        let xPos = margin;
        tableHeaders.forEach((h, i) => {
            page.drawText(h, { x: xPos, y: yPos, font: boldFont, size: 9 });
            xPos += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    let currentPage = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = currentPage.getSize();
    let y = height - margin;

    // --- 1. HEADER & RINGKASAN (HANYA HALAMAN 1) ---
    currentPage.drawText(storeName.toUpperCase(), { x: margin, y, font: boldFont, size: 16 });
    y -= 20;
    currentPage.drawText(`RINGKASAN AUDIT PAJAK`, { x: margin, y, font: boldFont, size: 12, color: rgb(0.3, 0.3, 0.3) });
    y -= 15;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y, font, size: 10 });
    y -= 30;

    const totalDPP = dailyStats.reduce((s, i) => s + i.taxableBase, 0);
    const totalCollected = dailyStats.reduce((s, i) => s + i.taxCollected, 0);
    const totalVoided = dailyStats.reduce((s, i) => s + i.taxVoided, 0);
    const totalNet = dailyStats.reduce((s, i) => s + i.netTaxOwed, 0);

    const boxHeight = 85; // Tinggi kotak ditingkatkan agar lebih lega
    const boxY = y - boxHeight; // Koordinat bawah kotak

    // Menggambar Kotak Abu-abu
    currentPage.drawRectangle({
        x: margin,
        y: boxY,
        width: width - (margin * 2),
        height: boxHeight,
        color: rgb(0.96, 0.96, 0.96),
    });

    // Mulai menggambar teks di dalam kotak dengan padding atas 15 unit
    let kpiY = (boxY + boxHeight) - 18; 
    const labelX = margin + 15;
    const valueX = margin + 180;

    currentPage.drawText(`Total DPP (Dasar Pajak):`, { x: labelX, y: kpiY, font, size: 9 });
    currentPage.drawText(formatCurrency(totalDPP), { x: valueX, y: kpiY, font: boldFont, size: 9 });
    
    kpiY -= 15;
    currentPage.drawText(`Total Pajak Terpungut:`, { x: labelX, y: kpiY, font, size: 9 });
    currentPage.drawText(formatCurrency(totalCollected), { x: valueX, y: kpiY, font: boldFont, size: 9 });

    kpiY -= 15;
    currentPage.drawText(`Total Pajak Void:`, { x: labelX, y: kpiY, font, size: 9, color: rgb(0.7, 0, 0) });
    currentPage.drawText(`(${formatCurrency(totalVoided)})`, { x: valueX, y: kpiY, font: boldFont, size: 9, color: rgb(0.7, 0, 0) });

    kpiY -= 18; // Beri jarak sedikit lebih lebar untuk baris total bersih
    currentPage.drawText(`KEWAJIBAN PAJAK BERSIH:`, { x: labelX, y: kpiY, font: boldFont, size: 10 });
    currentPage.drawText(formatCurrency(totalNet), { x: valueX, y: kpiY, font: boldFont, size: 10, color: rgb(0, 0.4, 0.7) });

    // Update 'y' ke posisi di bawah kotak untuk memulai tabel (beri jarak 40 unit)
    y = boxY - 35;

    // --- 2. TABEL DATA ---
    for (const item of dailyStats) {
        if (y < 60) {
            currentPage = pdfDoc.addPage(PageSizes.A4);
            y = height - margin;
            currentPage.drawText(`${storeName} - Ringkasan Pajak (Lanj.)`, { x: margin, y, font: boldFont, size: 10 });
            y -= 25;
            y = drawTableHeader(currentPage, y);
        }

        const row = [
            format(new Date(item.date), 'dd/MM/yyyy'),
            formatCurrency(item.taxableBase),
            formatCurrency(item.taxCollected),
            item.taxVoided > 0 ? `(${formatCurrency(item.taxVoided)})` : 'Rp 0',
            formatCurrency(item.netTaxOwed)
        ];

        let xPos = margin;
        row.forEach((text, i) => {
            currentPage.drawText(text, { 
                x: xPos, y, font, size: 8,
                color: i === 3 && item.taxVoided > 0 ? rgb(0.7, 0, 0) : rgb(0,0,0)
            });
            xPos += colWidths[i];
        });
        y -= 15;
    }

    const pdfBytes = await pdfDoc.save();
    const rangeStr = format(dateRange.from, 'yyyyMMdd') + '-' + format(dateRange.to, 'yyyyMMdd');
    await saveFileNative(pdfBytes, `ringkasan_pajak_${rangeStr}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
};

const mmToPt = (mm: number) => mm * 2.83465

interface LabelOptions {
    pageSize?: [number, number]
    labelWidthMm?: number
    labelHeightMm?: number
    repeat?: number
    marginMm?: number
    gapMm?: number
}

export const exportBarcodeStickersToPdf = async (
    products: Product[],
    options: LabelOptions = {}
) => {

    const {
        pageSize = PageSizes.A4,
        labelWidthMm = 38,
        labelHeightMm = 13,
        repeat = 1,
        marginMm = 5,
        gapMm = 2
    } = options

    const labelWidth = mmToPt(labelWidthMm)
    const labelHeight = mmToPt(labelHeightMm)

    const margin = mmToPt(marginMm)
    const gap = mmToPt(gapMm)

    const pageWidth = pageSize[0]
    const pageHeight = pageSize[1]

    const cols = Math.floor((pageWidth - margin * 2 + gap) / (labelWidth + gap))
    const rows = Math.floor((pageHeight - margin * 2 + gap) / (labelHeight + gap))

    const pdfDoc = await PDFDocument.create()

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const monoFont = await pdfDoc.embedFont(StandardFonts.Courier)

    const barcodeCache = new Map<string, any>()

    async function getBarcode(barcode: string) {

        if (barcodeCache.has(barcode)) {
            return barcodeCache.get(barcode)
        }

        const canvas = document.createElement("canvas")

        await bwipjs.toCanvas(canvas, {
            bcid: "code128",
            text: barcode,
            scale: 2,
            height: 6,
            includetext: false
        })

        const pngBytes = await fetch(canvas.toDataURL()).then(r => r.arrayBuffer())

        const img = await pdfDoc.embedPng(pngBytes)

        barcodeCache.set(barcode, img)

        return img
    }

    const expandedProducts: Product[] = []

    for (const p of products) {
        for (let i = 0; i < repeat; i++) {
            expandedProducts.push(p)
        }
    }

    let productIndex = 0

    while (productIndex < expandedProducts.length) {

        const page = pdfDoc.addPage(pageSize)

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {

                if (productIndex >= expandedProducts.length) break

                const product = expandedProducts[productIndex]

                if (!product.barcode) {
                    productIndex++
                    c--
                    continue
                }

                const x = margin + c * (labelWidth + gap)

                const y =
                    pageHeight -
                    margin -
                    labelHeight -
                    r * (labelHeight + gap)

                let name = product.name

                if (name.length > 18) {
                    name = name.substring(0, 16) + "..."
                }

                page.drawText(name, {
                    x: x + 3,
                    y: y + labelHeight - 8,
                    size: 6,
                    font: boldFont
                })

                page.drawText(formatCurrency(product.price), {
                    x: x + labelWidth - font.widthOfTextAtSize(formatCurrency(product.price), 6) - 3,
                    y: y + labelHeight - 8,
                    size: 6,
                    font
                })

                const barcodeImg = await getBarcode(product.barcode)

                page.drawImage(barcodeImg, {
                    x: x + 3,
                    y: y + labelHeight - 28,
                    width: labelWidth - 6,
                    height: labelHeight * 0.45
                })

                const barcodeTextWidth = monoFont.widthOfTextAtSize(product.barcode, 6);

                page.drawText(product.barcode, {
                    x: x + (labelWidth / 2) - (barcodeTextWidth / 2),
                    y: y + 2,
                    size: 6,
                    font: monoFont
                })

                productIndex++
            }

            if (productIndex >= expandedProducts.length) break
        }
    }

    const pdfBytes = await pdfDoc.save()

    const filename = `barcode_labels.pdf`;
    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);

}


// lib/export.ts

export const exportConsignorReportToExcel = async (
    reportData: any[], 
    dateRange: { from: Date, to: Date }, 
    storeName: string,
    filterStatus: string = 'unpaid' // --- TAMBAHAN PARAMETER STATUS FILTER ---
) => {
    let dataForExport: any[] = [];
    let summary: any = {};

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const isPaidMode = filterStatus === 'paid';

    if (isPaidMode) {
        // --- LAYOUT EXCEL UNTUK RIWAYAT PEMBAYARAN LUNAS (PAID LEDGER) ---
        dataForExport = reportData.map(item => ({
            'Tanggal Bayar': format(new Date(item.settledDate), 'yyyy-MM-dd'),
            'Nama Penitip': item.consignorName,
            'Nama Produk': item.productName,
            'Harga Jual': item.price,
            'Kuantitas Lunas': item.qty,
            'Tipe Komisi': item.commissionType === 'flat' ? 'Flat / Rupiah' : 'Persentase',
            'Nilai Komisi': item.commissionValue,
            'Total Komisi Toko': item.storeCommission,
            'Total Dibayar (Lunas)': item.consignorShare,
        }));

        const totalQty = reportData.reduce((sum, item) => sum + item.qty, 0);
        const totalStoreCommission = reportData.reduce((sum, item) => sum + item.storeCommission, 0);
        const totalConsignorShare = reportData.reduce((sum, item) => sum + item.consignorShare, 0);

        summary = {
            'Tanggal Bayar': 'TOTAL',
            'Nama Penitip': '',
            'Nama Produk': '',
            'Harga Jual': '',
            'Kuantitas Lunas': totalQty,
            'Tipe Komisi': '',
            'Nilai Komisi': '',
            'Total Komisi Toko': totalStoreCommission,
            'Total Dibayar (Lunas)': totalConsignorShare,
        };
    } else {
        // --- LAYOUT EXCEL STANDAR (BELUM LUNAS / SEMUA AKTIVITAS) ---
        dataForExport = reportData.map(item => ({
            'Nama Penitip': item.consignorName,
            'Nama Produk': item.productName,
            'Harga Jual': item.price,
            'Masuk': item.supplied,
            'Terjual': item.sold,
            'Ditarik': item.returned,
            'Tipe Komisi': item.commissionType === 'flat' ? 'Flat / Rupiah' : 'Persentase',
            'Nilai Komisi': item.commissionValue,
            'Total Komisi Toko': item.storeCommission,
            'Bagi Hasil Penitip': item.consignorShare,
        }));

        const totalSupplied = reportData.reduce((sum, item) => sum + item.supplied, 0);
        const totalSold = reportData.reduce((sum, item) => sum + item.sold, 0);
        const totalReturned = reportData.reduce((sum, item) => sum + item.returned, 0);
        const totalStoreCommission = reportData.reduce((sum, item) => sum + item.storeCommission, 0);
        const totalConsignorShare = reportData.reduce((sum, item) => sum + item.consignorShare, 0);

        summary = {
            'Nama Penitip': 'TOTAL',
            'Nama Produk': '',
            'Harga Jual': '',
            'Masuk': totalSupplied,
            'Terjual': totalSold,
            'Ditarik': totalReturned,
            'Tipe Komisi': '',
            'Nilai Komisi': '',
            'Total Komisi Toko': totalStoreCommission,
            'Bagi Hasil Penitip': totalConsignorShare,
        };
    }

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.sheet_add_json(worksheet, [summary], { origin: -1, skipHeader: true });

    const workbook = XLSX.utils.book_new();
    const sheetName = isPaidMode ? 'Riwayat Pembayaran' : 'Laporan Konsinyasi';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    const filename = isPaidMode 
        ? `riwayat_pembayaran_titipan_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`
        : `laporan_payout_konsinyasi_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`;

    await saveFileNative(uint8Array, filename, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportConsignorReportToPdf = async (
    reportData: any[], 
    dateRange: { from: Date, to: Date }, 
    storeName: string,
    filterStatus: string = 'unpaid' // --- TAMBAHAN PARAMETER STATUS FILTER ---
) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const margin = 40;
    const fontSize = 9;
    const bodyFontSize = 8;
    const isPaidMode = filterStatus === 'paid';

    // --- SETUP COLS & HEADER DYNAMICALLY ---
    const tableHeaders = isPaidMode 
        ? ['Tanggal Bayar', 'Produk', 'Harga', 'Qty Lunas', 'Komisi', 'Total Dibayar']
        : ['Produk', 'Harga', 'Masuk', 'Laku', 'Sisa', 'Komisi', 'Bagi Hasil'];
        
    const colWidths = isPaidMode
        ? [75, 150, 65, 45, 75, 80] // Total: 490pt
        : [135, 65, 40, 40, 40, 75, 80]; // Total: 475pt

    const drawTableHeader = (page: any, yPos: number) => {
        const { width } = page.getSize();
        let xPos = margin;
        tableHeaders.forEach((h, i) => {
            page.drawText(h, { x: xPos, y: yPos, font: boldFont, size: fontSize });
            xPos += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    let currentPage = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = currentPage.getSize();
    let y = height - margin;

    // --- HEADER DETAILS ---
    currentPage.drawText(`${storeName.toUpperCase()}`, { x: margin, y: y, font: boldFont, size: 16 });
    y -= 18;
    
    const subtitle = isPaidMode 
        ? 'BUKU RIWAYAT PEMBAYARAN KONSINYASI (PAID LEDGER)'
        : 'LAPORAN BAGI HASIL TITIPAN (KONSINYASI)';
    currentPage.drawText(subtitle, { x: margin, y: y, font: boldFont, size: 11, color: rgb(0.3, 0.3, 0.3) });
    y -= 15;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y: y, font: font, size: 10 });
    y -= 30;

    // --- GRAND TOTAL BOX SUMMARY ---
    const totalSupplied = isPaidMode ? 0 : reportData.reduce((sum, item) => sum + item.supplied, 0);
    const totalSold = isPaidMode 
        ? reportData.reduce((sum, item) => sum + item.qty, 0)
        : reportData.reduce((sum, item) => sum + item.sold, 0);
    const totalStoreCommission = reportData.reduce((sum, item) => sum + item.storeCommission, 0);
    const totalPayout = reportData.reduce((sum, item) => sum + item.consignorShare, 0);

    const boxHeight = 75;
    const boxY = y - boxHeight;

    currentPage.drawRectangle({
        x: margin,
        y: boxY,
        width: width - (margin * 2),
        height: boxHeight,
        color: rgb(0.96, 0.96, 0.96),
    });

    let kpiY = (boxY + boxHeight) - 15;
    if (isPaidMode) {
        currentPage.drawText(`Total Kuantitas Lunas: ${totalSold} unit`, { x: margin + 15, y: kpiY, font: font, size: 8 });
        currentPage.drawText(`Total Transaksi Payout: ${reportData.length} kali`, { x: margin + 220, y: kpiY, font: font, size: 8 });
    } else {
        currentPage.drawText(`Total Barang Masuk: ${totalSupplied} unit`, { x: margin + 15, y: kpiY, font: font, size: 8 });
        currentPage.drawText(`Total Barang Terjual: ${totalSold} unit`, { x: margin + 220, y: kpiY, font: font, size: 8 });
    }
    
    kpiY -= 15;
    currentPage.drawText(`Total Komisi Toko:`, { x: margin + 15, y: kpiY, font: font, size: 9 });
    currentPage.drawText(formatCurrency(totalStoreCommission), { x: margin + 130, y: kpiY, font: boldFont, size: 9 });

    kpiY -= 20;
    const greenLabel = isPaidMode ? 'TOTAL TELAH DIBAYARKAN:' : 'TOTAL SIAP BAYAR KE PENITIP:';
    currentPage.drawText(greenLabel, { x: margin + 15, y: kpiY, font: boldFont, size: 10 });
    currentPage.drawText(formatCurrency(totalPayout), { x: margin + 220, y: kpiY, font: boldFont, size: 10, color: rgb(0, 0.5, 0.2) });

    y = boxY - 30;
    y = drawTableHeader(currentPage, y);

    // --- GROUP BY CONSIGNOR LOGIC ---
    const groupedByConsignor = reportData.reduce((acc: any, item: any) => {
        const key = item.consignorName || 'Umum';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    for (const [consignor, items] of Object.entries(groupedByConsignor)) {
        if (y < 80) {
            currentPage = pdfDoc.addPage(PageSizes.A4);
            y = height - margin;
            y = drawTableHeader(currentPage, y);
        }

        currentPage.drawText(`PENITIP: ${consignor.toUpperCase()}`, { x: margin, y: y, font: boldFont, size: 10, color: rgb(0.1, 0.4, 0.7) });
        y -= 15;

        let consignorTotalPayout = 0;

        for (const item of (items as any[])) {
            if (y < 50) {
                currentPage = pdfDoc.addPage(PageSizes.A4);
                y = height - margin;
                y = drawTableHeader(currentPage, y);
            }

            consignorTotalPayout += item.consignorShare;

            const row = isPaidMode 
                ? [
                    format(new Date(item.settledDate), 'dd/MM/yyyy'),
                    item.productName.length > 28 ? item.productName.substring(0, 25) + "..." : item.productName,
                    formatCurrency(item.price),
                    `${item.qty} unit`,
                    formatCurrency(item.storeCommission),
                    formatCurrency(item.consignorShare)
                  ]
                : [
                    item.productName.length > 25 ? item.productName.substring(0, 22) + "..." : item.productName,
                    formatCurrency(item.price),
                    item.supplied.toString(),
                    item.sold.toString(),
                    item.returned.toString(),
                    formatCurrency(item.storeCommission),
                    formatCurrency(item.consignorShare)
                  ];

            let xPos = margin;
            row.forEach((cell, i) => {
                currentPage.drawText(cell, { x: xPos, y: y, font: font, size: bodyFontSize });
                xPos += colWidths[i];
            });
            y -= 13;
        }

        // Draw subtotal separator line
        currentPage.drawLine({
            start: { x: margin, y: y + 5 },
            end: { x: width - margin, y: y + 5 },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8)
        });

        const payoutLabel = isPaidMode ? `Total Terbayar (${consignor}):` : `Total Bayar (${consignor}):`;
        currentPage.drawText(payoutLabel, { x: margin + 180, y: y, font: boldFont, size: 8 });
        currentPage.drawText(formatCurrency(consignorTotalPayout), { x: margin + 380, y: y, font: boldFont, size: 8, color: rgb(0, 0.5, 0.2) });
        y -= 25;
    }

    const pdfBytes = await pdfDoc.save();
    const rangeStr = format(dateRange.from, 'yyyyMMdd') + '-' + format(dateRange.to, 'yyyyMMdd');
    const filename = isPaidMode 
        ? `riwayat_pembayaran_titipan_${rangeStr}.pdf`
        : `laporan_payout_titipan_${rangeStr}.pdf`;

    await saveFileNative(pdfBytes, filename, [{ name: 'PDF', extensions: ['pdf'] }]);
};

// --- Promo & Voucher Performance Report ---
export const exportPromoPerformanceToExcel = async (
    summary: { totalDiscount: number; autoDiscount: number; voucherDiscount: number; manualDiscount: number; promoSharePct: number },
    diskonRows: any[],
    voucherRows: any[],
    dateRange: { from: Date, to: Date },
    storeName: string
) => {
    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet([
        { 'Metrik': 'Total Diskon', 'Nilai': formatCurrency(summary.totalDiscount) },
        { 'Metrik': 'Diskon Otomatis', 'Nilai': formatCurrency(summary.autoDiscount) },
        { 'Metrik': 'Diskon Voucher', 'Nilai': formatCurrency(summary.voucherDiscount) },
        { 'Metrik': 'Diskon Manual', 'Nilai': formatCurrency(summary.manualDiscount) },
        { 'Metrik': '% Omzet Terdiskon', 'Nilai': `${summary.promoSharePct.toFixed(2)}%` },
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');

    const diskonSheet = XLSX.utils.json_to_sheet(diskonRows.map(r => ({
        'Promo': r.name,
        'Jenis': r.type,
        'Transaksi': r.transactions,
        'Total Diskon': r.totalDiscount,
        'Rata-rata / Transaksi': r.avgPerTx,
        '% Kontribusi': `${r.sharePct.toFixed(2)}%`,
    })));
    XLSX.utils.book_append_sheet(workbook, diskonSheet, 'Diskon');

    const voucherSheet = XLSX.utils.json_to_sheet(voucherRows.map(r => ({
        'Kode': r.code,
        'Nama': r.name,
        'Redeem': r.redeems,
        'Total Nilai': r.totalValue,
        'Kuota Terpakai': r.quotaUsed,
        'Kuota Maks': r.quotaTotal || '-',
        'Status': r.status,
    })));
    XLSX.utils.book_append_sheet(workbook, voucherSheet, 'Voucher');

    const range = format(dateRange.from, 'yyyy-MM-dd') + '_to_' + format(dateRange.to, 'yyyy-MM-dd');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    await saveFileNative(new Uint8Array(excelBuffer), `promo_report_${storeName.replace(/\s+/g, '_')}_${range}.xlsx`, [{ name: 'Excel', extensions: ['xlsx'] }]);
};

export const exportPromoPerformanceToPdf = async (
    summary: { totalDiscount: number; autoDiscount: number; voucherDiscount: number; manualDiscount: number; promoSharePct: number },
    diskonRows: any[],
    voucherRows: any[],
    dateRange: { from: Date, to: Date },
    storeName: string
) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    const fontSize = 9;

    let currentPage = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = currentPage.getSize();
    let y = height - margin;

    // --- HEADER ---
    currentPage.drawText(`${storeName.toUpperCase()}`, { x: margin, y, font: boldFont, size: 16 });
    y -= 18;
    currentPage.drawText('LAPORAN PERFORMA PROMO & VOUCHER', { x: margin, y, font: boldFont, size: 11, color: rgb(0.3, 0.3, 0.3) });
    y -= 15;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y, font, size: 10 });
    y -= 25;

    // --- SUMMARY BOX ---
    const boxHeight = 80;
    const boxY = y - boxHeight;
    currentPage.drawRectangle({
        x: margin,
        y: boxY,
        width: width - (margin * 2),
        height: boxHeight,
        color: rgb(0.96, 0.96, 0.96),
    });

    const summaryRows = [
        ['Total Diskon', formatCurrency(summary.totalDiscount)],
        ['Diskon Otomatis', formatCurrency(summary.autoDiscount)],
        ['Diskon Voucher', formatCurrency(summary.voucherDiscount)],
        ['Diskon Manual', formatCurrency(summary.manualDiscount)],
        ['% Omzet Terdiskon', `${summary.promoSharePct.toFixed(2)}%`],
    ];
    let kpiY = (boxY + boxHeight) - 15;
    summaryRows.forEach(([label, value], i) => {
        const col = i % 2 === 0 ? margin + 15 : margin + 220;
        if (i > 0 && i % 2 === 0) kpiY -= 15;
        currentPage.drawText(label, { x: col, y: kpiY, font, size: 8 });
        currentPage.drawText(value, { x: col + 115, y: kpiY, font: boldFont, size: 8 });
    });
    y = boxY - 25;

    const drawTableHeader = (page: any, yPos: number, headers: string[], colWidths: number[]) => {
        let xPos = margin;
        headers.forEach((h, i) => {
            page.drawText(h, { x: xPos, y: yPos, font: boldFont, size: fontSize });
            xPos += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };

    const drawRows = (headers: string[], colWidths: number[], rows: string[][]) => {
        y = drawTableHeader(currentPage, y, headers, colWidths);
        for (const row of rows) {
            if (y < 50) {
                currentPage = pdfDoc.addPage(PageSizes.A4);
                y = height - margin;
                y = drawTableHeader(currentPage, y, headers, colWidths);
            }
            let xPos = margin;
            row.forEach((cell, i) => {
                const text = cell.length > 40 ? cell.substring(0, 38) + "..." : cell;
                currentPage.drawText(text, { x: xPos, y, font, size: 8 });
                xPos += colWidths[i];
            });
            y -= 14;
        }
        y -= 10;
    };

    // --- DISKON TABLE ---
    currentPage.drawText('PER PROMO (DISKON)', { x: margin, y, font: boldFont, size: 11 });
    y -= 16;
    drawRows(
        ['Promo', 'Jenis', 'Transaksi', 'Total Diskon', 'Kontribusi'],
        [150, 120, 70, 110, 80],
        diskonRows.map(r => [r.name, r.type, String(r.transactions), formatCurrency(r.totalDiscount), `${r.sharePct.toFixed(1)}%`])
    );

    // --- VOUCHER TABLE ---
    currentPage.drawText('VOUCHER', { x: margin, y, font: boldFont, size: 11 });
    y -= 16;
    drawRows(
        ['Kode', 'Nama', 'Redeem', 'Total Nilai', 'Kuota', 'Status'],
        [90, 130, 55, 95, 60, 70],
        voucherRows.map(r => [r.code, r.name, String(r.redeems), formatCurrency(r.totalValue), r.quotaTotal ? `${r.quotaUsed}/${r.quotaTotal}` : String(r.quotaUsed), r.status])
    );

    const pdfBytes = await pdfDoc.save();
    const rangeStr = format(dateRange.from, 'yyyyMMdd') + '-' + format(dateRange.to, 'yyyyMMdd');
    await saveFileNative(pdfBytes, `laporan_promo_${rangeStr}.pdf`, [{ name: 'PDF', extensions: ['pdf'] }]);
};

export const buildWorksheetSessionPdfBytes = async (session: any, items: any[]) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40; let y = PageSizes.A4[1] - margin;
    let page = pdfDoc.addPage(PageSizes.A4); const { width, height } = page.getSize();
    y = height - margin;
    const storeName = 'Kastoko';
    page.drawText(storeName.toUpperCase(), { x: margin, y, font: boldFont, size: 14 }); y -= 18;
    page.drawText('BERITA ACARA SERAH TERIMA INVENTORI', { x: margin, y, font: boldFont, size: 11 }); y -= 20;
    const info = [
        ['No. Sesi', session.name],
        ['Tanggal', format(new Date(session.created_at), 'dd MMM yyyy HH:mm')],
        ['Operator', session.created_by],
        // @ts-ignore
        ['Perihal', session.subject==='other' ? (session.subject_other||'Lain-lain') : ({dealer_in:'Produk Masuk dari Dealer',restock:'Stok Masuk',routine_check:'Cek Rutin',warehouse_cleanup:'Bersih Gudang'})[session.subject] || session.subject],
        ['Pihak Terkait', session.related_party||'-'],
        ['Keterangan', session.description||'-'],
    ];
    for (const [k,v] of info) { if (y < 80) { page = pdfDoc.addPage(PageSizes.A4); y = height - margin; } page.drawText(k, { x: margin, y, font: boldFont, size: 9 }); page.drawText(String(v), { x: margin+120, y, font, size: 9 }); y -= 14; }
    y -= 8;
    page.drawText('DAFTAR PRODUK', { x: margin, y, font: boldFont, size: 10 }); y -= 14;
    const headers = ['No','Produk','Aksi','Jumlah','Stok Fisik','Keterangan'];
    const w = [30,170,60,50,70,120];
    let x = margin; headers.forEach((h,i)=>{ page.drawText(h,{x, y, font: boldFont, size: 8}); x+=w[i]; }); y-=4; page.drawLine({ start:{x:margin,y}, end:{x:width-margin,y}, thickness:1 }); y-=10;
    let n=1; const totals={tambah:0, kurang:0, koreksi:0};
    for (const it of items) {
        if (y < 80) { page = pdfDoc.addPage(PageSizes.A4); y = height - margin; x=margin; headers.forEach((h,i)=>{ page.drawText(h,{x, y, font: boldFont, size: 8}); x+=w[i]; }); y-=4; page.drawLine({ start:{x:margin,y}, end:{x:width-margin,y}, thickness:1 }); y-=10; }
        const phys = it.action==='tambah' ? it.system_qty+it.qty : it.action==='kurang' ? Math.max(0,it.system_qty-it.qty) : it.qty;
        if (it.action==='tambah') totals.tambah+=it.qty; else if (it.action==='kurang') totals.kurang+=it.qty; else totals.koreksi+=1;
        const prod = (it.variant_name_snapshot ? `${it.product_name_snapshot} (${it.variant_name_snapshot})` : it.product_name_snapshot);
        const row=[String(n++), prod.length>30?prod.slice(0,28)+'..':prod, it.action, String(it.qty), String(phys), (it.notes||'-').slice(0,20)];
        x=margin; row.forEach((c,i)=>{ page.drawText(c,{x, y, font, size:7}); x+=w[i]; }); y-=12;
    }
    y-=6; page.drawLine({ start:{x:margin,y}, end:{x:width-margin,y}, thickness:1 }); y-=10;
    page.drawText(`Total Tambah: ${totals.tambah}  Kurang: ${totals.kurang}  Koreksi: ${totals.koreksi}`, { x: margin, y, font: boldFont, size: 8 }); y-=22;
    const sigY=y; page.drawLine({ start:{x:margin,y:sigY}, end:{x:margin+180,y:sigY}, thickness:1 }); page.drawLine({ start:{x:margin+260,y:sigY}, end:{x:margin+440,y:sigY}, thickness:1 });
    y-=10; page.drawText('Operator', { x: margin, y, font: boldFont, size: 8 }); page.drawText('Yang menyerahkan', { x: margin+260, y, font: boldFont, size: 8 }); y-=12; page.drawText(session.created_by, { x: margin, y, font, size: 8 });
    y-=20; const printed = format(new Date(), 'dd MMM yyyy HH:mm'); page.drawText(`Dicetak: ${printed}`, { x: margin, y, font, size:7, color: rgb(0.5,0.5,0.5) });
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};
export const exportWorksheetSessionToPdf = async (session: any, items: any[]) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40; let y = PageSizes.A4[1] - margin;
    let page = pdfDoc.addPage(PageSizes.A4); const { width, height } = page.getSize();
    y = height - margin;
    const storeName = 'Kastoko';
    page.drawText(storeName.toUpperCase(), { x: margin, y, font: boldFont, size: 14 }); y -= 18;
    page.drawText('BERITA ACARA SERAH TERIMA INVENTORI', { x: margin, y, font: boldFont, size: 11 }); y -= 20;
    const info: [string,string][] = [
        ['No. Sesi', session.name],
        ['Tanggal', format(new Date(session.created_at), 'dd MMM yyyy HH:mm')],
        ['Operator', session.created_by],
        ['Perihal', session.subject==='other' ? (session.subject_other||'Lain-lain') : (({dealer_in:'Produk Masuk dari Dealer',restock:'Stok Masuk',routine_check:'Cek Rutin',warehouse_cleanup:'Bersih Gudang'} as any)[session.subject as string] || session.subject)],
        ['Pihak Terkait', session.related_party||'-'],
        ['Keterangan', session.description||'-'],
    ];
    for (const [k,v] of info) { if (y < 80) { page = pdfDoc.addPage(PageSizes.A4); y = height - margin; } page.drawText(k, { x: margin, y, font: boldFont, size: 9 }); page.drawText(String(v), { x: margin+120, y, font, size: 9 }); y -= 14; }
    y -= 8;
    page.drawText('DAFTAR PRODUK', { x: margin, y, font: boldFont, size: 10 }); y -= 14;
    const headers = ['No','Produk','Aksi','Jumlah','Stok Fisik','Keterangan'];
    const w = [30,170,60,50,70,120];
    let x = margin; headers.forEach((h,i)=>{ page.drawText(h,{x, y, font: boldFont, size: 8}); x+=w[i]; }); y-=4; page.drawLine({ start:{x:margin,y}, end:{x:width-margin,y}, thickness:1 }); y-=10;
    let n=1; const totals={tambah:0, kurang:0, koreksi:0};
    for (const it of items) {
        if (y < 80) { page = pdfDoc.addPage(PageSizes.A4); y = height - margin; x=margin; headers.forEach((h,i)=>{ page.drawText(h,{x, y, font: boldFont, size: 8}); x+=w[i]; }); y-=4; page.drawLine({ start:{x:margin,y}, end:{x:width-margin,y}, thickness:1 }); y-=10; }
        const phys = it.action==='tambah' ? it.system_qty+it.qty : it.action==='kurang' ? Math.max(0,it.system_qty-it.qty) : it.qty;
        if (it.action==='tambah') totals.tambah+=it.qty; else if (it.action==='kurang') totals.kurang+=it.qty; else totals.koreksi+=1;
        const prod = (it.variant_name_snapshot ? `${it.product_name_snapshot} (${it.variant_name_snapshot})` : it.product_name_snapshot);
        const row=[String(n++), prod.length>30?prod.slice(0,28)+'..':prod, it.action, String(it.qty), String(phys), (it.notes||'-').slice(0,20)];
        x=margin; row.forEach((c,i)=>{ page.drawText(c,{x, y, font, size:7}); x+=w[i]; }); y-=12;
    }
    y-=6; page.drawLine({ start:{x:margin,y}, end:{x:width-margin,y}, thickness:1 }); y-=10;
    page.drawText(`Total Tambah: ${totals.tambah}  Kurang: ${totals.kurang}  Koreksi: ${totals.koreksi}`, { x: margin, y, font: boldFont, size: 8 }); y-=22;
    const sigY=y; page.drawLine({ start:{x:margin,y:sigY}, end:{x:margin+180,y:sigY}, thickness:1 }); page.drawLine({ start:{x:margin+260,y:sigY}, end:{x:margin+440,y:sigY}, thickness:1 });
    y-=10; page.drawText('Operator', { x: margin, y, font: boldFont, size: 8 }); page.drawText('Yang menyerahkan', { x: margin+260, y, font: boldFont, size: 8 }); y-=12; page.drawText(session.created_by, { x: margin, y, font, size: 8 });
    y-=20; const printed = format(new Date(), 'dd MMM yyyy HH:mm'); page.drawText(`Dicetak: ${printed}`, { x: margin, y, font, size:7, color: rgb(0.5,0.5,0.5) });
    const pdfBytes = await pdfDoc.save();
    await saveFileNative(pdfBytes, `berita_acara_${session.name}.pdf`, [{ name:'PDF', extensions:['pdf'] }]);
};

export const exportWorksheetSessionToExcel = async (session: any, items: any[]) => {
    const header=[['No. Sesi',session.name],['Tanggal',format(new Date(session.created_at),'dd MMM yyyy HH:mm')],['Operator',session.created_by],['Perihal',session.subject],['Pihak Terkait',session.related_party||'-'],['Keterangan',session.description||'-']];
    const rows=items.map((it:any,idx:number)=>{ const phys=it.action==='tambah'?it.system_qty+it.qty:it.action==='kurang'?Math.max(0,it.system_qty-it.qty):it.qty; return { No:idx+1, Produk: it.variant_name_snapshot?`${it.product_name_snapshot} (${it.variant_name_snapshot})`:it.product_name_snapshot, Aksi:it.action, Jumlah:it.qty, 'Stok Fisik':phys, Keterangan:it.notes||'-' }; });
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(header.map(([k,v])=>({'Info':k,'Detail':v}))), 'Info Sesi');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Items');
    const buf=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    await saveFileNative(new Uint8Array(buf), `worksheet_${session.name}.xlsx`, [{ name:'Excel', extensions:['xlsx'] }]);
};

export const buildShiftDetailsPdfBytes = async (shift: any, transactions: Transaction[], storeName: string): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = 10;
    const bodyFontSize = 8;
    const margin = 50;
    const tableHeaders = ['Waktu', 'Invoice', 'Item', 'Total', 'Status'];
    const colWidths = [80, 150, 50, 100, 80];
    const drawTableHeader = (page: any, yPos: number) => {
        let x = margin;
        tableHeaders.forEach((header, i) => {
            page.drawText(header, { x, y: yPos, font: boldFont, size: fontSize });
            x += colWidths[i];
        });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };
    let y = height - margin;
    page.drawText(`${storeName} - Detail Sif`, { x: margin, y, font: boldFont, size: 18 });
    y -= 30;
    const openedAt = typeof shift.opened_at === 'string' ? parseISO(shift.opened_at) : new Date(shift.opened_at);
    const closedAt = shift.closed_at ? (typeof shift.closed_at === 'string' ? parseISO(shift.closed_at) : new Date(shift.closed_at)) : null;
    page.drawText(`Shift ID: ${shift.id}`, { x: margin, y, font, size: 12 });
    y -= 18;
    page.drawText(`Periode: ${format(openedAt, 'PPP p')} s.d. ${closedAt ? format(closedAt, 'PPP p') : 'Berjalan'}`, { x: margin, y, font, size: 12 });
    y -= 25;
    const totalSales = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.total, 0);
    const totalVoid = transactions.filter(t => t.status === 'voided').reduce((sum, t) => sum + t.total, 0);
    const expectedCash = shift.opening_cash + totalSales;
    const summaryData = [
        { label: 'Kas Awal:', value: formatCurrency(shift.opening_cash) },
        { label: 'Total Penjualan:', value: formatCurrency(totalSales) },
        { label: 'Total Batal:', value: formatCurrency(totalVoid), color: rgb(0.8, 0, 0) },
        { label: 'Ekspektasi Kas:', value: formatCurrency(expectedCash) },
        { label: 'Kas Aktual:', value: formatCurrency(shift.declared_cash || 0) },
        { label: 'Selisih:', value: formatCurrency(shift.variance || 0), color: shift.variance === 0 ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0) }
    ];
    const x = margin;
    summaryData.forEach(item => {
        page.drawText(item.label, { x, y, font, size: fontSize });
        page.drawText(item.value, { x: x + 120, y, font: boldFont, size: fontSize, color: item.color || rgb(0, 0, 0) });
        y -= 15;
    });
    y = drawTableHeader(page, y);
    let activePage = page;
    for (const tx of transactions) {
        if (y < 50) {
            activePage = pdfDoc.addPage();
            y = height - margin;
            y = drawTableHeader(activePage, y);
        }
        let txDate = typeof tx.created_at === 'string' ? parseISO(tx.created_at) : new Date(tx.created_at);
        if (isNaN(txDate.getTime())) txDate = new Date();
        const row = [
            format(txDate, 'HH:mm:ss'),
            tx.invoice_number,
            tx.items.reduce((sum, item) => sum + item.qty, 0).toString(),
            formatCurrency(tx.total),
            tx.status === 'paid' ? 'Lunas' : 'Void'
        ];
        let x2 = margin;
        row.forEach((cell, i) => {
            activePage.drawText(cell, { x: x2, y, font, size: bodyFontSize, color: tx.status === 'voided' ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0) });
            x2 += colWidths[i];
        });
        y -= 12;
    }
    const pdfBytes = await pdfDoc.save();
    return pdfBytes as Uint8Array;
};

export const buildBarcodeStickersPdfBytes = async (products: Product[], options: LabelOptions = {}): Promise<Uint8Array> => {
    const { pageSize = PageSizes.A4, labelWidthMm = 38, labelHeightMm = 13, repeat = 1, marginMm = 5, gapMm = 2 } = options
    const labelWidth = mmToPt(labelWidthMm)
    const labelHeight = mmToPt(labelHeightMm)
    const margin = mmToPt(marginMm)
    const gap = mmToPt(gapMm)
    const pageWidth = pageSize[0]
    const pageHeight = pageSize[1]
    const cols = Math.floor((pageWidth - margin * 2 + gap) / (labelWidth + gap))
    const rows = Math.floor((pageHeight - margin * 2 + gap) / (labelHeight + gap))
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const monoFont = await pdfDoc.embedFont(StandardFonts.Courier)
    const barcodeCache = new Map<string, any>()
    async function getBarcode(barcode: string) {
        if (barcodeCache.has(barcode)) return barcodeCache.get(barcode)
        const canvas = document.createElement("canvas")
        await bwipjs.toCanvas(canvas, { bcid: "code128", text: barcode, scale: 2, height: 6, includetext: false })
        const pngBytes = await fetch(canvas.toDataURL()).then(r => r.arrayBuffer())
        const img = await pdfDoc.embedPng(pngBytes)
        barcodeCache.set(barcode, img)
        return img
    }
    const expandedProducts: Product[] = []
    for (const p of products) { for (let i = 0; i < repeat; i++) expandedProducts.push(p) }
    let productIndex = 0
    while (productIndex < expandedProducts.length) {
        const page = pdfDoc.addPage(pageSize)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (productIndex >= expandedProducts.length) break
                const product = expandedProducts[productIndex]
                if (!product.barcode) { productIndex++; c--; continue }
                const x = margin + c * (labelWidth + gap)
                const y = pageHeight - margin - labelHeight - r * (labelHeight + gap)
                let name = product.name
                if (name.length > 18) name = name.substring(0, 16) + "..."
                page.drawText(name, { x: x + 3, y: y + labelHeight - 8, size: 6, font: boldFont })
                page.drawText(formatCurrency(product.price), { x: x + labelWidth - font.widthOfTextAtSize(formatCurrency(product.price), 6) - 3, y: y + labelHeight - 8, size: 6, font })
                const barcodeImg = await getBarcode(product.barcode)
                page.drawImage(barcodeImg, { x: x + 3, y: y + labelHeight - 28, width: labelWidth - 6, height: labelHeight * 0.45 })
                const barcodeTextWidth = monoFont.widthOfTextAtSize(product.barcode, 6);
                page.drawText(product.barcode, { x: x + (labelWidth / 2) - (barcodeTextWidth / 2), y: y + 2, size: 6, font: monoFont })
                productIndex++
            }
            if (productIndex >= expandedProducts.length) break
        }
    }
    const pdfBytes = await pdfDoc.save()
    return pdfBytes as Uint8Array;
};

export const buildPromoPerformancePdfBytes = async (summary: { totalDiscount: number; autoDiscount: number; voucherDiscount: number; manualDiscount: number; promoSharePct: number }, diskonRows: any[], voucherRows: any[], dateRange: { from: Date, to: Date }, storeName: string): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    const fontSize = 9;
    let currentPage = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = currentPage.getSize();
    let y = height - margin;
    currentPage.drawText(`${storeName.toUpperCase()}`, { x: margin, y, font: boldFont, size: 16 });
    y -= 18;
    currentPage.drawText('LAPORAN PERFORMA PROMO & VOUCHER', { x: margin, y, font: boldFont, size: 11, color: rgb(0.3, 0.3, 0.3) });
    y -= 15;
    currentPage.drawText(`Periode: ${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`, { x: margin, y, font, size: 10 });
    y -= 25;
    const boxHeight = 80;
    const boxY = y - boxHeight;
    currentPage.drawRectangle({ x: margin, y: boxY, width: width - (margin * 2), height: boxHeight, color: rgb(0.96, 0.96, 0.96) });
    const summaryRows = [
        ['Total Diskon', formatCurrency(summary.totalDiscount)],
        ['Diskon Otomatis', formatCurrency(summary.autoDiscount)],
        ['Diskon Voucher', formatCurrency(summary.voucherDiscount)],
        ['Diskon Manual', formatCurrency(summary.manualDiscount)],
        ['% Omzet Terdiskon', `${summary.promoSharePct.toFixed(2)}%`],
    ];
    let kpiY = (boxY + boxHeight) - 15;
    summaryRows.forEach(([label, value], i) => {
        const col = i % 2 === 0 ? margin + 15 : margin + 220;
        if (i > 0 && i % 2 === 0) kpiY -= 15;
        currentPage.drawText(label, { x: col, y: kpiY, font, size: 8 });
        currentPage.drawText(value, { x: col + 115, y: kpiY, font: boldFont, size: 8 });
    });
    y = boxY - 25;
    const drawTableHeader = (page: any, yPos: number, headers: string[], colWidths: number[]) => {
        let xPos = margin;
        headers.forEach((h, i) => { page.drawText(h, { x: xPos, y: yPos, font: boldFont, size: fontSize }); xPos += colWidths[i]; });
        const lineY = yPos - 5;
        page.drawLine({ start: { x: margin, y: lineY }, end: { x: width - margin, y: lineY }, thickness: 1 });
        return lineY - 15;
    };
    const drawRows = (headers: string[], colWidths: number[], rows: string[][]) => {
        y = drawTableHeader(currentPage, y, headers, colWidths);
        for (const row of rows) {
            if (y < 50) { currentPage = pdfDoc.addPage(PageSizes.A4); y = height - margin; y = drawTableHeader(currentPage, y, headers, colWidths); }
            let xPos = margin;
            row.forEach((cell, i) => { const text = cell.length > 40 ? cell.substring(0, 38) + "..." : cell; currentPage.drawText(text, { x: xPos, y, font, size: 8 }); xPos += colWidths[i]; });
            y -= 14;
        }
        y -= 10;
    };
    currentPage.drawText('PER PROMO (DISKON)', { x: margin, y, font: boldFont, size: 11 }); y -= 16;
    drawRows(['Promo', 'Jenis', 'Transaksi', 'Total Diskon', 'Kontribusi'], [150, 120, 70, 110, 80], diskonRows.map(r => [r.name, r.type, String(r.transactions), formatCurrency(r.totalDiscount), `${r.sharePct.toFixed(1)}%`]));
    currentPage.drawText('VOUCHER', { x: margin, y, font: boldFont, size: 11 }); y -= 16;
    drawRows(['Kode', 'Nama', 'Redeem', 'Total Nilai', 'Kuota', 'Status'], [90, 130, 55, 95, 60, 70], voucherRows.map(r => [r.code, r.name, String(r.redeems), formatCurrency(r.totalValue), r.quotaTotal ? `${r.quotaUsed}/${r.quotaTotal}` : String(r.quotaUsed), r.status]));
    const pdfBytes = await pdfDoc.save();
    return pdfBytes as Uint8Array;
};
