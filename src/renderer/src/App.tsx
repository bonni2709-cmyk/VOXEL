import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Placeholder } from './pages/Placeholder';
import { applyTheme } from './theme';
import { useSettings } from './store/settings';
import { subscribeLauncherEvents, useLauncher } from './store/launcher';
import { Versions } from './pages/Versions';
import { Downloads } from './pages/Downloads';
import { Console } from './pages/Console';
import { JavaManager } from './pages/JavaManager';
import { Worlds } from './pages/Worlds';
import { Gallery } from './pages/Gallery';
import { Mods } from './pages/Mods';
import { Modpacks } from './pages/Modpacks';
import { Server } from './pages/Server';
import { SkinStudio } from './pages/SkinStudio';

function PageView() {
  const page = useSettings((s) => s.page);
  switch (page) {
    case 'overview': return <Overview />;
    case 'profile': return <Profile />;
    case 'settings': return <Settings />;
    case 'versions': return <Versions />;
    case 'downloads': return <Downloads />;
    case 'console': return <Console />;
    case 'java': return <JavaManager />;
    case 'worlds': return <Worlds />;
    case 'gallery': return <Gallery />;
    case 'mods': return <Mods />;
    case 'modpacks': return <Modpacks />;
    case 'server': return <Server />;
    case 'skins': return <SkinStudio />;
    default: return <Placeholder page={page} />;
  }
}

export function App() {
  const page = useSettings((s) => s.page);
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);

  useEffect(() => applyTheme(theme, accent), [theme, accent]);

  const proxy = useSettings((s) => s.proxy);
  const mirror = useSettings((s) => s.mirror);
  useEffect(() => {
    void window.voxel.shield.set({ proxy, mirror });
  }, [proxy, mirror]);

  useEffect(() => {
    const off = subscribeLauncherEvents();
    void useLauncher.getState().refreshInstalled();
    return off;
  }, []);

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
