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
  Settings01Icon as SettingsData,
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
export type HugeIcon = React.ComponentType<
  Omit<HugeiconsIconProps, "icon">
>;

function createIcon(icon: IconData, displayName: string): HugeIcon {
  function Icon({ color = "currentColor", ...props }: Omit<HugeiconsIconProps, "icon">) {
    return <HugeiconsIcon icon={icon} color={color} {...props} />;
  }

  Icon.displayName = displayName;
  return Icon;
}

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
export const CornerDownRight = createIcon(CornerDownRightData, "CornerDownRight");
export const CreditCard = createIcon(CreditCardData, "CreditCard");
export const Database = createIcon(DatabaseData, "Database");
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
export const Grid3X3 = createIcon(GridData, "Grid3X3");
export const Hash = createIcon(HashData, "Hash");
export const Heart = createIcon(HeartData, "Heart");
export const HelpCircle = createIcon(HelpCircleData, "HelpCircle");
export const Home = createIcon(HomeData, "Home");
export const Info = createIcon(InfoData, "Info");
export const Layers = createIcon(LayersData, "Layers");
export const LayoutGrid = createIcon(LayoutGridData, "LayoutGrid");
export const LayoutPanelLeft = createIcon(LayoutPanelLeftData, "LayoutPanelLeft");
export const Lightbulb = createIcon(LightbulbData, "Lightbulb");
export const Link = createIcon(LinkData, "Link");
export const List = createIcon(ListData, "List");
export const Loader2 = createIcon(LoaderData, "Loader2");
export const Mail = createIcon(MailData, "Mail");
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
export const Settings = createIcon(SettingsData, "Settings");
export const Settings2 = Settings;
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