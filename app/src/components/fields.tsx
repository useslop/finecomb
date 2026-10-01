// Small controlled-input wrappers so form pages (Step2, Step3) stay readable. Every field is
// optional by construction — callers pass `undefined` through onChange freely — matching
// docs/SPEC.md §2 step 4: "each [context question] is skippable."

interface BaseProps {
  id: string;
  label: string;
  hint?: string;
}

export function TextField({
  id,
  label,
  hint,
  value,
  onChange,
}: BaseProps & { value: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value || undefined)} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function DateField({
  id,
  label,
  hint,
  value,
  onChange,
}: BaseProps & { value: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value || undefined)} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: BaseProps & { value: number | ''; onChange: (v: number | undefined) => void }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <input
        id={id}
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="checkbox-row">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function SelectField({
  id,
  label,
  hint,
  value,
  onChange,
  options,
  placeholder = 'Skip / not sure',
}: BaseProps & {
  value: string;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
