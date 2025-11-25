"use client";

import { useEffect, useRef } from "react";

/**
 * Custom vertical scrollbar component that mirrors page scroll state and
 * enables pointer dragging and keyboard navigation for accessibility.
 * - Hides itself when content doesn't overflow the viewport.
 * - Keeps screen reader attributes in sync with scroll position.
 * @returns A custom scrollbar React element.
 * @source
 */
export function CustomScrollbar() {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef(0);

  useEffect(() => {
    const scrollbar = scrollbarRef.current;
    const thumb = thumbRef.current;

    if (!scrollbar || !thumb) return;

    // Update visual thumb size/position and accessible attributes based on
    // current document scroll state.
    const updateScrollbar = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const scrollTop = window.scrollY;

      const trackRect = scrollbar.getBoundingClientRect();
      const trackHeight = trackRect.height;

      // Guard against cases where content doesn't overflow the viewport
      if (scrollHeight <= clientHeight || trackHeight <= 0) {
        // Hide the thumb when there's nothing to scroll
        thumb.style.display = "none";
        thumb.style.height = "0px";
        thumb.style.top = "0px";
        return;
      } else {
        thumb.style.display = "";
      }

      const maxScroll = scrollHeight - clientHeight;
      const thumbHeight = Math.max(
        20,
        (clientHeight / scrollHeight) * trackHeight,
      );
      const scrollPercent = scrollTop / maxScroll;
      const thumbTop = scrollPercent * (trackHeight - thumbHeight);

      thumb.style.height = `${thumbHeight}px`;
      thumb.style.top = `${thumbTop}px`;

      // Update accessible attributes for assistive tech (and to satisfy linter)
      thumb.setAttribute("aria-valuenow", String(scrollTop));
      thumb.setAttribute("aria-valuemax", String(maxScroll));
    };

    // Sync thumb position when the window scrolls.
    const handleScroll = () => {
      updateScrollbar();
    };

    // Begin a drag operation on the scrollbar thumb.
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      thumb.classList.add("dragging");
      document.body.style.userSelect = "none";

      // Calculate pointer offset into the thumb so it doesn't jump on drag.
      const thumbRect = thumb.getBoundingClientRect();
      dragOffsetRef.current = e.clientY - thumbRect.top;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragOffsetRef.current = 0;
      thumb.classList.remove("dragging");
      document.body.style.userSelect = "";
    };

    // While dragging, convert pointer delta into page scroll position.
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const thumbHeight = thumb.offsetHeight;

      const trackRect = scrollbar.getBoundingClientRect();
      const trackHeight = trackRect.height;

      // Avoid division by zero and impossible states when content is small.
      const maxScroll = scrollHeight - clientHeight;
      const maxThumbTop = trackHeight - thumbHeight;
      if (maxScroll <= 0 || maxThumbTop <= 0) return;

      // Use absolute pointer Y relative to the track to compute new thumb top.
      const pointerY = e.clientY - trackRect.top;
      let requestedTop = pointerY - dragOffsetRef.current;
      requestedTop = Math.max(0, Math.min(requestedTop, maxThumbTop));
      const newScrollTop = (requestedTop / maxThumbTop) * maxScroll;

      window.scrollTo(0, newScrollTop);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const clientHeight = window.innerHeight;

      switch (key) {
        case "ArrowUp":
          e.preventDefault();
          window.scrollBy({ top: -40, left: 0, behavior: "auto" });
          break;
        case "ArrowDown":
          e.preventDefault();
          window.scrollBy({ top: 40, left: 0, behavior: "auto" });
          break;
        case "PageUp":
          e.preventDefault();
          window.scrollBy({ top: -clientHeight, left: 0, behavior: "auto" });
          break;
        case "PageDown":
          e.preventDefault();
          window.scrollBy({ top: clientHeight, left: 0, behavior: "auto" });
          break;
        default:
          break;
      }
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateScrollbar);
    thumb.addEventListener("mousedown", handleMouseDown);
    thumb.addEventListener("keydown", handleKeyDown);
    globalThis.addEventListener("mouseup", handleMouseUp);
    globalThis.addEventListener("mousemove", handleMouseMove);

    updateScrollbar();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollbar);
      thumb.removeEventListener("mousedown", handleMouseDown);
      thumb.removeEventListener("keydown", handleKeyDown);
      globalThis.removeEventListener("mouseup", handleMouseUp);
      globalThis.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div ref={scrollbarRef} className="custom-scrollbar">
      <div
        ref={thumbRef}
        className="custom-scrollbar-thumb"
        tabIndex={0}
        role="scrollbar"
        aria-controls="app-root"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuenow={0}
      />
    </div>
  );
}
