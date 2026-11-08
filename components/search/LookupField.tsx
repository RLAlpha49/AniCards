"use client";

import { AtSign, Hash } from "@/lib/icons";
import styles from "./search.module.css";

/**
 * The identifier field, its clear action, and the two hints below it.
 *
 * Kept apart from the panel so the panel's own render stays a straight line:
 * every branch here is about what the entered value looks like, and none of
 * them changes what the panel does.
 *
 * @param props.inputId - Id the label points at.
 * @param props.label - Name of the identifier being read.
 * @param props.hint - Short description of the entered value.
 * @param props.placeholder - Example value for the field.
 * @param props.value - Current field contents.
 * @param props.trimmed - `value` with surrounding whitespace removed.
 * @param props.isIdMode - Whether the field reads a numeric ID.
 * @param props.looksNumeric - Whether a handle field holds only digits.
 * @param props.targetParam - Query parameter the form will open.
 * @param props.errorId - Id of the error paragraph, when one is shown.
 * @param props.hasError - Whether an error is currently shown.
 * @param props.disabled - Whether the field is waiting on a lookup.
 * @param props.onChange - Called with the new field contents.
 * @param props.onClear - Called when the visitor clears the field.
 * @param props.onAcceptAsId - Called when a numeric handle is taken as an ID.
 * @source
 */
export function LookupField({
  inputId,
  label,
  hint,
  placeholder,
  value,
  trimmed,
  isIdMode,
  looksNumeric,
  targetParam,
  errorId,
  hasError,
  disabled,
  onChange,
  onClear,
  onAcceptAsId,
}: Readonly<{
  inputId: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  trimmed: string;
  isIdMode: boolean;
  looksNumeric: boolean;
  targetParam: string;
  errorId: string;
  hasError: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onAcceptAsId: () => void;
}>) {
  const FieldIcon = isIdMode ? Hash : AtSign;

  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>
        <label htmlFor={inputId}>{label}</label>
        <span className={styles.fieldHint}>{hint}</span>
      </div>

      <div className={styles.input}>
        <FieldIcon className={styles.inputIcon} aria-hidden="true" />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-describedby={hasError ? errorId : undefined}
          aria-invalid={hasError ? true : undefined}
          className={styles.inputField}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
        />
        {trimmed && (
          <button type="button" onClick={onClear} className={styles.inputClear}>
            Clear
          </button>
        )}
      </div>

      {/* A pasted number is an ID. Offer the switch before it fails. */}
      {looksNumeric && (
        <p className={styles.detect}>
          That looks like a numeric ID.{" "}
          <button
            type="button"
            onClick={onAcceptAsId}
            className={styles.detectButton}
          >
            Look it up as a user ID
          </button>
        </p>
      )}

      {/* The address the form will open, so the destination is never a
          surprise when the profile page loads. Hidden while the value reads
          as an ID in handle mode, because the form refuses that until the
          mode is switched. */}
      {!looksNumeric && (
        <p className={styles.target}>
          <span className={styles.targetLabel}>Opens</span>
          <code className={styles.targetUrl}>
            /user?{targetParam}=
            {trimmed ? (
              <mark>{trimmed}</mark>
            ) : (
              <span className={styles.targetEmpty}>…</span>
            )}
          </code>
        </p>
      )}
    </div>
  );
}
