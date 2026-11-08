import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import {
  ActivityIcon as ActivityData,
  AlertCircleIcon as AlertCircleData,
  TriangleAlertIcon as AlertTriangleData,
  ArrowDownIcon as ArrowDownData,
  ArrowLeftIcon as ArrowLeftData,
  ArrowRightIcon as ArrowRightData,
  AtSignIcon as AtSignData,
  BarChartIcon as BarChartData,
  BookOpenIcon as BookOpenData,
  BrushIcon as BrushData,
  Building01Icon as BuildingData,
  CalendarIcon as CalendarData,
  CheckIcon as CheckData,
  CheckmarkCircleIcon as CheckCircleData,
  ChevronDownIcon as ChevronDownData,
  ChevronLeftIcon as ChevronLeftData,
  ChevronRightIcon as ChevronRightData,
  ChevronUpIcon as ChevronUpData,
  CircleDotIcon as CircleDotData,
  ClockIcon as ClockData,
  CodeIcon as CodeData,
  CopyIcon as CopyData,
  CornerDownRightIcon as CornerDownRightData,
  CreditCardIcon as CreditCardData,
  DatabaseIcon as DatabaseData,
  DiscordIcon as DiscordBrandData,
  DownloadIcon as DownloadData,
  DropletsIcon as DropletsData,
  ExternalLinkIcon as ExternalLinkData,
  EyeIcon as EyeData,
  FileIcon as FileData,
  FileArchiveIcon as FileArchiveData,
  FileTextIcon as FileTextData,
  FilmIcon as FilmData,
  FilterIcon as FilterData,
  FolderIcon as FolderData,
  GitForkIcon as GitForkData,
  Github01Icon as GithubBrandData,
  Grid3X3Icon as GridData,
  HashIcon as HashData,
  HeartIcon as HeartData,
  HelpCircleIcon as HelpCircleData,
  Home01Icon as HomeData,
  InformationCircleIcon as InfoData,
  LayersIcon as LayersData,
  LayoutGridIcon as LayoutGridData,
  LayoutPanelLeftIcon as LayoutPanelLeftData,
  LightbulbIcon as LightbulbData,
  Link01Icon as LinkData,
  ListIcon as ListData,
  LoaderCircleIcon as LoaderData,
  MailIcon as MailData,
  MessageSquareIcon as MessageSquareData,
  Mic01Icon as MicData,
  Menu01Icon as MenuData,
  MinusIcon as MinusData,
  MonitorIcon as MonitorData,
  MoonIcon as MoonData,
  MoveIcon as MoveData,
  PaletteIcon as PaletteData,
  PanelLeftIcon as PanelLeftData,
  PanelLeftCloseIcon as PanelLeftCloseData,
  PercentIcon as PercentData,
  PieChart01Icon as PieChartData,
  PlayIcon as PlayData,
  PlusIcon as PlusData,
  RefreshCwIcon as RefreshData,
  RotateCcwIcon as RotateData,
  ScaleIcon as ScaleData,
  SearchIcon as SearchData,
  MailSend01Icon as SendData,
  Share01Icon as ShareData,
  ShieldIcon as ShieldData,
  ShieldCheckIcon as ShieldCheckData,
  SparklesIcon as SparklesData,
  SquareIcon as SquareData,
  StarIcon as StarData,
  SunIcon as SunData,
  TrashIcon as TrashData,
  TrendingUpIcon as TrendingUpData,
  TvIcon as TvData,
  UserIcon as UserData,
  UserGroupIcon as UsersData,
  MagicWandIcon as WandData,
  Cancel01Icon as CloseData,
  ZapIcon as ZapData,
} from "@hugeicons/core-free-icons";

type IconData = HugeiconsIconProps["icon"];
export type HugeIcon = React.ComponentType<Omit<HugeiconsIconProps, "icon">>;

function createIcon(icon: IconData, displayName: string): HugeIcon {
  function Icon({
    color = "currentColor",
    ...props
  }: Omit<HugeiconsIconProps, "icon">) {
    return <HugeiconsIcon icon={icon} color={color} {...props} />;
  }

  Icon.displayName = displayName;
  return Icon;
}

type BrandIconProps = Readonly<{
  size?: number;
  className?: string;
}>;

/**
 * AniList brand mark.
 *
 * Hugeicons ships no AniList logo, so this component carries the official mark
 * path itself (path data from Simple Icons, CC0 1.0). It stays solid-filled:
 * at the 15-18px sizes the site uses, an outlined version of this glyph turns
 * into thin overlapping strokes instead of a readable mark.
 *
 * @param props.size - Width/height in pixels; defaults to 32.
 * @param props.className - Optional CSS class names to style the SVG.
 * @source
 */
export const AniListBrand = ({ size = 32, className }: BrandIconProps) => (
  <svg
    className={className}
    role="img"
    aria-label="AniList"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M24 17.53v2.421c0 .71-.391 1.101-1.1 1.101h-5l-.057-.165L11.84 3.736c.106-.502.46-.788 1.053-.788h2.422c.71 0 1.1.391 1.1 1.1v12.38H22.9c.71 0 1.1.392 1.1 1.101zM11.034 2.947l6.337 18.104h-4.918l-1.052-3.131H6.019l-1.077 3.131H0L6.361 2.948h4.673zm-.66 10.96-1.69-5.014-1.541 5.015h3.23z" />
  </svg>
);

