import { en } from './en';
import { zh } from './zh';

export type Locale = 'en' | 'zh';
export function getCopy(locale: Locale) {
  return locale === 'zh' ? zh : en;
}
