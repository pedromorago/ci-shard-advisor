import { useLayoutEffect, useRef, useState } from 'react';
import { formatDuration, formatMoney } from '@ci-shard-advisor/core';
import type { ConfigPoint } from '@ci-shard-advisor/core';

/** The chart only needs a point's cost, feedback and shard count. */
type ChartPoint = { costMs: number; feedbackTimeMs: number; shardCount: number };

interface FrontierChartProps {
  frontier: ConfigPoint[];
  recommended: ChartPoint;
  current?: ChartPoint;
  ratePerMin: number;
}

const DEFAULT_WIDTH = 640;
const MIN_WIDTH = 280;
const MARGIN = { top: 24, right: 24, bottom: 52, left: 80 };
/** Width of the widest marker label, "recommended (16)" at 12px. */
const LABEL_WIDTH = 100;
/** Gap between a marker and its label. */
const LABEL_GAP = 10;

/**
 * The figure's rendered width, so the chart is drawn in real pixels: on a phone
 * the plot narrows while its 12px labels stay 12px, instead of the whole drawing
 * shrinking to half size. Where nothing is laid out (jsdom, a closed <details>)
 * it keeps the desktop width.
 */
function useRenderedWidth() {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.round(entry.contentRect.width);
      if (measured > 0) setWidth(Math.max(MIN_WIDTH, measured));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Evenly spaced tick values across [min, max]. */
function ticks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  return Array.from({ length: count }, (_, i) => min + (i / (count - 1)) * (max - min));
}

/**
 * The cost/time frontier as a single Pareto curve: each shard count is plotted
 * at (billed cost on X, feedback time on Y). One plot, one series, no dual axis:
 * the recommended knee and the current config are marked directly. Lower-left
 * (cheap and fast) is best.
 */
export function FrontierChart({ frontier, recommended, current, ratePerMin }: FrontierChartProps) {
  const { ref, width } = useRenderedWidth();
  // Narrow screens get a taller aspect, so the curve keeps room to read.
  const height = Math.round(Math.min(360, Math.max(240, width * 0.85)));
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  // X axis = billed cost (money if priced, else machine time), Y = feedback time.
  const xOf = (p: ChartPoint) => p.costMs;
  const yOf = (p: ChartPoint) => p.feedbackTimeMs;
  const money = (costMs: number) => formatMoney(costMs, ratePerMin) ?? formatDuration(costMs);

  const xs = frontier.map(xOf);
  const ys = frontier.map(yOf);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * 0.06 || 1;
  const yPad = (yMax - yMin) * 0.06 || 1;
  const x0 = Math.max(0, xMin - xPad);
  const x1 = xMax + xPad;
  const y0 = Math.max(0, yMin - yPad);
  const y1 = yMax + yPad;

  const sx = (v: number) => MARGIN.left + ((v - x0) / (x1 - x0)) * plotW;
  const sy = (v: number) => MARGIN.top + plotH - ((v - y0) / (y1 - y0)) * plotH;
  // Marker labels sit above their point, in the empty space over the curve:
  // "recommended" to the right and "current" to the left, so they never cover
  // each other even when the two points coincide. A label that would run out
  // of the plot swaps to the other side.
  const labelAt = (point: ChartPoint, side: 'left' | 'right') => {
    const x = sx(xOf(point));
    const fitsRight = x + LABEL_GAP + LABEL_WIDTH <= width - MARGIN.right;
    const fitsLeft = x - LABEL_GAP - LABEL_WIDTH >= MARGIN.left;
    const right = side === 'right' ? fitsRight || !fitsLeft : !fitsLeft;
    return {
      x: right ? x + LABEL_GAP : x - LABEL_GAP,
      y: sy(yOf(point)) - LABEL_GAP,
      textAnchor: right ? ('start' as const) : ('end' as const),
    };
  };

  const line = [...frontier]
    .sort((a, b) => xOf(a) - xOf(b))
    .map((p, i) => `${i ? 'L' : 'M'}${sx(xOf(p)).toFixed(1)},${sy(yOf(p)).toFixed(1)}`)
    .join(' ');

  const label = `Feedback time versus billed cost across ${frontier.length} container configurations; recommended is ${recommended.shardCount} containers.`;

  return (
    <figure className="chart" ref={ref}>
      <figcaption id="chart-caption">Feedback time vs cost (lower-left is better)</figcaption>
      <svg
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {/* Y axis grid + ticks (feedback time) */}
        {ticks(yMin, yMax).map((v) => (
          <g key={`y${v}`}>
            <line className="chart__grid" x1={MARGIN.left} y1={sy(v)} x2={width - MARGIN.right} y2={sy(v)} />
            <text className="chart__tick" x={MARGIN.left - 8} y={sy(v)} textAnchor="end" dominantBaseline="middle">
              {formatDuration(v)}
            </text>
          </g>
        ))}
        {/* X axis ticks (billed cost, in money); three on a phone-width plot so they never touch */}
        {ticks(xMin, xMax, plotW < 300 ? 3 : 4).map((v) => (
          <text key={`x${v}`} className="chart__tick" x={sx(v)} y={height - MARGIN.bottom + 20} textAnchor="middle">
            {money(v)}
          </text>
        ))}
        <text className="chart__axis-label" x={MARGIN.left + plotW / 2} y={height - 8} textAnchor="middle">
          Cost per run
        </text>
        <text
          className="chart__axis-label"
          x={16}
          y={MARGIN.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${MARGIN.top + plotH / 2})`}
        >
          Feedback time
        </text>

        <path className="chart__line" d={line} fill="none" />

        {frontier.map((p) => (
          <circle key={p.shardCount} className="chart__point" cx={sx(xOf(p))} cy={sy(yOf(p))} r={4}>
            <title>{`${p.shardCount} containers · ${formatDuration(p.feedbackTimeMs)} · ${money(p.costMs)}`}</title>
          </circle>
        ))}

        {current ? (
          <g>
            <circle className="chart__point chart__point--current" cx={sx(xOf(current))} cy={sy(yOf(current))} r={7} />
            <text className="chart__marker-label" {...labelAt(current, 'left')}>
              current ({current.shardCount})
            </text>
          </g>
        ) : null}

        <g>
          <circle className="chart__point chart__point--recommended" cx={sx(xOf(recommended))} cy={sy(yOf(recommended))} r={7} />
          <text className="chart__marker-label" {...labelAt(recommended, 'right')}>
            recommended ({recommended.shardCount})
          </text>
        </g>
      </svg>

      {/* Table view for accessibility (the same data, screen-reader friendly).
          Hidden through a wrapper: a table ignores the 1px width and would
          widen the page on phones. */}
      <div className="visually-hidden">
        <table>
          <caption>Cost/time frontier by container count</caption>
          <thead>
            <tr>
              <th scope="col">Containers</th>
              <th scope="col">Feedback time</th>
              <th scope="col">Cost per run</th>
            </tr>
          </thead>
          <tbody>
            {frontier.map((p) => (
              <tr key={p.shardCount}>
                <td>{p.shardCount}</td>
                <td>{formatDuration(p.feedbackTimeMs)}</td>
                <td>{money(p.costMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
