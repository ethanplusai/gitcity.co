'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseRepoInput } from '@/lib/github-api';
// Landing animation removed — use CSS grid pattern instead

const EXAMPLE_REPOS = [
  { label: 'facebook/react', value: 'facebook/react', desc: 'The library for web UIs' },
  { label: 'vercel/next.js', value: 'vercel/next.js', desc: 'The React framework' },
  { label: 'denoland/deno', value: 'denoland/deno', desc: 'A modern JS runtime' },
  { label: 'rust-lang/rust', value: 'rust-lang/rust', desc: 'The Rust compiler' },
  { label: 'sveltejs/svelte', value: 'sveltejs/svelte', desc: 'Cybernetically enhanced web apps' },
  { label: 'golang/go', value: 'golang/go', desc: 'The Go programming language' },
  { label: 'microsoft/typescript', value: 'microsoft/typescript', desc: 'TypeScript language' },
  { label: 'torvalds/linux', value: 'torvalds/linux', desc: 'The Linux kernel' },
];

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSubtitleVisible(true), 400);
    const t2 = setTimeout(() => setHintVisible(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleSubmit = useCallback((repoString?: string) => {
    const value = repoString || input;
    const parsed = parseRepoInput(value);
    if (!parsed) {
      setError('Enter a valid owner/repo or GitHub URL');
      return;
    }
    setError('');
    router.push(`/city?repo=${encodeURIComponent(`${parsed.owner}/${parsed.repo}`)}`);
  }, [input, router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8 relative overflow-hidden">
      {/* Subtle isometric grid pattern background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(30deg, rgba(99,102,241,0.3) 1px, transparent 1px),
            linear-gradient(150deg, rgba(99,102,241,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 35px',
        }}
      />
      {/* Radial glow behind title */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[120px]" />

      <div className="max-w-xl w-full flex flex-col items-center space-y-12 relative z-10">

        {/* Title */}
        <div className="text-center space-y-4">
          <h1
            className="text-7xl sm:text-8xl font-bold tracking-wider text-white/95 select-none"
            style={{
              textShadow: '0 0 80px rgba(99, 102, 241, 0.3), 0 0 40px rgba(99, 102, 241, 0.15), 0 0 120px rgba(59, 130, 246, 0.1)',
            }}
          >
            gitcity
          </h1>
          <p
            className="text-lg sm:text-xl font-light text-white/50 tracking-wide transition-all duration-1000"
            style={{
              opacity: subtitleVisible ? 1 : 0,
              transform: subtitleVisible ? 'translateY(0)' : 'translateY(8px)',
            }}
          >
            see any codebase as a city
          </p>
          <p
            className="text-sm font-light text-white/25 tracking-wide transition-all duration-1000"
            style={{
              opacity: subtitleVisible ? 1 : 0,
              transform: subtitleVisible ? 'translateY(0)' : 'translateY(8px)',
              transitionDelay: '200ms',
            }}
          >
            every file is a building. every directory is a block.
          </p>
        </div>

        {/* Input */}
        <div className="w-full space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="facebook/react"
              className="flex-1 px-4 py-3 bg-white/5 border border-white/15 text-white placeholder:text-white/30 rounded-none focus:outline-none focus:border-indigo-400/50 transition-colors text-lg font-light tracking-wide"
              style={{
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.1)',
              }}
            />
            <button
              onClick={() => handleSubmit()}
              className="px-6 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 hover:border-indigo-400/50 text-white font-light tracking-wide rounded-none transition-all duration-200 text-lg"
            >
              Build City
            </button>
          </div>
          {error && (
            <p className="text-red-400/80 text-sm font-light">{error}</p>
          )}

          {/* URL swap trick — prominent */}
          <div
            className="flex items-center justify-center gap-3 py-3 px-4 bg-white/[0.03] border border-white/[0.06] rounded transition-all duration-700"
            style={{
              opacity: hintVisible ? 1 : 0,
              transform: hintVisible ? 'translateY(0)' : 'translateY(6px)',
            }}
          >
            <span className="text-sm font-mono text-white/30">github.com<span className="text-white/50">/repo</span></span>
            <span className="text-indigo-400/60 text-lg">&rarr;</span>
            <span className="text-sm font-mono text-indigo-300/60">gitcity.co<span className="text-indigo-300/80">/repo</span></span>
            <span className="text-xs text-white/20 ml-2 hidden sm:inline">just swap the domain</span>
          </div>
        </div>

        {/* Example repos */}
        <div className="w-full space-y-3">
          <p className="text-xs font-medium text-white/30 uppercase tracking-wider">
            Try an example
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_REPOS.map((repo) => (
              <button
                key={repo.value}
                onClick={() => handleSubmit(repo.value)}
                className="group relative px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400/30 text-white/60 hover:text-white text-sm font-light tracking-wide rounded-none transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.15)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {repo.label}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 border border-white/10 text-white/70 text-xs whitespace-nowrap rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  {repo.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Building showcase — actual IsoCity sprites */}
        <div className="w-full space-y-4 pt-4">
          <p className="text-xs font-medium text-white/20 uppercase tracking-wider text-center">
            Your code, visualized
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 opacity-60">
            {[
              { label: '.ts', desc: 'Offices', bg: 'from-blue-500/10 to-blue-600/5' },
              { label: '.py', desc: 'Universities', bg: 'from-green-500/10 to-green-600/5' },
              { label: '.rs', desc: 'Factories', bg: 'from-orange-500/10 to-orange-600/5' },
              { label: '.md', desc: 'Parks', bg: 'from-emerald-500/10 to-emerald-600/5' },
              { label: '.css', desc: 'Mansions', bg: 'from-pink-500/10 to-pink-600/5' },
              { label: '.go', desc: 'Industry', bg: 'from-cyan-500/10 to-cyan-600/5' },
              { label: '.json', desc: 'Shops', bg: 'from-yellow-500/10 to-yellow-600/5' },
              { label: 'main.*', desc: 'Landmarks', bg: 'from-purple-500/10 to-purple-600/5' },
            ].map((item) => (
              <div key={item.label} className={`flex flex-col items-center gap-1.5 p-2 rounded bg-gradient-to-b ${item.bg} border border-white/5`}>
                <span className="text-[10px] font-mono text-white/50">{item.label}</span>
                <span className="text-[9px] text-white/30">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 space-y-2">
          <p className="text-xs text-white/20 font-light">
            Started by{' '}
            <a href="https://ethanplus.ai" className="text-white/30 hover:text-white/50 transition-colors" target="_blank" rel="noopener noreferrer">
              Ethan
            </a>
            {' '}&middot;{' '}
            Powered by{' '}
            <a href="https://github.com/amilich/isometric-city" className="text-white/30 hover:text-white/50 transition-colors" target="_blank" rel="noopener noreferrer">
              IsoCity
            </a>
            {' '}(MIT)
            {' '}&middot;{' '}
            <a href="https://github.com/ethanplusai/gitcity" className="text-white/30 hover:text-white/50 transition-colors" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </p>
        </div>
      </div>

      {/* Input pulse animation is handled via Tailwind animate-pulse on focus */}
    </main>
  );
}
