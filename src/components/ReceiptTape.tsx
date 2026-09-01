"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatIDNumber } from "@/lib/format";

export interface ReceiptLineItem {
    name: string;
    variant?: string;
    qty: number;
    price: number;
    discount?: number;
    bonusLabel?: string;
}

export interface ReceiptSnapshot {
    invoice: string;
    change: number;
    cashPaid: number;
    items: ReceiptLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    promoDiscount: number;
    voucherDiscount: number;
    voucherCode?: string;
    manualDiscount: number;
    dateISO: string;
}

interface ReceiptTapeProps {
    data: ReceiptSnapshot;
    storeName: string;
    storeAddress?: string;
    footer?: string;
    className?: string;
}

// Thermal paper is always paper — the tape ignores the app theme entirely.
const PAPER = "#FCFBF7";
const INK = "#1B1A17";
const INK_SOFT = "#3E3B34";
const INK_MUTED = "#8B857B";
const INK_FAINT = "#C9C3B7";
const RULE = "#DDD7CB";
const LED = "#E5484D";



const TOP_TEETH =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' preserveAspectRatio='none'%3E%3Cpath d='M0 0 L12 0 L6 8 Z' fill='%23FCFBF7'/%3E%3C/svg%3E";
const BOTTOM_TEETH =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' preserveAspectRatio='none'%3E%3Cpath d='M0 8 L12 8 L6 0 Z' fill='%23FCFBF7'/%3E%3C/svg%3E";

const useReducedMotion = () =>
    useMemo(
        () =>
            typeof window !== "undefined"
                ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
                : false,
        []
    );

function FauxBarcode({ text }: { text: string }) {
    const bars = useMemo(() => {
        let seed = 1;
        for (const c of text) seed = (seed * 131 + c.charCodeAt(0)) >>> 0;
        let state = seed || 1;
        const rnd = (m: number) => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return (state % m) + 1;
        };
        const raw: number[] = [];
        let sum = 0;
        for (let i = 0; i < 42; i++) {
            const w = rnd(3);
            raw.push(w);
            sum += w;
        }
        let x = 0;
        return raw.map((w, i) => {
            const b = { x, w: Math.max(1, Math.round(w * (140 / sum))), black: i % 2 === 0 };
            x += b.w;
            return b;
        });
    }, [text]);

    return (
        <svg className="h-9 w-full" viewBox="0 0 140 36" preserveAspectRatio="none" aria-hidden>
            {bars.map((b, i) => (
                <rect key={i} x={b.x} width={b.w} height={36} fill={b.black ? INK : "transparent"} />
            ))}
        </svg>
    );
}

const LedgerRow = ({
    label,
    value,
    muted = false,
    strong = false,
}: {
    label: string;
    value: string;
    muted?: boolean;
    strong?: boolean;
}) => (
    <div
        className="flex items-baseline gap-1.5"
        style={{
            color: muted ? INK_MUTED : strong ? INK : INK_SOFT,
            fontWeight: strong ? 700 : 400,
        }}
    >
        <span className="shrink-0">{label}</span>
        <span
            aria-hidden
            className="min-w-0 flex-1 border-b border-dotted"
            style={{ borderColor: INK_FAINT, transform: "translateY(-2px)" }}
        />
        <span className="shrink-0 tabular-nums">{value}</span>
    </div>
);

const Step = ({
    delay,
    reduced,
    children,
}: {
    delay: number;
    reduced: boolean;
    children: React.ReactNode;
}) => (
    <motion.div
        initial={{ opacity: 0, y: reduced ? 0 : 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.16, ease: "easeOut" }}
    >
        {children}
    </motion.div>
);

