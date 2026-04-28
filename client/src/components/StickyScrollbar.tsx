import { useRef, useEffect, useState, useCallback } from "react";

/**
 * StickyScrollbar — wraps a horizontally-scrollable container and renders
 * a second, "fake" scrollbar that sticks to the bottom of the viewport.
 *
 * When the real scrollbar is off-screen (below the fold), the user can still
 * scroll the table horizontally using the sticky bar at the bottom of the viewport.
 */
export function StickyScrollbar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const fakeRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [barLeft, setBarLeft] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const syncing = useRef(false);

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    const rect = el.getBoundingClientRect();
    // Show sticky bar when the real scrollbar is below the viewport bottom
    const realBarBelowViewport = rect.bottom > window.innerHeight;

    setShow(hasOverflow && realBarBelowViewport);
    setThumbWidth(el.scrollWidth);
    setBarLeft(rect.left);
    setBarWidth(rect.width);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });

    // Use MutationObserver to detect DOM changes (e.g. data loading)
    const observer = new MutationObserver(measure);
    if (contentRef.current) {
      observer.observe(contentRef.current, { childList: true, subtree: true });
    }

    // Also re-measure periodically for the first few seconds (data loading)
    const timers = [
      setTimeout(measure, 500),
      setTimeout(measure, 1000),
      setTimeout(measure, 2000),
    ];

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [measure]);

  // Sync scroll positions between real and fake scrollbar
  const onContentScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (fakeRef.current && contentRef.current) {
      fakeRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  const onFakeScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (contentRef.current && fakeRef.current) {
      contentRef.current.scrollLeft = fakeRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  return (
    <div className="relative">
      {/* Real scrollable content */}
      <div
        ref={contentRef}
        className={`overflow-x-auto ${className}`}
        onScroll={onContentScroll}
      >
        {children}
      </div>

      {/* Sticky fake scrollbar aligned with the content container */}
      {show && (
        <div
          ref={fakeRef}
          onScroll={onFakeScroll}
          style={{
            position: "fixed",
            bottom: "0px",
            left: `${barLeft}px`,
            width: `${barWidth}px`,
            height: "20px",
            zIndex: 9999,
            background: "linear-gradient(to bottom, #e8ecf0, #d1d5db)",
            borderTop: "1px solid #9ca3af",
            boxShadow: "0 -3px 10px rgba(0,0,0,0.15)",
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          <div style={{ width: thumbWidth, height: "1px" }} />
        </div>
      )}
    </div>
  );
}
