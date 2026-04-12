import type { LucideIcon } from "lucide-react";

export interface ProjectSocialPreview {
  cardType: string;
  colorPreset?: string;
  userId?: string;
  username?: string;
  variation?: string;
}

export interface Project {
  name: string;
  description: string;
  url: string;
  tags: string[];
  numeral: string;
  highlight: string;
  isOpenSource: boolean;
  socialPreview: ProjectSocialPreview;
}

export interface EthosItem {
  icon: LucideIcon;
  numeral: string;
  title: string;
  description: string;
}