export function ReceiptTape({ data, storeName, storeAddress, footer, className }: ReceiptTapeProps) {
    const reduced = useReducedMotion();
    const STEP = reduced ? 0 : 0.05;
    const START = reduced ? 0.1 : 0.3;

    const rows = useMemo(() => {
        const list: React.ReactNode[] = [];

        list.push(
            <div
                key="store"
                className="text-center font-mono font-black uppercase tracking-[0.22em]"
                style={{ color: INK, fontSize: 13, lineHeight: 1.35 }}
            >
                {storeName}
            </div>
        );

        if (storeAddress?.trim()) {
            list.push(
                <div
                    key="addr"
                    className="text-center font-mono"
                    style={{ color: INK_MUTED, fontSize: 10, lineHeight: 1.4 }}
                >
                    {storeAddress}
                </div>
            );
        }

        const dateStr = new Date(data.dateISO).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
        });

        list.push(
            <div
                key="meta"
                className="flex items-baseline justify-between gap-2 font-mono"
                style={{ fontSize: 10.5, color: INK_SOFT }}
            >
                <span className="font-bold">STRUK {data.invoice}</span>
                <span style={{ color: INK_MUTED }}>{dateStr}</span>
            </div>
        );

        list.push(<div key="rule1" className="font-mono" style={{ borderTop: `2px dashed ${RULE}` }} />);

        data.items.forEach((item, i) => {
            const bonusSuffix = item.bonusLabel ? ` (${item.bonusLabel})` : '';
            list.push(
                <div
                    key={`n${i}`}
                    className="font-mono font-bold"
                    style={{ fontSize: 11, color: INK, lineHeight: 1.4 }}
                >
                    {item.name}
                    {bonusSuffix ? (
                        <span style={{ color: LED, fontWeight: 600 }}>{bonusSuffix}</span>
                    ) : null}
                    {item.variant ? (
                        <span style={{ color: INK_MUTED, fontWeight: 500 }}> · {item.variant}</span>
                    ) : null}
                </div>
            );
            const gross = item.price * item.qty;
            const net = gross - (item.discount || 0);
            list.push(<LedgerRow key={`p${i}`} label={`${item.qty} x ${formatIDNumber(item.price)}`} value={formatIDNumber(net)} />);
            if ((item.discount || 0) > 0) {
                list.push(
                    <div
                        key={`d${i}`}
                        className="font-mono text-right"
                        style={{ color: INK_MUTED, fontSize: 9, lineHeight: 1.3 }}
                    >
                        Diskon -{formatIDNumber(item.discount || 0)}
                    </div>
                );
            }
        });

        list.push(<div key="rule2" className="font-mono" style={{ borderTop: `1px solid ${RULE}` }} />);
        list.push(<LedgerRow key="subtotal" label="Subtotal" value={formatIDNumber(data.subtotal)} strong />);
        const promoExclVoucher = data.promoDiscount - (data.voucherDiscount || 0);
        if (promoExclVoucher > 0) {
            list.push(<LedgerRow key="promo" label="Promo & Diskon Produk" value={`-${formatIDNumber(promoExclVoucher)}`} muted />);
        }
        if ((data.voucherDiscount || 0) > 0) {
            const vLabel = data.voucherCode ? `Voucher ${data.voucherCode}` : 'Voucher';
            list.push(<LedgerRow key="voucher" label={vLabel} value={`-${formatIDNumber(data.voucherDiscount)}`} muted />);
        }
        if (data.manualDiscount > 0) {
            list.push(<LedgerRow key="manual" label="Diskon Kasir" value={`-${formatIDNumber(data.manualDiscount)}`} muted />);
        }
        list.push(<LedgerRow key="tax" label="Pajak" value={formatIDNumber(data.tax)} />);
        list.push(<div key="rule3" className="font-mono" style={{ borderTop: `3px double ${INK}` }} />);
        list.push(
            <div key="total" className="flex items-center justify-end gap-1.5 font-mono">
                <span className="font-black tracking-widest" style={{ color: INK, fontSize: 11 }}>
                    TOTAL
                </span>
                <span
                    className="px-2 py-0.5 font-black tabular-nums"
                    style={{ background: INK, color: PAPER, fontSize: 12 }}
                >
                    {formatIDNumber(data.total)}
                </span>
            </div>
        );
        list.push(<LedgerRow key="cash" label="TUNAI" value={formatIDNumber(data.cashPaid)} />);
        list.push(<LedgerRow key="change" label="KEMBALI" value={formatIDNumber(data.change)} strong />);
        list.push(
            <div key="barcode" className="pt-1">
                <FauxBarcode text={data.invoice} />
                <div
                    className="mt-0.5 text-center font-mono tracking-[0.3em]"
                    style={{ color: INK_MUTED, fontSize: 9 }}
                >
                    {data.invoice}
                </div>
            </div>
        );
        list.push(<div key="rule4" className="font-mono" style={{ borderTop: `2px dashed ${RULE}` }} />);
        list.push(
            <div
                key="thanks"
                className="text-center font-mono font-black uppercase tracking-[0.3em]"
                style={{ color: INK, fontSize: 11 }}
            >
                Terima Kasih
            </div>
        );
        if (footer?.trim()) {
            list.push(
                <div
                    key="footer"
                    className="text-center font-mono"
                    style={{ color: INK_MUTED, fontSize: 10, lineHeight: 1.45 }}
                >
                    {footer}
                </div>
            );
        }

        return list;
    }, [data, storeName, storeAddress, footer]);

    const printEnd = START + rows.length * STEP + 0.45;
    const [headDone, setHeadDone] = useState(false);

    return (
        <motion.div
            className={cn("relative mx-auto", className)}
            style={{ width: 264, transformPerspective: 640 }}
            initial={{ opacity: 0, y: reduced ? 0 : 18, rotateX: reduced ? 0 : 42, scale: reduced ? 1 : 0.92 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0, stiffness: 260, damping: 26, delay: 0.05 }}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute -top-2 left-0 right-0 h-2"
                style={{
                    backgroundImage: `url("${TOP_TEETH}")`,
                    backgroundRepeat: "repeat-x",
                    backgroundSize: "12px 8px",
                }}
            />
            <div
                className="relative"
                style={{
                    background: PAPER,
                    boxShadow: "0 24px 60px -18px rgba(0,0,0,0.75), 0 4px 14px -6px rgba(0,0,0,0.4)",
                }}
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(180deg, rgba(0,0,0,0.08) 0, rgba(0,0,0,0) 26px), repeating-linear-gradient(0deg, rgba(0,0,0,0.025) 0 1px, transparent 1px 3px)",
                    }}
                />
                <div className="relative space-y-1.5 px-5 pb-4 pt-4 font-mono">
                    {rows.map((node, i) => (
                        <Step key={i} delay={START + i * STEP} reduced={reduced}>
                            {node}
                        </Step>
                    ))}
                    <motion.div
                        aria-hidden
                        className="pointer-events-none absolute left-0 right-0 flex items-center"
                        initial={{ top: "0%" }}
                        animate={reduced ? { opacity: 0 } : headDone ? { opacity: 0 } : { top: ["0%", "100%"], opacity: 1 }}
                        transition={reduced ? { duration: 0 } : headDone ? { duration: 0.3 } : { duration: printEnd, ease: "linear" }}
                        onAnimationComplete={() => !headDone && !reduced && setHeadDone(true)}
                        style={{ height: 2 }}
                    >
                        <div style={{ height: 2, background: LED, opacity: 0.9, boxShadow: `0 0 8px 1px ${LED}` }} className="w-full" />
                        <div
                            className="shrink-0"
                            style={{
                                width: 6,
                                height: 6,
                                marginLeft: -3,
                                borderRadius: 999,
                                background: LED,
                                boxShadow: "0 0 10px 2px rgba(229,72,77,0.8)",
                            }}
                        />
                    </motion.div>
                </div>
            </div>
            <div
                aria-hidden
                className="pointer-events-none absolute -bottom-2 left-0 right-0 h-2"
                style={{
                    backgroundImage: `url("${BOTTOM_TEETH}")`,
                    backgroundRepeat: "repeat-x",
                    backgroundSize: "12px 8px",
                }}
            />
        </motion.div>
    );
}