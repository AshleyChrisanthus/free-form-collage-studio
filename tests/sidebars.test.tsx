// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inspector } from '../src/components/layout/Inspector';
import { ObjectPropertiesPanel } from '../src/components/layout/ObjectPropertiesPanel';
import { LayersPanel } from '../src/components/layers/LayersPanel';
import { useSceneStore } from '../src/store/sceneStore';
import type { ImageObject } from '../src/types/scene';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sampleImg: ImageObject = {
  id: 'img-sidebar-1',
  type: 'image',
  assetId: 'asset-sidebar-1',
  x: 10,
  y: 20,
  width: 300,
  height: 200,
  origWidth: 300,
  origHeight: 200,
  mimeType: 'image/png',
  groupId: null,
  opacity: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
};

describe('Left Canvas & Layout + Right Layers & Object Properties Sidebars (#44)', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const store = useSceneStore.getState();
    store.resetScene();
    store.toggleCanvas(true);
    store.toggleLayers(true);
    store.toggleProperties(true);

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <div>
          <div data-testid="left-dock">
            <Inspector />
          </div>
          <div data-testid="right-dock">
            <LayersPanel />
            <ObjectPropertiesPanel />
          </div>
        </div>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('keeps Canvas & Layout accessible on the left even when an image is selected', () => {
    const leftDock = host.querySelector('[data-testid="left-dock"]')!;
    const rightDock = host.querySelector('[data-testid="right-dock"]')!;

    // Initially no object selected: Canvas & Layout on left, Layers on right, no Properties panel
    expect(leftDock.querySelector('aside')?.getAttribute('aria-label')).toBe('Canvas & Layout');
    expect(rightDock.querySelector('aside[aria-label="Layers Panel"]')).toBeTruthy();
    expect(rightDock.querySelector('aside[aria-label="Properties Inspector"]')).toBeNull();

    // Add and select an image
    act(() => {
      useSceneStore.getState().addObject(sampleImg);
    });

    // Left still shows Canvas & Layout!
    expect(leftDock.querySelector('aside')?.getAttribute('aria-label')).toBe('Canvas & Layout');
    expect(leftDock.textContent).toContain('Export & Spacing');

    // Right shows both Layers (first) and Image Properties (second, just below Layers)
    const rightPanels = rightDock.querySelectorAll('aside');
    expect(rightPanels.length).toBe(2);
    expect(rightPanels[0].getAttribute('aria-label')).toBe('Layers Panel');
    expect(rightPanels[1].getAttribute('aria-label')).toBe('Properties Inspector');
    expect(rightPanels[1].textContent).toContain('Image Properties');
  });

  it('allows toggling Layers and Image Properties independently on the right side', () => {
    act(() => {
      useSceneStore.getState().addObject(sampleImg);
    });

    const rightDock = host.querySelector('[data-testid="right-dock"]')!;

    // Collapse Layers panel -> Image Properties remains open
    const collapseLayersBtn = rightDock.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Layers Panel"]'
    )!;
    act(() => collapseLayersBtn.click());

    expect(rightDock.querySelector('aside[aria-label="Layers Panel"]')).toBeNull();
    expect(rightDock.querySelector('button[aria-label="Open Layers Panel"]')).toBeTruthy();
    expect(rightDock.querySelector('aside[aria-label="Properties Inspector"]')).toBeTruthy();

    // Collapse Image Properties panel -> both show reopen buttons
    const collapsePropsBtn = rightDock.querySelector<HTMLButtonElement>(
      'button[aria-label="Collapse Properties Panel"]'
    )!;
    act(() => collapsePropsBtn.click());

    expect(rightDock.querySelector('aside[aria-label="Properties Inspector"]')).toBeNull();
    expect(rightDock.querySelector('button[aria-label="Open Properties Inspector"]')).toBeTruthy();

    // Reopen Layers panel -> Layers opens while Properties stays collapsed
    const openLayersBtn = rightDock.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Layers Panel"]'
    )!;
    act(() => openLayersBtn.click());

    expect(rightDock.querySelector('aside[aria-label="Layers Panel"]')).toBeTruthy();
    expect(rightDock.querySelector('aside[aria-label="Properties Inspector"]')).toBeNull();

    // Reopen Image Properties panel -> both open again
    const openPropsBtn = rightDock.querySelector<HTMLButtonElement>(
      'button[aria-label="Open Properties Inspector"]'
    )!;
    act(() => openPropsBtn.click());

    expect(rightDock.querySelector('aside[aria-label="Layers Panel"]')).toBeTruthy();
    expect(rightDock.querySelector('aside[aria-label="Properties Inspector"]')).toBeTruthy();
  });

  it('allows toggling Canvas & Layout on the left independently of right panels', () => {
    act(() => {
      useSceneStore.getState().addObject(sampleImg);
    });

    const leftDock = host.querySelector('[data-testid="left-dock"]')!;
    const rightDock = host.querySelector('[data-testid="right-dock"]')!;
    const collapseCanvasBtn = Array.from(leftDock.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Collapse Canvas & Layout'
    )!;
    expect(collapseCanvasBtn).toBeTruthy();
    act(() => collapseCanvasBtn.click());

    expect(leftDock.querySelector('aside')).toBeNull();
    // Right panels remain open while left is collapsed
    expect(rightDock.querySelectorAll('aside').length).toBe(2);

    const openCanvasBtn = Array.from(leftDock.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Open Canvas & Layout'
    )!;
    expect(openCanvasBtn).toBeTruthy();

    act(() => openCanvasBtn.click());
    expect(leftDock.querySelector('aside')?.getAttribute('aria-label')).toBe('Canvas & Layout');
  });
});
