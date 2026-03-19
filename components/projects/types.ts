import type { LucideIcon } from "lucide-react";

export interface Project {
  name: string;
  description: string;
  url: string;
  tags: string[];
  numeral: string;
  highlight: string;
}

export interface EthosItem {
  icon: LucideIcon;
  numeral: string;
  title: string;
  description: string;
}
