// Re-export validation module exports
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

// Re-export fetching module exports
export {
  resolveUserIdFromUsername,
  fetchUserDataOnly,
  fetchUserData,
  fetchUserDataForCard,
} from "./fetching";

// Re-export processing module exports
export {
  toTemplateSocialStats,
  buildCommonTemplateFields,
  toTemplateAnimeStats,
  toTemplateMangaStats,
  toTemplateAnimeSourceMaterialDistribution,
  mapCategoryItem,
  processFavorites,
} from "./processing";

// Re-export config module exports
export {
  needsCardConfigFromDb,
  buildCardConfigFromParams,
  resolveEffectiveColorPreset,
  isCustomPreset,
  processCardConfig,
} from "./config";
export type { ColorOverrideParams } from "./config";
