import type { ReactNode } from 'react';
import type { Forecast, Series } from '../../api/openMeteo';
import type { MessageKey } from '../../i18n';
import { extent, niceDomain, type LinearScale } from '../../lib/scales';
import { degreesToCompass } from '../../lib/units';

export interface PanelContext {
  forecast: Forecast;
  /** Vodorovná pozice bodu v pixelech podle indexu času. */
  x: (index: number) => number;
  /** Totéž pro libovolný okamžik – denní úhrny leží mimo hodinovou mřížku. */
  xTime: (epochSeconds: number) => number;
  y: LinearScale;
  width: number;
  height: number;
  /** Šířka jednoho kroku modelu – sloupce nesmí předpokládat 1 h. */
  slotWidth: (index: number) => number;
}

export interface PanelDef {
  key: string;
  titleKey: MessageKey;
  /** Jednotka je funkce – vítr ji mění podle nastavení (m/s vs. km/h). */
  unitKey: (windUnitKey: MessageKey) => MessageKey;
  legend: { labelKey: MessageKey; token: string }[];
  /** Řady, bez kterých panel nemá co kreslit. */
  requires: (keyof Forecast['hourly'])[];
  /** Volné místo nad grafem; zrážky ho potřebují na denní úhrny. */
  topPad?: number;
  domain: (forecast: Forecast) => [number, number];
  render: (context: PanelContext) => ReactNode;
}

const GAP = 2; // odstup mezi sousedními výplněmi (viz docs §3.0)

