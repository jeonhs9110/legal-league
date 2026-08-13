"use client";

import { useEffect, useState } from "react";
import {
  DICTIONARIES,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_SHORT,
  isLocale,
  type Locale,
} from "@/lib/i18n";

const STORAGE_KEY = "ll-locale";

/**
 * Floating language switcher, bottom right.
 *
 * Fixed rather than in the footer because a reader decides they want another
 * language while reading, not after scrolling to the end of 800 stories. It
 * appears once the reader has moved down the page, so it never sits on top of
 * the nameplate on first view.
 *
 * Choosing a language sets the document's lang attribute as well as the stored
 * preference: a screen reader announcing Korean text with an English voice is
 * the accessibility failure this attribute exists to prevent.
 */
export function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>("en");
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored ?? undefined)) {
      apply(stored as Locale);
    } else {
      const browser = navigator.language.slice(0, 2);
      if (isLocale(browser)) apply(browser);
    }

    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(next: Locale) {
    setLocale(next);
    document.documentElement.lang = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    // Every element that opted in re-reads its label. Keeps the switcher from
    // needing to own the whole tree just to change a dozen strings.
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const path = el.dataset.i18n;
      if (!path) return;
      const value = path
        .split(".")
        .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key],
          DICTIONARIES[next]);
      if (typeof value === "string") el.textContent = value;
    });
    window.dispatchEvent(new CustomEvent("ll-locale", { detail: next }));
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        visible ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      {open ? (
        <ul className="mb-2 overflow-hidden border border-rule bg-paper shadow-lg">
          {LOCALES.map((code) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => {
                  apply(code);
                  setOpen(false);
                }}
                aria-current={code === locale}
                className={`flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper-sunken ${
                  code === locale ? "text-oxblood" : "text-ink"
                }`}
              >
                <span className="figure text-[11px] text-ink-faint">
                  {LOCALE_SHORT[code]}
                </span>
                <span className="editorial text-sm">{LOCALE_NAMES[code]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={DICTIONARIES[locale].common.language}
        className="flex items-center gap-2 border border-ink bg-paper px-4 py-2.5 shadow-md transition-colors hover:bg-paper-sunken"
      >
        <span className="figure text-[11px] text-ink-faint">
          {LOCALE_SHORT[locale]}
        </span>
        <span className="editorial text-sm text-ink">
          {LOCALE_NAMES[locale]}
        </span>
        <span aria-hidden="true" className="text-ink-faint">
          {open ? "▾" : "▴"}
        </span>
      </button>
    </div>
  );
}
