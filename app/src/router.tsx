import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// A deliberately tiny router: every route in this app is a static path (no params), and bill
// data must never live in the URL (docs/SPEC.md §5), so a plain pathname -> element lookup is
// all that's needed. Avoids pulling in react-router-dom's weight for v1's budget (SPEC §7).

interface RouterValue {
  path: string;
  navigate: (to: string) => void;
}

const RouterCtx = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to);
    }
    setPath(to);
    window.scrollTo(0, 0);
  }, []);

  return <RouterCtx.Provider value={{ path, navigate }}>{children}</RouterCtx.Provider>;
}

function useRouter(): RouterValue {
  const ctx = useContext(RouterCtx);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}

export function useNavigate(): (to: string) => void {
  return useRouter().navigate;
}

export function usePath(): string {
  return useRouter().path;
}

export function Link({
  to,
  children,
  className,
  'aria-current': ariaCurrent,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  'aria-current'?: 'page';
}) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      aria-current={ariaCurrent}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Routes({ routes, fallback }: { routes: Record<string, ReactNode>; fallback: ReactNode }) {
  const path = usePath();
  return <>{routes[path] ?? fallback}</>;
}
