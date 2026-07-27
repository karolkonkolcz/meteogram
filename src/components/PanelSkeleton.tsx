import styles from './PanelSkeleton.module.css';

export type PanelSeries = { label: string; token: string };

/**
 * Dočasná kostra panelu: drží rozvržení a ověřuje tokeny v obou motivoch.
 * Etapa M2 ju nahradí skutočným SVG panelom s rovnakou hlavičkou.
 */
export function PanelSkeleton({
  title,
  unit,
  series,
}: {
  title: string;
  unit: string;
  series: PanelSeries[];
}) {
  return (
    <section className={styles.panel} aria-label={`${title} [${unit}]`}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          {title} <span className={styles.unit}>[{unit}]</span>
        </h2>
        <ul className={styles.legend}>
          {series.map((item) => (
            <li key={item.label} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ background: `var(${item.token})` }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      </header>
      <div className={styles.plot} />
    </section>
  );
}