function line(
  series: Series | undefined,
  { x, y }: PanelContext,
  smooth = false,
): ReactNode {
  if (!series) return null;
  // Chybějící hodnota přeruší čáru; nedopočítává se přes mezeru.
  const segments: string[] = [];
  let current: string[] = [];

  series.forEach((value, index) => {
    if (value === null) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(' '));

  return segments.map((path) => (
    <path
      key={path.slice(0, 24)}
      d={path}
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin={smooth ? 'round' : 'miter'}
      vectorEffect="non-scaling-stroke"
    />
  ));
}

function bars(
  series: Series | undefined,
  context: PanelContext,
  baseline: number,
  className: string,
): ReactNode {
  if (!series) return null;
  const { x, y, slotWidth } = context;
  return series.map((value, index) => {
    if (value === null || value <= baseline) return null;
    const width = Math.max(1, slotWidth(index) - GAP);
    const top = y(value);
    const bottom = y(baseline);
    return (
      <rect
        key={index}
        className={className}
        x={x(index) - width / 2}
        y={top}
        width={width}
        height={Math.max(1, bottom - top)}
        rx={Math.min(2, width / 2)}
      />
    );
  });
}

function areaPath(series: Series | undefined, { x, y }: PanelContext, base: number): string {
  if (!series) return '';
  const bottom = y(base);
  let path = '';
  let open = false;

  series.forEach((value, index) => {
    if (value === null) {
      if (open) {
        path += ` L${x(index - 1).toFixed(1)},${bottom.toFixed(1)} Z`;
        open = false;
      }
      return;
    }
    if (!open) {
      path += ` M${x(index).toFixed(1)},${bottom.toFixed(1)} L${x(index).toFixed(1)},${y(value).toFixed(1)}`;
      open = true;
    } else {
      path += ` L${x(index).toFixed(1)},${y(value).toFixed(1)}`;
    }
  });

  if (open) {
    path += ` L${x(series.length - 1).toFixed(1)},${bottom.toFixed(1)} Z`;
  }
  return path.trim();
}

/**
 * Denní úhrny nad sloupci, jako boxíky v předloze. Vypisují se jen tam, kde
 * opravdu prší – nulové dny by jen zaplnily panel prázdnými nulami.
 */
function dailySums({ forecast, xTime, width }: PanelContext): ReactNode {
  const sums = forecast.daily.precipitation_sum;
  if (!sums) return null;

  return (
    <g fill="var(--rain)" fontSize={10} textAnchor="middle">
      {forecast.dailyTimes.map((dayStart, index) => {
        const value = sums[index];
        if (value === null || value === undefined || value < 0.1) return null;
        const center = xTime(dayStart + 12 * 3600);
        if (center < 0 || center > width) return null;
        return (
          <text key={dayStart} x={center} y={24}>
            {value.toFixed(1)}
          </text>
        );
      })}
    </g>
  );
}

export const PANEL_DEFS: PanelDef[] = [
  {
    key: 'temperature',
    titleKey: 'panel.temperature',
    unitKey: () => 'unit.celsius',
    legend: [
      { labelKey: 'series.temperature', token: '--temp' },
      { labelKey: 'series.apparent', token: '--temp-soft' },
    ],
    requires: ['temperature_2m'],
    domain: (forecast) => {
      const span =
        extent([
          ...(forecast.hourly.temperature_2m ?? []),
          ...(forecast.hourly.apparent_temperature ?? []),
        ]) ?? [0, 20];
      return niceDomain(span[0], span[1], 4);
    },
    render: (context) => (
      <>
        <g stroke="var(--temp-soft)" strokeDasharray="4 3" opacity={0.9}>
          {line(context.forecast.hourly.apparent_temperature, context)}
        </g>
        <g stroke="var(--temp)">{line(context.forecast.hourly.temperature_2m, context)}</g>
      </>
    ),
  },
  {
    key: 'cloud',
    titleKey: 'panel.cloud',
    unitKey: () => 'unit.percent',
    legend: [{ labelKey: 'series.cloud', token: '--cloud' }],
    requires: ['cloud_cover'],
    domain: () => [0, 100],
    render: (context) => (
      // Silueta, ne sloupce: odlišuje panel tvarem od zrážok pod ním.
      <path
        d={areaPath(context.forecast.hourly.cloud_cover, context, 0)}
        fill="var(--cloud)"
        fillOpacity={0.55}
        stroke="var(--cloud)"
        strokeWidth={1}
      />
    ),
  },
  {
    key: 'precipitation',
    titleKey: 'panel.precipitation',
    unitKey: () => 'unit.mm',
    legend: [
      { labelKey: 'series.rain', token: '--rain' },
      { labelKey: 'series.snow', token: '--snow' },
    ],
    requires: ['precipitation'],
    topPad: 32,
    domain: (forecast) => {
      const span = extent(forecast.hourly.precipitation) ?? [0, 1];
      // Nulová stupnice by u sucha zvětšila šum na plnou výšku panelu.
      return [0, Math.max(1, niceDomain(0, span[1], 3)[1])];
    },
    render: (context) => (
      <>
        <g fill="var(--rain)">{bars(context.forecast.hourly.rain, context, 0, '')}</g>
        <g fill="var(--snow)">{bars(context.forecast.hourly.snowfall, context, 0, '')}</g>
        {dailySums(context)}
      </>
    ),
  },
  {
    key: 'pressure',
    titleKey: 'panel.pressure',
    unitKey: () => 'unit.hpa',
    legend: [{ labelKey: 'series.pressure', token: '--pressure' }],
    requires: ['pressure_msl'],
    domain: (forecast) => {
      const span = extent(forecast.hourly.pressure_msl) ?? [1000, 1020];
      return niceDomain(span[0], span[1], 4);
    },
    render: (context) => (
      <g stroke="var(--pressure)">{line(context.forecast.hourly.pressure_msl, context, true)}</g>
    ),
  },
  {
    key: 'wind',
    titleKey: 'panel.wind',
    unitKey: (windUnitKey) => windUnitKey,
    legend: [
      { labelKey: 'series.wind', token: '--wind' },
      { labelKey: 'series.gust', token: '--wind-gust' },
    ],
    requires: ['wind_speed_10m'],
    domain: (forecast) => {
      const span =
        extent([
          ...(forecast.hourly.wind_speed_10m ?? []),
          ...(forecast.hourly.wind_gusts_10m ?? []),
        ]) ?? [0, 10];
      return [0, niceDomain(0, span[1], 4)[1]];
    },
    render: (context) => (
      <>
        {/* Nárazy jsou obálka rychlosti (vždy ≥), proto plocha pod čarou. */}
        <path
          d={areaPath(context.forecast.hourly.wind_gusts_10m, context, 0)}
          fill="var(--wind-gust)"
          fillOpacity={0.55}
        />
        <g stroke="var(--wind)">{line(context.forecast.hourly.wind_speed_10m, context)}</g>
      </>
    ),
  },
  {
    key: 'direction',
    titleKey: 'panel.direction',
    unitKey: () => 'unit.compass',
    legend: [{ labelKey: 'series.direction', token: '--wind-dir' }],
    requires: ['wind_direction_10m'],
    // Osa je 0–360°, popisky se převádějí na světové strany.
    domain: () => [0, 360],
    render: ({ forecast, x, y, slotWidth }) => (
      <g fill="var(--wind-dir)">
        {forecast.hourly.wind_direction_10m?.map((value, index) =>
          value === null ? null : (
            <circle
              key={index}
              cx={x(index)}
              cy={y(value)}
              r={Math.min(2.5, Math.max(1.4, slotWidth(index) / 2))}
            />
          ),
        )}
      </g>
    ),
  },
];

/** Popisky svislé osy: u směru větru světové strany, jinak čísla. */
export function formatAxisValue(panelKey: string, value: number): string {
  if (panelKey !== 'direction') return String(value);
  return value === 360 ? 'S' : degreesToCompass(value);
}

export function axisTicksFor(panelKey: string, defaultTicks: number[]): number[] {
  if (panelKey !== 'direction') return defaultTicks;
  // Po 45° se devět popisků do panelu nevejde; hlavní světové strany stačí.
  return [0, 90, 180, 270, 360];
}
