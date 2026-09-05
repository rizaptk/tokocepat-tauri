import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { Transaction, StoreConfig, Customer, Shift } from '@/lib/types';
import { formatIDR } from '@/lib/format';

export async function buildFakturPdfBytes(
  tx: Transaction,
  storeConfig: StoreConfig | null,
  customer?: Customer | null,
  shift?: Shift | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  const storeName = storeConfig?.store_name || 'Toko';
  const storeAddr = storeConfig?.address || '';
  const storeNpwp = (storeConfig as any)?.npwp || '';

  const anyTx = tx as any;
  const invoice = tx.invoice_number;
  const createdStr = (() => { try { return format(new Date(tx.created_at), 'dd MMMM yyyy, HH:mm', { locale: localeId }); } catch { return tx.created_at; } })();
  const dueStr = anyTx.due_date ? (() => { try { return format(new Date(anyTx.due_date), 'dd MMMM yyyy', { locale: localeId }); } catch { return String(anyTx.due_date); } })() : '-';
  const cashier = anyTx.cashier_name_snapshot || (shift as any)?.opened_by || '-';
  const shiftOpenStr = shift?.opened_at ? (() => { try { return format(new Date(shift.opened_at), 'dd MMM yyyy HH:mm', { locale: localeId }); } catch { return shift.opened_at as string; } })() : '';

  const custName = anyTx.customer_name_snapshot || customer?.name || '-';
  const custGroup = anyTx.customer_group_snapshot || '';
  const custAddr = (customer as any)?.address || '';
  const custPhone = customer?.phone || '';
  const custNpwp = (customer as any)?.npwp || anyTx.customer_npwp_snapshot || '';

  // --- Kop ---
  page.drawText(storeName.toUpperCase(), { x: margin, y, font: boldFont, size: 13, color: rgb(0.13, 0.13, 0.13) });
  y -= 12;
  if (storeAddr) {
    page.drawText(storeAddr, { x: margin, y, font, size: 7, color: rgb(0.4, 0.4, 0.4) });
    y -= 10;
  }
  if (storeNpwp) {
    page.drawText(`NPWP: ${storeNpwp}`, { x: margin, y, font, size: 7, color: rgb(0.4, 0.4, 0.4) });
    y -= 10;
  } else {
    page.drawText('NPWP: ___________________________', { x: margin, y, font, size: 7, color: rgb(0.5, 0.5, 0.5) });
    y -= 10;
  }
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.2, color: rgb(0.13, 0.4, 0.8) });
  y -= 14;

  page.drawText('FAKTUR PENJUALAN', { x: width / 2 - 52, y, font: boldFont, size: 13, color: rgb(0.13, 0.13, 0.13) });
  y -= 12;
  page.drawText(`No. Faktur: ${invoice}  ·  reuse INV`, { x: margin, y, font, size: 7, color: rgb(0.5, 0.5, 0.5) });
  y -= 14;

  // --- Meta two columns ---
  const leftX = margin;
  const rightX = width / 2 + 10;
  let ly = y;
  let ry = y;
  // left: pelanggan
  page.drawText('Kepada:', { x: leftX, y: ly, font, size: 7, color: rgb(0.5, 0.5, 0.5) });
  ly -= 10;
  page.drawText(custName, { x: leftX, y: ly, font: boldFont, size: 9, color: rgb(0.13, 0.13, 0.13) });
  ly -= 10;
  if (custGroup) { page.drawText(`Grup: ${custGroup}`, { x: leftX, y: ly, font, size: 7, color: rgb(0.4, 0.4, 0.4) }); ly -= 9; }
  if (custAddr) { const t = fitText(font, custAddr, 7, width / 2 - margin - 10); page.drawText(t, { x: leftX, y: ly, font, size: 7, color: rgb(0.4, 0.4, 0.4) }); ly -= 9; }
  if (custPhone) { page.drawText(`Telp: ${custPhone}`, { x: leftX, y: ly, font, size: 7, color: rgb(0.4, 0.4, 0.4) }); ly -= 9; }
  if (custNpwp) {
    page.drawText(`NPWP: ${custNpwp}`, { x: leftX, y: ly, font, size: 7, color: rgb(0.4, 0.4, 0.4) }); ly -= 9;
  } else {
    page.drawText('NPWP: ___________________________', { x: leftX, y: ly, font, size: 7, color: rgb(0.5, 0.5, 0.5) }); ly -= 9;
  }
  // right: transaksi
  page.drawText('Transaksi', { x: rightX, y: ry, font, size: 7, color: rgb(0.5, 0.5, 0.5) }); ry -= 10;
  const metaRight: [string,string][] = [
    ['Tanggal', createdStr],
    ['Kasir', cashier],
    ['Sif', shiftOpenStr ? `${(shift as any)?.id?.slice(0,8) || anyTx.shift_id?.slice(0,8) || '-'} · ${shiftOpenStr}` : (anyTx.shift_id || '-')],
    ['Jatuh Tempo', anyTx.is_wholesale ? `${dueStr} ${anyTx.term_days ? `(TOP ${anyTx.term_days} hari)` : ''} · ${anyTx.payment_status || '-'}` : '-'],
    ['Status', (tx.status === 'voided' ? 'VOID' : (anyTx.payment_status || 'lunas')) + (anyTx.payment_status && anyTx.payment_status !== 'lunas' ? ` · Sisa ${formatIDR(Math.max(0, tx.total - (tx.cash_paid || 0)))}` : '')],
  ];
  for (const [k,v] of metaRight) {
    page.drawText(`${k}:`, { x: rightX, y: ry, font, size: 7, color: rgb(0.4, 0.4, 0.4) });
    const val = fitText(font, String(v), 7, width - rightX - margin - 46);
    page.drawText(val, { x: rightX + 46, y: ry, font: boldFont, size: 7, color: rgb(0.2, 0.2, 0.2) });
    ry -= 9;
  }
  y = Math.min(ly, ry) - 10;
  if (tx.status === 'voided') {
    page.drawText('DOKUMEN VOID — TIDAK BERLAKU UNTUK PENAGIHAN', { x: margin, y, font: boldFont, size: 7, color: rgb(0.8, 0.15, 0.15) });
    y -= 12;
  }

  // --- Item table ---
  const headers = ['No', 'Produk', 'Qty', 'Harga', 'Diskon', 'Subtotal'];
  const colW = [22, 228, 50, 70, 60, 75]; // total 505 = width - 2*margin 515 - padding
  let x = margin;
  // header bg
  page.drawRectangle({ x: margin - 1, y: y - 4, width: colW.reduce((a,b)=>a+b,0)+2, height: 14, color: rgb(0.94,0.94,0.94) });
  headers.forEach((h,i) => {
    const alignRight = i >= 3;
    const tx_ = h;
    const txX = alignRight ? x + colW[i] - 2 - font.widthOfTextAtSize(tx_, 7) : x + 2;
    page.drawText(tx_, { x: txX, y, font: boldFont, size: 7, color: rgb(0.2,0.2,0.2) });
    x += colW[i];
  });
  y -= 10;
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 0.6, color: rgb(0.8,0.8,0.8) });

  const wrap = (text: string, size: number, maxW: number) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW) { if (cur) lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // need pagination: if y < 120 add page
  let currentPage = page;
  let pageCount = 1;
  const addPageIfNeeded = (needed: number) => {
    if (y - needed < 90) {
      const p = pdfDoc.addPage([595,842]);
      pageCount++;
      y = p.getSize().height - margin - 10;
      currentPage = p;
      // redraw header
      let hx = margin;
      p.drawRectangle({ x: margin - 1, y: y - 4, width: colW.reduce((a,b)=>a+b,0)+2, height: 14, color: rgb(0.94,0.94,0.94) });
      headers.forEach((h,i) => {
        const alignRight = i >= 3;
        const tx_ = h;
        const txX = alignRight ? hx + colW[i] - 2 - font.widthOfTextAtSize(tx_, 7) : hx + 2;
        p.drawText(tx_, { x: txX, y, font: boldFont, size: 7, color: rgb(0.2,0.2,0.2) });
        hx += colW[i];
      });
      y -= 10;
      p.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 0.6, color: rgb(0.8,0.8,0.8) });
      return p;
    }
    return currentPage;
  };

  tx.items.forEach((it, idx) => {
    const prodName = (it as any).product_snapshot?.name || '-';
    const bonus = (it as any).bonus_label ? ` (${(it as any).bonus_label})` : '';
    const freeTag = it.is_free_item ? ' (gratis)' : '';
    const fullName = `${prodName}${bonus}${freeTag}`;
    const nameLines = wrap(fullName, 7, colW[1]-4);
    const rowH = Math.max(10, nameLines.length * 8 + 2);
    const pg = addPageIfNeeded(rowH);

    const qtyStr = `${it.qty}${(it as any).uom_name ? ` ${(it as any).uom_name}` : ''}`;
    const priceStr = formatIDR((it as any).price_snapshot || 0);
    const discStr = (it.discount_amount || 0) > 0 ? `-${formatIDR(it.discount_amount || 0)}` : '-';
    const subtotalNet = (it.subtotal || 0) - (it.discount_amount || 0);
    const subtotalStr = formatIDR(it.is_free_item ? 0 : subtotalNet);

    let cx = margin;
    // No
    pg.drawText(String(idx+1), { x: cx+2, y, font, size: 7, color: rgb(0.2,0.2,0.2) }); cx+=colW[0];
    // Produk (multiline)
    let ny = y;
    for (const line of nameLines) { pg.drawText(truncate(font, line, 7, colW[1]-4), { x: cx+2, y: ny, font, size: 7, color: rgb(0.2,0.2,0.2) }); ny-=8; } cx+=colW[1];
    // Qty
    pg.drawText(qtyStr, { x: cx+2, y, font, size: 7, color: rgb(0.2,0.2,0.2) }); cx+=colW[2];
    // Harga right
    pg.drawText(priceStr, { x: cx+colW[3]-2 - font.widthOfTextAtSize(priceStr,7), y, font, size: 7, color: rgb(0.2,0.2,0.2) }); cx+=colW[3];
    // Diskon right
    pg.drawText(discStr, { x: cx+colW[4]-2 - font.widthOfTextAtSize(discStr,7), y, font, size: 7, color: (it.discount_amount||0)>0 ? rgb(0,0.5,0.2) : rgb(0.4,0.4,0.4) }); cx+=colW[4];
    // Subtotal right bold
    pg.drawText(subtotalStr, { x: cx+colW[5]-2 - boldFont.widthOfTextAtSize(subtotalStr,7), y, font: boldFont, size: 7, color: rgb(0.2,0.2,0.2) });
    y -= rowH;
    pg.drawLine({ start: { x: margin, y: y + 4 }, end: { x: width - margin, y: y + 4 }, thickness: 0.3, color: rgb(0.93,0.93,0.93) });
  });

  y -= 6;
  // --- Summary box DPP + PPN terpisah ---
  const gross = (tx as any).gross_subtotal != null ? (tx as any).gross_subtotal : tx.subtotal;
  const discountTotal = (tx as any).discount_total != null ? (tx as any).discount_total : (((tx as any).promo_discount || 0) + ((tx as any).manual_discount || 0));
  const dpp = Math.max(0, gross - discountTotal);
  const ppn = tx.tax_amount || 0;
  const grand = tx.total;
  const dibayar = tx.cash_paid || 0;
  const sisa = Math.max(0, grand - dibayar);

  // box
  const boxW = 220;
  const boxX = width - margin - boxW;
  let boxY = y;
  // ensure box fits
  if (boxY < 130) { const p = pdfDoc.addPage([595,842]); pageCount++; currentPage = p; boxY = p.getSize().height - margin - 10; y = boxY; }
  currentPage.drawRectangle({ x: boxX, y: boxY - 86, width: boxW, height: 86, color: rgb(0.96,0.96,0.96), borderColor: rgb(0.85,0.85,0.85), borderWidth: 0.6 });
  const rows: [string,string,boolean][] = [
    ['Subtotal (gross)', formatIDR(gross), false],
    ['Diskon', discountTotal>0 ? `-${formatIDR(discountTotal)}` : formatIDR(0), false],
    ['DPP (Dasar Pengenaan)', formatIDR(dpp), false],
    ['PPN', formatIDR(ppn), false],
    ['Grand Total', formatIDR(grand), true],
    ['Dibayar', formatIDR(dibayar), false],
    ['Sisa', formatIDR(sisa), sisa>0],
  ];
  let ry2 = boxY - 10;
  for (const [label,val,bold] of rows) {
    const f = bold ? boldFont : font;
    const s = bold ? 8 : 7;
    currentPage.drawText(label, { x: boxX + 6, y: ry2, font: f, size: s, color: label==='Sisa' && sisa>0 ? rgb(0.8,0.15,0.15) : rgb(0.2,0.2,0.2) });
    const vw = f.widthOfTextAtSize(val, s);
    currentPage.drawText(val, { x: boxX + boxW - 6 - vw, y: ry2, font: f, size: s, color: label==='Sisa' && sisa>0 ? rgb(0.8,0.15,0.15) : rgb(0.13,0.13,0.13) });
    ry2 -= 11;
    if (label==='PPN') {
      currentPage.drawLine({ start: { x: boxX+6, y: ry2+6 }, end: { x: boxX+boxW-6, y: ry2+6 }, thickness: 0.5, color: rgb(0.2,0.2,0.2) });
    }
  }
  y = boxY - 94;

  // promo detail if any
  if (tx.applied_promos && tx.applied_promos.length > 0) {
    if (y < 100) { const p = pdfDoc.addPage([595,842]); currentPage = p; y = p.getSize().height - margin; }
    currentPage.drawText('Rincian promo/diskon:', { x: margin, y, font, size: 7, color: rgb(0.5,0.5,0.5) });
    y -= 8;
    for (const pr of tx.applied_promos) {
      const line = `· ${pr.name}${pr.voucher_code ? ` (${pr.voucher_code})` : ''} : -${formatIDR(pr.amount)} [${pr.kind}]`;
      currentPage.drawText(truncate(font, line, 7, width - margin*2), { x: margin, y, font, size: 7, color: rgb(0.2,0.2,0.2) });
      y -= 8;
    }
    y -= 4;
  }

  // --- Tanda tangan ---
  if (y < 90) { const p = pdfDoc.addPage([595,842]); currentPage = p; y = p.getSize().height - margin; }
  y -= 6;
  currentPage.drawText('Hormat kami,', { x: margin, y, font, size: 8, color: rgb(0.2,0.2,0.2) });
  y -= 16;
  currentPage.drawText(storeName, { x: margin, y, font: boldFont, size: 9, color: rgb(0.13,0.13,0.13) });
  y -= 10;
  currentPage.drawText(`Kasir: ${cashier}`, { x: margin, y, font, size: 7, color: rgb(0.4,0.4,0.4) });
  y -= 8;
  if (shiftOpenStr) { currentPage.drawText(`Sif buka: ${shiftOpenStr}`, { x: margin, y, font, size: 7, color: rgb(0.5,0.5,0.5) }); y -= 8; }
  // garis tanda tangan
  y -= 18;
  currentPage.drawLine({ start: { x: margin, y }, end: { x: margin + 120, y }, thickness: 0.6, color: rgb(0.2,0.2,0.2) });
  currentPage.drawText('(tanda tangan & cap)', { x: margin, y: y - 8, font, size: 6, color: rgb(0.6,0.6,0.6) });

  currentPage.drawText('Faktur ini sah tanpa tanda tangan basah — dicetak dari Kastoko.', { x: margin, y: 28, font, size: 6, color: rgb(0.6,0.6,0.6) });
  if (tx.status === 'voided') {
    currentPage.drawText(`VOID: ${tx.void_reason || '-'}`, { x: margin, y: 18, font: boldFont, size: 6, color: rgb(0.8,0.15,0.15) });
  }

  return pdfDoc.save() as Promise<Uint8Array>;
}

function truncate(font: any, text: string, size: number, maxW: number): string {
  let t = text;
  while (font.widthOfTextAtSize(t, size) > maxW && t.length > 8) t = t.slice(0, -4) + '…';
  return t;
}
function fitText(font: any, text: string, size: number, maxW: number): string {
  let t = text;
  while (font.widthOfTextAtSize(t, size) > maxW && t.length > 8) t = t.slice(0, -4) + '…';
  return t;
}
