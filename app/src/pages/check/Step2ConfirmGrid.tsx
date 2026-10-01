import { useAppState } from '../../state/AppState';
import { TextField, DateField, NumberField } from '../../components/fields';
import type { BillLine } from '../../types/engine';

function newLineId(): string {
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyLine(): BillLine {
  return { id: newLineId(), description: '', amount: 0 };
}

export default function Step2ConfirmGrid({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { bill, setBill, warnings } = useAppState();

  const updateHeader = (patch: Partial<typeof bill.header>) => {
    setBill({ ...bill, header: { ...bill.header, ...patch }, confirmed: false });
  };

  const updateLine = (id: string, patch: Partial<BillLine>) => {
    setBill({
      ...bill,
      lines: bill.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      confirmed: false,
    });
  };

  const removeLine = (id: string) => {
    setBill({ ...bill, lines: bill.lines.filter((l) => l.id !== id), confirmed: false });
  };

  const addLine = () => {
    setBill({ ...bill, lines: [...bill.lines, emptyLine()], confirmed: false });
  };

  const confirmAndNext = () => {
    setBill({ ...bill, confirmed: true });
    onNext();
  };

  return (
    <div>
      {warnings.length > 0 && (
        <div className="banner banner--notice" role="status">
          <strong>Heads up</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Bill details</h2>
        <div className="form-grid form-grid--2">
          <TextField id="h-patient" label="Patient name" value={bill.header.patientName ?? ''} onChange={(v) => updateHeader({ patientName: v })} />
          <TextField id="h-provider" label="Provider / facility" value={bill.header.providerName ?? ''} onChange={(v) => updateHeader({ providerName: v })} />
          <TextField id="h-account" label="Account number" value={bill.header.accountNumber ?? ''} onChange={(v) => updateHeader({ accountNumber: v })} />
          <DateField id="h-statement" label="Statement date" value={bill.header.statementDate ?? ''} onChange={(v) => updateHeader({ statementDate: v })} />
          <DateField id="h-admit" label="Admit date" value={bill.header.admitDate ?? ''} onChange={(v) => updateHeader({ admitDate: v })} />
          <DateField id="h-discharge" label="Discharge date" value={bill.header.dischargeDate ?? ''} onChange={(v) => updateHeader({ dischargeDate: v })} />
          <NumberField id="h-total" label="Total charges" value={bill.header.totalCharges ?? ''} onChange={(v) => updateHeader({ totalCharges: v })} />
          <NumberField id="h-payments" label="Payments" value={bill.header.payments ?? ''} onChange={(v) => updateHeader({ payments: v })} />
          <NumberField id="h-adjustments" label="Adjustments" value={bill.header.adjustments ?? ''} onChange={(v) => updateHeader({ adjustments: v })} />
          <NumberField id="h-balance" label="Balance due" value={bill.header.balanceDue ?? ''} onChange={(v) => updateHeader({ balanceDue: v })} />
        </div>
      </div>

      <div className="card">
        <h2>Line items</h2>
        <p className="field__hint">Check every row against your paper or portal bill, then confirm below.</p>
        <div className="table-scroll">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Code</th>
                <th scope="col">Modifiers</th>
                <th scope="col">Rev</th>
                <th scope="col">NDC</th>
                <th scope="col">Description</th>
                <th scope="col">Qty</th>
                <th scope="col">Unit price</th>
                <th scope="col">Amount</th>
                <th scope="col">Didn't get this</th>
                <th scope="col">
                  <span className="visually-hidden">Remove line</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <label>
                      <span className="visually-hidden">Date</span>
                      <input
                        type="date"
                        value={line.date ?? ''}
                        onChange={(e) => updateLine(line.id, { date: e.target.value || undefined })}
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">Code</span>
                      <input
                        type="text"
                        value={line.code ?? ''}
                        onChange={(e) => updateLine(line.id, { code: e.target.value || undefined })}
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">Modifiers</span>
                      <input
                        type="text"
                        value={(line.modifiers ?? []).join(',')}
                        onChange={(e) =>
                          updateLine(line.id, {
                            modifiers: e.target.value
                              ? e.target.value
                                  .split(',')
                                  .map((m) => m.trim())
                                  .filter(Boolean)
                              : undefined,
                          })
                        }
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">Revenue code</span>
                      <input
                        type="text"
                        value={line.revCode ?? ''}
                        onChange={(e) => updateLine(line.id, { revCode: e.target.value || undefined })}
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">NDC</span>
                      <input
                        type="text"
                        value={line.ndc ?? ''}
                        onChange={(e) => updateLine(line.id, { ndc: e.target.value || undefined })}
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">Description</span>
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, { description: e.target.value })}
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">Quantity</span>
                      <input
                        type="number"
                        value={line.qty ?? ''}
                        onChange={(e) =>
                          updateLine(line.id, { qty: e.target.value === '' ? undefined : Number(e.target.value) })
                        }
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">Unit price</span>
                      <input
                        type="number"
                        step="0.01"
                        value={line.unitPrice ?? ''}
                        onChange={(e) =>
                          updateLine(line.id, {
                            unitPrice: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <span className="visually-hidden">Amount</span>
                      <input
                        type="number"
                        step="0.01"
                        value={line.amount}
                        onChange={(e) => updateLine(line.id, { amount: Number(e.target.value) || 0 })}
                      />
                    </label>
                  </td>
                  <td className="text-center">
                    <label>
                      <span className="visually-hidden">Didn't get this</span>
                      <input
                        type="checkbox"
                        checked={Boolean(line.notReceived)}
                        onChange={(e) => updateLine(line.id, { notReceived: e.target.checked || undefined })}
                      />
                    </label>
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => removeLine(line.id)}
                      aria-label={`Remove line: ${line.description || 'blank'}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {bill.lines.length === 0 && (
                <tr>
                  <td colSpan={11} className="field__hint">
                    No lines yet — paste text, upload a bill, or add a line below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn--secondary" onClick={addLine}>
          + Add line
        </button>
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn--primary" disabled={bill.lines.length === 0} onClick={confirmAndNext}>
          These lines look right
        </button>
      </div>
    </div>
  );
}
