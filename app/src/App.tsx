import { RouterProvider, Link, Routes, usePath } from './router';
import { AppStateProvider } from './state/AppState';
import Landing from './pages/Landing';
import CheckPage from './pages/check/CheckPage';
import Results from './pages/Results';
import Letters from './pages/Letters';
import Help from './pages/Help';
import Rights from './pages/Rights';
import Accuracy from './pages/Accuracy';
import Privacy from './pages/Privacy';

const NAV_LINKS: [string, string][] = [
  ['/check', 'Check a bill'],
  ['/letters', 'Letters'],
  ['/help', 'Charity & assistance'],
  ['/rights', 'Know your rights'],
  ['/accuracy', 'Accuracy'],
  ['/privacy', 'Privacy'],
];

function NavBar() {
  const path = usePath();
  return (
    <header className="nav no-print">
      <div className="nav__inner">
        <Link to="/" className="nav__brand">
          Finecomb
        </Link>
        <ul className="nav__links">
          {NAV_LINKS.map(([to, label]) => (
            <li key={to}>
              <Link to={to} aria-current={path === to ? 'page' : undefined}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer no-print">
      Finecomb is consumer information, not legal, medical or financial advice. Your bill never
      leaves your device. <Link to="/privacy">See the proof</Link>.
    </footer>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to Finecomb home</Link>
      </p>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes
      routes={{
        '/': <Landing />,
        '/check': <CheckPage />,
        '/check/results': <Results />,
        '/letters': <Letters />,
        '/help': <Help />,
        '/rights': <Rights />,
        '/accuracy': <Accuracy />,
        '/privacy': <Privacy />,
      }}
      fallback={<NotFound />}
    />
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppStateProvider>
        <div className="app-shell">
          <NavBar />
          <main>
            <AppRoutes />
          </main>
          <Footer />
        </div>
      </AppStateProvider>
    </RouterProvider>
  );
}
