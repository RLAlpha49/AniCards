// Re-export validation module exports
export type {
  GenreItem,
  MilestoneFields,
  StaffItem,
  StudioItem,
  TagItem,
  VoiceActorItem,
} from "./validation";
export { CardDataError } from "./validation";
export {
  displayNames,
  getFavoritesForCardType,
  validateAndNormalizeUserRecord,
} from "./validation";

// Re-export fetching module exports
export {
  fetchUserData,
  fetchUserDataForCard,
  fetchUserDataOnly,
  resolveUserIdFromUsername,
} from "./fetching";

// Re-export processing module exports
export {
  buildCommonTemplateFields,
  mapCategoryItem,
  processFavorites,
  toTemplateAnimeEpisodeLengthPreferences,
  toTemplateAnimeGenreSynergy,
  toTemplateAnimeSeasonalPreference,
  toTemplateAnimeSourceMaterialDistribution,
  toTemplateAnimeStats,
  toTemplateMangaStats,
  toTemplateSeasonalViewingPatterns,
  toTemplateSocialStats,
  toTemplateStudioCollaboration,
  toTemplateTagCategoryDistribution,
  toTemplateTagDiversity,
} from "./processing";

// Re-export config module exports
export type { ColorOverrideParams } from "./config";
export {
  buildCardConfigFromParams,
  isCustomPreset,
  needsCardConfigFromDb,
  processCardConfig,
  resolveEffectiveColorPreset,
} from "./config";
