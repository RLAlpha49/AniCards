import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

import { allowConsoleWarningsAndErrors } from "@/tests/unit/__setup__";
import {
  createDeferred,
  flushMicrotasks,
  installHappyDom,
  resetHappyDom,
  restoreHappyDom,
} from "@/tests/unit/hooks/test-helpers";

const previewCache = {
  getCachedPreviewObjectUrl: mock(() => null as string | null),
};
const convertSvgToBlob = mock(
  async () => new Blob(["preview"], { type: "image/png" }),
);
const getAbsoluteUrl = mock((previewUrl: string) =>
  new URL(previewUrl, globalThis.location.origin).toString(),
);
const readSvgMarkupFromObjectUrl = mock(async () => "<svg />");
const readSvgMarkupFromUrl = mock(async () => "<svg />");
const toCardApiHref = mock((previewUrl: string): string | null => previewUrl);
const cn = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ");

mock.module("@/components/user/tile/preview-cache", () => previewCache);
mock.module("@/lib/utils", () => ({
  cn,
  convertSvgToBlob,
  getAbsoluteUrl,
  readSvgMarkupFromObjectUrl,
  readSvgMarkupFromUrl,
  toCardApiHref,
}));

installHappyDom();

const { act, cleanup, renderHook } = await import("@testing-library/react");
const { useDownload } = await import("@/hooks/useDownload");
let createdAnchors: HTMLAnchorElement[] = [];
const originalCreateElement = document.createElement.bind(document);
const originalAnchorClick = HTMLAnchorElement.prototype.click;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const anchorClick = mock(() => {});
const createObjectURL = mock((blob: Blob | MediaSource) => {
  void blob;
  return "blob:download-result";
});
const revokeObjectURL = mock(() => {});

beforeEach(() => {
  resetHappyDom();
  createdAnchors = [];
  previewCache.getCachedPreviewObjectUrl.mockReset();
  convertSvgToBlob.mockReset();
  getAbsoluteUrl.mockReset();
  readSvgMarkupFromObjectUrl.mockReset();
  readSvgMarkupFromUrl.mockReset();
  toCardApiHref.mockReset();
  anchorClick.mockReset();
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();

  previewCache.getCachedPreviewObjectUrl.mockReturnValue(null);
  convertSvgToBlob.mockResolvedValue(
    new Blob(["preview"], { type: "image/png" }),
  );
  getAbsoluteUrl.mockImplementation((previewUrl: string) =>
    new URL(previewUrl, globalThis.location.origin).toString(),
  );
  readSvgMarkupFromObjectUrl.mockResolvedValue("<svg />");
  readSvgMarkupFromUrl.mockResolvedValue("<svg />");
  toCardApiHref.mockImplementation((previewUrl: string) => previewUrl);
  createObjectURL.mockReturnValue("blob:download-result");

  document.createElement = ((
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === "a") {
      createdAnchors.push(element as HTMLAnchorElement);
    }
    return element;
  }) as typeof document.createElement;

  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: anchorClick,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
});

afterEach(() => {
  cleanup();
  document.createElement = originalCreateElement;
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: originalAnchorClick,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
});

afterAll(() => {
  mock.restore();
  restoreHappyDom();
});

