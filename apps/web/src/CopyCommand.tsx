import { useEffect, useRef, useState } from 'react';

interface CopyCommandProps {
  command: string;
  /** The button's accessible name: "Copy the command for container 2". */
  label: string;
}

type CopyStatus = 'idle' | 'copied' | 'selected';

const ANNOUNCEMENT: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Copied to the clipboard',
  selected: 'Selected: press Ctrl+C or ⌘C to copy',
};

/**
 * One per-container command with its Copy button (spec §8). The text goes to
 * the clipboard exactly as shown; where the browser refuses, the command is
 * selected so it can be copied by hand. A live region announces either outcome.
 */
export function CopyCommand({ command, label }: CopyCommandProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<CopyStatus>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus('copied');
    } catch {
      if (codeRef.current) window.getSelection()?.selectAllChildren(codeRef.current);
      setStatus('selected');
    }
  }

  return (
    <div className="move__command">
      <code ref={codeRef} className="move__apply">
        {command}
      </code>
      <button type="button" className="copy-btn" aria-label={label} onClick={copy}>
        {status === 'copied' ? 'Copied' : 'Copy'}
      </button>
      <span role="status" className="visually-hidden">
        {ANNOUNCEMENT[status]}
      </span>
    </div>
  );
}
