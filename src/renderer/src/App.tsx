import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Placeholder } from './pages/Placeholder';
import { applyTheme } from './theme';
import { useSettings } from './store/settings';

function PageView() {
  const page = useSettings((s) => s.page);
  switch (page) {
    case 'overview': return <Overview />;
    case 'profile': return <Profile />;
    case 'settings': return <Settings />;
    default: return <Placeholder page={page} />;
  }
}

export function App() {
  const page = useSettings((s) => s.page);
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);

  useEffect(() => applyTheme(theme, accent), [theme, accent]);

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="h-full"
        >
          <PageView />
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
