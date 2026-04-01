import { useLayoutEffect, useRef } from "react";

type OverlayScrollbarOptions = {
    autoHideDelay?: number;
    minThumbHeight?: number;
    scrollStopDelay?: number;
};

interface UseOverlayScrollbarProps {
    outerRef: React.RefObject<HTMLElement | null>;
    thumbRef: React.RefObject<HTMLElement | null>;
    trackRef: React.RefObject<HTMLElement | null>;
    containerRef: React.RefObject<HTMLElement | null>;
    options?: OverlayScrollbarOptions;
}

export function useOverlayScrollbar({ outerRef, thumbRef, trackRef, containerRef, options }: UseOverlayScrollbarProps) {
    const {
        autoHideDelay = 800,
        minThumbHeight = 24,
        scrollStopDelay = 150,
    } = options || {};

    const hideTimeout = useRef<number>(-1);
    const rafId = useRef<number>(-1);
    const resizeObserver = useRef<ResizeObserver>(null);

    const scrollTopRef = useRef(0);
    const scrollBottomRef = useRef(0);
    const scrollingRef = useRef(false);
    const scrollStopTimeout = useRef<number>(-1);

    const listeners = useRef(new Set<() => void>());

    useLayoutEffect(() => {
        let frameId: number;
        let onHover = false;

        const tryInit = () => {
            const scrollEl = outerRef.current;
            const thumbEl = thumbRef.current;
            const trackEl = trackRef.current;
            const container = containerRef.current;


            if (!scrollEl || !thumbEl || !trackEl || !container) {
                frameId = requestAnimationFrame(tryInit);
                return;
            }

            const showTrack = () => {
                onHover = true;
                trackEl.style.opacity = "1";

                clearTimeout(hideTimeout.current);
            };

            const hideTrack = () => {
                clearTimeout(hideTimeout.current);
                hideTimeout.current = window.setTimeout(() => {
                    trackEl.style.opacity = "0";
                    onHover = false;
                }, autoHideDelay);
            };

            const updateThumb = () => {
                const totalHeight = scrollEl.scrollHeight;
                const visibleHeight = scrollEl.clientHeight;

                if (totalHeight <= visibleHeight) {
                    trackEl.style.opacity = "0";
                    thumbEl.style.height = "0px";
                    return;
                }

                const thumbHeight = Math.max(
                    (visibleHeight / totalHeight) * visibleHeight,
                    minThumbHeight
                );

                thumbEl.style.height = `${thumbHeight}px`;

                const scrollTop = scrollEl.scrollTop;
                const maxScroll = totalHeight - visibleHeight;
                const maxThumbTop = visibleHeight - thumbHeight;

                scrollTopRef.current = scrollTop;
                scrollBottomRef.current = maxScroll - scrollTop;
                listeners.current.forEach((listener) => listener());

                const thumbTop =
                    (scrollTop / maxScroll) * maxThumbTop;

                thumbEl.style.transform = `translateY(${thumbTop}px)`;
            };

            const onScroll = () => {
                clearTimeout(scrollStopTimeout.current);
                scrollingRef.current = true;
                
                scrollStopTimeout.current = window.setTimeout(() => {
                    scrollingRef.current = false;
                    listeners.current.forEach((listener) => listener());
                }, scrollStopDelay);

                cancelAnimationFrame(rafId.current);
                rafId.current = requestAnimationFrame(updateThumb);

                const totalHeight = scrollEl.scrollHeight;
                const visibleHeight = scrollEl.clientHeight;
                const scrollTop = scrollEl.scrollTop;

                const maxScroll = totalHeight - visibleHeight;
                const scrollBottom = maxScroll - scrollTop;

                scrollTopRef.current = scrollTop;
                scrollBottomRef.current = scrollBottom;
                scrollingRef.current = true;

                listeners.current.forEach((listener) => listener());

                trackEl.style.opacity = "1";

                if (onHover) return;

                clearTimeout(hideTimeout.current);
                hideTimeout.current = window.setTimeout(() => {
                    trackEl.style.opacity = "0";
                }, autoHideDelay);
            };

            scrollEl.addEventListener("scroll", onScroll, { passive: true });
            container.addEventListener("mouseenter", showTrack, { passive: true });
            container.addEventListener("mouseleave", hideTrack, { passive: true });

            resizeObserver.current = new ResizeObserver(updateThumb);
            resizeObserver.current.observe(scrollEl);

            updateThumb();
        };

        frameId = requestAnimationFrame(tryInit);

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, []);

    // 🔥 Drag Support
    useLayoutEffect(() => {
        let frame: number;

        const tryAttach = () => {
            const scrollEl = outerRef.current;
            const thumbEl = thumbRef.current;

            if (!scrollEl || !thumbEl) {
                frame = requestAnimationFrame(tryAttach);
                return;
            }

            let isDragging = false;
            let startY = 0;
            let startScrollTop = 0;
            // let activePointerId: number | null = null;

            const onPointerMove = (e: PointerEvent) => {
                if (!isDragging) return;

                const totalHeight = scrollEl.scrollHeight;
                const visibleHeight = scrollEl.clientHeight;

                const maxScroll = totalHeight - visibleHeight;
                const maxThumbTop = visibleHeight - thumbEl.offsetHeight;

                const delta = e.clientY - startY;
                const scrollRatio = maxScroll / maxThumbTop;

                scrollEl.scrollTop =
                    startScrollTop + delta * scrollRatio;
            };

            const onPointerUp = () => {
                isDragging = false;
                // activePointerId = null;
                document.body.style.userSelect = "";
            };

            const onPointerDown = (e: PointerEvent) => {
                isDragging = true;
                // activePointerId = e.pointerId;

                startY = e.clientY;
                startScrollTop = scrollEl.scrollTop;

                document.body.style.userSelect = "none";
                thumbEl.setPointerCapture(e.pointerId);
            };

            thumbEl.addEventListener("pointerdown", onPointerDown);
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
        };

        frame = requestAnimationFrame(tryAttach);

        return () => cancelAnimationFrame(frame);
    }, []);

    return {
        getScrollTop: () => scrollTopRef.current,
        getScrollBottom: () => scrollBottomRef.current,
        getIsScrolling: () => scrollingRef.current,
        subscribe: (cb: () => void) => {
            listeners.current.add(cb);
            return () => listeners.current.delete(cb);
        },
    };
}