import { useCallback, useMemo, useRef, useState } from 'react';
import type { Forecast } from '../../api/openMeteo';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import {
  daySpans,
  nearestIndex,
  nightIntervals,
  uncertaintyStart,
  type DaySpan,
  type Interval,
} from '../../lib/meteogramGeometry';
import { scaleLinear, ticks, type LinearScale } from '../../lib/scales';
import { formatHour, stepHours } from '../../lib/time';
import { PANEL_DEFS, axisTicksFor, formatAxisValue } from './panelDefs';
import { Tooltip } from './Tooltip';
import styles from './Meteogram.module.css';

const AXIS_WIDTH = 46;
const DAY_STRIP_HEIGHT = 34;
const TOOLTIP_WIDTH = 208;
const HOUR = 3600;

interface Geometry {
  pxPerHour: number;
  width: number;
  x: (index: number) => number;
  xTime: (epochSeconds: number) => number;
  slotWidth: (index: number) => number;
  days: DaySpan[];
  nights: Interval[];
  dimX: number | null;
  nowX: number | null;
  panelHeight: number;
  titleAbove: boolean;
}

/**
 * Výchozí výřez a výška panelů podle třídy zařízení (docs §3.6). Rozhoduje
 * naměřená šířka kontejneru, ne šířka okna – graf se tak chová správně
 * i ve split-screenu. Zoom a gesta doplní M3.
 */
function layoutFor(width: number): {
  visibleHours: number;
  panelHeight: number;
  /** Na úzkém displeji popisek nad plochou; přes graf by ji zakryl. */
  titleAbove: boolean;
} {
  if (width < 600) return { visibleHours: 48, panelHeight: 66, titleAbove: true };
  if (width < 1024) return { visibleHours: 120, panelHeight: 80, titleAbove: false };
  return { visibleHours: Number.POSITIVE_INFINITY, panelHeight: 98, titleAbove: false };
}

const TITLE_ROW_HEIGHT = 18;

