import type { ChangeEvent } from 'react';
import type { ReportFile } from '@ci-shard-advisor/core';

interface ReportInputProps {
  /** Called with every selected file (one per shard, or a single merged one). */
  onSelect: (reports: ReportFile[]) => void;
  /** Called to restore the preloaded demo. */
  onLoadDemo: () => void;
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

export function ReportInput({ onSelect, onLoadDemo }: ReportInputProps) {
  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const reports = await Promise.all(
      files.map(async (file) => ({ name: file.name, content: await readFileText(file) })),
    );
    onSelect(reports);
    event.target.value = '';
  }

  return (
    <div className="report-input">
      <label className="report-input__file">
        <span>Upload your shard reports (one per shard, or a merged one)</span>
        <input
          type="file"
          multiple
          accept="application/json,.json,application/xml,text/xml,.xml"
          onChange={handleChange}
        />
      </label>
      <button type="button" className="report-input__demo" onClick={onLoadDemo}>
        Load demo
      </button>
      <p className="report-input__note">
        Processed entirely in your browser — your reports are never uploaded.
      </p>
    </div>
  );
}
