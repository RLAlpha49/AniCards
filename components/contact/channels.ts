import type { HugeIcon } from "@/lib/icons";
import { AlertCircle, Lightbulb, Mail, MessageSquare } from "@/lib/icons";

/**
 * Where the four kinds of message are meant to go.
 *
 * The contact page asks what a message is about before it offers an address,
 * because a bug and a card idea need different things from the person reading
 * them. Each intent carries the channel, the reason for it, and the details
 * that make a reply possible.
 * @source
 */
export type IntentId = "card-issue" | "card-idea" | "question" | "other";

/** A single reason to write in, paired with the channel that handles it. @source */
export type ContactIntent = Readonly<{
  id: IntentId;
  numeral: string;
  label: string;
  hint: string;
  icon: HugeIcon;
  channelName: string;
  channelWhere: string;
  why: string;
  include: readonly string[];
  turnaround: string;
  actionLabel: string;
  actionHref: string;
}>;

/** New-issue form for this repository. @source */
const ISSUE_BASE = "https://github.com/RLAlpha49/AniCards/issues/new";

/** The one address that reaches the maintainer without an account anywhere. @source */
const EMAIL = "contact@alpha49.com";

/** Discord profile lookup for the maintainer's numeric ID. @source */
const DISCORD_URL = "https://discordid.netlify.app/?id=251479989378220044";

/**
 * Builds a query string that survives mail clients as well as browsers.
 *
 * `URLSearchParams` writes a space as `+`, which mail clients show literally,
 * so every value is encoded with `encodeURIComponent` instead.
 *
 * @param base - URL without a query string.
 * @param params - Query parameters in display order.
 * @source
 */
function withQuery(base: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `${base}?${query}`;
}

/** Issue body for a card that renders the wrong thing. @source */
const CARD_ISSUE_BODY = [
  "### What is wrong",
  "<!-- One line describing the problem. -->",
  "",
  "### The card",
  "- Card type:",
  "- Variation:",
  "- Page URL:",
  "",
  "### AniList handle",
  "@",
  "",
  "### Expected",
  "<!-- What the card should show. -->",
  "",
  "### Actual",
  "<!-- What it shows instead. Drag a screenshot into this box. -->",
].join("\n");

/** Issue body for a card type, layout, or palette that does not exist yet. @source */
const CARD_IDEA_BODY = [
  "### The idea",
  "<!-- What the card would show. -->",
  "",
  "### Where it fits",
  "<!-- Which card it sits beside, or what it would replace. -->",
  "",
  "### Reference",
  "<!-- A sketch, a mockup, or an example card. Drag an image into this box. -->",
  "",
  "### AniList handle",
  "@",
].join("\n");

/** Email body scaffold, kept short so it reads as a prompt rather than a form. @source */
const EMAIL_BODY = [
  "(What this is about, in the first line.)",
  "",
  "",
  "--",
  "Sent from the AniCards contact page.",
].join("\n");

/** The four reasons to write in, in the order the desk lists them. @source */
export const CONTACT_INTENTS: readonly ContactIntent[] = [
  {
    id: "card-issue",
    numeral: "壱",
    label: "A card is wrong",
    hint: "A stat is missing, a label is off, or the layout breaks.",
    icon: AlertCircle,
    channelName: "GitHub issue",
    channelWhere: "RLAlpha49/AniCards",
    why: "An issue holds the card, the link, and the fix in one thread that closes when the fix ships.",
    include: [
      "The card type, its variation, and the page URL",
      "Your AniList handle, so the same data can be read again",
      "What you expected the card to show instead",
    ],
    turnaround: "Read when I next work through the issue list.",
    actionLabel: "Open a prefilled issue",
    actionHref: withQuery(ISSUE_BASE, {
      title: "Card issue: ",
      body: CARD_ISSUE_BODY,
    }),
  },
  {
    id: "card-idea",
    numeral: "弐",
    label: "A card idea",
    hint: "A card type, a layout, or a colour preset you want to see.",
    icon: Lightbulb,
    channelName: "GitHub issue",
    channelWhere: "RLAlpha49/AniCards",
    why: "Card ideas get built from issues. A proposal in the issue list can be discussed, sketched on, and closed when it lands in the generator.",
    include: [
      "What the card would show",
      "A sketch, a mockup, or an example card if you have one",
      "Which card it would sit beside in the generator",
    ],
    turnaround: "Treated as a proposal, so it may wait behind fixes.",
    actionLabel: "Open a prefilled issue",
    actionHref: withQuery(ISSUE_BASE, {
      title: "Card idea: ",
      body: CARD_IDEA_BODY,
    }),
  },
  {
    id: "question",
    numeral: "参",
    label: "A quick question",
    hint: "How a setting works, or whether a card type exists.",
    icon: MessageSquare,
    channelName: "Discord",
    channelWhere: "Direct message",
    why: "Discord is the fastest way to go back and forth. Use it for simple and quick questions.",
    include: [
      "What you were doing in the generator",
      "The step or card type you were on",
    ],
    turnaround: "Usually the fastest of the four.",
    actionLabel: "Open Discord",
    actionHref: DISCORD_URL,
  },
  {
    id: "other",
    numeral: "肆",
    label: "Something else",
    hint: "Press, partnerships, or anything that is not about a card.",
    icon: Mail,
    channelName: "Email",
    channelWhere: EMAIL,
    why: "Email is the one inbox that does not need an account on any platform. It reaches the same person as everything else on this page.",
    include: ["What the message is about, in the first line"],
    turnaround: "Slowest of the four. There is no support desk behind it.",
    actionLabel: "Write the email",
    actionHref: withQuery(`mailto:${EMAIL}`, {
      subject: "AniCards: ",
      body: EMAIL_BODY,
    }),
  },
];

/** Intent shown before the visitor picks one: the most common reason to write. @source */
export const DEFAULT_INTENT_ID: IntentId = "card-issue";

/** One channel in the open directory, with its address visible. @source */
export type DirectoryChannel = Readonly<{
  id: string;
  name: string;
  address: string;
  href: string;
  /** Brand icons are rendered by the page, so the data stays plain. */
  brand: "github" | "discord" | "anilist" | "email";
  external: boolean;
}>;

/**
 * Every channel the desk can route to, in the order the directory lists them.
 *
 * The addresses are written out rather than hidden behind a button, so someone
 * who already knows where they are going does not have to answer the desk's
 * question first.
 * @source
 */
export const DIRECTORY_CHANNELS: readonly DirectoryChannel[] = [
  {
    id: "github",
    name: "GitHub",
    address: "RLAlpha49/AniCards",
    href: "https://github.com/RLAlpha49/AniCards/issues",
    brand: "github",
    external: true,
  },
  {
    id: "discord",
    name: "Discord",
    address: "Alpha49",
    href: DISCORD_URL,
    brand: "discord",
    external: true,
  },
  {
    id: "email",
    name: "Email",
    address: EMAIL,
    href: `mailto:${EMAIL}`,
    brand: "email",
    external: false,
  },
  {
    id: "anilist",
    name: "AniList",
    address: "@Alpha49",
    href: "https://anilist.co/user/Alpha49",
    brand: "anilist",
    external: true,
  },
];
