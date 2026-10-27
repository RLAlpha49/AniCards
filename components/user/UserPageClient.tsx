"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaperSurface } from "@/components/PaperSurface";
import { displayNames } from "@/lib/card-data/validation";
import {
  getCardBorderRadius,
  getResponseErrorMessage,
  parseResponsePayload,
} from "@/lib/utils";
import {
  VARIATION_LABEL_MAP,
  buildCardUrlWithParams,
  mapStoredConfigToCardUrlParams,
} from "@/lib/card-groups";
import { buildCardVersion } from "@/lib/server/card-version";
import { UserMasthead } from "./UserMasthead";
import { SavedCardSet } from "./SavedCardSet";
import { SavedCardClosing, SavedCardGuide } from "./SavedCardGuide";
import { UserPageState } from "./UserPageState";
import type { SavedCard } from "./types";
import styles from "./user.module.css";

/**
 * Basic user identity returned from the API.
 * @property userId - AniList numeric user id.
 * @property username - Optional AniList username for display.
 * @property dataUpdatedAt - When the stats behind the cards last changed.
 *   `get-user` includes it in the parts it returns by default. This is not
 *   `updatedAt`: a scheduled refresh advances that on every run, whether or
 *   not the numbers moved.
 * @source
 */
interface UserData {
  userId: string;
  username?: string;
  dataUpdatedAt?: string;
}

/**
 * Shape of a card configuration entry used to request or render a stat card.
 * @property cardName - Internal card key used to generate the SVG.
 * @property variation - Optional card variation identifier.
 * @property useStatusColors - Optional flag to render status distribution with color hints.
 * @property showPiePercentages - Optional flag to toggle pie chart percentage labels.
 * @property showFavorites - Optional flag to show favorites indicator.
 * @property titleColor - Title color (hex or gradient).
 * @property backgroundColor - Background color (hex or gradient).
 * @property textColor - Text color (hex or gradient).
 * @property circleColor - Circle/accent color (hex or gradient).
 * @property borderColor - Optional border color.
 * @property borderRadius - Optional border radius.
 * @source
 */
interface CardData {
  cardName: string;
  variation?: string;
  useStatusColors?: boolean;
  showPiePercentages?: boolean;
  showFavorites?: boolean;
  borderRadius?: number;
  // Color configuration
  titleColor?: string;
  backgroundColor?: string;
  textColor?: string;
  circleColor?: string;
  borderColor?: string;
  // Color preset name (if not "custom", use preset instead of individual colors)
  colorPreset?: string;
  gridCols?: number;
  gridRows?: number;
}

/**
 * Parts the user page needs. The page renders only the user ID and username,
 * so the other stored parts are left in Redis.
 * @source
 */
const USER_PAGE_PARTS = "meta";

type ApiUser = {
  userId?: string | number;
  username?: string;
  dataUpdatedAt?: string;
};
type ApiCards = {
  userId?: number | string;
  cards?: CardData[];
  updatedAt?: string;
};

/**
 * Fetch JSON from the given URL and perform minimal validation for 'user' or 'cards'.
 * Errors are reported via the provided setError callback and null is returned
 * to indicate failure.
 */
async function fetchJsonWithValidation<T>(
  url: string,
  kind: "user" | "cards",
  setErrorCallback: (v: string | null) => void,
): Promise<T | null> {
  try {
    const res = await fetch(url);
    const payload = await parseResponsePayload(res);

    if (!res.ok) {
      const bodyMsg = getResponseErrorMessage(res, payload);
      setErrorCallback(
        kind === "user"
          ? `Failed to load user (${bodyMsg})`
          : `Failed to load cards (${bodyMsg})`,
      );
      return null;
    }

    if (kind === "user") {
      const p = payload as ApiUser;
      if (!p || typeof p !== "object" || (!p.userId && !p.username)) {
        setErrorCallback("Failed to load user: invalid response format");
        return null;
      }
    } else {
      const p = payload as ApiCards;
      if (!p || typeof p !== "object" || !Array.isArray(p.cards)) {
        setErrorCallback("Failed to load cards: invalid response format");
        return null;
      }
    }

    return payload as T;
  } catch (error_) {
    setErrorCallback(
      kind === "user" ? "Failed to load user" : "Failed to load cards",
    );
    console.error("Network error while fetching", url, error_);
    return null;
  }
}

