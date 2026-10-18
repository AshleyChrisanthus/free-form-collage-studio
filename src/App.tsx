import { useEffect, useState } from 'react';
import { TopBar } from './components/layout/TopBar';
import { ToolRail } from './components/layout/ToolRail';
import { Stage } from './canvas/Stage';
import { FloatingToolbar } from './components/layout/FloatingToolbar';
import { Inspector } from './components/layout/Inspector';
import { LayersPanel } from './components/layers/LayersPanel';
import { Toast } from './components/layout/Toast';
import { ThemeModal } from './components/ThemeModal';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { PrecisionObjectSizingDialog } from './components/framing/PrecisionObjectSizingDialog';
import { handleGlobalKeyDown } from './input/shortcuts';
import { useVariantStore } from './store/variantStore';

export default function App() {
  const [themeOpen, setThemeOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const hydrateVariants = useVariantStore((state) => state.hydrate);

  useEffect(() => {
    void hydrateVariants();
  }, [hydrateVariants]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      handleGlobalKeyDown(e, () => setShortcutsOpen(true));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-backdrop relative flex h-full flex-col overflow-hidden text-fg">
      {/* Top Bar */}
      <TopBar
        onOpenTheme={() => setThemeOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Main Studio Workspace Stage */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* Left Tool Rail */}
        <ToolRail />

        {/* Collapsible Layers Panel */}
        <LayersPanel />

        {/* Center 3-Layer Canvas Stage */}
        <Stage />

        {/* Right Properties Inspector */}
        <Inspector />

        {/* Floating Zoom & Fit Toolbar */}
        <FloatingToolbar />
      </main>

      {/* Global Notifications Toast */}
      <Toast />

      {/* Modals */}
      <ThemeModal isOpen={themeOpen} onClose={() => setThemeOpen(false)} />
      <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <PrecisionObjectSizingDialog />
    </div>
  );
}
