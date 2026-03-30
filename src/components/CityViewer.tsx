'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';
import { MiniMap } from '@/components/game/MiniMap';
import { RepoFile } from '@/lib/github-api';

interface CityViewerProps {
  repoName: string;
  fileCount: number;
  dirCount: number;
  buildingPositions: Map<string, { x: number; y: number }>;
  files: RepoFile[];
  onExit?: () => void;
}

export default function CityViewer({ repoName, fileCount, dirCount, buildingPositions, files, onExit }: CityViewerProps) {
  const { state, updateGrid } = useGame();
  const [buildCount, setBuildCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ file: RepoFile | null; buildingType: string; x: number; y: number } | null>(null);
  const cityContainerRef = useRef<HTMLDivElement>(null);
  const center = Math.floor(state.gridSize / 2);
  const hasNavigated = useRef(false);
  const hasBuildAnimated = useRef(false);
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNavigated.current) {
      hasNavigated.current = true;
      setTimeout(() => {
        setNavigationTarget({ x: center, y: center });
      }, 100);
    }
  }, [center]);

  // Staggered build animation: construction -> finished building
  // Buildings start at constructionProgress: 0 (from city-generator), showing construction sprites.
  // Each building is revealed one by one, then its constructionProgress animates 0 -> 100.
  // All updates go through updateGrid to trigger proper React state changes.
  useEffect(() => {
    if (hasBuildAnimated.current) return;
    if (buildingPositions.size === 0) return;
    hasBuildAnimated.current = true;

    const entries = [...buildingPositions.entries()];
    const totalBuildings = entries.length;
    // Adaptive stagger delay: cap total reveal at ~3s
    const staggerDelay = Math.max(15, Math.min(80, 3000 / totalBuildings));
    // Construction animation: ~1.5s per building (runs concurrently after reveal)
    const constructionDuration = 1500;
    const constructionTickInterval = 60; // ms between progress updates
    const progressPerTick = (100 / constructionDuration) * constructionTickInterval;

    // Save the real building data and hide all buildings via a single state update
    const savedBuildings = new Map<string, { type: string; level: number; zone: string }>();
    updateGrid((grid) => {
      const newGrid = grid.map(row => row.map(tile => ({ ...tile })));
      for (const [, pos] of entries) {
        const tile = newGrid[pos.y]?.[pos.x];
        if (tile && tile.building.type !== 'empty' && tile.building.type !== 'road' && tile.building.type !== 'water' && tile.building.type !== 'grass') {
          savedBuildings.set(`${pos.x},${pos.y}`, { type: tile.building.type, level: tile.building.level, zone: tile.zone });
          newGrid[pos.y][pos.x] = { ...tile, building: { ...tile.building, type: 'empty' as any, level: 0, constructionProgress: 0 }, zone: 'none' };
        }
      }
      return newGrid;
    });

    let revealed = 0;
    // Track progress per building for construction animation
    const progressMap = new Map<string, number>();
    const timers: ReturnType<typeof setInterval>[] = [];

    // Progressively reveal buildings, then animate their construction
    const revealInterval = setInterval(() => {
      if (revealed >= totalBuildings) {
        clearInterval(revealInterval);
        return;
      }

      const [, pos] = entries[revealed];
      const key = `${pos.x},${pos.y}`;
      const saved = savedBuildings.get(key);
      if (saved) {
        // Reveal the building with constructionProgress: 0 (shows construction sprite)
        progressMap.set(key, 0);
        updateGrid((grid) => {
          const newGrid = grid.map(row => [...row]);
          const tile = newGrid[pos.y]?.[pos.x];
          if (tile) {
            newGrid[pos.y][pos.x] = {
              ...tile,
              zone: saved.zone as any,
              building: { ...tile.building, type: saved.type as any, level: saved.level, constructionProgress: 0 },
            };
          }
          return newGrid;
        });

        // Start animating constructionProgress 0 -> 100
        const constructionTimer = setInterval(() => {
          const currentProgress = progressMap.get(key) ?? 0;
          const newProgress = Math.min(100, currentProgress + progressPerTick);
          progressMap.set(key, newProgress);

          updateGrid((grid) => {
            const newGrid = grid.map(row => [...row]);
            const t = newGrid[pos.y]?.[pos.x];
            if (!t) return grid;
            newGrid[pos.y][pos.x] = { ...t, building: { ...t.building, constructionProgress: newProgress } };
            return newGrid;
          });

          if (newProgress >= 100) {
            clearInterval(constructionTimer);
            progressMap.delete(key);
          }
        }, constructionTickInterval);
        timers.push(constructionTimer);
      }

      revealed++;
      setBuildCount(revealed);
    }, staggerDelay);

    timers.push(revealInterval);

    return () => {
      for (const timer of timers) clearInterval(timer);
    };
  }, [buildingPositions, updateGrid]);

  const handleScreenshot = useCallback(() => {
    const container = cityContainerRef.current;
    if (!container) return;

    const canvases = container.querySelectorAll('canvas');
    if (canvases.length === 0) return;

    const first = canvases[0];
    const width = first.width;
    const height = first.height;

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Dark background
    ctx.fillStyle = '#0f1219';
    ctx.fillRect(0, 0, width, height);

    // Composite all canvas layers in order
    for (const canvas of canvases) {
      ctx.drawImage(canvas, 0, 0);
    }

    // Download
    const link = document.createElement('a');
    link.download = `${repoName.replace('/', '-')}-gitcity.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  }, [repoName]);

  // Look up file info for a selected tile
  const getFileForTile = useCallback((x: number, y: number): RepoFile | null => {
    for (const [path, pos] of buildingPositions.entries()) {
      if (pos.x === x && pos.y === y) {
        return files.find(f => f.path === path) || null;
      }
    }
    return null;
  }, [buildingPositions, files]);

  return (
    <TooltipProvider>
      <div className="w-full h-full overflow-hidden bg-background flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-white/10 z-10">
          <div className="flex items-center gap-4">
            {onExit && (
              <button
                onClick={onExit}
                className="text-white/50 hover:text-white text-sm transition-colors"
              >
                &larr; back
              </button>
            )}
            <h1 className="text-white font-light tracking-wide text-lg">{repoName}</h1>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span>{fileCount} files</span>
              <span>{dirCount} directories</span>
              {buildCount < buildingPositions.size && (
                <span className="text-blue-400/60">building... {buildCount}/{buildingPositions.size}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const url = `${window.location.origin}/${repoName}`;
                navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/30 rounded transition-all"
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={handleScreenshot}
              className="px-3 py-1.5 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/30 rounded transition-all"
            >
              Screenshot
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={cityContainerRef} className="flex-1 relative overflow-hidden">
          <CanvasIsometricGrid
            overlayMode="none"
            selectedTile={null}
            setSelectedTile={() => {}}
            navigationTarget={navigationTarget}
            onNavigationComplete={() => setNavigationTarget(null)}
            onViewportChange={setViewport}
            onTileHover={(tile, mx, my) => {
              if (!tile) { setHoverInfo(null); return; }
              const file = getFileForTile(tile.x, tile.y);
              const t = state.grid[tile.y]?.[tile.x];
              if (!t || t.building.type === 'road' || t.building.type === 'water' || t.building.type === 'empty' || t.building.type === 'grass') {
                setHoverInfo(null);
                return;
              }
              setHoverInfo({ file, buildingType: t.building.type, x: mx, y: my });
            }}
          />
          <MiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />

          {/* Hover tooltip — follows mouse */}
          {hoverInfo && hoverInfo.file && (
            <div
              ref={tooltipRef}
              className="fixed z-50 pointer-events-none bg-slate-900/95 border border-white/15 rounded-lg px-4 py-3 shadow-2xl max-w-xs backdrop-blur-sm"
              style={{ left: hoverInfo.x + 16, top: hoverInfo.y + 16 }}
            >
              <p className="text-white font-mono text-sm font-semibold truncate">{hoverInfo.file.path.split('/').pop()}</p>
              <p className="text-white/35 font-mono text-[10px] mt-0.5 truncate">{hoverInfo.file.path}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-mono">.{hoverInfo.file.type}</span>
                <span className="px-1.5 py-0.5 bg-white/10 text-white/60 rounded text-[10px]">~{hoverInfo.file.lines} lines</span>
                <span className="px-1.5 py-0.5 bg-white/10 text-white/60 rounded text-[10px]">{(hoverInfo.file.size / 1024).toFixed(1)} KB</span>
                {hoverInfo.file.isEntry && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-[10px]">entry</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
