/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { previewCardDimensions, previewCardUrl } from "@/lib/card-preview";
import styles from "./CardPreviewImage.module.css";

type CardPreviewImageProps = Readonly<{
  cardType: string;
  variation?: string;
  preset?: string;
  /**
   * Explicit card URL. When set, it replaces the URL built from the card type,
   * variation, and preset, which lets callers show colours the preset argument
   * cannot express, such as four hand-picked hex values.
   */
  src?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  eager?: boolean;
  width?: number;
  height?: number;
  /**
   * Called once when the preview resolves, whether it painted or failed.
   *
   * Callers that swap the artwork animate on this rather than on mount, so the
   * incoming card is never revealed before its own SVG has decoded.
   */
  onSettled?: () => void;
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
  src,
  alt,
  className,
  style,
  eager = false,
  width,
  height,
  onSettled,
}: CardPreviewImageProps) {
  const [failed, setFailed] = useState(false);

  /* The settle callback is read through a ref so the element's ref callback
     keeps a stable identity. An unstable ref callback would detach and
     reattach on every parent render, which would fire the callback again. */
  const onSettledRef = useRef(onSettled);
  const settledRef = useRef(false);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  /** Reports the first resolution of this preview, and only the first. @source */
  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettledRef.current?.();
  }, []);

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
        settle();
      }
    },
    [detectErrorGraphic, settle],
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
      src={src ?? previewCardUrl(cardType, variation, preset)}
      alt={alt}
      className={className}
      style={style}
      width={expectedWidth}
      height={expectedHeight}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        setFailed(true);
        settle();
      }}
      onLoad={(event) => {
        detectErrorGraphic(event.currentTarget);
        settle();
      }}
    />
  );
}
