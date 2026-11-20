/**
 * The public interface of `lib/card-data`: the records the card API reads and
 * the translations it applies to them.
 *
 * Every name here has an outside consumer. Seven it used to re-export
 * (`toTemplateTagCategoryDistribution`, `toTemplateTagDiversity`,
 * `toTemplateSeasonalViewingPatterns`, `buildCommonTemplateFields`,
 * `fetchUserDataOnly`, `resolveEffectiveColorPreset`, and `isCustomPreset`)
 * were reachable from here and from nowhere else, which advertised an interface
 * nothing called. The `config` parameter types went the same way.
 *
 * A module that needs a single deep symbol still imports the module, and that is
 * deliberate in two places: `lib/api-utils.ts` reads `validation.ts` directly,
 * because `fetching.ts` imports `api-utils` and routing it through this barrel
 * would close a cycle; and request paths that want one validator avoid pulling
 * the fetching and processing modules this barrel also loads.
 *
 * @source
 */

// Validation: what a stored record is, and the names the UI prints for a card.
export { CardDataError } from "./validation";
export type {
  GenreItem,
  TagItem,
  VoiceActorItem,
  StudioItem,
  StaffItem,
  MilestoneFields,
} from "./validation";
export {
  displayNames,
  getFavoritesForCardType,
  validateAndNormalizeUserRecord,
} from "./validation";

// Fetching: username lookup and the record loads the card route needs.
export {
  resolveUserIdFromUsername,
  fetchUserData,
  fetchUserDataForCard,
} from "./fetching";

// Processing: record to template-field translation.
export {
  extractActivityHistory,
  extractMediaListEntries,
  toTemplateSocialStats,
  toTemplateAnimeStats,
  toTemplateMangaStats,
  toTemplateAnimeSourceMaterialDistribution,
  toTemplateAnimeSeasonalPreference,
  toTemplateAnimeEpisodeLengthPreferences,
  toTemplateAnimeGenreSynergy,
  toTemplateStudioCollaboration,
  mapCategoryItem,
  processFavorites,
} from "./processing";

// Config: which stored configuration a request needs, and how it is built.
export {
  needsCardConfigFromDb,
  classifyCardConfigSource,
  buildCardConfigFromParams,
  processCardConfig,
} from "./config";
