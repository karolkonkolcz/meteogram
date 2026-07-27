import type { ThemePreference } from '../lib/theme';
import styles from './ThemeToggle.module.css';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Svetlý' },
  { value: 'dark', label: 'Tmavý' },
];

export function ThemeToggle({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (next: ThemePreference) => void;
}) {
  return (
    <div className={styles.group} role="group" aria-label="Farebný motív">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.button}
          aria-pressed={preference === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
