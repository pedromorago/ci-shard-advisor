import type { ChangeEvent } from 'react';

interface ReportInputProps {
  /** Called with the selected file's raw text and its name. */
  onSelect: (jsonText: string, fileName: string) => void;
  /** Called to restore the preloaded demo analysis. */
  onLoadDemo: () => void;
}

/** Read a File as text via FileReader (works in browsers and jsdom alike). */
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
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await readFileText(file);
    onSelect(text, file.name);
    // Reset so selecting the same file again still fires a change event.
    event.target.value = '';
  }

  return (
    <div className="report-input">
      <label className="report-input__file">
        <span>Upload a test report (Playwright, Cypress or JUnit XML)</span>
        <input
          type="file"
          accept="application/json,.json,application/xml,text/xml,.xml"
          onChange={handleChange}
        />
      </label>
      <button type="button" className="report-input__demo" onClick={onLoadDemo}>
        Load demo
      </button>
      <p className="report-input__note">
        Processed entirely in your browser — your report is never uploaded.
      </p>
    </div>
  );
}