describe("useDownload", () => {
  it("routes PNG downloads through /card.png without creating an object URL", async () => {
    getAbsoluteUrl.mockReturnValue(
      "https://anicards.test/card.svg?card=animeStats",
    );
    toCardApiHref.mockReturnValue("/api/card?card=animeStats");
    previewCache.getCachedPreviewObjectUrl.mockReturnValue(
      "blob:cached-preview",
    );

    const { result } = renderHook(() =>
      useDownload("https://anicards.test/card.svg?card=animeStats", {
        cardId: "animeStats",
        variant: "minimal",
      }),
    );

    await act(async () => {
      await result.current.handleDownload("png");
    });

    expect(previewCache.getCachedPreviewObjectUrl).not.toHaveBeenCalled();
    expect(convertSvgToBlob).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalledTimes(1);

    const createdAnchor = createdAnchors[0];
    if (!createdAnchor) {
      throw new Error("Expected the hook to create a download anchor.");
    }

    expect(createdAnchor.download).toBe("animeStats-minimal.png");
    expect(createdAnchor.href).toBe(
      "https://anicards.test/card.png?card=animeStats",
    );
    expect(document.body.contains(createdAnchor)).toBe(false);
  });

  it("uses URL-based raster conversion and ignores duplicate in-flight downloads", async () => {
    const deferredBlob = createDeferred<Blob>();

    getAbsoluteUrl.mockReturnValue(
      "https://anicards.test/api/card?card=animeStats",
    );
    toCardApiHref.mockReturnValue("/api/card?card=animeStats");
    previewCache.getCachedPreviewObjectUrl.mockReturnValue(
      "blob:cached-preview",
    );
    readSvgMarkupFromObjectUrl.mockResolvedValue("<svg>cached</svg>");
    convertSvgToBlob.mockImplementation(async () => deferredBlob.promise);

    const { result } = renderHook(() =>
      useDownload("/api/card?card=animeStats", {
        cardId: "animeStats",
        variant: "minimal",
      }),
    );

    let downloadPromise!: Promise<void>;
    let duplicateDownloadPromise!: Promise<void>;
    act(() => {
      downloadPromise = result.current.handleDownload("webp");
      duplicateDownloadPromise = result.current.handleDownload("webp");
    });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.isDownloading).toBe(true);
    expect(result.current.status).toBe("downloading");
    expect(previewCache.getCachedPreviewObjectUrl).not.toHaveBeenCalled();
    expect(convertSvgToBlob).toHaveBeenCalledTimes(1);
    expect(readSvgMarkupFromObjectUrl).not.toHaveBeenCalled();
    expect(convertSvgToBlob).toHaveBeenCalledWith(
      "https://anicards.test/api/card?card=animeStats",
      "webp",
    );

    deferredBlob.resolve(new Blob(["webp"], { type: "image/webp" }));

    await act(async () => {
      await Promise.all([downloadPromise, duplicateDownloadPromise]);
    });

    expect(result.current.isDownloading).toBe(false);
    expect(result.current.status).toBe("success");
    expect(result.current.error).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download-result");
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(createdAnchors).toHaveLength(1);
    const createdAnchor = createdAnchors[0];
    if (!createdAnchor) {
      throw new Error("Expected the hook to create a download anchor.");
    }
    expect(createdAnchor.download).toBe("animeStats-minimal.webp");
    expect(createdAnchor.href).toBe("blob:download-result");
    expect(document.body.contains(createdAnchor)).toBe(false);
  });

  it("reports conversion failures and resets the transient downloading state", async () => {
    const { consoleError } = allowConsoleWarningsAndErrors();
    const downloadError = new Error("conversion failed");

    getAbsoluteUrl.mockReturnValue(
      "https://anicards.test/api/card?card=animeStats",
    );
    toCardApiHref.mockReturnValue(null);
    convertSvgToBlob.mockRejectedValue(downloadError);

    const { result } = renderHook(() =>
      useDownload("/api/card?card=animeStats", {
        cardId: "animeStats",
        variant: "minimal",
      }),
    );

    await act(async () => {
      await result.current.handleDownload();
    });

    expect(previewCache.getCachedPreviewObjectUrl).not.toHaveBeenCalled();
    expect(convertSvgToBlob).toHaveBeenCalledWith(
      "https://anicards.test/api/card?card=animeStats",
      "png",
    );
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(downloadError);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to download card:",
      downloadError,
    );
  });

  it("downloads raw SVG markup directly without routing through raster conversion", async () => {
    getAbsoluteUrl.mockReturnValue(
      "https://anicards.test/api/card?card=animeStats",
    );
    toCardApiHref.mockReturnValue("/api/card?card=animeStats");
    previewCache.getCachedPreviewObjectUrl.mockReturnValue(null);
    readSvgMarkupFromUrl.mockResolvedValue("<svg>live</svg>");

    const { result } = renderHook(() =>
      useDownload("/api/card?card=animeStats", {
        cardId: "animeStats",
        variant: "minimal",
      }),
    );

    await act(async () => {
      await result.current.handleDownload("svg");
    });

    expect(readSvgMarkupFromUrl).toHaveBeenCalledWith(
      "https://anicards.test/api/card?card=animeStats",
    );
    expect(convertSvgToBlob).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    const firstCreateObjectUrlCall = createObjectURL.mock.calls[0];
    if (!firstCreateObjectUrlCall) {
      throw new TypeError("Expected the SVG download to create an object URL.");
    }

    const [downloadBlob] = firstCreateObjectUrlCall;
    if (!(downloadBlob instanceof Blob)) {
      throw new TypeError("Expected SVG download to create a Blob.");
    }

    expect(downloadBlob.type).toBe("image/svg+xml");
    expect(await downloadBlob.text()).toBe("<svg>live</svg>");
    expect(anchorClick).toHaveBeenCalledTimes(1);

    const createdAnchor = createdAnchors[0];
    if (!createdAnchor) {
      throw new Error("Expected the hook to create a download anchor.");
    }

    expect(createdAnchor.download).toBe("animeStats-minimal.svg");
    expect(createdAnchor.href).toBe("blob:download-result");
  });
});
