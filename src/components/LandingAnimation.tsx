'use client';

import React, { useEffect, useRef } from 'react';

// Simple isometric building renderer for the landing page background
const GRID_SIZE = 8;
const TILE_W = 48;
const TILE_H = 24;

// Building color palettes — muted blues, purples, teals
const BUILDING_COLORS = [
  { top: '#3b5998', left: '#2d4373', right: '#1e2d4d' },
  { top: '#6366f1', left: '#4f46e5', right: '#3730a3' },
  { top: '#0ea5e9', left: '#0284c7', right: '#0369a1' },
  { top: '#8b5cf6', left: '#7c3aed', right: '#6d28d9' },
  { top: '#06b6d4', left: '#0891b2', right: '#0e7490' },
  { top: '#a78bfa', left: '#8b5cf6', right: '#7c3aed' },
  { top: '#38bdf8', left: '#0ea5e9', right: '#0284c7' },
  { top: '#818cf8', left: '#6366f1', right: '#4f46e5' },
];

interface BuildingState {
  height: number;
  targetHeight: number;
  colorIndex: number;
  delay: number;
}

function toIso(x: number, y: number, originX: number, originY: number): { sx: number; sy: number } {
  return {
    sx: originX + (x - y) * (TILE_W / 2),
    sy: originY + (x + y) * (TILE_H / 2),
  };
}

function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  height: number,
  color: { top: string; left: string; right: string },
  alpha: number
) {
  const h = height;
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;

  ctx.globalAlpha = alpha;

  // Left face
  ctx.fillStyle = color.left;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx - hw, sy - hh);
  ctx.lineTo(sx - hw, sy - hh - h);
  ctx.lineTo(sx, sy - h);
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = color.right;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + hw, sy - hh);
  ctx.lineTo(sx + hw, sy - hh - h);
  ctx.lineTo(sx, sy - h);
  ctx.closePath();
  ctx.fill();

  // Top face
  ctx.fillStyle = color.top;
  ctx.beginPath();
  ctx.moveTo(sx, sy - h);
  ctx.lineTo(sx - hw, sy - hh - h);
  ctx.lineTo(sx, sy - (2 * hh) - h);
  ctx.lineTo(sx + hw, sy - hh - h);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
}

export default function LandingAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * window.devicePixelRatio;
      canvas!.height = height * window.devicePixelRatio;
      canvas!.style.width = width + 'px';
      canvas!.style.height = height + 'px';
      ctx!.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);

    // Generate buildings with random heights and staggered delays
    let buildings: BuildingState[][] = [];
    let cycleStart = 0;
    const CYCLE_DURATION = 6000; // ms per full cycle
    const RISE_DURATION = 1500;
    const HOLD_DURATION = 2500;
    const FADE_DURATION = 2000;

    function initBuildings() {
      buildings = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        const row: BuildingState[] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
          const dist = Math.abs(x - GRID_SIZE / 2) + Math.abs(y - GRID_SIZE / 2);
          row.push({
            height: 0,
            targetHeight: 15 + Math.random() * 55,
            colorIndex: Math.floor(Math.random() * BUILDING_COLORS.length),
            delay: dist * 80 + Math.random() * 200,
          });
        }
        buildings.push(row);
      }
      cycleStart = performance.now();
    }

    initBuildings();

    function animate(time: number) {
      const elapsed = time - cycleStart;

      // Check if cycle is done — reset
      if (elapsed > CYCLE_DURATION + 1000) {
        initBuildings();
      }

      ctx!.clearRect(0, 0, width, height);

      const originX = width / 2;
      const originY = height / 2 - 30;

      // Draw back-to-front for correct z-ordering
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const b = buildings[y][x];
          const localElapsed = elapsed - b.delay;

          let progress = 0;
          let alpha = 0.2;

          if (localElapsed < 0) {
            progress = 0;
            alpha = 0;
          } else if (localElapsed < RISE_DURATION) {
            // Rising
            const t = localElapsed / RISE_DURATION;
            // Ease out cubic
            progress = 1 - Math.pow(1 - t, 3);
            alpha = 0.2;
          } else if (localElapsed < RISE_DURATION + HOLD_DURATION) {
            // Holding
            progress = 1;
            alpha = 0.2;
          } else if (localElapsed < RISE_DURATION + HOLD_DURATION + FADE_DURATION) {
            // Fading
            const t = (localElapsed - RISE_DURATION - HOLD_DURATION) / FADE_DURATION;
            progress = 1;
            alpha = 0.2 * (1 - t);
          } else {
            progress = 0;
            alpha = 0;
          }

          if (alpha <= 0) continue;

          const currentHeight = b.targetHeight * progress;
          const iso = toIso(x, y, originX, originY);
          const color = BUILDING_COLORS[b.colorIndex];

          drawIsoBox(ctx!, iso.sx, iso.sy, currentHeight, color, alpha);

          // Subtle glow on top
          if (alpha > 0.05 && currentHeight > 5) {
            const grd = ctx!.createRadialGradient(
              iso.sx, iso.sy - currentHeight - TILE_H / 2,
              0,
              iso.sx, iso.sy - currentHeight - TILE_H / 2,
              TILE_W * 0.6
            );
            grd.addColorStop(0, `rgba(100, 150, 255, ${alpha * 0.3})`);
            grd.addColorStop(1, 'rgba(100, 150, 255, 0)');
            ctx!.fillStyle = grd;
            ctx!.fillRect(
              iso.sx - TILE_W,
              iso.sy - currentHeight - TILE_H * 2,
              TILE_W * 2,
              TILE_H * 2
            );
          }
        }
      }

      // Subtle grid floor
      ctx!.globalAlpha = 0.04;
      ctx!.strokeStyle = '#6366f1';
      ctx!.lineWidth = 0.5;
      for (let y = 0; y <= GRID_SIZE; y++) {
        const start = toIso(0, y, originX, originY);
        const end = toIso(GRID_SIZE, y, originX, originY);
        ctx!.beginPath();
        ctx!.moveTo(start.sx, start.sy);
        ctx!.lineTo(end.sx, end.sy);
        ctx!.stroke();
      }
      for (let x = 0; x <= GRID_SIZE; x++) {
        const start = toIso(x, 0, originX, originY);
        const end = toIso(x, GRID_SIZE, originX, originY);
        ctx!.beginPath();
        ctx!.moveTo(start.sx, start.sy);
        ctx!.lineTo(end.sx, end.sy);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}
