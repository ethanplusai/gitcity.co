'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GameProvider } from '@/context/GameContext';
import { fetchRepoTree, parseRepoInput } from '@/lib/github-api';
import { generateCityFromRepo, calculateGridSize } from '@/lib/city-generator';
import { createCityGameState } from '@/lib/city-state';
import CityViewer from '@/components/CityViewer';
import type { GameState } from '@/types/game';
import type { RepoFile } from '@/lib/github-api';

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  PRIVATE_REPO: {
    title: 'Private Repository',
    message: 'This repo is private. GitHub auth coming soon!',
  },
  RATE_LIMIT: {
    title: 'Rate Limited',
    message: 'GitHub API limit reached. Try again in a minute.',
  },
  REPO_NOT_FOUND: {
    title: 'Not Found',
    message: "Repo not found. Check the URL and try again.",
  },
  NETWORK_ERROR: {
    title: 'Connection Error',
    message: "Couldn't reach GitHub. Check your connection.",
  },
};

function getErrorInfo(errorMsg: string): { title: string; message: string } {
  return ERROR_MESSAGES[errorMsg] || { title: 'Error', message: errorMsg };
}

function CityPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoParam = searchParams.get('repo');

  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [repoName, setRepoName] = useState('');
  const [fileCount, setFileCount] = useState(0);
  const [dirCount, setDirCount] = useState(0);
  const [buildingPositions, setBuildingPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [files, setFiles] = useState<RepoFile[]>([]);

  useEffect(() => {
    if (!repoParam) {
      setError('No repo specified. Add ?repo=owner/repo to the URL.');
      setLoading(false);
      return;
    }

    const parsed = parseRepoInput(repoParam);
    if (!parsed) {
      setError('Invalid repo format. Use owner/repo.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRepo() {
      try {
        setLoading(true);
        setError('');
        setLoadingStage('Fetching repository...');

        const repoData = await fetchRepoTree(parsed!.owner, parsed!.repo);
        if (cancelled) return;

        if (repoData.files.length === 0) {
          setError('This repository has no source files to visualize.');
          setLoading(false);
          return;
        }

        setLoadingStage(`Analyzing ${repoData.files.length} files...`);
        // Small delay so the stage is visible
        await new Promise(r => setTimeout(r, 300));

        const gridSize = calculateGridSize(repoData.files.length);
        const { grid, buildingPositions: positions } = generateCityFromRepo(repoData.files, gridSize);

        if (cancelled) return;

        setLoadingStage('Building city...');
        await new Promise(r => setTimeout(r, 200));

        // Count unique top-level directories
        const dirs = new Set(repoData.files.map(f => {
          const parts = f.path.split('/');
          return parts.length > 1 ? parts[0] : '.';
        }));

        const state = createCityGameState(grid, gridSize, `${parsed!.owner}/${parsed!.repo}`);

        setGameState(state);
        setRepoName(`${parsed!.owner}/${parsed!.repo}`);
        setFileCount(repoData.files.length);
        setDirCount(dirs.size);
        setBuildingPositions(positions);
        setFiles(repoData.files);
        document.title = `${parsed!.owner}/${parsed!.repo} — gitcity`;
        setLoading(false);
      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (cancelled) return;
        setError(err.message || 'Failed to load repo');
        setLoading(false);
      }
    }

    loadRepo();
    return () => { cancelled = true; };
  }, [repoParam]);

  const handleExit = useCallback(() => {
    router.push('/');
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="text-white/40 text-sm font-mono tracking-wide">{repoParam}</div>
          <div className="text-white/70 text-lg font-light">{loadingStage}</div>
          <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
            <div
              className="h-full bg-indigo-400/60 rounded-full transition-all duration-500"
              style={{
                width: loadingStage.includes('Fetching') ? '30%' : loadingStage.includes('Analyzing') ? '65%' : '90%',
                animation: 'loadPulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
          <style jsx>{`
            @keyframes loadPulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      </main>
    );
  }

  if (error) {
    const errorInfo = getErrorInfo(error);
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-5 max-w-md px-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-400/20 flex items-center justify-center">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <h2 className="text-white/80 text-xl font-light">{errorInfo.title}</h2>
          <p className="text-white/40 text-sm font-light leading-relaxed">{errorInfo.message}</p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-light rounded-none transition-colors text-sm"
            >
              Back to home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-white font-light rounded-none transition-colors text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!gameState) return null;

  return (
    <GameProvider initialState={gameState}>
      <main className="h-screen w-screen overflow-hidden">
        <CityViewer
          repoName={repoName}
          fileCount={fileCount}
          dirCount={dirCount}
          buildingPositions={buildingPositions}
          files={files}
          onExit={handleExit}
        />
      </main>
    </GameProvider>
  );
}

export default function CityPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </main>
    }>
      <CityPageContent />
    </Suspense>
  );
}
