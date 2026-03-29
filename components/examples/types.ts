import type { ThemeSettingsSnapshots } from "@/lib/card-preview";
import type { ThemePreviewUrls } from "@/lib/preview-theme";

export type ExampleCategory =
  | "Core Stats"
  | "Anime Deep Dive"
  | "Manga Deep Dive"
  | "Activity & Engagement"
  | "Library & Progress"
  | "Advanced Analytics";

export type ExampleIconKey =
  | "activity"
  | "barChart2"
  | "bookOpen"
  | "building2"
  | "calendar"
  | "clock"
  | "heart"
  | "layoutGrid"
  | "mic"
  | "pieChart"
  | "trendingUp"
  | "users";

export interface CategoryInfo {
  name: ExampleCategory;
  count: number;
}

export interface ExampleCardVariant {
  name: string;
  previewUrls: ThemePreviewUrls;
  settingsSnapshots: ThemeSettingsSnapshots;
  description?: string;
  width?: number;
  height?: number;
}

export interface ExampleCardType {
  title: string;
  description: string;
  variants: ExampleCardVariant[];
  category: ExampleCategory;
  iconKey: ExampleIconKey;
}

export interface ExamplesCatalogPayload {
  categories: readonly ExampleCategory[];
  categoryInfo: CategoryInfo[];
  cardTypes: ExampleCardType[];
  totalCardTypes: number;
  totalVariants: number;
}
