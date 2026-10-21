/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { previewCardDimensions, previewCardUrl } from "@/lib/card-preview";
import styles from "./CardPreviewImage.module.css";

type CardPreviewImageProps = Readonly<{
  cardType: string;
  variation?: string;
  preset?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  eager?: boolean;
  width?: number;
  height?: number;
}>;

/**
 * Dimensions of the error SVG the card API returns for a failed request.
 *
 * The API answers a bad request with a valid `image/svg+xml` body and a 4xx
 * or 5xx status. An `<img>` ignores the status and only checks whether the
 * body decodes, so a failed card renders as a plausible black graphic rather
 * than a broken-image icon. No card template uses this size, so it
 * identifies the error body.
 * @source
 */
const ERROR_SVG_SIZE = { width: 800, height: 400 } as const;

/**
 * Plain image element for live SVG card previews.
 *
 * The shared `ImageWithSkeleton` forces a fixed radius and centres a skeleton,
 * which fights the art-directed frames on the home page. The home page owns
 * its frames, so the card renders directly.
 *
 * The card's intrinsic size is set on the element, so the frame reserves its
 * space before the SVG loads and the image is never stretched to fit a box of
 * the wrong shape. When the loaded image turns out to be the API's error
 * graphic, a fallback takes its place.
 *
 * @source
 */
export function CardPreviewImage({
  cardType,
  variation,
  preset,
  alt,
  className,
  style,
  eager = false,
  width,
  height,
}: CardPreviewImageProps) {
  const [failed, setFailed] = useState(false);

  const dimensions = previewCardDimensions(cardType, variation ?? "default");
  const expectedWidth = width ?? dimensions.width;
  const expectedHeight = height ?? dimensions.height;

  /**
   * Detects the API's error graphic on a loaded card.
   *
   * @param image - The loaded image element.
   * @source
   */
  const detectErrorGraphic = useCallback((image: HTMLImageElement | null) => {
    if (!image) return;
    if (
      image.naturalWidth === ERROR_SVG_SIZE.width &&
      image.naturalHeight === ERROR_SVG_SIZE.height
    ) {
      setFailed(true);
    }
  }, []);

  /* A card that finished loading before hydration never fires `load`, so the
     ref callback checks the already-complete image as well. */
  const attachImage = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete) {
        detectErrorGraphic(image);
      }
    },
    [detectErrorGraphic],
  );

  if (failed) {
    return (
      <span className={styles.failed} role="status">
        Preview unavailable
      </span>
    );
  }

  return (
    <img
      ref={attachImage}
      src={previewCardUrl(cardType, variation, preset)}
      alt={alt}
      className={className}
      style={style}
      width={expectedWidth}
      height={expectedHeight}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={(event) => detectErrorGraphic(event.currentTarget)}
    />
  );
}
