/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type React from "react";

type ImageWithSkeletonProps = {
  src: string;
  alt: string;
  className: string;
  style?: React.CSSProperties;
};

export const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  src,
  alt,
  className,
  style,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Fallback timeout to show content even if onLoad doesn't fire
    if (!isMounted) return;

    const fallbackTimer = setTimeout(() => {
      if (!isLoaded && !hasError) {
        setIsLoaded(true);
      }
    }, 2000);

    return () => clearTimeout(fallbackTimer);
  }, [isLoaded, hasError, isMounted]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div className="relative h-full w-full">
      {isMounted ? (
        <>
          {!isLoaded && !hasError && (
            <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
          )}
          <img
            src={src}
            alt={alt}
            className={`${className} ${isLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
            style={style}
            loading="lazy"
            onLoad={handleLoad}
            onError={handleError}
          />
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <span className="text-sm text-gray-500">Failed to load</span>
            </div>
          )}
        </>
      ) : (
        <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
      )}
    </div>
  );
};
