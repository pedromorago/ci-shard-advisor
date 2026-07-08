import { formatDuration } from '@ci-shard-advisor/core';
import type { ConfigPoint } from '@ci-shard-advisor/core';

interface FrontierChartProps {
  frontier: ConfigPoint[];
  recommended: ConfigPoint;
  current?: ConfigPoint;
}

const WIDTH = 640;
const HEIGHT = 360;
const MARGIN = { top: 24, right: 24, bottom: 52, left: 72 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

/** Evenly spaced tick values across [min, max]. */
function ticks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  return Array.from({ length: count }, (_, i) => min + (i / (count - 1)) * (max - min));
}

/**
 * The cost/time frontier as a single Pareto curve: each shard count is plotted
 * at (billed cost on X, feedback time on Y). One plot, one series, no dual axis —
 * the recommended knee and the current config are marked directly. Lower-left
 * (cheap and fast) is best.
 */
export function FrontierChart({ frontier, recommended, current }: FrontierChartProps) {
  // X axis = billed cost, Y axis = feedback time.
  const xOf = (p: ConfigPoint) => p.costMs;
  const yOf = (p: ConfigPoint) => p.feedbackTimeMs;

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

  const sx = (v: number) => MARGIN.left + ((v - x0) / (x1 - x0)) * PLOT_W;
  const sy = (v: number) => MARGIN.top + PLOT_H - ((v - y0) / (y1 - y0)) * PLOT_H;

  const line = [...frontier]
    .sort((a, b) => xOf(a) - xOf(b))
    .map((p, i) => `${i ? 'L' : 'M'}${sx(xOf(p)).toFixed(1)},${sy(yOf(p)).toFixed(1)}`)
    .join(' ');

  const label = `Feedback time versus billed cost across ${frontier.length} shard configurations; recommended is ${recommended.shardCount} shards.`;

  return (
    <figure className="chart">
      <figcaption id="chart-caption">Feedback time vs cost (lower-left is better)</figcaption>
      <svg
        className="chart__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
      >
        {/* Y axis grid + ticks (feedback time) */}
        {ticks(yMin, yMax).map((v) => (
          <g key={`y${v}`}>
            <line className="chart__grid" x1={MARGIN.left} y1={sy(v)} x2={WIDTH - MARGIN.right} y2={sy(v)} />
            <text className="chart__tick" x={MARGIN.left - 8} y={sy(v)} textAnchor="end" dominantBaseline="middle">
              {formatDuration(v)}
            </text>
          </g>
        ))}
        {/* X axis ticks (billed cost) */}
        {ticks(xMin, xMax).map((v) => (
          <text key={`x${v}`} className="chart__tick" x={sx(v)} y={HEIGHT - MARGIN.bottom + 20} textAnchor="middle">
            {formatDuration(v)}
          </text>
        ))}
        <text className="chart__axis-label" x={MARGIN.left + PLOT_W / 2} y={HEIGHT - 8} textAnchor="middle">
          Billed cost
        </text>
        <text
          className="chart__axis-label"
          x={16}
          y={MARGIN.top + PLOT_H / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${MARGIN.top + PLOT_H / 2})`}
        >
          Feedback time
        </text>

        <path className="chart__line" d={line} fill="none" />

        {frontier.map((p) => (
          <circle key={p.shardCount} className="chart__point" cx={sx(xOf(p))} cy={sy(yOf(p))} r={4}>
            <title>{`${p.shardCount} shards · ${formatDuration(p.feedbackTimeMs)} · ${formatDuration(p.costMs)}`}</title>
          </circle>
        ))}

        {current ? (
          <g>
            <circle className="chart__point chart__point--current" cx={sx(xOf(current))} cy={sy(yOf(current))} r={7} />
            <text className="chart__marker-label" x={sx(xOf(current))} y={sy(yOf(current)) - 12} textAnchor="middle">
              current ({current.shardCount})
            </text>
          </g>
        ) : null}

        <g>
          <circle className="chart__point chart__point--recommended" cx={sx(xOf(recommended))} cy={sy(yOf(recommended))} r={7} />
          <text className="chart__marker-label" x={sx(xOf(recommended))} y={sy(yOf(recommended)) + 22} textAnchor="middle">
            recommended ({recommended.shardCount})
          </text>
        </g>
      </svg>

      {/* Table view for accessibility (the same data, screen-reader friendly). */}
      <table className="visually-hidden">
        <caption>Cost/time frontier by shard count</caption>
        <thead>
          <tr>
            <th scope="col">Shards</th>
            <th scope="col">Feedback time</th>
            <th scope="col">Billed cost</th>
          </tr>
        </thead>
        <tbody>
          {frontier.map((p) => (
            <tr key={p.shardCount}>
              <td>{p.shardCount}</td>
              <td>{formatDuration(p.feedbackTimeMs)}</td>
              <td>{formatDuration(p.costMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