export const Activity = createIcon(ActivityData, "Activity");
export const AlertCircle = createIcon(AlertCircleData, "AlertCircle");
export const AlertTriangle = createIcon(AlertTriangleData, "AlertTriangle");
export const ArrowDown = createIcon(ArrowDownData, "ArrowDown");
export const ArrowLeft = createIcon(ArrowLeftData, "ArrowLeft");
export const ArrowRight = createIcon(ArrowRightData, "ArrowRight");
export const AtSign = createIcon(AtSignData, "AtSign");
export const BarChart = createIcon(BarChartData, "BarChart");
export const BarChart2 = BarChart;
export const BookOpen = createIcon(BookOpenData, "BookOpen");
export const Brush = createIcon(BrushData, "Brush");
export const Building2 = createIcon(BuildingData, "Building2");
export const Calendar = createIcon(CalendarData, "Calendar");
export const Check = createIcon(CheckData, "Check");
export const CheckCircle2 = createIcon(CheckCircleData, "CheckCircle2");
export const ChevronDown = createIcon(ChevronDownData, "ChevronDown");
export const ChevronLeft = createIcon(ChevronLeftData, "ChevronLeft");
export const ChevronRight = createIcon(ChevronRightData, "ChevronRight");
export const ChevronUp = createIcon(ChevronUpData, "ChevronUp");
export const CircleDot = createIcon(CircleDotData, "CircleDot");
export const Clock = createIcon(ClockData, "Clock");
export const Code2 = createIcon(CodeData, "Code2");
export const Copy = createIcon(CopyData, "Copy");
export const CornerDownRight = createIcon(
  CornerDownRightData,
  "CornerDownRight",
);
export const CreditCard = createIcon(CreditCardData, "CreditCard");
export const Database = createIcon(DatabaseData, "Database");
export const DiscordBrand = createIcon(DiscordBrandData, "DiscordBrand");
export const Download = createIcon(DownloadData, "Download");
export const Droplets = createIcon(DropletsData, "Droplets");
export const ExternalLink = createIcon(ExternalLinkData, "ExternalLink");
export const Eye = createIcon(EyeData, "Eye");
export const File = createIcon(FileData, "File");
export const FileArchive = createIcon(FileArchiveData, "FileArchive");
export const FileText = createIcon(FileTextData, "FileText");
export const Film = createIcon(FilmData, "Film");
export const Filter = createIcon(FilterData, "Filter");
export const Folder = createIcon(FolderData, "Folder");
export const GitFork = createIcon(GitForkData, "GitFork");
export const GithubBrand = createIcon(GithubBrandData, "GithubBrand");
export const Grid3X3 = createIcon(GridData, "Grid3X3");
export const Hash = createIcon(HashData, "Hash");
export const Heart = createIcon(HeartData, "Heart");
export const HelpCircle = createIcon(HelpCircleData, "HelpCircle");
export const Home = createIcon(HomeData, "Home");
export const Info = createIcon(InfoData, "Info");
export const Layers = createIcon(LayersData, "Layers");
export const LayoutGrid = createIcon(LayoutGridData, "LayoutGrid");
export const LayoutPanelLeft = createIcon(
  LayoutPanelLeftData,
  "LayoutPanelLeft",
);
export const Lightbulb = createIcon(LightbulbData, "Lightbulb");
export const Link = createIcon(LinkData, "Link");
export const List = createIcon(ListData, "List");
export const Loader2 = createIcon(LoaderData, "Loader2");
export const Mail = createIcon(MailData, "Mail");
export const Menu = createIcon(MenuData, "Menu");
export const MessageSquare = createIcon(MessageSquareData, "MessageSquare");
export const Mic = createIcon(MicData, "Mic");
export const Minus = createIcon(MinusData, "Minus");
export const Monitor = createIcon(MonitorData, "Monitor");
export const Moon = createIcon(MoonData, "Moon");
export const Move = createIcon(MoveData, "Move");
export const Palette = createIcon(PaletteData, "Palette");
export const PanelLeft = createIcon(PanelLeftData, "PanelLeft");
export const PanelLeftClose = createIcon(PanelLeftCloseData, "PanelLeftClose");
export const Percent = createIcon(PercentData, "Percent");
export const PieChart = createIcon(PieChartData, "PieChart");
export const Play = createIcon(PlayData, "Play");
export const Plus = createIcon(PlusData, "Plus");
export const RefreshCw = createIcon(RefreshData, "RefreshCw");
export const RotateCcw = createIcon(RotateData, "RotateCcw");
export const Scale = createIcon(ScaleData, "Scale");
export const Search = createIcon(SearchData, "Search");
export const Send = createIcon(SendData, "Send");
export const Share2 = createIcon(ShareData, "Share2");
export const Shield = createIcon(ShieldData, "Shield");
export const ShieldCheck = createIcon(ShieldCheckData, "ShieldCheck");
export const Sparkles = createIcon(SparklesData, "Sparkles");
export const Square = createIcon(SquareData, "Square");
export const Star = createIcon(StarData, "Star");
export const Sun = createIcon(SunData, "Sun");
export const Trash2 = createIcon(TrashData, "Trash2");
export const TrendingUp = createIcon(TrendingUpData, "TrendingUp");
export const Tv = createIcon(TvData, "Tv");
export const User = createIcon(UserData, "User");
export const Users = createIcon(UsersData, "Users");
export const Wand2 = createIcon(WandData, "Wand2");
export const X = createIcon(CloseData, "X");
export const Zap = createIcon(ZapData, "Zap");
