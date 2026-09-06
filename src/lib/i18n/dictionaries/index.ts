/**
 * One table per language, keyed on the exact English source text used in the
 * components. Built mechanically: `npm run i18n:extract` prints every string the
 * interface asks to be translated, and `npm run i18n:coverage` reports how many of
 * them each table actually answers — so an unfinished language is a measured
 * state, not a rumour.
 */
import type { Locale } from '../locales';
import { de } from './de';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';

export const dictionaries: Record<Locale, Record<string, string>> = {
  en: {},
  fr,
  de,
  it,
  es,
};
