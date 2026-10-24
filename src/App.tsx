import { useEffect, useState } from 'react';
import { TopBar } from './components/layout/TopBar';
import { ToolRail } from './components/layout/ToolRail';
import { Stage } from './canvas/Stage';
import { FloatingToolbar } from './components/layout/FloatingToolbar';
import { Inspector } from './components/layout/Inspector';
import { ObjectPropertiesPanel } from './components/layout/ObjectPropertiesPanel';
import { LayersPanel } from './components/layers/LayersPanel';
import { Toast } from './components/layout/Toast';
import { ThemeModal } from './components/ThemeModal';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { PrecisionObjectSizingDialog } from './components/framing/PrecisionObjectSizingDialog';
import { CropBar } from './components/crop/CropBar';
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
        {/* Canvas & Layout Panel (Left Panel, always accessible) */}
        <Inspector />

        {/* Top Horizontal Tool Ribbon (Excalidraw style) */}
        <ToolRail />

        {/* Floating Crop Studio Action Bar */}
        <CropBar />

        {/* Center 3-Layer Canvas Stage */}
        <Stage />

        {/* Right Sidebars: Layers (top) + Object/Image Properties (below, when selected) */}
        <div
          className="pointer-events-none absolute right-3 top-3 bottom-3 z-20 flex w-72 flex-col items-end gap-3"
          data-testid="right-sidebar-dock"
        >
          <LayersPanel />
          <ObjectPropertiesPanel />
        </div>

        {/* Floating Zoom & Fit Toolbar (Bottom Center) */}
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
