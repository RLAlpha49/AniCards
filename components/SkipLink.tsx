const MAIN_CONTENT_ID = "main-content";

/**
 * Provides a first-tab-order skip link that also moves programmatic focus to
 * the stable main landmark.
 */
export default function SkipLink() {
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className="skip-link" data-skip-link="true">
      Skip to main content
    </a>
  );
}
