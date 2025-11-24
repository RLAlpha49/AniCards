"use client";

import { useEffect, useRef } from "react";

export function CustomScrollbar() {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const scrollbar = scrollbarRef.current;
    const thumb = thumbRef.current;

    if (!scrollbar || !thumb) return;

    const updateScrollbar = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const scrollTop = window.scrollY;

      const scrollPercent = scrollTop / (scrollHeight - clientHeight);
      const thumbHeight = (clientHeight / scrollHeight) * clientHeight;
      const thumbTop = scrollPercent * (clientHeight - thumbHeight);

      thumb.style.height = `${Math.max(thumbHeight, 20)}px`;
      thumb.style.top = `${thumbTop}px`;
    };

    const handleScroll = () => {
      updateScrollbar();
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      thumb.classList.add("dragging");
      document.body.style.userSelect = "none";
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      thumb.classList.remove("dragging");
      document.body.style.userSelect = "";
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const thumbHeight = thumb.offsetHeight;

      const deltaY = e.movementY;
      const newScrollTop =
        window.scrollY +
        (deltaY / (clientHeight - thumbHeight)) * (scrollHeight - clientHeight);

      window.scrollTo(0, newScrollTop);
    };

    window.addEventListener("scroll", handleScroll);
    thumb.addEventListener("mousedown", handleMouseDown);
    globalThis.addEventListener("mouseup", handleMouseUp);
    globalThis.addEventListener("mousemove", handleMouseMove);

    updateScrollbar();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      thumb.removeEventListener("mousedown", handleMouseDown);
      globalThis.removeEventListener("mouseup", handleMouseUp);
      globalThis.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div ref={scrollbarRef} className="custom-scrollbar">
      <div ref={thumbRef} className="custom-scrollbar-thumb" />
    </div>
  );
}