export function Meteogram({ forecast }: { forecast: Forecast }) {
  const [container, containerWidth] = useContainerWidth<HTMLDivElement>();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const geometry = useMemo<Geometry>(() => {
    const { times, utcOffsetSeconds } = forecast;
    const first = times[0] ?? 0;
    const last = times[times.length - 1] ?? first;
    const totalHours = Math.max(1, (last - first) / HOUR);

    const layout = layoutFor(containerWidth);
    const available = Math.max(240, containerWidth - AXIS_WIDTH);
    const pxPerHour = available / Math.min(layout.visibleHours, totalHours);

    const xTime = (seconds: number) => ((seconds - first) / HOUR) * pxPerHour;
    const dimFrom = uncertaintyStart(times);
    const now = Date.now() / 1000;

    return {
      pxPerHour,
      width: totalHours * pxPerHour,
      xTime,
      x: (index) => xTime(times[index] ?? first),
      slotWidth: (index) =>
        (stepHours(times, index) ?? stepHours(times, index - 1) ?? 1) * pxPerHour,
      days: daySpans(times, utcOffsetSeconds, 'sk'),
      nights: nightIntervals(forecast),
      dimX: dimFrom === null ? null : xTime(dimFrom),
      nowX: now >= first && now <= last ? xTime(now) : null,
      panelHeight: layout.panelHeight,
      titleAbove: layout.titleAbove,
    };
  }, [forecast, containerWidth]);

  const panels = useMemo(
    () =>
      PANEL_DEFS.map((def) => {
        // Teplota je hlavní panel, dostává o něco víc místa než ostatní.
        const height =
          geometry.panelHeight +
          (def.key === 'temperature' ? 18 : 0) +
          (def.topPad ? def.topPad - 16 : 0);
        const domain = def.domain(forecast);
        const y: LinearScale = scaleLinear(domain, [height - 6, def.topPad ?? 16]);
        return {
          def,
          height,
          y,
          available: def.requires.every((key) => forecast.hourly[key] !== undefined),
          axisTicks: axisTicksFor(def.key, ticks(domain[0], domain[1], 4)),
        };
      }),
    [forecast, geometry.panelHeight],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const bounds = overlayRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const seconds =
        (forecast.times[0] ?? 0) + ((event.clientX - bounds.left) / geometry.pxPerHour) * HOUR;
      setHoverIndex(nearestIndex(forecast.times, seconds));
    },
    [forecast.times, geometry.pxPerHour],
  );

  const hoverX = hoverIndex !== null && hoverIndex >= 0 ? geometry.x(hoverIndex) : null;
  const visibleWidth = Math.max(240, containerWidth - AXIS_WIDTH);
  // Bublina se překlopí, až když by u pravého okraje výřezu přetekla.
  const flipTooltip = hoverX !== null && hoverX - scrollLeft > visibleWidth - TOOLTIP_WIDTH;

  return (
    <div className={styles.meteogram} ref={container}>
      <div
        className={styles.scroller}
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
      >
        {panels.map(({ def, height, y, available, axisTicks }) => (
          <div key={def.key} className={styles.row}>
            <div
              className={styles.axis}
              style={{
                width: AXIS_WIDTH,
                height: height + (geometry.titleAbove ? TITLE_ROW_HEIGHT : 0),
              }}
            >
              {available &&
                axisTicks.map((value) => (
                  <span
                    key={value}
                    className={`${styles.axisLabel} tabular`}
                    // Popisek je absolutní, padding by ho neposunul – proto ručně.
                    style={{ top: y(value) + (geometry.titleAbove ? TITLE_ROW_HEIGHT : 0) }}
                  >
                    {formatAxisValue(def.key, value)}
                  </span>
                ))}
            </div>

            <div
              className={styles.plot}
              style={{
                width: geometry.width,
                height: height + (geometry.titleAbove ? TITLE_ROW_HEIGHT : 0),
              }}
            >
              <span
                className={`${styles.panelTitle} ${geometry.titleAbove ? styles.panelTitleAbove : ''}`}
              >
                <span className={styles.panelTitleInner}>
                  {def.title} <span className={styles.panelUnit}>[{def.unit}]</span>
                  {def.legend.map((item) => (
                    <span key={item.label} className={styles.legendItem}>
                      <span
                        className={styles.swatch}
                        style={{ background: `var(${item.token})` }}
                        aria-hidden="true"
                      />
                      {item.label}
                    </span>
                  ))}
                </span>
              </span>

              {available ? (
                <svg width={geometry.width} height={height} className={styles.svg} role="presentation">
                  <Backdrop geometry={geometry} height={height} />
                  {axisTicks.map((value) => (
                    <line
                      key={value}
                      x1={0}
                      x2={geometry.width}
                      y1={y(value)}
                      y2={y(value)}
                      stroke="var(--grid)"
                      strokeWidth={1}
                    />
                  ))}
                  {def.render({
                    forecast,
                    x: geometry.x,
                    xTime: geometry.xTime,
                    y,
                    width: geometry.width,
                    height,
                    slotWidth: geometry.slotWidth,
                  })}
                  {geometry.dimX !== null && (
                    // Po desátém dni se předpověď tlumí podkladem, ne jinou barvou čar.
                    <rect
                      x={geometry.dimX}
                      y={0}
                      width={Math.max(0, geometry.width - geometry.dimX)}
                      height={height}
                      fill="var(--surface)"
                      opacity={0.42}
                    />
                  )}
                </svg>
              ) : (
                <p className={styles.missing}>Model túto veličinu nedodal.</p>
              )}
            </div>
          </div>
        ))}

        <div className={styles.row}>
          <div className={styles.axis} style={{ width: AXIS_WIDTH, height: DAY_STRIP_HEIGHT }} />
          <div className={styles.plot} style={{ width: geometry.width, height: DAY_STRIP_HEIGHT }}>
            <DayStrip geometry={geometry} forecast={forecast} />
          </div>
        </div>

        {/* Ukazatel leží nad všemi panely, proto je mimo jednotlivá SVG. */}
        <div
          className={styles.overlay}
          ref={overlayRef}
          style={{ left: AXIS_WIDTH, width: geometry.width }}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {geometry.nowX !== null && <span className={styles.now} style={{ left: geometry.nowX }} />}
          {hoverX !== null && <span className={styles.crosshair} style={{ left: hoverX }} />}
          {hoverX !== null && hoverIndex !== null && (
            <Tooltip
              forecast={forecast}
              index={hoverIndex}
              x={hoverX}
              flip={flipTooltip}
              width={TOOLTIP_WIDTH}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Backdrop({ geometry, height }: { geometry: Geometry; height: number }) {
  return (
    <g>
      {geometry.days
        .filter((day) => day.weekend)
        .map((day) => (
          <rect
            key={`weekend-${day.start}`}
            x={geometry.xTime(day.start)}
            y={0}
            width={geometry.xTime(day.end) - geometry.xTime(day.start)}
            height={height}
            fill="var(--band-weekend)"
          />
        ))}
      {geometry.nights.map((night) => (
        <rect
          key={`night-${night.from}`}
          x={geometry.xTime(night.from)}
          y={0}
          width={geometry.xTime(night.to) - geometry.xTime(night.from)}
          height={height}
          fill="var(--band-night)"
        />
      ))}
      {geometry.days.map((day) => (
        <line
          key={`day-${day.start}`}
          x1={geometry.xTime(day.start)}
          x2={geometry.xTime(day.start)}
          y1={0}
          y2={height}
          stroke="var(--axis)"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

function DayStrip({ geometry, forecast }: { geometry: Geometry; forecast: Forecast }) {
  // Hodiny se vypisují jen tehdy, když se vejdou; jinak zůstanou samotné dny.
  const hourStep =
    geometry.pxPerHour * 6 >= 24 ? 6 : geometry.pxPerHour * 12 >= 24 ? 12 : 0;

  return (
    <svg width={geometry.width} height={DAY_STRIP_HEIGHT} className={styles.svg} role="presentation">
      {hourStep > 0 &&
        geometry.days.flatMap((day) => {
          const marks = [];
          for (let hour = hourStep; hour < 24; hour += hourStep) {
            const time = day.start + hour * HOUR;
            if (time > day.end) break;
            marks.push(
              <text
                key={`${day.start}-${hour}`}
                x={geometry.xTime(time)}
                y={11}
                textAnchor="middle"
                fontSize={9}
                fill="var(--ink-muted)"
              >
                {formatHour(time, forecast.utcOffsetSeconds)}
              </text>,
            );
          }
          return marks;
        })}
      {geometry.days.map((day) => {
        const start = geometry.xTime(day.start);
        const end = geometry.xTime(day.end);
        return (
          <g key={day.start}>
            <line x1={start} x2={start} y1={0} y2={DAY_STRIP_HEIGHT} stroke="var(--axis)" />
            <text
              x={(start + end) / 2}
              y={27}
              textAnchor="middle"
              fontSize={11}
              fontWeight={day.weekend ? 600 : 400}
              fill={day.weekend ? 'var(--ink)' : 'var(--ink-secondary)'}
            >
              {day.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