/**
 * Error sink for a fetch whose failure must not break the page.
 *
 * Some requests only enrich the page with extra information. A failure
 * there leaves the page able to render, so the failure is not reported as a
 * page error.
 *
 * @source
 */
const ignoreError = (): void => {};

/**
 * Fetch a user by numeric id.
 */
async function fetchUserById(
  userId: string,
  setErrorCallback: (v: string | null) => void,
): Promise<ApiUser | null> {
  return fetchJsonWithValidation<ApiUser>(
    `/api/get-user?userId=${userId}&parts=${USER_PAGE_PARTS}`,
    "user",
    setErrorCallback,
  );
}

/**
 * Fetch a user by username.
 */
async function fetchUserByUsername(
  username: string,
  setErrorCallback: (v: string | null) => void,
): Promise<ApiUser | null> {
  return fetchJsonWithValidation<ApiUser>(
    `/api/get-user?username=${encodeURIComponent(username)}&parts=${USER_PAGE_PARTS}`,
    "user",
    setErrorCallback,
  );
}

/**
 * Fetch cards for a user id.
 */
async function fetchCardsForUserId(
  userId: string,
  setErrorCallback: (v: string | null) => void,
): Promise<ApiCards | null> {
  return fetchJsonWithValidation<ApiCards>(
    `/api/get-cards?userId=${userId}`,
    "cards",
    setErrorCallback,
  );
}

/**
 * Narrowing helper that checks whether the given userId is a valid AniList numeric id string.
 * @param userId - The candidate userId string or null.
 * @returns True if userId is a numeric string.
 * @source
 */
const isValidUserId = (userId: string | null): userId is string => {
  if (!userId) return false;
  return /^\d+$/.test(userId);
};

/**
 * Narrowing helper that checks whether the username matches expected AniList username patterns.
 * @param username - The candidate username string or null.
 * @returns True if username is valid.
 * @source
 */
const isValidUsername = (username: string | null): username is string => {
  if (!username) return false;
  return /^[a-zA-Z0-9_-]{2,}$/.test(username);
};

/**
 * Parse a JSON-encoded cards parameter and filter invalid entries.
 * @param cardsParam - JSON string representing an array of CardData entries.
 * @returns Filtered CardData array.
 * @throws {TypeError} If the parameter is not an array.
 * @source
 */
const parseAndValidateCards = (cardsParam: string): CardData[] => {
  try {
    const parsedCards = JSON.parse(cardsParam);

    if (!Array.isArray(parsedCards)) {
      throw new TypeError("Cards parameter must be an array");
    }

    return parsedCards.filter((card) => {
      if (typeof card !== "object" || card === null) {
        console.warn("Invalid card object:", card);
        return false;
      }
      if (typeof card.cardName !== "string" || !card.cardName) {
        console.warn("Card missing required cardName:", card);
        return false;
      }
      return true;
    });
  } catch (error_) {
    console.error("Failed to parse cards parameter:", error_);
    throw error_;
  }
};

/**
 * Safely read a string property from a Record-like object.
 * Returns the string value or undefined if not present or not a string.
 */
