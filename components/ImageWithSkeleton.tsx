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

export type ImageLoadState = "loading" | "slow" | "loaded" | "error";

export const SLOW_LOAD_THRESHOLD_MS = 2000;

export function isImageReady(
  imageElement: HTMLImageElement | null,
): imageElement is HTMLImageElement {
  return Boolean(imageElement?.complete && imageElement.naturalWidth > 0);
}

export function getImageLoadState({
  isLoaded,
  isSlowLoading,
  hasError,
}: {
  isLoaded: boolean;
  isSlowLoading: boolean;
  hasError: boolean;
}): ImageLoadState {
  if (hasError) {
    return "error";
  }

  if (isLoaded) {
    return "loaded";
  }

  if (isSlowLoading) {
    return "slow";
  }

  return "loading";
}

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

    if (isImageReady(el) && !imageDimensions && el.naturalHeight > 0) {
      setImageDimensions({
        width: el.naturalWidth,
        height: el.naturalHeight,
      });
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
  slowLoadMs = SLOW_LOAD_THRESHOLD_MS,
): {
  isLoaded: boolean;
  isSlowLoading: boolean;
  hasError: boolean;
  handleLoad: () => void;
  handleError: () => void;
} {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setIsSlowLoading(false);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    if (!isMounted || isLoaded || hasError) {
      setIsSlowLoading(false);
      return;
    }

    const slowLoadingTimer = setTimeout(() => {
      setIsSlowLoading(true);
    }, slowLoadMs);

    return () => clearTimeout(slowLoadingTimer);
  }, [hasError, isLoaded, isMounted, slowLoadMs, src]);

  useEffect(() => {
    if (!isMounted) return;

    const el = imgRef.current;
    if (isImageReady(el)) {
      setIsLoaded(true);
      setIsSlowLoading(false);
    }
  }, [imgRef, isMounted, src]);

  const handleLoad = () => {
    setIsLoaded(true);
    setIsSlowLoading(false);
  };

  const handleError = () => {
    setIsLoaded(false);
    setIsSlowLoading(false);
    setHasError(true);
  };

  return {
    isLoaded,
    isSlowLoading,
    hasError,
    handleLoad,
    handleError,
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
  const [imageDimensions, setImageDimensions] = useImageDimensions(
    src,
    imgRef,
    isMounted,
    width,
    height,
  );
  const { isLoaded, isSlowLoading, hasError, handleLoad, handleError } =
    useImageLoader(imgRef, src, isMounted, SLOW_LOAD_THRESHOLD_MS);

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

  const imageState = getImageLoadState({
    isLoaded,
    isSlowLoading,
    hasError,
  });

  return (
    <div
      className={`relative w-full ${containerClassName ?? ""}`}
      style={containerStyle}
      data-image-state={imageState}
      aria-busy={imageState === "loading" || imageState === "slow"}
    >
      {shouldShowSkeleton && (
        <Skeleton
          className="absolute inset-0 size-full"
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
        className={`${className} ${shouldShowImage ? "opacity-100" : "opacity-0"}
          transition-opacity duration-300
        `}
        style={{ borderRadius: "4px", ...style }}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        onLoad={onImageLoad}
        onError={onImageError}
      />
      {hasError && (
        <div className="
          absolute inset-0 flex items-center justify-center bg-gray-100
          dark:bg-gray-800
        ">
          <span className="text-sm text-gray-500">Failed to load</span>
        </div>
      )}
    </div>
  );
};
