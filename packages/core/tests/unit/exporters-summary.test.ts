import { describe, expect, it } from 'vitest';
import { formatDuration, formatSignedDuration } from '../../src/exporters/summary';

describe('formatDuration', () => {
  it('renders sub-minute durations as seconds with one decimal', () => {
    expect(formatDuration(0)).toBe('0.0s');
    expect(formatDuration(5100)).toBe('5.1s');
    expect(formatDuration(59900)).toBe('59.9s');
  });

  it('renders longer durations as minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(244400)).toBe('4m 4s');
  });

  it('carries rounded-up seconds into the minute (never "1m 60s" or "60.0s")', () => {
    expect(formatDuration(119600)).toBe('2m 0s');
    expect(formatDuration(179700)).toBe('3m 0s');
    expect(formatDuration(59960)).toBe('1m 0s');
  });

  it('formatSignedDuration keeps an explicit sign', () => {
    expect(formatSignedDuration(5000)).toBe('+5.0s');
    expect(formatSignedDuration(-60000)).toBe('-1m 0s');
  });
});
