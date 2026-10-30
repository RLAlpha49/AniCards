"use client";

import { useId, useMemo, useState } from "react";
import { Check, CornerDownRight, Layers, RotateCcw } from "@/lib/icons";
import { cn, isGradient } from "@/lib/utils";
import type {
  ColorValue,
  GradientDefinition,
  GradientStop,
} from "@/lib/types/card";
import { PALETTE_PRESETS, paletteLabel } from "../card-options";
import type { PalettePreset } from "../card-options";
import styles from "../generator.module.css";

/** Palette filters. 56 presets need a way to narrow the list. @source */
const FILTERS = [
  { id: "all", label: "All" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "gradient", label: "Gradient" },
] as const;

type PaletteFilter = (typeof FILTERS)[number]["id"];

/** The four colour slots every card template reads. @source */
const COLOR_SLOTS = [
  { index: 0, label: "Title" },
  { index: 1, label: "Background" },
  { index: 2, label: "Text" },
  { index: 3, label: "Accent" },
] as const;

/**
 * Reads one colour of a preset as CSS.
 *
 * A gradient slot becomes the gradient itself, so a tile that holds a gradient
 * background shows the gradient rather than a flat stand-in.
 * @param color - Colour value from the preset.
 * @param fallback - Value to use when the slot is missing.
 * @source
 */
function cssColor(color: ColorValue | undefined, fallback: string): string {
  if (!color) return fallback;
  return colorSwatch(color) || fallback;
}

/** The hex a colour field edits, or the first stop of a gradient. @source */
function fieldHex(color: ColorValue): string {
  if (isGradient(color)) return color.stops[0]?.color ?? "#000000";
  return color;
}

