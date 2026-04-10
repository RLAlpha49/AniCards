"use client";

import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

type ImageRenderState = {
  loadState: ImageLoadState;
  naturalDimensions: ImageDimensions | null;
};

export type ImageLoadState = "loading" | "slow" | "loaded" | "error";

export const SLOW_LOAD_THRESHOLD_MS = 2000;

const useIsomorphicLayoutEffect =
  globalThis.window === undefined ? useEffect : useLayoutEffect;

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

function getKnownDimensions(
  width: number | undefined,
  height: number | undefined,
): ImageDimensions | null {
  if (
    typeof width !== "number" ||
    width <= 0 ||
    typeof height !== "number" ||
    height <= 0
  ) {
    return null;
  }

  return {
    width,
    height,
  };
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

function areImageDimensionsEqual(
  current: ImageDimensions | null,
  next: ImageDimensions | null,
): boolean {
  return current?.width === next?.width && current?.height === next?.height;
}

function areImageRenderStatesEqual(
  current: ImageRenderState,
  next: ImageRenderState,
): boolean {
  return (
    current.loadState === next.loadState &&
    areImageDimensionsEqual(current.naturalDimensions, next.naturalDimensions)
  );
}

function getLoadingImageState(): ImageRenderState {
  return {
    loadState: "loading",
    naturalDimensions: null,
  };
}

function getLoadedImageState(
  imageElement: HTMLImageElement | null,
  knownDimensions: ImageDimensions | null,
): ImageRenderState {
  return {
    loadState: "loaded",
    naturalDimensions: knownDimensions
      ? null
      : getImageDimensions(imageElement),
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
  const [imageState, setImageState] = useState<ImageRenderState>(() =>
    getLoadingImageState(),
  );
  const knownDimensions = getKnownDimensions(width, height);
  const imageDimensions = knownDimensions ?? imageState.naturalDimensions;

  useIsomorphicLayoutEffect(() => {
    const readyImage = imgRef.current;

    if (isImageReady(readyImage)) {
      const loadedState = getLoadedImageState(readyImage, knownDimensions);
      setImageState((current) =>
        areImageRenderStatesEqual(current, loadedState) ? current : loadedState,
      );
      return;
    }

    const loadingState = getLoadingImageState();
    setImageState((current) =>
      areImageRenderStatesEqual(current, loadingState) ? current : loadingState,
    );

    const slowLoadingTimer = globalThis.setTimeout(() => {
      setImageState((current) =>
        current.loadState === "loading"
          ? { ...current, loadState: "slow" }
          : current,
      );
    }, SLOW_LOAD_THRESHOLD_MS);

    return () => globalThis.clearTimeout(slowLoadingTimer);
  }, [height, src, width]);

  const onImageLoad = () => {
    const loadedState = getLoadedImageState(imgRef.current, knownDimensions);

    setImageState((current) =>
      areImageRenderStatesEqual(current, loadedState) ? current : loadedState,
    );
  };

  const onImageError = () => {
    setImageState((current) =>
      current.loadState === "error"
        ? current
        : { ...current, loadState: "error" },
    );
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

  const showSkeleton =
    imageState.loadState === "loading" || imageState.loadState === "slow";
  const showImage = imageState.loadState === "loaded";

  return (
    <div
      className={`relative w-full ${containerClassName ?? ""}`}
      style={containerStyle}
      data-image-state={imageState.loadState}
      aria-busy={
        imageState.loadState === "loading" || imageState.loadState === "slow"
      }
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
      {imageState.loadState === "error" && (
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
