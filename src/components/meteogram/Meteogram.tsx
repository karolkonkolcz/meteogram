import { useCallback, useMemo, useRef, useState } from 'react';
import type { Forecast } from '../../api/openMeteo';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { useSettings } from '../../settings/SettingsContext';
import { useCoarsePointer, useReducedMotion } from '../../hooks/useMediaQuery';
import { zoomBounds } from '../../lib/zoom';
import { useMeteogramControls } from './useMeteogramControls';
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
function layoutFor(
  width: number,
  coarsePointer: boolean,
): {
  visibleHours: number;
  panelHeight: number;
  /** Na úzkém displeji popisek nad plochou; přes graf by ji zakryl. */
  titleAbove: boolean;
} {
  if (width < 600) return { visibleHours: 48, panelHeight: 66, titleAbove: true };
  // Telefon na šířku: víc dní, ale pořád nízké panely a hrubý ukazatel.
  if (coarsePointer && width < 900) {
    return { visibleHours: 96, panelHeight: 72, titleAbove: false };
  }
  if (width < 1024) return { visibleHours: 120, panelHeight: 80, titleAbove: false };
  return { visibleHours: Number.POSITIVE_INFINITY, panelHeight: 98, titleAbove: false };
}

const TITLE_ROW_HEIGHT = 18;

