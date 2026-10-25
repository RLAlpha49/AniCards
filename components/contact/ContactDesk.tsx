"use client";

import { useId, useState } from "react";
import { ArrowRight, Mail } from "@/lib/icons";
import {
  SimpleDiscordIcon,
  SimpleGithubIcon,
} from "@/components/SimpleIcons";
import {
  safeTrack,
  trackExternalLinkClick,
  trackFormSubmission,
} from "@/lib/utils/google-analytics";
import {
  CONTACT_INTENTS,
  DEFAULT_INTENT_ID,
  type ContactIntent,
  type IntentId,
} from "./channels";
import styles from "./contact.module.css";

type ChannelMarkProps = Readonly<{
  channelName: ContactIntent["channelName"];
  size: number;
}>;

/**
 * Draws the mark for a channel.
 *
 * Two intents can share a channel, so the mark follows the channel and the text
 * beside it names the specific reason. Brand marks sit inside a hidden wrapper
 * because the library icons carry their own accessible labels, which would
 * otherwise repeat the visible text.
 *
 * @param props.channelName - Channel the selected intent routes to.
 * @param props.size - Mark size in pixels.
 * @source
 */
function ChannelMark({ channelName, size }: ChannelMarkProps) {
  if (channelName === "GitHub issue") {
    return <SimpleGithubIcon size={size} />;
  }

  if (channelName === "Discord") {
    return <SimpleDiscordIcon size={size} />;
  }

  return <Mail width={size} height={size} />;
}

/**
 * The routing desk on the contact page.
 *
 * The visitor picks what their message is about, not which platform to use.
 * That choice fills the answer pane with the channel that handles it, why that
 * channel is the right one, and what to include so a reply is possible. Only
 * the answer pane changes, so the question stays put while the visitor compares
 * two reasons.
 *
 * The radios are native, so arrow keys walk the group and the checked state
 * survives without JavaScript beyond the first render.
 * @source
 */
export function ContactDesk() {
  const [selectedId, setSelectedId] = useState<IntentId>(DEFAULT_INTENT_ID);
  const groupName = useId();

  const selected =
    CONTACT_INTENTS.find((intent) => intent.id === selectedId) ??
    CONTACT_INTENTS[0];
  const isMail = selected.channelName === "Email";

  /**
   * Reports the chosen channel when the visitor commits to it.
   *
   * @param intent - The intent whose action was followed.
   * @source
   */
  const reportAction = (intent: ContactIntent) => {
    safeTrack(() => trackFormSubmission("contact_intent", true));
    safeTrack(() => trackExternalLinkClick(intent.id, "contact_page"));
  };

  return (
    <div className={styles.desk}>
      <div className={styles.deskAsk}>
        <div className={styles.deskHead}>
          <span className={styles.deskSeal} aria-hidden="true">
            便
          </span>
          <p className={styles.deskTitle}>What is it about?</p>
          <span className={styles.deskHeadRule} aria-hidden="true" />
          <span className={styles.deskCount}>
            {CONTACT_INTENTS.length} kinds
          </span>
        </div>

        <fieldset className={styles.deskList}>
          <legend className={styles.deskLegend}>
            Choose what your message is about
          </legend>

          {CONTACT_INTENTS.map((intent) => {
            const IntentIcon = intent.icon;
            const checked = intent.id === selected.id;

            return (
              <div key={intent.id} className={styles.intentRow}>
                <input
                  type="radio"
                  id={`${groupName}-${intent.id}`}
                  name={groupName}
                  value={intent.id}
                  checked={checked}
                  onChange={() => setSelectedId(intent.id)}
                  className={styles.intentInput}
                />
                <label
                  htmlFor={`${groupName}-${intent.id}`}
                  className={styles.intent}
                >
                  <span className={styles.intentNum} aria-hidden="true">
                    {intent.numeral}
                  </span>
                  <span className={styles.intentBody}>
                    <span className={styles.intentLabel}>{intent.label}</span>
                    <span className={styles.intentHint}>{intent.hint}</span>
                  </span>
                  <IntentIcon
                    className={styles.intentIcon}
                    aria-hidden="true"
                  />
                </label>
              </div>
            );
          })}
        </fieldset>
      </div>

      {/* Announces the channel when the answer pane changes, so a keyboard
          visitor hears the result of their choice. */}
      <p className="sr-only" role="status">
        {selected.label}: goes to {selected.channelName}.
      </p>

      <div className={styles.slip}>
        <div className={styles.slipBody}>
          <div key={selected.id} className={styles.slipContent}>
            <div className={styles.slipHead}>
              <span className={styles.slipSeal} aria-hidden="true">
                {selected.numeral}
              </span>
              <div className={styles.slipHeadText}>
                <p className={styles.slipEyebrow}>Goes to</p>
                <p className={styles.slipChannel}>{selected.channelName}</p>
              </div>
              <p className={styles.slipWhere}>{selected.channelWhere}</p>
            </div>

            <p className={styles.slipWhy}>{selected.why}</p>

            <p className={styles.slipIncludeHead}>
              <span>What to include</span>
              <span className={styles.slipIncludeRule} aria-hidden="true" />
            </p>
            <ol className={styles.slipInclude}>
              {selected.include.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </div>

        <div className={styles.slipStub}>
          <a
            href={selected.actionHref}
            target={isMail ? undefined : "_blank"}
            rel={isMail ? undefined : "noopener noreferrer"}
            onClick={() => reportAction(selected)}
            className={styles.stubAction}
          >
            {isMail ? (
              <Mail
                className={styles.stubActionIcon}
                aria-hidden="true"
              />
            ) : (
              <span className={styles.stubActionIcon} aria-hidden="true">
                <ChannelMark channelName={selected.channelName} size={15} />
              </span>
            )}
            {selected.actionLabel}
            <ArrowRight className={styles.stubActionIcon} aria-hidden="true" />
          </a>

          <p className={styles.stubNote}>
            <strong>When it gets read</strong>
            {selected.turnaround}
          </p>
        </div>
      </div>
    </div>
  );
}
