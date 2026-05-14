export const MAIN_CONTENT_ID = "main-content";
const MAIN_CONTENT_HASH = `#${MAIN_CONTENT_ID}`;

export const SKIP_LINK_ATTRIBUTE = "data-skip-link";
export const MOBILE_MENU_TOGGLE_ATTRIBUTE = "data-mobile-menu-toggle";
export const MOBILE_MENU_NAVIGATION_ATTRIBUTE = "data-mobile-navigation";

export const SHELL_JS_ENABLED_DATASET_KEY = "jsEnabled";
export const MOBILE_MENU_OPEN_DATASET_KEY = "mobileMenuOpen";
export const MOBILE_MENU_HYDRATED_DATASET_KEY = "mobileMenuHydrated";

export const MOBILE_MENU_OPEN_LABEL = "Open menu";
export const MOBILE_MENU_CLOSE_LABEL = "Close menu";

export const MOBILE_MENU_TOGGLE_SELECTOR = `[${MOBILE_MENU_TOGGLE_ATTRIBUTE}="true"]`;
export const MOBILE_MENU_NAVIGATION_SELECTOR = `[${MOBILE_MENU_NAVIGATION_ATTRIBUTE}="true"]`;
export const SKIP_LINK_SELECTOR = `[${SKIP_LINK_ATTRIBUTE}="true"]`;

export const MOBILE_MENU_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function getMobileMenuAriaLabel(isOpen: boolean): string {
  return isOpen ? MOBILE_MENU_CLOSE_LABEL : MOBILE_MENU_OPEN_LABEL;
}

function serializeForInlineScript(value: string): string {
  return JSON.stringify(value);
}

export function buildEarlyAccessibilityShellScript(): string {
  return `(function () {
  const root = document.documentElement;
  root.dataset[${serializeForInlineScript(SHELL_JS_ENABLED_DATASET_KEY)}] = 'true';
  const focusableSelector = ${serializeForInlineScript(MOBILE_MENU_FOCUSABLE_SELECTOR)};

  function shellHydrated() {
    return root.dataset[${serializeForInlineScript(MOBILE_MENU_HYDRATED_DATASET_KEY)}] === 'true';
  }

  function getMainContent() {
    return document.getElementById(${serializeForInlineScript(MAIN_CONTENT_ID)});
  }

  function getMenuToggle() {
    return document.querySelector(${serializeForInlineScript(MOBILE_MENU_TOGGLE_SELECTOR)});
  }

  function getMobileNavigation() {
    return document.querySelector(${serializeForInlineScript(MOBILE_MENU_NAVIGATION_SELECTOR)});
  }

  function getFocusableMenuElements() {
    const mobileNavigation = getMobileNavigation();

    if (!(mobileNavigation instanceof HTMLElement) || mobileNavigation.hidden) {
      return [];
    }

    return Array.from(mobileNavigation.querySelectorAll(focusableSelector)).filter(
      (element) => element instanceof HTMLElement,
    );
  }

  function focusMainContent() {
    const mainContent = getMainContent();

    if (!(mainContent instanceof HTMLElement)) {
      return;
    }

    mainContent.scrollIntoView({ block: 'start' });
    mainContent.focus();
    history.replaceState(null, '', ${serializeForInlineScript(MAIN_CONTENT_HASH)});
  }

  function syncMobileMenu(open, restoreFocus) {
    const menuToggle = getMenuToggle();
    const mobileNavigation = getMobileNavigation();

    root.dataset[${serializeForInlineScript(MOBILE_MENU_OPEN_DATASET_KEY)}] = open ? 'true' : 'false';

    if (menuToggle instanceof HTMLElement) {
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute(
        'aria-label',
        open
          ? ${serializeForInlineScript(MOBILE_MENU_CLOSE_LABEL)}
          : ${serializeForInlineScript(MOBILE_MENU_OPEN_LABEL)},
      );
    }

    if (mobileNavigation instanceof HTMLElement) {
      if (open) {
        mobileNavigation.removeAttribute('hidden');
      } else {
        mobileNavigation.setAttribute('hidden', '');
      }
    }

    if (open) {
      const [firstFocusable] = getFocusableMenuElements();
      (firstFocusable || mobileNavigation)?.focus();
      return;
    }

    if (restoreFocus && menuToggle instanceof HTMLElement) {
      menuToggle.focus();
    }
  }

  document.addEventListener('click', function (event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const skipLink = target.closest(${serializeForInlineScript(SKIP_LINK_SELECTOR)});

    if (skipLink instanceof HTMLAnchorElement) {
      event.preventDefault();
      focusMainContent();
      return;
    }

    if (shellHydrated()) {
      return;
    }

    const menuToggle = target.closest(${serializeForInlineScript(MOBILE_MENU_TOGGLE_SELECTOR)});

    if (!(menuToggle instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    syncMobileMenu(menuToggle.getAttribute('aria-expanded') !== 'true', false);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (!shellHydrated()) {
      const open = root.dataset[${serializeForInlineScript(MOBILE_MENU_OPEN_DATASET_KEY)}] === 'true';

      if (!open) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        syncMobileMenu(false, true);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableMenuElements();
      const mobileNavigation = getMobileNavigation();

      if (!(mobileNavigation instanceof HTMLElement)) {
        return;
      }

      if (focusableElements.length === 0) {
        event.preventDefault();
        mobileNavigation.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const isFocusInsideMenu = activeElement instanceof HTMLElement
        && mobileNavigation.contains(activeElement);

      if (event.shiftKey) {
        if (!isFocusInsideMenu || activeElement === firstFocusable) {
          event.preventDefault();
          (lastFocusable || firstFocusable).focus();
        }
        return;
      }

      if (!isFocusInsideMenu || activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
      return;
    }

    if (
      event.key === 'Enter'
      && document.activeElement?.matches(
        ${serializeForInlineScript(SKIP_LINK_SELECTOR)},
      )
    ) {
      event.preventDefault();
      focusMainContent();
    }
  }, true);
})();`;
}
