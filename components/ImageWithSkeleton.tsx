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
  fetchPriority?: React.ImgHTMLAttributes<HTMLImageElement>["fetchPriority"];
  fixedDimensions?: boolean;
};

type ImageDimensions = {
  width: number;
  height: number;
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

function getImageDimensions(
  imageElement: HTMLImageElement | null,
): ImageDimensions | null {
  if (!imageElement) {
    return null;
  }

  if (imageElement.naturalWidth <= 0 || imageElement.naturalHeight <= 0) {
    return null;
  }

  return {
    width: imageElement.naturalWidth,
    height: imageElement.naturalHeight,
  };
}

function getContainerStyle(
  imageDimensions: ImageDimensions | null,
  fallbackAspectRatio: number | undefined,
  fixedDimensions: boolean,
): React.CSSProperties {
  if (fixedDimensions && imageDimensions) {
    const style: React.CSSProperties = {
      width: imageDimensions.width,
      minWidth: imageDimensions.width,
      maxWidth: imageDimensions.width,
    };

    if (fallbackAspectRatio) style.aspectRatio = fallbackAspectRatio;
    return style;
  }

  if (fallbackAspectRatio) return { aspectRatio: fallbackAspectRatio };
  return {};
}

/**
 * Image wrapper that displays a Skeleton while the image is loading.
 * Uses intrinsic dimensions when available to reserve responsive space and
 * lets the native image lifecycle drive visibility with a simple error fallback.
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
  fetchPriority,
  fixedDimensions = false,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadedDimensions, setLoadedDimensions] =
    useState<ImageDimensions | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const knownDimensions =
    typeof width === "number" &&
    width > 0 &&
    typeof height === "number" &&
    height > 0
      ? { width, height }
      : null;
  const imageDimensions = knownDimensions ?? loadedDimensions;

  useEffect(() => {
    setLoadedDimensions(null);
    setIsLoaded(false);
    setIsSlowLoading(false);
    setHasError(false);

    const readyImage = imgRef.current;
    if (!isImageReady(readyImage)) {
      return;
    }

    if (!knownDimensions) {
      const naturalDimensions = getImageDimensions(readyImage);
      if (naturalDimensions) {
        setLoadedDimensions(naturalDimensions);
      }
    }

    setIsLoaded(true);
  }, [height, src, width]);

  useEffect(() => {
    if (isLoaded || hasError) {
      setIsSlowLoading(false);
      return;
    }

    const slowLoadingTimer = setTimeout(() => {
      setIsSlowLoading(true);
    }, SLOW_LOAD_THRESHOLD_MS);

    return () => clearTimeout(slowLoadingTimer);
  }, [hasError, isLoaded, src]);

  const onImageLoad = () => {
    if (!knownDimensions) {
      const naturalDimensions = getImageDimensions(imgRef.current);
      if (naturalDimensions) {
        setLoadedDimensions(naturalDimensions);
      }
    }

    setHasError(false);
    setIsLoaded(true);
    setIsSlowLoading(false);
  };

  const onImageError = () => {
    setHasError(true);
    setIsLoaded(false);
    setIsSlowLoading(false);
  };

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
      {showSkeleton && (
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
        className={`${className} ${showImage ? "opacity-100" : "opacity-0"}
          transition-opacity duration-300
        `}
        style={{ borderRadius: "4px", ...style }}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
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
