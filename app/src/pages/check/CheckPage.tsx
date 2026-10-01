import { useState } from 'react';
import { useNavigate } from '../../router';
import { useAppState } from '../../state/AppState';
import Step1AddBill from './Step1AddBill';
import Step2ConfirmGrid from './Step2ConfirmGrid';
import Step3Context from './Step3Context';

const STEP_LABELS = ['Add bill', 'Check lines', 'Context'];

export default function CheckPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { runAnalysis } = useAppState();
  const navigate = useNavigate();

  const handleFinish = async () => {
    await runAnalysis();
    navigate('/check/results');
  };

  return (
    <div className="page">
      <h1>Check your bill</h1>
      <ol className="steps" aria-label="Progress">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const cls =
            n === step
              ? 'steps__item steps__item--active'
              : n < step
                ? 'steps__item steps__item--done'
                : 'steps__item';
          return (
            <li key={label} className={cls} aria-current={n === step ? 'step' : undefined}>
              {n}. {label}
            </li>
          );
        })}
      </ol>

      {step === 1 && <Step1AddBill onNext={() => setStep(2)} />}
      {step === 2 && <Step2ConfirmGrid onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && <Step3Context onBack={() => setStep(2)} onFinish={handleFinish} />}
    </div>
  );
}
