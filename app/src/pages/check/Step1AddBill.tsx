import { useState } from 'react';
import { useAppState } from '../../state/AppState';
import { ingest } from '../../ingest';

export default function Step1AddBill({ onNext }: { onNext: () => void }) {
  const { setBill, setWarnings } = useAppState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const runIngest = async (input: { text?: string; files?: File[] }) => {
    setBusy(true);
    try {
      const result = await ingest(input);
      setBill(result.bill);
      setWarnings(result.warnings);
      onNext();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Paste your bill</h2>
        <p className="field__hint">
          Copy the line items from an online bill or patient portal and paste them below. One
          charge per line.
        </p>
        <label className="field" htmlFor="bill-text">
          <span className="field__label">Bill text</span>
          <textarea
            id="bill-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'09/12/2026, Emergency room visit, 1250.00\n09/12/2026, CT scan head, 3400.00'}
          />
        </label>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || text.trim().length === 0}
          onClick={() => void runIngest({ text })}
        >
          Use this text
        </button>
      </div>

      <div className="card">
        <h2>Upload a PDF or photo</h2>
        <p className="field__hint">
          PDF text extraction and photo OCR run locally in your browser — self-hosted, no CDN,
          nothing uploaded.
        </p>
        <label className="field" htmlFor="bill-files">
          <span className="field__label">PDF or photo</span>
          <input
            id="bill-files"
            type="file"
            accept="application/pdf,image/*"
            multiple
            disabled={busy}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length > 0) void runIngest({ files });
            }}
          />
        </label>
      </div>

      <div className="card">
        <h2>Enter it by hand</h2>
        <p className="field__hint">Skip straight to the grid and add lines one at a time.</p>
        <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => void runIngest({})}>
          Enter manually
        </button>
      </div>
    </div>
  );
}
