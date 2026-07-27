import { useEffect, useRef } from 'react';
import { useSettings } from '../settings/SettingsContext';
import type { ThemePreference } from '../lib/theme';
import type { Locale } from '../lib/time';
import type { WindUnit } from '../lib/units';
import type { MessageKey } from '../i18n';
import styles from './SettingsDialog.module.css';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'sk', label: 'Slovenčina' },
  { value: 'cs', label: 'Čeština' },
];

const THEMES: { value: ThemePreference; labelKey: MessageKey }[] = [
  { value: 'auto', labelKey: 'settings.themeAuto' },
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
];

const WIND_UNITS: { value: WindUnit; labelKey: MessageKey }[] = [
  { value: 'ms', labelKey: 'unit.ms' },
  { value: 'kmh', labelKey: 'unit.kmh' },
];

/** Nativní `<dialog>` řeší Esc, fokus i překrytí – vlastní modal by to jen zopakoval. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, update, t } = useSettings();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-label={t('settings.title')}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('settings.title')}</h2>
        <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>
          {t('settings.close')}
        </button>
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('settings.language')}</legend>
        {LOCALES.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="locale"
              checked={settings.locale === option.value}
              onChange={() => update({ locale: option.value })}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('settings.theme')}</legend>
        {THEMES.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="theme"
              checked={settings.theme === option.value}
              onChange={() => update({ theme: option.value })}
            />
            {t(option.labelKey)}
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('settings.windUnit')}</legend>
        {WIND_UNITS.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name="windUnit"
              checked={settings.windUnit === option.value}
              onChange={() => update({ windUnit: option.value })}
            />
            {t(option.labelKey)}
          </label>
        ))}
      </fieldset>

      <div className={styles.group}>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={settings.elevationCorrection}
            onChange={(event) => update({ elevationCorrection: event.target.checked })}
          />
          {t('settings.elevation')}
        </label>
        <p className={styles.help}>{t('settings.elevationHelp')}</p>
      </div>
    </dialog>
  );
}
