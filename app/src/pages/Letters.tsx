import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../state/AppState';
import { renderLetter, screen, fplPercent, LETTER_TITLES } from '@finecomb/engine';
import type { LetterId, LetterUser, L6Issue, NsaScenario } from '../types/engine';
import { TextField, SelectField } from '../components/fields';
import { Link } from '../router';

const ALL_IDS = Object.keys(LETTER_TITLES) as LetterId[];

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Letters() {
  const { bill, ctx, appData, ensureData, result, findingActions } = useAppState();
  const [templateId, setTemplateId] = useState<LetterId>('L2');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<LetterUser>({});

  useEffect(() => {
    void ensureData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedFindings = useMemo(
    () => (result?.findings ?? []).filter((f) => findingActions[f.id] === 'dispute'),
    [result, findingActions],
  );

  const autoUser = useMemo<LetterUser>(() => {
    if (!appData) return user;
    const screenResult = screen(ctx, appData.datasets, appData.fpl, appData.stateCharity);
    return {
      ...user,
      isNonprofit501r: user.isNonprofit501r ?? screenResult.hospital?.ownershipCategory === 'nonprofit',
      fplPercent: user.fplPercent ?? fplPercent(ctx, appData.fpl) ?? undefined,
      stateLawSentence:
        user.stateLawSentence ??
        (screenResult.stateScreen?.found
          ? screenResult.stateScreen.message + (screenResult.stateScreen.citation ? ` (${screenResult.stateScreen.citation})` : '')
          : undefined),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData, ctx, user]);

  const regenerate = () => {
    setText(renderLetter(templateId, { bill, ctx, findings: selectedFindings, user: autoUser }));
  };

  useEffect(() => {
    regenerate();
    // Regenerate only when the template changes, so hand-edits to the textarea aren't clobbered
    // by every keystroke in the fields below — use the "Regenerate" button for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const set = (patch: Partial<LetterUser>) => setUser((u) => ({ ...u, ...patch }));

  return (
    <div className="page page--wide">
      <h1>Dispute &amp; request letters</h1>
      <p className="field__hint">
        Everything here is generated and edited on this device — nothing is sent by the app. Mail
        it certified with a return receipt, or send through your patient portal, and keep a copy.
      </p>

      <div className="card">
        <SelectField
          id="letter-template"
          label="Template"
          value={templateId}
          onChange={(v) => { if (v) setTemplateId(v as LetterId); }}
          options={ALL_IDS.map((id) => ({ value: id, label: `${id} — ${LETTER_TITLES[id]}` }))}
          placeholder="Choose a template"
        />

        {templateId === 'L2' && (
          <p className="field__hint">
            {selectedFindings.length} finding(s) marked "Add to dispute letter" on your{' '}
            <Link to="/check/results">results page</Link> will be included below.
          </p>
        )}

        <h3>Your details</h3>
        <div className="form-grid form-grid--2">
          <TextField id="u-dob" label="Date of birth" value={user.patientDob ?? ''} onChange={(v) => set({ patientDob: v })} />
          <TextField id="u-address" label="Your mailing address" value={user.patientAddress ?? ''} onChange={(v) => set({ patientAddress: v })} />
          <TextField id="u-phone" label="Phone" value={user.phone ?? ''} onChange={(v) => set({ phone: v })} />
          <TextField id="u-email" label="Email" value={user.email ?? ''} onChange={(v) => set({ email: v })} />
          <TextField id="u-provider-address" label="Provider's billing address" value={user.providerBillingAddress ?? ''} onChange={(v) => set({ providerBillingAddress: v })} />
          <TextField id="u-member-id" label="Insurance member ID" value={user.memberId ?? ''} onChange={(v) => set({ memberId: v })} />
          <TextField id="u-group" label="Group number" value={user.groupNumber ?? ''} onChange={(v) => set({ groupNumber: v })} />
          <TextField id="u-claim" label="Claim number" value={user.claimNumber ?? ''} onChange={(v) => set({ claimNumber: v })} />
        </div>

        {templateId === 'L1' && (
          <TextField id="u-l1" label="State itemized-bill law sentence (optional)" value={user.stateItemizedLawSentence ?? ''} onChange={(v) => set({ stateItemizedLawSentence: v })} />
        )}
        {templateId === 'L2' && (
          <TextField id="u-l2" label="Specific records to request" value={user.recordsRequested ?? ''} onChange={(v) => set({ recordsRequested: v })} />
        )}
        {templateId === 'L3' && (
          <TextField id="u-l3" label="Enclosures (what you're attaching)" value={user.enclosures ?? ''} onChange={(v) => set({ enclosures: v })} />
        )}
        {templateId === 'L4' && (
          <div className="form-grid form-grid--2">
            <SelectField
              id="u-l4-scenario"
              label="Scenario (auto-detected if skipped)"
              value={user.scenario ?? ''}
              onChange={(v) => set({ scenario: (v as NsaScenario) || undefined })}
              options={[
                { value: 'emergency', label: 'Emergency care' },
                { value: 'ancillary_in_network_facility', label: 'Out-of-network clinician at in-network facility' },
                { value: 'air_ambulance', label: 'Air ambulance' },
              ]}
            />
            <TextField id="u-l4-facility" label="Facility name" value={user.facilityName ?? ''} onChange={(v) => set({ facilityName: v })} />
            <TextField id="u-l4-clinician" label="Clinician type" value={user.clinicianType ?? ''} onChange={(v) => set({ clinicianType: v })} />
          </div>
        )}
        {templateId === 'L5' && (
          <TextField id="u-l5-gfedate" label="Date you received the Good Faith Estimate" value={user.gfeDate ?? ''} onChange={(v) => set({ gfeDate: v })} />
        )}
        {templateId === 'L6' && (
          <div className="form-grid form-grid--2">
            <TextField id="u-l6-eobdate" label="EOB date" value={user.eobDate ?? ''} onChange={(v) => set({ eobDate: v })} />
            <SelectField
              id="u-l6-issue"
              label="Issue"
              value={user.issue ?? ''}
              onChange={(v) => set({ issue: (v as L6Issue) || undefined })}
              options={[
                { value: 'balance_exceeds_eob', label: 'Balance exceeds my EOB' },
                { value: 'provider_liability_billed', label: "Provider's responsibility billed to me" },
                { value: 'not_processed_in_network', label: 'Not processed in-network' },
                { value: 'wrong_member_info', label: 'Wrong member info' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <TextField id="u-l6-details" label="Explain the issue" value={user.issueDetails ?? ''} onChange={(v) => set({ issueDetails: v })} />
            <TextField id="u-l6-action" label="What you want the insurer to do" value={user.requestedAction ?? ''} onChange={(v) => set({ requestedAction: v })} />
          </div>
        )}
        {templateId === 'L7' && (
          <div className="form-grid form-grid--2">
            <TextField id="u-l7-format" label="Delivery format" value={user.format ?? ''} onChange={(v) => set({ format: v })} />
            <TextField id="u-l7-deliverto" label="Deliver to" value={user.deliverTo ?? ''} onChange={(v) => set({ deliverTo: v })} />
          </div>
        )}

        <div className="btn-row no-print">
          <button type="button" className="btn btn--primary" onClick={regenerate}>
            Regenerate from current answers
          </button>
        </div>
      </div>

      <div className="card">
        <label className="field" htmlFor="letter-text">
          <span className="field__label">Letter text (editable)</span>
          <textarea
            id="letter-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={24}
            style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.95rem' }}
          />
        </label>
        <div className="btn-row no-print">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
            Print / save PDF
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => downloadText(`finecomb-${templateId}.txt`, text)}
          >
            Download .txt
          </button>
        </div>
        <p className="field__hint">
          Never sent by the app, and never a "mailto:" link with this text — copy, print or
          download only. Send by certified mail with a return receipt, or your patient portal's
          message center, and save a copy. Write down the date you sent it.
        </p>
      </div>
    </div>
  );
}