export function Meteogram({ forecast }: { forecast: Forecast }) {
  const [container, containerWidth] = useContainerWidth<HTMLDivElement>();
  const { settings, t } = useSettings();
  const windUnitKey = settings.windUnit === 'kmh' ? ('unit.kmh' as const) : ('unit.ms' as const);
  const coarsePointer = useCoarsePointer();
  const reducedMotion = useReducedMotion();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  const first = forecast.times[0] ?? 0;
  const last = forecast.times[forecast.times.length - 1] ?? first;
  const totalHours = Math.max(1, (last - first) / HOUR);
  const available = Math.max(240, containerWidth - AXIS_WIDTH);
  const layout = layoutFor(containerWidth, coarsePointer);
  const bounds = useMemo(() => zoomBounds(totalHours, available), [totalHours, available]);
  const defaultPxPerHour = available / Math.min(layout.visibleHours, totalHours);

  // Aktuální přiblížení musí být dostupné uvnitř zpětného volání, které se
  // předává ovládání – jinak by se do něj zamrazila hodnota z prvního renderu.
  const controlsPxRef = useRef(defaultPxPerHour);

  const setPointFromPlotX = useCallback(
    (contentX: number) => {
      const seconds = first + ((contentX - AXIS_WIDTH) / controlsPxRef.current) * HOUR;
      setHoverIndex(nearestIndex(forecast.times, seconds));
    },
    [first, forecast.times],
  );

  const controls = useMeteogramControls({
    bounds,
    defaultPxPerHour,
    coarsePointer,
    reducedMotion,
    onPoint: setPointFromPlotX,
    onClearPoint: () => setHoverIndex(null),
  });
  controlsPxRef.current = controls.pxPerHour;

  const geometry = useMemo<Geometry>(() => {
    const { times, utcOffsetSeconds } = forecast;
    const pxPerHour = controls.pxPerHour;

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
      days: daySpans(times, utcOffsetSeconds, settings.locale),
      nights: nightIntervals(forecast),
      dimX: dimFrom === null ? null : xTime(dimFrom),
      nowX: now >= first && now <= last ? xTime(now) : null,
      panelHeight: layout.panelHeight,
      titleAbove: layout.titleAbove,
    };
  }, [
    forecast,
    first,
    last,
    totalHours,
    controls.pxPerHour,
    layout.panelHeight,
    layout.titleAbove,
    settings.locale,
  ]);

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

  /** Ukazatel posunutý klávesnicí musí zůstat ve výřezu. */
  const ensureVisible = useCallback((x: number) => {
    const scroller = controls.scrollerRef.current;
    if (!scroller) return;
    const left = scroller.scrollLeft;
    const right = left + scroller.clientWidth - AXIS_WIDTH;
    const margin = 40;
    if (x < left + margin) scroller.scrollLeft = Math.max(0, x - margin);
    else if (x > right - margin) scroller.scrollLeft = x - scroller.clientWidth + AXIS_WIDTH + margin;
  }, [controls.scrollerRef]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const lastIndex = forecast.times.length - 1;
      const move = (target: number) => {
        const next = Math.min(lastIndex, Math.max(0, target));
        setHoverIndex(next);
        ensureVisible(geometry.x(next));
        event.preventDefault();
      };
      const current = hoverIndex ?? 0;

      switch (event.key) {
        case 'ArrowRight':
          return move(current + (event.shiftKey ? 6 : 1));
        case 'ArrowLeft':
          return move(current - (event.shiftKey ? 6 : 1));
        case 'Home':
          return move(0);
        case 'End':
          return move(lastIndex);
        case '+':
        case '=':
          event.preventDefault();
          return controls.zoomByStep(1);
        case '-':
          event.preventDefault();
          return controls.zoomByStep(-1);
        case '0':
          event.preventDefault();
          return controls.resetZoom();
        case 'Escape':
          return setHoverIndex(null);
        default:
      }
    },
    [controls, ensureVisible, forecast.times.length, geometry, hoverIndex],
  );

  const hoverX = hoverIndex !== null && hoverIndex >= 0 ? geometry.x(hoverIndex) : null;
  const visibleWidth = Math.max(240, containerWidth - AXIS_WIDTH);
  // Bublina se překlopí, až když by u pravého okraje výřezu přetekla.
  const flipTooltip = hoverX !== null && hoverX - scrollLeft > visibleWidth - TOOLTIP_WIDTH;

  return (
    <div
      className={styles.meteogram}
      ref={container}
      tabIndex={0}
      role="group"
      aria-label={t('chart.label')}
      onKeyDown={onKeyDown}
    >
      {/* Čtečka obrazovky z SVG nic nevyčte – odkážeme ji na tabulku. */}
      <p className="visually-hidden">{t('chart.textAlternative')}</p>

      <div className={styles.toolbar}>
        <span className={styles.hint}>
          {t(coarsePointer ? 'chart.hintTouch' : 'chart.hintPointer')}
        </span>
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => controls.zoomByStep(-1)}
          aria-label={t('chart.zoomOut')}
        >
          −
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => controls.zoomByStep(1)}
          aria-label={t('chart.zoomIn')}
        >
          +
        </button>
        {controls.isZoomed && (
          <button type="button" className={styles.controlButton} onClick={controls.resetZoom}>
            {t('chart.zoomReset')}
          </button>
        )}
      </div>

      <div className={styles.frame}>
      <div
        className={styles.scroller}
        ref={controls.scrollerRef}
        /*
         * Prohlížeč dělá posuvné oblasti fokusovatelné, aby šly ovládat
         * klávesnicí. Tady to řeší už rodič (šipky, Home/End), takže by
         * v pořadí tabulátoru přibyla jen zastávka bez použití.
         */
        tabIndex={-1}
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
                  {t(def.titleKey)}{' '}
                  <span className={styles.panelUnit}>[{t(def.unitKey(windUnitKey))}]</span>
                  {def.legend.map((item) => (
                    <span key={item.labelKey} className={styles.legendItem}>
                      <span
                        className={styles.swatch}
                        style={{ background: `var(${item.token})` }}
                        aria-hidden="true"
                      />
                      {t(item.labelKey)}
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
                <p className={styles.missing}>{t('panel.missing')}</p>
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
          style={{ left: AXIS_WIDTH, width: geometry.width }}
          {...controls.handlers}
        >
          {geometry.nowX !== null && <span className={styles.now} style={{ left: geometry.nowX }} />}
          {hoverX !== null && <span className={styles.crosshair} style={{ left: hoverX }} />}
          {hoverX !== null && hoverIndex !== null && (
            <Tooltip
              forecast={forecast}
              index={hoverIndex}
              windUnitKey={windUnitKey}
              x={hoverX}
              flip={flipTooltip}
              width={TOOLTIP_WIDTH}
            />
          )}
        </div>
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
