"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Props for ImageWithSkeleton component.
 * - src: image URL to render
 * - alt: alternative text for the image
 * - className: Tailwind classes applied to the image
 * - style: optional inline styles passed through to the img element
 * - width: optional known width for proper skeleton sizing
 * - height: optional known height for proper skeleton sizing
 * - containerClassName: optional className for the wrapper container
 * @source
 */
type ImageWithSkeletonProps = {
  src: string;
  alt: string;
  className: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  containerClassName?: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
  fixedDimensions?: boolean;
};

function useImageDimensions(
  src: string,
  imgRef: React.RefObject<HTMLImageElement | null>,
  isMounted: boolean,
  width?: number,
  height?: number,
): readonly [
  { width: number; height: number } | null,
  React.Dispatch<
    React.SetStateAction<{ width: number; height: number } | null>
  >,
] {
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(width && height ? { width, height } : null);

  useEffect(() => {
    if (!isMounted) return;
    const el = imgRef.current;
    if (!el) return;
    if (el.complete) {
      if (!imageDimensions && el.naturalWidth && el.naturalHeight) {
        setImageDimensions({
          width: el.naturalWidth,
          height: el.naturalHeight,
        });
      }
    }
  }, [isMounted, src, imageDimensions, imgRef]);

  useEffect(() => {
    if (width && height) {
      setImageDimensions({ width, height });
    } else {
      setImageDimensions(null);
    }
  }, [src, width, height]);

  return [imageDimensions, setImageDimensions] as const;
}

function useImageLoader(
  imgRef: React.RefObject<HTMLImageElement | null>,
  src: string,
  isMounted: boolean,
  fallbackMs = 2000,
): {
  isLoaded: boolean;
  hasError: boolean;
  handleLoad: () => void;
  handleError: () => void;
  setIsLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  setHasError: React.Dispatch<React.SetStateAction<boolean>>;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!isMounted) return;

    const fallbackTimer = setTimeout(() => {
      if (!isLoaded && !hasError) {
        setIsLoaded(true);
      }
    }, fallbackMs);

    return () => clearTimeout(fallbackTimer);
  }, [fallbackMs, hasError, isLoaded, isMounted]);

  useEffect(() => {
    if (!isMounted) return;

    const el = imgRef.current;
    if (!el) return;

    if (el.complete) {
      setIsLoaded(true);
    }
  }, [imgRef, isMounted, src]);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = () => setIsLoaded(true);
  const handleError = () => setHasError(true);

  return {
    isLoaded,
    hasError,
    handleLoad,
    handleError,
    setIsLoaded,
    setHasError,
  };
}

function getContainerStyle(
  imageDimensions: { width: number; height: number } | null,
  fallbackAspectRatio: number | undefined,
  fixedDimensions: boolean,
): React.CSSProperties {
  if (imageDimensions) {
    const style: React.CSSProperties = fixedDimensions
      ? {
          width: imageDimensions.width,
          minWidth: imageDimensions.width,
          maxWidth: imageDimensions.width,
        }
      : { maxWidth: imageDimensions.width };

    if (fallbackAspectRatio) style.aspectRatio = fallbackAspectRatio;
    return style;
  }
  if (fallbackAspectRatio) return { aspectRatio: fallbackAspectRatio };
  return {};
}

/**
 * Image wrapper that displays a Skeleton while the image is loading.
 * Uses a client-side mount lifecycle to avoid SSR mismatch for randomized
 * or lazy loaded images and provides a simple error fallback.
 * The skeleton sizing is constrained to the image's natural dimensions.
 * @source
 */
export const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className,
  style,
  width,
  height,
  containerClassName,
  loading = "lazy",
  decoding = "async",
  fixedDimensions = false,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageDimensions, setImageDimensions] = useImageDimensions(
    src,
    imgRef,
    isMounted,
    width,
    height,
  );
  const { isLoaded, hasError, handleLoad, handleError } = useImageLoader(
    imgRef,
    src,
    isMounted,
    2000,
  );

  const onImageLoad = () => {
    if (imgRef.current && !imageDimensions) {
      setImageDimensions({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
    handleLoad();
  };

  const onImageError = () => {
    handleError();
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const aspectRatio = imageDimensions
    ? imageDimensions.width / imageDimensions.height
    : undefined;

  const fallbackAspectRatio = aspectRatio ?? 16 / 9;

  const containerStyle = getContainerStyle(
    imageDimensions,
    fallbackAspectRatio,
    fixedDimensions,
  );

  const showSkeleton = !hasError && !isLoaded;
  const showImage = isLoaded;

  const shouldShowSkeleton = !isMounted || showSkeleton;
  const shouldShowImage = isMounted && showImage;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${containerClassName ?? ""}`}
      style={containerStyle}
    >
      {shouldShowSkeleton && (
        <Skeleton
          className="absolute inset-0 h-full w-full rounded-lg"
          style={
            fallbackAspectRatio
              ? { aspectRatio: fallbackAspectRatio }
              : undefined
          }
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`${className} ${shouldShowImage ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        style={{ borderRadius: "4px", ...style }}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        onLoad={onImageLoad}
        onError={onImageError}
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
          <span className="text-sm text-gray-500">Failed to load</span>
        </div>
      )}
    </div>
  );
};
