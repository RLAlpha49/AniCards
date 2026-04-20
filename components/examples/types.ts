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
  slug: string;
  href: string;
  description: string;
  sectionDescription: string;
  indexLabel: string;
  count: number;
  variantCount: number;
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
  id: string;
  title: string;
  description: string;
  variants: ExampleCardVariant[];
  category: ExampleCategory;
  iconKey: ExampleIconKey;
  searchText: string;
}

export interface ExamplesCatalogSummary {
  categories: readonly ExampleCategory[];
  categoryInfo: CategoryInfo[];
  totalCardTypes: number;
  totalVariants: number;
}

export interface ExamplesCatalogPayload extends ExamplesCatalogSummary {
  cardTypes: ExampleCardType[];
}
