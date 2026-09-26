import { act, renderHook } from '@testing-library/react';
import type { AdvisorResult } from '@ci-shard-advisor/core';
import { DEFAULT_SETTINGS } from './analysis';
import type { AnalysisSettings } from './analysis';
import type { AnalysisReply, AnalysisRequest } from './analysis.worker';
import { DEMO_REPORTS } from './demo';
import { useAnalysis } from './useAnalysis';

/** Stands in for the Web Worker jsdom lacks: records requests, replies on demand. */
class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: MessageEvent<AnalysisReply>) => void) | null = null;
  posted: AnalysisRequest[] = [];
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(request: AnalysisRequest) {
    this.posted.push(request);
  }
  terminate() {}
  reply(reply: AnalysisReply) {
    act(() => this.onmessage?.({ data: reply } as MessageEvent<AnalysisReply>));
  }
}

/** The hook passes results through untouched, so a marker object is enough. */
const resultFor = (label: string) => ({ label }) as unknown as AdvisorResult;
const at = (pricePerMinute: number): AnalysisSettings => ({ ...DEFAULT_SETTINGS, pricePerMinute });

function renderAnalysis() {
  return renderHook(({ settings }) => useAnalysis(DEMO_REPORTS, settings), {
    initialProps: { settings: DEFAULT_SETTINGS },
  });
}

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a first result at once, then analyzes changes in the worker', () => {
    const { result, rerender } = renderAnalysis();
    const first = result.current.result;
    expect(first.tasks.length).toBeGreaterThan(0);
    expect(result.current.updating).toBe(false);

    const dearer = at(0.02);
    rerender({ settings: dearer });

    // The old result stays on screen, flagged, while the worker runs.
    expect(result.current.updating).toBe(true);
    expect(result.current.result).toBe(first);
    const [request] = FakeWorker.last.posted;
    expect(request.settings).toBe(dearer);

    FakeWorker.last.reply({ id: request.id, result: resultFor('dearer') });
    expect(result.current.updating).toBe(false);
    expect(result.current.result).toEqual(resultFor('dearer'));
    expect(result.current.settings).toBe(dearer);
  });

  it('runs one analysis at a time and coalesces the changes made meanwhile', () => {
    const { result, rerender } = renderAnalysis();
    rerender({ settings: at(0.02) });
    rerender({ settings: at(0.03) });
    const latest = at(0.04);
    rerender({ settings: latest });

    // Typing three prices sent one request; the other two wait as a single run.
    expect(FakeWorker.last.posted).toHaveLength(1);

    FakeWorker.last.reply({ id: FakeWorker.last.posted[0].id, result: resultFor('0.02') });
    expect(FakeWorker.last.posted).toHaveLength(2);
    expect(FakeWorker.last.posted[1].settings).toBe(latest);
    expect(result.current.updating).toBe(true);

    FakeWorker.last.reply({ id: FakeWorker.last.posted[1].id, result: resultFor('0.04') });
    expect(result.current.updating).toBe(false);
    expect(result.current.result).toEqual(resultFor('0.04'));
    expect(result.current.settings).toBe(latest);
  });

  it('ignores a reply that no request is waiting for', () => {
    const { result, rerender } = renderAnalysis();
    rerender({ settings: at(0.02) });
    const [request] = FakeWorker.last.posted;

    FakeWorker.last.reply({ id: request.id + 1, result: resultFor('stray') });

    expect(result.current.updating).toBe(true);
    expect(result.current.result).not.toEqual(resultFor('stray'));
  });
});