/** The CSS a swatch uses for one colour. @source */
function colorSwatch(color: ColorValue): string {
  if (!isGradient(color)) return color;
  const stops = color.stops
    .map((stop) => `${stop.color} ${stop.offset}%`)
    .join(", ");
  return color.type === "radial"
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${color.angle ?? 0}deg, ${stops})`;
}

type PaletteStepProps = Readonly<{
  presetName: string;
  colors: ColorValue[];
  onPresetChange: (presetName: string) => void;
  onColorChange: (index: number, color: ColorValue) => void;
  frameEnabled: boolean;
  frameColor: string;
  cornerRadius: number;
  onToggleFrame: () => void;
  onFrameColorChange: (color: string) => void;
  onCornerRadiusChange: (radius: number) => void;
}>;

/**
 * Step two: colour.
 *
 * Presets first, because most visitors want a named palette and should not have
 * to build one. A filter narrows 56 presets to a readable list. The four colour
 * fields below stay in sync with the chosen preset, so a visitor can start from
 * a preset and nudge one slot, which is marked as a custom palette from then on.
 * The frame controls sit last: they are the least-used setting and the easiest
 * to leave alone.
 *
 * @source
 */
export function PaletteStep({
  presetName,
  colors,
  onPresetChange,
  onColorChange,
  frameEnabled,
  frameColor,
  cornerRadius,
  onToggleFrame,
  onFrameColorChange,
  onCornerRadiusChange,
}: PaletteStepProps) {
  const [filter, setFilter] = useState<PaletteFilter>("all");
  const filterGroupId = useId();
  const radiusId = useId();
  const frameColorId = useId();

  const visible = useMemo(() => {
    if (filter === "gradient") {
      return PALETTE_PRESETS.filter((preset) => preset.gradient);
    }
    if (filter === "light" || filter === "dark") {
      return PALETTE_PRESETS.filter(
        (preset) => !preset.gradient && preset.mode === filter,
      );
    }
    return PALETTE_PRESETS;
  }, [filter]);

  return (
    <div>
      <section className={styles.paletteBlock} aria-labelledby={filterGroupId}>
        <div className={styles.blockHead}>
          <h3>Named palettes</h3>
          <p>
            {visible.length} of {PALETTE_PRESETS.length} shown
          </p>
        </div>

        <div
          id={filterGroupId}
          className={styles.presetFilter}
          role="group"
          aria-label="Filter palettes"
        >
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              aria-pressed={filter === entry.id}
              className={cn(
                styles.presetFilterButton,
                filter === entry.id && styles.presetFilterActive,
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <ul className={styles.presetGrid}>
          {visible.map((preset) => (
            <li key={preset.name}>
              <PresetTile
                preset={preset}
                active={preset.name === presetName}
                onSelect={() => onPresetChange(preset.name)}
              />
            </li>
          ))}

          {visible.length === 0 && (
            <li className={styles.presetEmpty}>
              No palette in this group. Pick another filter.
            </li>
          )}
        </ul>
      </section>

      <section className={styles.paletteBlock} aria-labelledby={radiusId}>
        <div className={styles.blockHead}>
          <h3 id={radiusId}>Four colours</h3>
          <p>
            {presetName === "custom"
              ? "Custom palette"
              : `Editing ${paletteLabel(presetName)} makes a custom palette`}
          </p>
        </div>

        <div className={styles.colorGrid}>
          {COLOR_SLOTS.map((slot) => (
            <ColorField
              key={slot.index}
              label={slot.label}
              color={colors[slot.index]}
              onChange={(next) => onColorChange(slot.index, next)}
            />
          ))}
        </div>

        <div className={styles.colorActions}>
          <button
            type="button"
            className={styles.linkAction}
            onClick={() => onPresetChange("default")}
          >
            <RotateCcw aria-hidden="true" />
            Back to the default palette
          </button>
        </div>
      </section>

      <section className={styles.paletteBlock}>
        <div className={styles.blockHead}>
          <h3>Card frame</h3>
          <p>Rounds the card corners and draws a border</p>
        </div>

        <div className={styles.frameRow}>
          <label className={styles.frameSwitch}>
            <input
              type="checkbox"
              className={styles.frameSwitchInput}
              checked={frameEnabled}
              onChange={onToggleFrame}
            />
            <span className={styles.frameSwitchLabel}>
              {frameEnabled ? "Frame on" : "Frame off"}
            </span>
          </label>

          {frameEnabled && (
            <>
              <span className={styles.fieldLabel}>
                <label htmlFor={frameColorId}>Border colour</label>
              </span>
              <div className={styles.colorFieldRow}>
                <input
                  id={frameColorId}
                  type="color"
                  aria-label="Card border colour"
                  value={frameColor.length === 7 ? frameColor : "#e4e2e2"}
                  onChange={(event) => onFrameColorChange(event.target.value)}
                  className={styles.colorWell}
                />
                <input
                  type="text"
                  aria-label="Card border colour as hex"
                  value={frameColor}
                  onChange={(event) => onFrameColorChange(event.target.value)}
                  className={styles.colorHex}
                  maxLength={9}
                  spellCheck={false}
                />
              </div>

              <div className={styles.radiusControl}>
                <span className={styles.fieldLabel}>Corners</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={cornerRadius}
                  onChange={(event) =>
                    onCornerRadiusChange(Number(event.target.value))
                  }
                  aria-label="Card corner radius"
                />
                <span className={styles.radiusValue}>{cornerRadius}</span>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

type PresetTileProps = Readonly<{
  preset: PalettePreset;
  active: boolean;
  onSelect: () => void;
}>;

/** One palette tile: a miniature card in that palette, then the name. @source */
function PresetTile({ preset, active, onSelect }: PresetTileProps) {
  const [title, background, text, accent] = preset.colors;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(styles.presetTile, active && styles.presetTileActive)}
      title={`${preset.label} palette`}
    >
      <span
        className={cn(
          styles.presetSwatch,
          preset.gradient && styles.presetSwatchGradient,
        )}
        style={{ background: cssColor(background, "#141321") }}
        aria-hidden="true"
      >
        <span
          className={styles.swatchTitle}
          style={{ background: cssColor(title, "#fe428e") }}
        />
        <span
          className={styles.swatchLine}
          style={{ background: cssColor(text, "#a9fef7") }}
        />
        <span
          className={cn(styles.swatchLine, styles.swatchLineShort)}
          style={{ background: cssColor(text, "#a9fef7") }}
        />
        <span
          className={styles.swatchAccent}
          style={{ background: cssColor(accent, "#fe428e") }}
        />
      </span>

      <span className={styles.presetName}>
        {preset.label}
        {active && <Check aria-hidden="true" />}
      </span>
    </button>
  );
}

type ColorFieldProps = Readonly<{
  label: string;
  color: ColorValue | undefined;
  onChange: (color: ColorValue) => void;
}>;

/**
 * One colour slot.
 *
 * A solid colour gets the native well and a hex field. A gradient keeps the
 * same two controls plus a stop list: each stop has its own colour and offset,
 * and the direction can be flipped between a linear angle and a radial centre.
 * The first stop is what a solid palette would use, so switching back to a
 * solid colour can run from any stop rather than only the first.
 *
 * @source
 */
function ColorField({ label, color, onChange }: ColorFieldProps) {
  const fallback: ColorValue = "#000000";
  const value = color ?? fallback;
  const gradient = isGradient(value);
  const hex = fieldHex(value);
  const [open, setOpen] = useState(false);
  const editorId = useId();

  /**
   * Writes one field of the gradient without losing the others.
   * @param patch - Gradient fields to replace.
   * @source
   */
  const patchGradient = (patch: Partial<GradientDefinition>) => {
    if (!gradient) return;
    onChange({ ...value, ...patch });
  };

  /**
   * Replaces one stop.
   * @param index - Stop position in the list.
   * @param next - Replacement stop.
   * @source
   */
  const patchStop = (index: number, next: Partial<GradientStop>) => {
    if (!gradient) return;
    const stops = value.stops.map((stop, position) =>
      position === index ? { ...stop, ...next } : stop,
    );
    patchGradient({ stops });
  };

  const stops = gradient ? value.stops : [];

  return (
    <div
      className={cn(styles.colorField, gradient && styles.colorFieldGradient)}
    >
      <p className={styles.colorFieldLabel}>{label}</p>

      {gradient ? (
        <>
          <span
            className={styles.gradientPreview}
            style={{ background: colorSwatch(value) }}
            aria-hidden="true"
          />

          <div className={styles.gradientRow}>
            <span className={styles.colorGradientTag}>
              <Layers aria-hidden="true" />
              {value.type === "radial" ? "Radial" : `${value.angle ?? 0}deg`}
            </span>
            <button
              type="button"
              className={styles.gradientToggle}
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              aria-controls={editorId}
            >
              {open
                ? "Hide stops"
                : `${stops.length} stop${stops.length === 1 ? "" : "s"}`}
            </button>
          </div>

          {open && (
            <div id={editorId} className={styles.gradientEditor}>
              <div className={styles.gradientTypeRow}>
                <button
                  type="button"
                  onClick={() => patchGradient({ type: "linear" })}
                  aria-pressed={value.type === "linear"}
                  className={cn(
                    styles.gradientTypeButton,
                    value.type === "linear" && styles.gradientTypeActive,
                  )}
                >
                  Linear
                </button>
                <button
                  type="button"
                  onClick={() => patchGradient({ type: "radial" })}
                  aria-pressed={value.type === "radial"}
                  className={cn(
                    styles.gradientTypeButton,
                    value.type === "radial" && styles.gradientTypeActive,
                  )}
                >
                  Radial
                </button>

                {value.type === "linear" && (
                  <label className={styles.gradientAngle}>
                    <span>Angle</span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={5}
                      value={value.angle ?? 0}
                      onChange={(event) =>
                        patchGradient({ angle: Number(event.target.value) })
                      }
                      aria-label={`${label} gradient angle`}
                    />
                    <span className={styles.radiusValue}>
                      {value.angle ?? 0}
                    </span>
                  </label>
                )}
              </div>

              <ul className={styles.gradientStops}>
                {stops.map((stop, index) => (
                  <li
                    key={`${stop.color}-${index}`}
                    className={styles.gradientStop}
                  >
                    <input
                      type="color"
                      aria-label={`${label} stop ${index + 1} colour`}
                      value={stop.color}
                      onChange={(event) =>
                        patchStop(index, { color: event.target.value })
                      }
                      className={styles.colorWell}
                    />
                    <input
                      type="text"
                      aria-label={`${label} stop ${index + 1} hex`}
                      value={stop.color}
                      onChange={(event) => {
                        const next = event.target.value.trim();
                        if (/^#?[0-9a-fA-F]{0,8}$/.test(next)) {
                          patchStop(index, {
                            color: next.startsWith("#") ? next : `#${next}`,
                          });
                        }
                      }}
                      className={styles.colorHex}
                      maxLength={9}
                      spellCheck={false}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={stop.offset}
                      onChange={(event) =>
                        patchStop(index, { offset: Number(event.target.value) })
                      }
                      aria-label={`${label} stop ${index + 1} position`}
                      className={styles.gradientOffset}
                    />
                  </li>
                ))}
              </ul>

              <div className={styles.gradientActions}>
                <button
                  type="button"
                  className={cn(styles.linkAction, styles.mutedAction)}
                  onClick={() =>
                    patchGradient({
                      stops: [...stops, { color: hex, offset: 100 }],
                    })
                  }
                >
                  + Add a stop
                </button>
                <button
                  type="button"
                  className={cn(styles.linkAction, styles.mutedAction)}
                  onClick={() => onChange(hex)}
                >
                  <CornerDownRight aria-hidden="true" />
                  Make it solid
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.colorFieldRow}>
          <input
            type="color"
            aria-label={`${label} colour`}
            value={hex}
            onChange={(event) => onChange(event.target.value)}
            className={styles.colorWell}
          />
          <input
            type="text"
            aria-label={`${label} colour as hex`}
            value={hex}
            onChange={(event) => {
              const next = event.target.value.trim();
              if (/^#?[0-9a-fA-F]{0,8}$/.test(next)) {
                onChange(next.startsWith("#") ? next : `#${next}`);
              }
            }}
            className={styles.colorHex}
            maxLength={9}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
