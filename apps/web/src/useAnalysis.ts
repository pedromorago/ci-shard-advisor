import { useEffect, useRef, useState } from 'react';
import type { AdvisorResult, ReportFile } from '@ci-shard-advisor/core';
import { adviseFrom } from './analysis';
import type { AnalysisSettings } from './analysis';
import type { AnalysisReply, AnalysisRequest } from './analysis.worker';

interface Inputs {
  reports: ReportFile[];
  settings: AnalysisSettings;
}

/**
 * The advisor's result for these reports and settings. A real suite takes the
 * engine a few hundred milliseconds, so the analysis runs in a Web Worker: the
 * page keeps responding while it works, and the previous result stays on
 * screen, flagged as `updating`, until the new one arrives. One analysis runs
 * at a time; inputs that change meanwhile are coalesced into the next one, so
 * typing a number never queues a run per keystroke.
 *
 * The first result is computed in place, so the page never renders empty.
 * Where there is no Worker (jsdom, in the component tests), every result is.
 * The returned `settings` are the ones the shown result was computed with, so
 * money is always formatted at the price behind the numbers.
 */
export function useAnalysis(reports: ReportFile[], settings: AnalysisSettings) {
  const inPlace = typeof Worker === 'undefined';
  const [analyzed, setAnalyzed] = useState<Inputs & { result: AdvisorResult }>(() => ({
    reports,
    settings,
    result: adviseFrom(reports, settings),
  }));
  const updating = analyzed.reports !== reports || analyzed.settings !== settings;

  // Without a worker, catch up during render (the store-previous-value idiom).
  if (inPlace && updating) {
    setAnalyzed({ reports, settings, result: adviseFrom(reports, settings) });
  }

  // Hands inputs to the worker: at once when it is idle, as the next run when not.
  const analyze = useRef<((inputs: Inputs) => void) | null>(null);

  useEffect(() => {
    if (inPlace) return;
    const instance = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    let lastId = 0;
    let inFlight: AnalysisRequest | null = null;
    let next: Inputs | null = null;
    const post = (inputs: Inputs) => {
      inFlight = { id: ++lastId, ...inputs };
      instance.postMessage(inFlight);
    };
    analyze.current = (inputs) => {
      if (inFlight) next = inputs;
      else post(inputs);
    };
    instance.onmessage = ({ data }: MessageEvent<AnalysisReply>) => {
      const request = inFlight;
      if (!request || request.id !== data.id) return;
      inFlight = null;
      if ('result' in data) {
        setAnalyzed({ reports: request.reports, settings: request.settings, result: data.result });
      } else {
        // Uploads are validated before they get here, so this is a bug: keep
        // the last good result on screen and say why in the console.
        console.error(`CI Shard Advisor: the analysis failed: ${data.error}`);
        setAnalyzed((last) => ({ ...last, reports: request.reports, settings: request.settings }));
      }
      if (next) {
        post(next);
        next = null;
      }
    };
    return () => {
      instance.terminate();
      analyze.current = null;
    };
  }, [inPlace]);

  useEffect(() => {
    if (updating) analyze.current?.({ reports, settings });
  }, [updating, reports, settings]);

  return { result: analyzed.result, settings: analyzed.settings, updating };
}
