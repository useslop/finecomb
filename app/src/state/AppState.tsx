import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AnalyzeResult, Bill, Context as EngineContext, Datasets } from '../types/engine';
import { analyze } from '../lib/analyze';
import { applyShipPolicy } from '../lib/shipPolicy';
import { loadAppData } from '../data';
import type { AppData } from '../data';

// The single source of truth for a check-in-progress. Everything lives in memory only —
// never in the URL, never in storage (docs/SPEC.md §5) — so a hard reload intentionally
// loses it. Pages that need it after a reload (e.g. /check/results) show a "start over" state.

function emptyBill(): Bill {
  return { header: {}, lines: [], confirmed: false };
}

/** The user's own calendar day. toISOString() is UTC, so after 8 pm in New York it was already tomorrow. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type FindingAction = 'dispute' | 'dismissed';

interface AppStateValue {
  bill: Bill;
  setBill: (bill: Bill) => void;
  ctx: EngineContext;
  setCtx: (patch: Partial<EngineContext>) => void;
  warnings: string[];
  setWarnings: (w: string[]) => void;
  appData: AppData | null;
  dataLoading: boolean;
  dataError: string | null;
  ensureData: () => Promise<AppData | null>;
  result: AnalyzeResult | null;
  runAnalysis: () => Promise<void>;
  findingActions: Record<string, FindingAction>;
  setFindingAction: (id: string, action: FindingAction) => void;
  resetCheck: () => void;
}

const AppStateCtx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [bill, setBill] = useState<Bill>(emptyBill);
  const [ctx, setCtxState] = useState<EngineContext>(() => ({ today: todayIso() }));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [findingActions, setFindingActions] = useState<Record<string, FindingAction>>({});
  const loadPromise = useRef<Promise<AppData | null> | null>(null);

  const ensureData = async (): Promise<AppData | null> => {
    if (appData) return appData;
    if (!loadPromise.current) {
      setDataLoading(true);
      setDataError(null);
      loadPromise.current = loadAppData()
        .then((d) => {
          setAppData(d);
          return d;
        })
        .catch((err: unknown) => {
          setDataError(err instanceof Error ? err.message : 'Failed to load reference data.');
          return null;
        })
        .finally(() => setDataLoading(false));
    }
    return loadPromise.current;
  };

  const setCtx = (patch: Partial<EngineContext>) => setCtxState((prev) => ({ ...prev, ...patch }));

  const runAnalysis = async () => {
    const data = await ensureData();
    const datasets: Datasets = data?.datasets ?? {};
    // The scoreboard's ship policy gates every finding the user (and the letters page) can see.
    setResult(applyShipPolicy(analyze(bill, ctx, datasets)));
  };

  const setFindingAction = (id: string, action: FindingAction) =>
    setFindingActions((prev) => ({ ...prev, [id]: action }));

  const resetCheck = () => {
    setBill(emptyBill());
    setCtxState({ today: todayIso() });
    setWarnings([]);
    setResult(null);
    setFindingActions({});
  };

  const value = useMemo<AppStateValue>(
    () => ({
      bill,
      setBill,
      ctx,
      setCtx,
      warnings,
      setWarnings,
      appData,
      dataLoading,
      dataError,
      ensureData,
      result,
      runAnalysis,
      findingActions,
      setFindingAction,
      resetCheck,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bill, ctx, warnings, appData, dataLoading, dataError, result, findingActions],
  );

  return <AppStateCtx.Provider value={value}>{children}</AppStateCtx.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