function getStringField(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

/**
 * Safely read a boolean property from a Record-like object.
 * Returns the boolean value or undefined if not present or not a boolean.
 */
function getBooleanField(
  obj: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const v = obj[key];
  return typeof v === "boolean" ? v : undefined;
}

/**
 * Safely read a finite number property from a Record-like object.
 * Returns the number value or undefined if not present or not a finite number.
 */
function getFiniteNumberField(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Read a grid size property, clamp and truncate it to the allowed range [1, 5].
 */
function getGridSizeField(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const n = getFiniteNumberField(obj, key);
  if (n === undefined) return undefined;
  return Math.max(1, Math.min(5, Math.trunc(n)));
}

function normalizeCardEntry(raw: unknown): CardData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const cardName = getStringField(r, "cardName");
  if (!cardName) return null;
  return {
    cardName,
    variation: getStringField(r, "variation"),
    useStatusColors: getBooleanField(r, "useStatusColors"),
    showPiePercentages: getBooleanField(r, "showPiePercentages"),
    showFavorites: getBooleanField(r, "showFavorites"),
    borderRadius: getFiniteNumberField(r, "borderRadius"),
    // Color configuration
    titleColor: getStringField(r, "titleColor"),
    backgroundColor: getStringField(r, "backgroundColor"),
    textColor: getStringField(r, "textColor"),
    circleColor: getStringField(r, "circleColor"),
    borderColor: getStringField(r, "borderColor"),
    colorPreset: getStringField(r, "colorPreset"),
    gridCols: getGridSizeField(r, "gridCols"),
    gridRows: getGridSizeField(r, "gridRows"),
  };
}

/**
 * Builds the version string a card URL carries in `_t`.
 *
 * The card endpoint ignores the value of `_t`; only its presence matters, and
 * it tells the endpoint not to use a stored copy of the card. The version
 * here is what makes the URL itself change when the card's content changes,
 * so a browser or CDN that already holds the old URL is asked for the new
 * one.
 *
 * Two things change a card: the stats it draws, and the configuration it is
 * drawn with. `dataUpdatedAt` moves only when a refresh actually changed the
 * stats, so a scheduled refresh that finds the same numbers leaves every URL
 * alone. `updatedAt` on the cards record is the configuration's own write
 * time, which only moves when someone saves.
 *
 * @param user - Resolved user identity, whose `dataUpdatedAt` covers the stats.
 * @param cardsUpdatedAt - `updatedAt` of the stored card configuration.
 * @returns A stable version token, or `undefined` when no timestamp exists.
 * @source
 */
function buildCardDataVersion(
  user: UserData | null,
  cardsUpdatedAt: string | undefined,
): string | undefined {
  return buildCardVersion(user?.dataUpdatedAt, cardsUpdatedAt);
}

/**
 * Preferred ordering for specific card types so the opening card is the one a
 * visitor is most likely to want on a profile.
 * @source
 */
const PRIORITY_ORDER = ["animeStats", "mangaStats", "socialStats"];

/**
 * Reads a stored preset key as a label.
 *
 * Stored keys are camel case, so `anilistDarkGradient` becomes
 * `Anilist Dark Gradient`. A record without a preset is drawn from its own
 * saved colours, which is what the generator calls a custom palette.
 *
 * @param key - Stored preset name.
 * @returns A readable label.
 * @source
 */
function readPresetLabel(key: string | undefined): string {
  if (!key || key === "custom") return "Custom palette";
  const spaced = key.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Turns the stored card configuration into the entries the page renders.
 *
 * @param cards - Stored card configurations.
 * @param userId - Profile the cards belong to.
 * @param version - Cache-busting token shared by every card in the set.
 * @returns Cards ready to render, in display order.
 * @source
 */
function buildSavedCards(
  cards: CardData[],
  userId: string | undefined,
  version: string,
): SavedCard[] {
  const built = cards.map<SavedCard>((card) => {
    const variation = card.variation || "default";
    const displayName = displayNames[card.cardName] || card.cardName;
    const isStatusDist = [
      "animeStatusDistribution",
      "mangaStatusDistribution",
    ].includes(card.cardName);
    const isFavoriteCapable = [
      "animeVoiceActors",
      "animeStudios",
      "animeStaff",
      "mangaStaff",
    ].includes(card.cardName);
    const isPieLikeVariation = variation === "pie" || variation === "donut";

    /* A stored preset wins. Legacy records without one fall back to `custom`,
       which makes the API resolve the colours from the saved record. */
    const effectivePreset = card.colorPreset ?? "custom";

    const urlParams = mapStoredConfigToCardUrlParams(
      {
        cardName: card.cardName,
        variation,
        colorPreset: effectivePreset,
        borderColor: card.borderColor,
        borderRadius: card.borderRadius,
        showFavorites: isFavoriteCapable ? card.showFavorites : undefined,
        useStatusColors: isStatusDist ? card.useStatusColors : undefined,
        showPiePercentages: isPieLikeVariation
          ? card.showPiePercentages
          : undefined,
        ...(card.cardName === "favoritesGrid"
          ? { gridCols: card.gridCols, gridRows: card.gridRows }
          : {}),
      },
      {
        userId,
        includeColors: false,
        defaultToCustomPreset: true,
      },
    );

    const svgUrl = buildCardUrlWithParams(urlParams);

    return {
      type: displayName,
      rawType: card.cardName,
      variation: VARIATION_LABEL_MAP[variation] ?? variation,
      preset: readPresetLabel(card.colorPreset),
      /* A URL with no `_t` is cached until something else changes it, and
         nothing else does when the version is unknown. The page-load time
         stands in, which is the safe direction: a card that may be out of date
         is fetched again rather than served from an unknown copy. */
      svgUrl: `${svgUrl}&_t=${encodeURIComponent(version)}`,
      borderRadius: getCardBorderRadius(card.borderRadius),
    };
  });

  return built.sort((a, b) => {
    const aPriority = PRIORITY_ORDER.indexOf(a.rawType);
    const bPriority = PRIORITY_ORDER.indexOf(b.rawType);

    if (aPriority !== -1 || bPriority !== -1) {
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    }

    return a.type.localeCompare(b.type);
  });
}

/**
 * The cards saved for one AniList profile.
 *
 * The page answers one question: what did the generator make for this profile,
 * and how do I take it? The masthead names the profile and states what the set
 * holds. The set follows, opening on the first card at full size. A short guide
 * explains the one thing a card is used for besides downloading it, and the
 * closing action sends the visitor back to the generator.
 *
 * Three query shapes resolve here: `userId`, `username`, and `cards`. The
 * `cards` parameter carries a configuration the visitor just built, so those
 * cards are shown without reading the stored set.
 * @source
 */
export function UserPageClient() {
  const searchParams = useSearchParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [cardsUpdatedAt, setCardsUpdatedAt] = useState<string | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True when the cards came from the URL rather than the stored set. */
  const [fromUrl, setFromUrl] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /**
     * Reads the cards stored for a profile.
     * @param userId - Profile to read.
     * @source
     */
    const readStoredCards = async (
      userId: string,
    ): Promise<CardData[] | null> => {
      const result = await fetchCardsForUserId(userId, setError);
      if (!result) return null;
      setCardsUpdatedAt(result.updatedAt);
      return (result.cards ?? [])
        .map(normalizeCardEntry)
        .filter((card): card is CardData => card !== null);
    };

    /**
     * Resolves a username to a profile record.
     * @param username - Handle to read.
     * @source
     */
    const readUserByUsername = async (
      username: string,
    ): Promise<UserData | null> => {
      const result = await fetchUserByUsername(username, setError);
      if (!result) return null;
      return {
        userId: String(result.userId),
        username: result.username || undefined,
        dataUpdatedAt: result.dataUpdatedAt,
      };
    };

    const load = async () => {
      try {
        let userId = searchParams.get("userId");
        let username = searchParams.get("username");
        const cardsParam = searchParams.get("cards");

        if (!isValidUserId(userId)) userId = null;
        if (!isValidUsername(username)) username = null;

        /* A configuration in the URL describes cards the visitor just built.
           The profile record is still read for the timestamps the card URLs
           carry, but a failure there does not hide the cards. */
        if (cardsParam) {
          let parsed: CardData[];
          try {
            parsed = parseAndValidateCards(cardsParam);
          } catch {
            setError("The card configuration in this link could not be read.");
            return;
          }

          let resolvedUser: UserData | null = null;

          if (userId) {
            const record = await fetchUserById(userId, ignoreError);
            const stored = await fetchCardsForUserId(userId, ignoreError);
            if (stored) setCardsUpdatedAt(stored.updatedAt);
            resolvedUser = {
              userId,
              username: username || record?.username || undefined,
              dataUpdatedAt: record?.dataUpdatedAt,
            };
          } else if (username) {
            resolvedUser = await readUserByUsername(username);
            if (!resolvedUser) return;
            const stored = await fetchCardsForUserId(
              resolvedUser.userId,
              ignoreError,
            );
            if (stored) setCardsUpdatedAt(stored.updatedAt);
          }

          if (cancelled) return;
          setUserData(resolvedUser);
          setCards(parsed);
          setFromUrl(true);
          return;
        }

        /* A numeric id is the address the generator hands over, so the stored
           set is read in full. */
        if (userId) {
          const record = await fetchUserById(userId, setError);
          if (!record) return;
          const stored = await readStoredCards(userId);
          if (!stored) return;

          if (cancelled) return;
          setUserData({
            userId: String(record.userId),
            username: record.username || undefined,
            dataUpdatedAt: record.dataUpdatedAt,
          });
          setCards(stored);
          return;
        }

        if (username) {
          const resolved = await readUserByUsername(username);
          if (!resolved) return;
          const stored = await readStoredCards(resolved.userId);
          if (!stored) return;

          if (cancelled) return;
          setUserData(resolved);
          setCards(stored);
          return;
        }

        /* Nothing to read. The page says so rather than guessing a profile. */
        if (cancelled) return;
        setUserData(null);
        setCards([]);
      } catch (error_) {
        console.error("Data loading error:", error_);
        if (!cancelled) setError("The cards could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const savedCards = useMemo(() => {
    if (cards.length === 0) return [];
    const version =
      buildCardDataVersion(userData, cardsUpdatedAt) ?? String(Date.now());
    return buildSavedCards(cards, userData?.userId, version);
  }, [cards, cardsUpdatedAt, userData]);

  if (loading) {
    return (
      <PaperSurface>
        <UserPageState state="loading" />
      </PaperSurface>
    );
  }

  if (error) {
    return (
      <PaperSurface>
        <UserPageState state="error" message={error} />
      </PaperSurface>
    );
  }

  if (!userData) {
    return (
      <PaperSurface>
        <UserPageState state="missing" />
      </PaperSurface>
    );
  }

  const fullSetHref = `/user?userId=${encodeURIComponent(userData.userId)}${
    userData.username
      ? `&username=${encodeURIComponent(userData.username)}`
      : ""
  }`;

  return (
    <ErrorBoundary>
      <PaperSurface>
        <UserMasthead
          username={userData.username}
          userId={userData.userId}
          cardCount={savedCards.length}
          dataUpdatedAt={userData.dataUpdatedAt}
        />

        {savedCards.length > 0 ? (
          <>
            <SavedCardSet
              cards={savedCards}
              username={userData.username}
              userId={userData.userId}
              partial={fromUrl}
              fullSetHref={fullSetHref}
            />
            <SavedCardGuide />
            <SavedCardClosing />
          </>
        ) : (
          <section className={styles.sectionLast}>
            <div className={styles.sheet}>
              <UserPageState state="empty" />
            </div>
          </section>
        )}
      </PaperSurface>
    </ErrorBoundary>
  );
}
