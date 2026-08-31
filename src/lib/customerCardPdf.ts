import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { Customer, CustomerGroup, StoreConfig } from '@/lib/types';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full, 16);
  return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 };
}

function formatCardId(id: string) {
  const clean = id.replace(/^cust-/, '').toUpperCase();
  const spaced = clean.replace(/(.{4})/g, '$1 ').trim();
  return `CUST ${spaced}`;
}

async function saveFileNative(data: Uint8Array, defaultFilename: string) {
  try {
    const path = await save({ defaultPath: defaultFilename, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (path) {
      await writeFile(path, data);
      return true;
    }
  } catch (e) {
    console.error('saveFileNative failed', e);
  }
  return false;
}

export async function buildCustomerCardPdfBytes(customer: Customer, group: CustomerGroup | undefined, storeConfig?: StoreConfig | null): Promise<Uint8Array> {
  // @ts-ignore
  const bwipjs = (await import('bwip-js')).default;

  const groupColorHex = (group as any)?.color || (group?.rank === 3 ? '#f59e0b' : group?.rank === 2 ? '#94a3b8' : group?.rank === 1 ? '#38bdf8' : '#64748b');
  const gc = hexToRgb(groupColorHex);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([242, 153]); // CR80 85x53.98mm
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Background dark
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.06, 0.09, 0.16), borderColor: rgb(0.2, 0.25, 0.35), borderWidth: 0.5 });

  // accent stripe top
  page.drawRectangle({ x: 0, y: height - 4, width, height: 4, color: rgb(gc.r, gc.g, gc.b) });

  // chip gold
  page.drawRectangle({ x: 14, y: height - 58, width: 28, height: 20, color: rgb(0.99, 0.84, 0.34), borderColor: rgb(0.85, 0.68, 0.12), borderWidth: 0.5 });
  page.drawLine({ start: { x: 14, y: height - 48 }, end: { x: 42, y: height - 48 }, thickness: 0.4, color: rgb(0.4, 0.3, 0.05), opacity: 0.4 });
  page.drawLine({ start: { x: 28, y: height - 58 }, end: { x: 28, y: height - 38 }, thickness: 0.4, color: rgb(0.4, 0.3, 0.05), opacity: 0.4 });

  // Header text
  const storeName = storeConfig?.store_name || 'Kastoko';
  page.drawText('KASTOKO MEMBER', { x: 14, y: height - 18, size: 5, font, color: rgb(0.9, 0.9, 0.95), opacity: 0.7 });
  page.drawText(storeName.toUpperCase(), { x: 14, y: height - 26, size: 6, font: fontBold, color: rgb(1, 1, 1) });

  // group badge
  const groupLabel = group ? group.name.toUpperCase() : 'UMUM';
  const badgeW = groupLabel.length * 4.2 + 12;
  page.drawRectangle({ x: width - badgeW - 10, y: height - 28, width: badgeW, height: 12, color: rgb(gc.r, gc.g, gc.b) });
  page.drawText(groupLabel, { x: width - badgeW - 10 + 6, y: height - 20, size: 5, font: fontBold, color: rgb(1, 1, 1) });

  // ID small top right
  page.drawText(customer.id, { x: width - 58, y: height - 46, size: 4, font, color: rgb(0.7, 0.75, 0.82) });

  // Customer name
  page.drawText(customer.name.toUpperCase(), { x: 14, y: height - 76, size: 9, font: fontBold, color: rgb(1, 1, 1) });

  // formatted card number
  const cardNo = formatCardId(customer.id);
  page.drawText(cardNo, { x: 14, y: height - 88, size: 7, font, color: rgb(0.85, 0.9, 0.98) });

  // barcode white box
  const bw = width - 28;
  const bh = 32;
  page.drawRectangle({ x: 14, y: 18, width: bw, height: bh, color: rgb(1, 1, 1), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });

  const canvas = document.createElement('canvas');
  bwipjs.toCanvas(canvas, { bcid: 'code128', text: customer.id, scale: 2, height: 8, includetext: false, backgroundcolor: 'FFFFFF' });
  const png = await pdf.embedPng(canvas.toDataURL('image/png'));
  const pngDims = png.scale(0.45);
  // center barcode in white box
  const bx = 14 + (bw - pngDims.width) / 2;
  const by = 18 + (bh - pngDims.height) / 2 + 2;
  page.drawImage(png, { x: bx, y: by, width: pngDims.width, height: pngDims.height });
  page.drawText(customer.id, { x: width / 2 - (customer.id.length * 1.4), y: 20, size: 4, font, color: rgb(0.4, 0.4, 0.45) });

  // footer
  const topDays = customer.topDays ?? group?.topDays ?? 0;
  const memberSince = new Date(customer.created_at).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  page.drawText(customer.phone || '—', { x: 14, y: 8, size: 4, font, color: rgb(0.6, 0.65, 0.72) });
  const rightFooter = `Member ${memberSince} · ${topDays === 0 ? 'COD' : `TOP ${topDays} hari`}`;
  page.drawText(rightFooter, { x: width - rightFooter.length * 2.2 - 14, y: 8, size: 4, font, color: rgb(0.6, 0.65, 0.72) });

  const bytes = await pdf.save();
  return bytes;
}

export async function exportCustomerCardPdf(customer: Customer, group: CustomerGroup | undefined, storeConfig?: StoreConfig | null) {
  const bytes = await buildCustomerCardPdfBytes(customer, group, storeConfig);
  const filename = `kartu-${customer.id}.pdf`;
  const saved = await saveFileNative(bytes, filename);
  if (!saved) {
    // fallback: open blob
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return bytes;
}
