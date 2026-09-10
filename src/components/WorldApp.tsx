'use client';
import FieldNotebook from './FieldNotebook';
import VerifyContribution from './VerifyContribution';
import { mergeSourceFiles } from '../../shared/source-pages.mjs';
import { reconcileSourceFiles } from '../../shared/source-reconcile.mjs';
import { progressiveCities } from '../../shared/progressive-cities.mjs';
import { cityArrivalOrder } from '../../shared/city-arrival.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Compass,
  ExternalLink,
  Footprints,
  GitBranch,
  Github,
  Globe2,
  HelpCircle,
  Landmark,
  Layers3,
  MapPin,
  Minus,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { atlas, coordinates, parseRoute } from '../../shared/model.mjs';
import type { WorldEngine, HighwayTravel, WalkingTravel } from '@/world/engine';
import type { City, CodeFile, Repo } from '@/world/types';
type Player = {
  login: string;
  soft: number;
  hard: number;
  possessions: { repo: string; item: string }[];
};
type Modal = 'highway' | 'search' | 'about' | 'passport' | 'hall' | 'file' | null;
type CityDirectory = City[] | { cities: City[]; nextPage: number | null };
const directoryCities = (data: CityDirectory) => (Array.isArray(data) ? data : data.cities);
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(path, options);
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.error || 'The city could not be reached.'), {
      status: r.status,
    });
  return data;
}
const compact = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0
    ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : '—';
const relative = (date: string) => {
  if (!Number.isFinite(Date.parse(date))) return 'date unavailable';
  const days = Math.floor((Date.now() - Date.parse(date)) / 86400000);
  return days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};
import CityOperations from './CityOperations';
import CityChallenges from './CityChallenges';
import { discover, expedition } from '../../shared/exploration.mjs';
export default function WorldApp() {
  const viewport = useRef<HTMLDivElement>(null),
    engine = useRef<WorldEngine | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    routeRef = useRef('/'),
    repoRef = useRef<Repo | null>(null),
    navigation = useRef<(path: string) => void>(() => {});
  const landingReady = useRef(false);
  const [arriving, setArriving] = useState(true);
  const [ready, setReady] = useState(false),
    [route, setRoute] = useState('/'),
    [repo, setRepo] = useState<Repo | null>(null),
    [ownerCities, setOwnerCities] = useState<City[]>([]),
    [ownerListLimit, setOwnerListLimit] = useState(60),
    [nearbyCities, setNearbyCities] = useState<City[]>([]),
    [phase, setPhase] = useState('The world is taking shape'),
    [error, setError] = useState(''),
    [modal, setModal] = useState<Modal>(null),
    [input, setInput] = useState(''),
    [searchError, setSearchError] = useState(''),
    [height, setHeight] = useState(1368),
    [walking, setWalking] = useState(false),
    [sound, setSound] = useState(false),
    [player, setPlayer] = useState<Player | null>(null),
    [configured, setConfigured] = useState(false),
    [notice, setNotice] = useState(''),
    [working, setWorking] = useState(false),
    [file, setFile] = useState<CodeFile | null>(null),
    [source, setSource] = useState(''),
    [sourceError, setSourceError] = useState(''),
    [copied, setCopied] = useState(false),
    [tab, setTab] = useState<'overview' | 'districts'>('overview'),
    [sourceRevision, setSourceRevision] = useState(0),
    [directoryPages, setDirectoryPages] = useState<
      Record<string, { cursor?: string | null; pending?: boolean; total?: number }>
    >({}),
    [webglError, setWebglError] = useState(''),
    [civicRole, setCivicRole] = useState('Tourist'),
    [districtRole, setDistrictRole] = useState<string | null>(null),
    [syncPhase, setSyncPhase] = useState('');
  const [walkingTravel, setWalkingTravel] = useState<WalkingTravel | null>(null);
  const [highwayTravel, setHighwayTravel] = useState<HighwayTravel | null>(null);
  const [cityDetailsExpanded, setCityDetailsExpanded] = useState(false);
  const [highwayDestinations, setHighwayDestinations] = useState<string[]>([]);
  const [journal, setJournal] = useState<string[]>([]);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourPath, setTourPath] = useState('');
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gitcity.exploration.v1') || '[]');
      if (Array.isArray(saved)) setJournal(saved.filter((v) => typeof v === 'string'));
    } catch {}
  }, []);
  const recordDiscovery = useCallback((city: string, kind: string, path = '') => {
    setJournal((previous) => {
      const next = discover(previous, city, kind, path);
      try {
        localStorage.setItem('gitcity.exploration.v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  useEffect(() => {
    if (repo?.id) {
      recordDiscovery(repo.id, 'city');
      setTourIndex(0);
      setTourPath('');
    }
  }, [repo?.id, recordDiscovery]);
  useEffect(() => {
    if (!engine.current) return;
    engine.current.onHall = () => {
      if (repo?.id) recordDiscovery(repo.id, 'hall');
      engine.current?.cityHall();
      setModal('hall');
    };
  }, [repo?.id, ready, recordDiscovery]);
  useEffect(() => {
    const world = engine.current;
    if (!world) return;
    world.onNavigationNotice = setNotice;
    world.onWalkingTravel = setWalkingTravel;
    world.onHighwayTravel = (travel) => {
      if (travel) setCityDetailsExpanded(false);
      setHighwayTravel(travel);
    };
    world.onHighway = (destinations) => {
      setHighwayDestinations([...new Set(destinations)].sort());
      setModal('highway');
    };
    return () => {
      world.onHighway = null;
      world.onHighwayTravel = null;
      world.onWalkingTravel = null;
      world.onNavigationNotice = null;
    };
  }, [ready]);
  const progress = expedition(journal, repo?.id || '');
  const closeDialog = () => {
    if (modal === 'file' && file) engine.current?.inspect(file.path);
    setModal(null);
  };
  const current = parseRoute(route),
    isWorld = current.level === 'world',
    isOwner = current.level === 'owner';
  const activeRepoId = repo?.id;
  const activeFilePath = file?.path;
  const navigate = useCallback((path: string) => {
    setArriving(true);
    setCityDetailsExpanded(false);
    window.history.pushState({}, '', path);
    setRoute(path);
    routeRef.current = path;
    setModal(null);
    setError('');
  }, []);
  navigation.current = navigate;
  const refreshPlayer = useCallback(async () => {
    try {
      const s = await api<{ configured: boolean; player: Player | null }>('/api/session');
      setConfigured(s.configured);
      setPlayer(s.player);
    } catch {
      setConfigured(false);
    }
  }, []);
  async function refreshAcceptedWork(id: string, number?: number) {
    await refreshPlayer();
    const current = repoRef.current;
    if (current?.id.toLowerCase() === id.toLowerCase()) {
      const fresh = await api<Repo>(`/api/repos/${current.id}`);
      if (repoRef.current?.id === current.id) {
        const updated = {
          ...repoRef.current,
          residents: fresh.residents,
          civic: fresh.civic,
          treasury: fresh.treasury,
        };
        repoRef.current = updated;
        setRepo(updated);
        engine.current?.refreshRecognition(updated);
        const resident = fresh.residents?.find(
          (entry) =>
            entry.pr === number && entry.login.toLowerCase() === player?.login.toLowerCase(),
        );
        if (resident)
          return {
            href: `/${id}/${resident.path.split('/').map(encodeURIComponent).join('/')}`,
            label: 'Visit your contribution',
          };
      }
    }
    return { href: `/${id}`, label: 'Visit this city' };
  }
  function visitVerifiedContribution(href: string) {
    setModal(null);
    navigate(href);
  }
  useEffect(() => {
    let cancelled = false;
    const host = viewport.current!;
    const lost = (e: Event) => setWebglError((e as CustomEvent).detail);
    host.addEventListener('world-error', lost);
    import('@/world/engine').then(({ WorldEngine }) => {
      if (cancelled) return;
      try {
        engine.current = new WorldEngine(
          host,
          (id) => navigation.current('/' + id),
          (f) => {
            const id = repoRef.current?.id;
            if (id)
              navigation.current(
                '/' + id + '/' + f.path.split('/').map(encodeURIComponent).join('/'),
              );
          },
          (h, w) => {
            setHeight(h);
            setWalking(w);
          },
        );
        setReady(true);
        setPhase('Open world · public repositories');
      } catch {
        setWebglError(
          'This device could not start WebGL 2. You can still search repositories and browse their files below.',
        );
      }
    });
    let path = window.location.pathname;
    const legacy = new URLSearchParams(window.location.search).get('repo');
    if (new URLSearchParams(window.location.search).get('auth') === 'denied')
      setNotice('GitHub sign-in was cancelled. You can keep exploring as a tourist.');
    if (path === '/city' && legacy) path = '/' + legacy;
    if (window.location.hash.startsWith('#/')) path = window.location.hash.slice(1);
    if (path !== window.location.pathname) window.history.replaceState({}, '', path);
    setRoute(path);
    routeRef.current = path;
    const pop = () => {
      setArriving(true);
      setCityDetailsExpanded(false);
      setRoute(window.location.pathname);
      routeRef.current = window.location.pathname;
      setModal(null);
    };
    const keys = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) &&
        !(e.target as HTMLElement).closest('input,textarea')
      ) {
        e.preventDefault();
        setModal('search');
      }
    };
    window.addEventListener('popstate', pop);
    window.addEventListener('keydown', keys);
    void refreshPlayer();
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
      window.removeEventListener('popstate', pop);
      window.removeEventListener('keydown', keys);
      host.removeEventListener('world-error', lost);
    };
  }, [refreshPlayer]);
  useEffect(() => {
    if (!ready && !webglError) return;
    const controller = new AbortController();
    const r = parseRoute(route);
    const arrivalRevision = engine.current?.navigationRevision;
    setError('');
    setFile(null);
    setSource('');
    engine.current?.exitInterior();
    setTab('overview');
    if (r.level === 'world') {
      setRepo(null);
      repoRef.current = null;
      engine.current?.worldView();
      setPhase('Open world · Next.js city');
      if (landingReady.current) {
        setArriving(false);
        return;
      }
      // Shared links spend their network and rendering budget on the destination.
      // Only a visit to the homepage constructs the featured atlas cities.
      api<Repo[]>('/api/atlas', { signal: controller.signal })
        .then(async (data) => {
          await engine.current?.previewBatch(
            data.filter((repo) => repo.id === 'vercel/next.js'),
            controller.signal,
          );
          if (controller.signal.aborted) return;
          landingReady.current = true;
          if (engine.current?.navigationRevision === arrivalRevision) engine.current?.worldView();
          setArriving(false);
          if (!data.length) setPhase('GitHub is unavailable · search to explore a repository');
          void engine.current
            ?.previewBatch(
              data.filter((repo) => repo.id !== 'vercel/next.js'),
              controller.signal,
            )
            .catch(() => {});
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setArriving(false);
            setError(error.message);
          }
        });
      return () => controller.abort();
    }
    if (r.level === 'owner') {
      setRepo(null);
      repoRef.current = null;
      setArriving(true);
      setOwnerCities([]);
      setOwnerListLimit(60);
      setPhase('Surveying this city’s districts');
      api<CityDirectory>(`/api/owners/${encodeURIComponent(r.owner!)}?page=1`, {
        signal: controller.signal,
      })
        .then((data) => {
          if (controller.signal.aborted) return;
          const cities = cityArrivalOrder(
            directoryCities(data).map((c) => ({ ...c, color: '#b4ce9e' })),
          );
          let directoryComplete = Array.isArray(data) || !data.nextPage;
          const unavailable = new Set<string>();
          setOwnerCities([...cities]);
          engine.current?.ownerView(
            cities,
            false,
            engine.current?.navigationRevision !== arrivalRevision,
          );
          setPhase(`Constructing neighborhoods · 0 of ${cities.length}`);
          let framed = false;
          let entranceFailed = false;
          let fallback: Repo | null = null;
          // Start drawing the first page immediately. Even organizations with
          // thousands of repositories need only one directory request to arrive.
          void (async () => {
            let nextPage = Array.isArray(data) ? null : data.nextPage;
            const seen = new Set(cities.map((city) => city.id.toLowerCase()));
            try {
              while (nextPage && !controller.signal.aborted) {
                const page = await api<CityDirectory>(
                  `/api/owners/${encodeURIComponent(r.owner!)}?page=${nextPage}`,
                  { signal: controller.signal },
                );
                if (controller.signal.aborted) return;
                const wasEmpty = cities.length === 0;
                for (const city of cityArrivalOrder(directoryCities(page))) {
                  if (seen.has(city.id.toLowerCase())) continue;
                  seen.add(city.id.toLowerCase());
                  cities.push({ ...city, color: '#b4ce9e' });
                }
                const visible = cities.filter((city) => !unavailable.has(city.id));
                setOwnerCities([...visible]);
                engine.current?.ownerView(
                  visible,
                  false,
                  !wasEmpty || engine.current?.navigationRevision !== arrivalRevision,
                );
                nextPage = Array.isArray(page) ? null : page.nextPage;
              }
            } catch (error) {
              if (!controller.signal.aborted)
                setError(
                  `The remaining directory could not be reached. ${(error as Error).message}`,
                );
            } finally {
              directoryComplete = true;
            }
          })();
          void progressiveCities(cities, {
            signal: controller.signal,
            directoryComplete: () => directoryComplete,
            eligible: (city: City) =>
              city === cities[0] || Boolean(engine.current?.shouldBuildCity(city)),
            onFailure: (city: City, error: Error & { status?: number }) => {
              if (controller.signal.aborted) return;
              if (city === cities[0]) {
                entranceFailed = true;
                if (!framed && fallback) {
                  framed = true;
                  if (engine.current?.navigationRevision === arrivalRevision)
                    engine.current?.focusNeighborhood(fallback.id);
                  setArriving(false);
                }
              }
              if ([404, 410].includes(error.status || 0)) {
                unavailable.add(city.id);
                engine.current?.removeCity(city.id);
                setOwnerCities((previous) => previous.filter((c) => c.id !== city.id));
              }
              setNotice(`${city.id}: ${error.message}`);
            },
            load: (city: City) => api<Repo>(`/api/repos/${city.id}`, { signal: controller.signal }),
            publish: async (data: Repo, city: City) => {
              await engine.current?.previewBatch([data], controller.signal);
              if (controller.signal.aborted) return;
              if (data.files.length) fallback ||= data;
              if (!framed && data.files.length && (city === cities[0] || entranceFailed)) {
                framed = true;
                if (engine.current?.navigationRevision === arrivalRevision)
                  engine.current?.focusNeighborhood(data.id);
                setArriving(false);
              }
            },
            progress: (completed: number, total: number, failed: number) =>
              setPhase(
                `Constructing neighborhoods · ${completed - failed} of ${total}${directoryComplete ? '' : '+'}${failed ? ` · ${failed} unavailable` : ''}`,
              ),
          }).then((failures) => {
            if (controller.signal.aborted) return;
            setArriving(false);
            const removed = new Set(
              failures
                .filter(({ error }) => [404, 410].includes(error.status))
                .map(({ city }) => city.id),
            );
            for (const id of removed) engine.current?.removeCity(id);
            if (removed.size)
              setOwnerCities((previous) => previous.filter((city) => !removed.has(city.id)));
            setPhase(
              `${cities.length - failures.length} neighborhoods built${failures.length ? ` · ${failures.length} unavailable` : ''}`,
            );
            if (failures.length)
              setError(
                `${failures[0].city.id}${failures.length > 1 ? ` and ${failures.length - 1} other neighborhoods` : ''} could not be constructed. ${failures[0].error.message}`,
              );
          });
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setArriving(false);
          }
        });
      return () => controller.abort();
    }
    const id = `${r.owner}/${r.repo}`;
    if (repoRef.current?.id !== id) engine.current?.survey(id);
    setPhase('Laying foundations · reading source & history');
    const finish = (data: Repo) => {
      if (controller.signal.aborted) return;
      const existing = repoRef.current?.id === data.id;
      setRepo(data);
      repoRef.current = data;
      if (!existing) {
        engine.current?.enter(
          data,
          undefined,
          engine.current?.navigationRevision !== arrivalRevision,
        );
        if (!r.file && new URLSearchParams(location.search).get('view') === 'overview')
          engine.current?.overview();
      }
      document.title = `${data.id} — Gitcity`;
      setArriving(false);
      setPhase(
        `${data.files.length} source buildings · ${data.historyCoverage || 'History coverage unavailable'}`,
      );
      if (r.file) {
        let path = r.file;
        if (path.startsWith('blob/' + data.defaultBranch + '/'))
          path = path.slice(6 + data.defaultBranch.length);
        const f = data.files.find((f) => f.path === path) || { path, analysis: 'on demand' };
        setFile(f);
        engine.current?.enterFile(path);
        setModal('file');
      }
    };
    if (repoRef.current?.id === id) {
      finish(repoRef.current);
      return () => controller.abort();
    }
    // Keep the mission UI mounted while physically crossing a neighborhood
    // boundary. Its subscription owns the active city-service round.
    if (engine.current?.pendingStreetView?.id !== id) {
      setRepo(null);
      repoRef.current = null;
    }
    api<Repo>(`/api/repos/${encodeURIComponent(r.owner!)}/${encodeURIComponent(r.repo!)}`, {
      signal: controller.signal,
    })
      .then(finish)
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setArriving(false);
          setPhase('Construction paused · your place is saved');
        }
      });
    return () => controller.abort();
  }, [route, ready, webglError]);
  useEffect(() => {
    setNearbyCities([]);
    if (!activeRepoId || !ready) return;
    const controller = new AbortController(),
      owner = activeRepoId.split('/')[0];
    // A shared link opens its own district first; adjoining neighborhoods materialize behind it.
    api<CityDirectory>(`/api/owners/${encodeURIComponent(owner)}?page=1`, {
      signal: controller.signal,
    })
      .then(async (directory) => {
        const cities = cityArrivalOrder(directoryCities(directory));
        const neighbors = cities.filter((c) => c.id !== activeRepoId).slice(0, 2);
        const loaded = await Promise.allSettled(
          neighbors.map(async (city) => {
            const data = await api<Repo>(`/api/repos/${city.id}`, { signal: controller.signal });
            return { city, data };
          }),
        );
        if (!controller.signal.aborted) {
          const results = loaded.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
          await engine.current?.previewBatch(
            results.map((r) => r.data),
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setNearbyCities(results.map((r) => r.city));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [activeRepoId, ready]);
  useEffect(() => {
    if (!activeRepoId) return;
    let alive = true,
      refreshing = false;
    const interval = setInterval(async () => {
      if (document.hidden || refreshing) return;
      refreshing = true;
      try {
        const data = await api<Repo>(`/api/repos/${activeRepoId}`);
        if (alive && data.commits[0]?.sha !== repoRef.current?.commits[0]?.sha) {
          const previous = repoRef.current;
          if (!previous) return;
          const results: { unchanged: string[]; files: CodeFile[] }[] = [];
          const initial = new Set(data.files.map((f) => f.path));
          const expanded = previous.files.filter((f) => !initial.has(f.path));
          for (let i = 0; i < expanded.length; i += 64) {
            const result = await api<{ unchanged: string[]; files: CodeFile[] }>(
              `/api/reconcile/${activeRepoId}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ref: data.ref,
                  files: expanded.slice(i, i + 64).map(({ path, sha }) => ({ path, sha })),
                }),
              },
            );
            if (!alive || repoRef.current !== previous) return;
            results.push(result);
          }
          const updated = {
            ...data,
            files: reconcileSourceFiles(previous.files, data.files, results),
          };
          setRepo(updated);
          repoRef.current = updated;
          setSourceRevision((revision) => revision + 1);
          engine.current?.audio.commit();
          setNotice(`New commit by ${data.commits[0].author}: ${data.commits[0].message}`);
          engine.current?.enter(updated, undefined, true);
        } else if (
          alive &&
          (data.ci !== repoRef.current?.ci || data.openPRs !== repoRef.current?.openPRs)
        ) {
          const updated = { ...data, files: repoRef.current?.files || data.files };
          setRepo(updated);
          repoRef.current = updated;
          engine.current?.enter(updated, undefined, true);
        } else if (alive) {
          const updated = { ...data, files: repoRef.current?.files || data.files };
          setRepo(updated);
          repoRef.current = updated;
          engine.current?.refreshStreetLife(updated);
          engine.current?.refreshRecognition(updated);
        }
      } catch (e) {
        if (alive && [404, 410].includes((e as { status?: number }).status || 0)) {
          engine.current?.removeCity(activeRepoId);
          repoRef.current = null;
          setRepo(null);
          setError((e as Error).message);
        }
      } finally {
        refreshing = false;
      }
    }, 60000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [activeRepoId]);
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    else if (!modal && dialog.current?.open) dialog.current.close();
  }, [modal]);
  useEffect(() => {
    if (!activeFilePath || !activeRepoId) return;
    const controller = new AbortController();
    setSource('');
    setSourceError('');
    api<{
      source: string;
      file: CodeFile;
      landPlan?: Repo['landPlan'];
      sourceInventory?: Repo['sourceInventory'];
      ref?: string;
    }>(
      `/api/source/${activeRepoId}?path=${encodeURIComponent(activeFilePath)}&loaded=${repoRef.current?.files.length || 0}`,
      { signal: controller.signal },
    )
      .then((d) => {
        if (controller.signal.aborted) return;
        setSource(d.source);
        recordDiscovery(activeRepoId, 'file', d.file.path);
        setFile(d.file);
        const existing = repoRef.current;
        if (!existing) return;
        if (!engine.current?.filePositions.has(d.file.path)) {
          const directory = d.file.path.includes('/') ? d.file.path.split('/')[0] : '.';
          const data = {
            ...existing,
            landPlan: d.landPlan || existing.landPlan,
            sourceInventory: d.sourceInventory?.ref
              ? d.sourceInventory
              : existing.sourceInventory || d.sourceInventory,
            directories: existing.directories.some((d) => d.name === directory)
              ? existing.directories
              : [...existing.directories, { name: directory, count: 1 }],
            files: [...existing.files.filter((f) => f.path !== d.file.path), d.file],
          };
          repoRef.current = data;
          setRepo(data);
          engine.current?.enter(data, undefined, true);
          engine.current?.enterFile(d.file.path);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setSourceError(e.message);
      });
    return () => controller.abort();
  }, [activeFilePath, activeRepoId, recordDiscovery]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let value = input
      .trim()
      .replace(/^https?:\/\/(?:www\.)?(?:github\.com|gitcity\.co)\//, '')
      .replace(/^github\.com\//, '')
      .replace(/^\/+|\/+$/g, '');
    value = value.split(/[?#]/)[0];
    if (
      !/^[\w.-]+(?:\/[\w.@%+ -]+)*$/.test(value) ||
      value.split('/').some((p) => p === '.' || p === '..')
    ) {
      setSearchError('Enter a GitHub username, owner/repo, or a link to a file.');
      return;
    }
    setSearchError('');
    navigate('/' + value);
    setInput('');
  };
  const share = async () => {
    try {
      if (navigator.share && window.innerWidth < 700)
        await navigator.share({ title: document.title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      setNotice('Copy this address from your browser to share the city.');
    }
  };
  const sync = async () => {
    setWorking(true);
    try {
      await api('/api/sync', { method: 'POST', body: JSON.stringify({ restart: true }) });
      setSyncPhase('Restoring your history');
    } catch (e) {
      setNotice((e as Error).message);
      setWorking(false);
    }
  };
  useEffect(() => {
    if (!working || !syncPhase) return;
    let cancelled = false,
      checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const job = await api<{ running: boolean; phase: string; error?: string; awarded: number }>(
          '/api/sync',
          { method: 'POST' },
        );
        if (cancelled) return;
        setSyncPhase(job.phase);
        if (!job.running) {
          setWorking(false);
          setSyncPhase('');
          await refreshPlayer();
          const current = repoRef.current;
          if (current) {
            try {
              const fresh = await api<Repo>(`/api/repos/${current.id}`);
              if (repoRef.current?.id === current.id) {
                const updated = {
                  ...repoRef.current,
                  residents: fresh.residents,
                  civic: fresh.civic,
                  treasury: fresh.treasury,
                };
                repoRef.current = updated;
                setRepo(updated);
                engine.current?.refreshRecognition(updated);
              }
            } catch {
              // The verified ledger is already restored. The regular repository
              // refresh will retry civic metadata without replaying the import.
            }
          }
          setNotice(job.error || `History restored. ${job.awarded || 0} structure credits earned.`);
        }
      } catch (e) {
        if (!cancelled) {
          setWorking(false);
          setSyncPhase('');
          setNotice((e as Error).message);
        }
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void check(), 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [working, syncPhase, refreshPlayer]);
  useEffect(() => {
    if (player && new URLSearchParams(window.location.search).has('welcome')) {
      window.history.replaceState({}, '', window.location.pathname);
      void sync();
      setModal('passport');
    }
  }, [player]);
  useEffect(() => {
    const world = engine.current;
    if (!world || !activeRepoId) return;
    let alive = true;
    const pending = new Set<string>();
    const cursors = new Map<string, string | null>();
    let queue = Promise.resolve();
    const directoryPending = (directory: string) =>
      [...pending].some((key) => key.startsWith(directory + '\0'));
    setDirectoryPages({});
    world.onDirectory = async (directory, block) => {
      const key = directory + '\0' + (block ?? 'all');
      if (pending.has(key) || cursors.get(key) === null) return;
      pending.add(key);
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      setDirectoryPages((pages) => ({
        ...pages,
        [directory]: { ...pages[directory], pending: true },
      }));
      await previous;
      try {
        if (!alive || repoRef.current?.id !== activeRepoId) return;
        const snapshot = repoRef.current.sourceInventory?.ref || repoRef.current.ref || '';
        const result = await api<{
          directory: string;
          files: CodeFile[];
          total: number;
          nextCursor?: string | null;
          landPlan?: Repo['landPlan'];
          sourceInventory?: Repo['sourceInventory'];
          ref?: string;
        }>(
          `/api/district/${activeRepoId}?directory=${encodeURIComponent(directory)}&cursor=${encodeURIComponent(cursors.get(key) || '')}&loaded=${repoRef.current?.files.length || 0}${block === undefined ? '' : `&block=${block}&ref=${encodeURIComponent(snapshot)}`}`,
        );
        if (!alive || repoRef.current?.id !== activeRepoId) return;
        const existing = repoRef.current;
        if (result.ref && existing.ref && result.ref !== existing.ref) {
          throw new Error(
            'The city changed while this block was being explored. Try the block again.',
          );
        }
        const files = mergeSourceFiles(existing.files, result.files);
        const data = {
          ...existing,
          landPlan: result.landPlan || existing.landPlan,
          sourceInventory: result.sourceInventory || existing.sourceInventory,
          files,
        };
        if (block === undefined || result.files.every((file) => file.analysis !== 'unavailable'))
          cursors.set(key, result.nextCursor ?? null);
        setDirectoryPages((pages) => ({
          ...pages,
          [directory]: {
            ...pages[directory],
            ...(block === undefined ? { cursor: result.nextCursor ?? null } : {}),
            total: result.total,
            pending: directoryPending(directory),
          },
        }));
        setRepo(data);
        repoRef.current = data;
        world.enter(data, undefined, true);
        setPhase(
          `${directory} · ${files.filter((f) => (f.path.includes('/') ? f.path.split('/')[0] : '.') === directory).length} of ${result.total} source buildings resolved`,
        );
        return true;
      } catch (e) {
        if (alive) {
          if ((e as Error & { status?: number }).status === 409) {
            cursors.delete(key);
            if (block === undefined) setDirectoryPages((pages) => ({ ...pages, [directory]: {} }));
          }
          setNotice((e as Error).message);
          // A click on the block can retry after a transient failure.
        }
        return false;
      } finally {
        pending.delete(key);
        release();
        if (alive)
          setDirectoryPages((pages) => ({
            ...pages,
            [directory]: { ...pages[directory], pending: directoryPending(directory) },
          }));
      }
    };
    return () => {
      alive = false;
      world.onDirectory = null;
    };
  }, [activeRepoId, ready, sourceRevision]);
  useEffect(() => {
    if (!repo) return;
    engine.current?.applyPresentation(
      player?.possessions.filter((p) => p.repo === repo.id).map((p) => p.item) || [],
      repo.civic || [],
    );
    let alive = true;
    api<{ role: string; districtRole: string | null }>(
      `/api/governance/${repo.id}?path=${encodeURIComponent(file?.path || '')}`,
    )
      .then((result) => {
        if (alive) {
          setCivicRole(result.role);
          setDistrictRole(result.districtRole);
        }
      })
      .catch(() => {
        if (alive) setCivicRole('Tourist');
      });
    return () => {
      alive = false;
    };
  }, [repo, player, file?.path]);
  const buy = async (item: string) => {
    if (!repo) return;
    setWorking(true);
    try {
      await api('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repo.id, item }),
      });
      await refreshPlayer();
      const updated = await api<Repo>(`/api/repos/${repo.id}`);
      setRepo(updated);
      repoRef.current = updated;
      engine.current?.applyPresentation(
        player?.possessions
          .filter((p) => p.repo === repo.id)
          .map((p) => p.item)
          .concat(item) || [item],
        updated.civic || [],
      );
      setNotice(
        item === 'pavilion'
          ? 'Your earned pavilion now stands beside city hall.'
          : 'Your city palette is saved.',
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const buildCommunity = async () => {
    if (!repo) return;
    setWorking(true);
    try {
      await api('/api/civic/pavilion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repo.id }),
      });
      const updated = await api<Repo>(`/api/repos/${repo.id}`);
      setRepo(updated);
      repoRef.current = updated;
      setNotice('A community pavilion, built with earned upstream contributions.');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const owner = current.owner,
    repoId = current.repo ? `${owner}/${current.repo}` : null;
  return (
    <main
      className={`gitcity-app${owner || walking ? ' exploring-city' : ''}${cityDetailsExpanded ? ' city-details-expanded' : ' city-details-collapsed'}${highwayTravel || walkingTravel ? ' highway-travel-active' : ''}`}
    >
      <div ref={viewport} className="world-viewport" />
      <div className="world-vignette" />
      {arriving && !webglError && (
        <div className="city-arrival" role="status" aria-live="polite">
          <span className="eyebrow">CITY UNDER CONSTRUCTION</span>
          <p>{phase}</p>
          <small>Drag to orbit · scroll to explore as it grows</small>
        </div>
      )}
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')} aria-label="Gitcity world">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          gitcity<span className="alpha">ALPHA</span>
        </button>
        <nav aria-label="Main navigation">
          {player && (
            <button onClick={() => navigate('/' + encodeURIComponent(player.login))}>
              <MapPin size={15} />
              Your city
            </button>
          )}
          <button className={isWorld ? 'nav-active' : ''} onClick={() => navigate('/')}>
            <Globe2 size={15} />
            Explore
          </button>
          <button onClick={() => setModal('about')}>
            How it works
            <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="project-links">
          <a
            href="https://github.com/ethanplusai/gitcity.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={15} /> GitHub
          </a>
          <a href="https://x.com/ethanplusai" target="_blank" rel="noopener noreferrer">
            Created by Ethan <ArrowUpRight size={13} />
          </a>
        </div>
        <div className="header-actions">
          <button
            className="search-trigger"
            onClick={() => setModal('search')}
            aria-label="Find a repository"
          >
            <Search size={16} />
            <span>Find a city</span>
            <kbd>/</kbd>
          </button>
          <button className="signin" onClick={() => setModal('passport')}>
            <Github size={16} />
            <span>{player ? player.login : 'Sign in'}</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </header>
      <div className="breadcrumb">
        <button onClick={() => navigate('/')}>
          <Globe2 size={13} />
          The open world
        </button>
        {owner && (
          <>
            <span>/</span>
            <button onClick={() => navigate('/' + owner)}>{owner}</button>
          </>
        )}
        {current.repo && (
          <>
            <span>/</span>
            <button onClick={() => navigate('/' + repoId)}>{current.repo}</button>
          </>
        )}
        <span className="crumb-status">
          <i />
          {isWorld
            ? 'WORLD VIEW'
            : isOwner
              ? 'CITY VIEW'
              : walking
                ? 'STREET LEVEL'
                : 'DISTRICT VIEW'}
        </span>
      </div>
      {isWorld ? (
        <section className="world-intro">
          <div className="eyebrow">
            <span />
            OPEN SOURCE. OPEN WORLD.
          </div>
          <h1>
            A world built
            <br />
            by <em>all of us.</em>
          </h1>
          <p>
            Every community, a city.
            <br />
            Every contribution, a place in it.
          </p>
          <button
            className="primary"
            onClick={() => {
              setInput('');
              setModal('search');
            }}
          >
            Find your city
            <ArrowRight size={17} />
          </button>
          <div className="tourist-note">
            <Globe2 size={13} />
            No account. Just curiosity.
          </div>
          <div className="world-key">
            <span>
              <i className="key-city" />
              Community cities
            </span>
            <span>
              <i className="key-road" />
              Connected neighborhoods
            </span>
            <small>Real source snapshots. Live detail on arrival.</small>
          </div>
        </section>
      ) : (
        <aside className="repo-panel" id="city-details-panel">
          <button className="back-link" onClick={() => navigate('/')}>
            <ArrowLeft size={13} />
            Back to the world
          </button>
          <div className="eyebrow">
            {isOwner ? 'CITY NEIGHBORHOODS' : 'REPOSITORY NEIGHBORHOOD'}
          </div>
          <div className="repo-heading">
            <h1 title={isOwner ? owner || undefined : current.repo || undefined}>
              {isOwner ? owner : current.repo}
            </h1>
            <div className="phone-city-actions">
              {!isOwner && repo && !walking && (
                <button
                  aria-label="Walk through this neighborhood"
                  onClick={() => {
                    setCityDetailsExpanded(false);
                    engine.current?.street();
                  }}
                >
                  <Footprints size={16} /> Walk
                </button>
              )}
              {!isOwner && repo && walking && (
                <button
                  aria-label="View the whole city"
                  onClick={() => {
                    setCityDetailsExpanded(false);
                    engine.current?.overview();
                  }}
                >
                  <ArrowUpRight size={16} /> City view
                </button>
              )}
              <button
                aria-label={cityDetailsExpanded ? 'Collapse city details' : 'Expand city details'}
                aria-expanded={cityDetailsExpanded}
                aria-controls="city-details-panel"
                onClick={() => setCityDetailsExpanded((expanded) => !expanded)}
              >
                {cityDetailsExpanded ? <Minus size={16} /> : <Plus size={16} />}
                Details
              </button>
            </div>
          </div>
          <p className="repo-description">
            {isOwner
              ? `${owner} is a city. Its repositories are neighborhoods; source directories are blocks.`
              : repo?.description || 'A new place in the open-source world.'}
          </p>
          {!isOwner && repo?.cached && (
            <p className="cached-notice">
              Cached source city · live GitHub data unavailable. Unknown activity is shown as
              unknown.
            </p>
          )}
          {!isOwner && repo && (
            <button
              className="primary wide open-dispatch"
              onClick={() =>
                document
                  .querySelector('.dispatch-board')
                  ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
              }
            >
              Play a city round <ArrowRight size={15} />
            </button>
          )}
          {!isOwner && (
            <div className="resident-badge">
              <MapPin size={13} />
              {civicRole}
              <span>Everyone is welcome</span>
            </div>
          )}
          {isOwner && ownerCities.some((city) => city.cached) && (
            <p className="cached-notice">
              Cached neighborhoods only. The full city directory will return when GitHub’s API is
              available.
            </p>
          )}
          {isOwner && ownerCities.length > 0 && (
            <button
              className="primary wide"
              onClick={() => engine.current?.ownerView(ownerCities, false, false, true)}
            >
              <Globe2 size={17} /> View the whole city
            </button>
          )}
          {error && (
            <div className="error-panel" role="alert">
              {error}
              <button
                onClick={() => {
                  setRoute('/');
                  setTimeout(() => setRoute(routeRef.current), 0);
                }}
              >
                Resume construction
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {isOwner ? (
            <div className="owner-list">
              {ownerCities.slice(0, ownerListLimit).map((c) => (
                <button key={c.id} onClick={() => navigate('/' + c.id)}>
                  <Layers3 size={15} />
                  <span>
                    {c.name}
                    <small>{c.language || 'Public repository'}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {ownerCities.length > ownerListLimit && (
                <button onClick={() => setOwnerListLimit((limit) => limit + 60)}>
                  Show more neighborhoods ({ownerCities.length - ownerListLimit} more)
                  <ArrowDown size={15} />
                </button>
              )}
            </div>
          ) : !error && repo ? (
            <>
              <div className="repo-stats">
                <div>
                  <strong>{compact(repo.totalFiles)}</strong>
                  <span>{repo.cached ? 'source samples' : 'files'}</span>
                </div>
                <div>
                  <strong>{compact(repo.stars)}</strong>
                  <span>stars</span>
                </div>
                <div>
                  <strong>
                    {typeof repo.openPRs === 'number' &&
                    Number.isFinite(repo.openPRs) &&
                    repo.openPRs >= 0
                      ? `${repo.openPRs}${repo.prsSampled ? '+' : ''}`
                      : '—'}
                  </strong>
                  <span>open PRs</span>
                </div>
              </div>
              <div className="panel-tabs">
                <button
                  className={tab === 'overview' ? 'active' : ''}
                  onClick={() => setTab('overview')}
                >
                  Overview
                </button>
                <button
                  className={tab === 'districts' ? 'active' : ''}
                  onClick={() => setTab('districts')}
                >
                  Buildings <span>{repo.files.length}</span>
                </button>
              </div>
              {tab === 'overview' ? (
                <>
                  <div className="city-condition">
                    <Sun size={19} />
                    <div>
                      {repo.ci === 'success'
                        ? 'Clear skies'
                        : repo.ci === 'failure' || repo.ci === 'error'
                          ? 'Storm front'
                          : repo.ci === 'pending'
                            ? 'Clouds gathering'
                            : 'Weather unreported'}
                      <small>
                        {!['success', 'failure', 'error', 'pending'].includes(repo.ci)
                          ? 'No commit status reported'
                          : `CI status · ${repo.ci}`}
                      </small>
                    </div>
                  </div>
                  <button
                    className="primary wide"
                    onClick={() => {
                      setCityDetailsExpanded(false);
                      engine.current?.street();
                      setWalking(true);
                    }}
                  >
                    <Footprints size={16} />
                    Walk the streets
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="secondary wide"
                    onClick={() => {
                      engine.current?.cityHall();
                      recordDiscovery(repo.id, 'hall');
                      setModal('hall');
                    }}
                  >
                    <Landmark size={16} />
                    Visit city hall
                    <ArrowUpRight size={14} />
                  </button>
                  {nearbyCities.length > 0 && (
                    <section
                      aria-label="Connected neighborhoods"
                      className="connected-neighborhoods"
                    >
                      <span className="eyebrow">AROUND THE CITY</span>
                      {nearbyCities.map((city) => (
                        <button
                          key={city.id}
                          className="secondary wide"
                          onClick={() => engine.current?.walkToNeighborhood(city.id)}
                        >
                          <Footprints size={15} />
                          Walk to {city.name}
                          <ArrowRight size={14} />
                        </button>
                      ))}
                    </section>
                  )}
                  {repo.dependencies.some((dependency) => dependency.repo) && (
                    <button
                      className="secondary wide"
                      onClick={() => {
                        setHighwayDestinations(
                          [
                            ...new Set(
                              repo.dependencies.flatMap((dependency) =>
                                dependency.repo ? [dependency.repo] : [],
                              ),
                            ),
                          ].sort(),
                        );
                        setModal('highway');
                      }}
                    >
                      <GitBranch size={16} /> Dependency destinations <ArrowUpRight size={14} />
                    </button>
                  )}
                  <CityOperations repo={repo} engine={engine.current} />
                  <CityChallenges
                    key={repo.id}
                    repo={repo}
                    engine={engine.current}
                    onVerified={player ? refreshAcceptedWork : undefined}
                    onVisit={visitVerifiedContribution}
                    onSignIn={() => setModal('passport')}
                  />
                  <div className="tour-actions">
                    <button className="secondary" onClick={() => engine.current?.overview()}>
                      Bird’s-eye view
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        const target = repo.files[tourIndex % repo.files.length];
                        if (target) {
                          engine.current?.inspect(target.path);
                          setTourPath(target.path);
                          setTourIndex(tourIndex + 1);
                        }
                      }}
                    >
                      Next landmark
                    </button>
                  </div>
                  {tourPath && (
                    <button
                      className="tour-target"
                      onClick={() =>
                        navigate(
                          '/' +
                            repo.id +
                            '/' +
                            tourPath.split('/').map(encodeURIComponent).join('/'),
                        )
                      }
                    >
                      Enter {tourPath}
                    </button>
                  )}
                  <p className="field-summary">
                    {progress.cities} cities visited · {progress.buildings} source buildings
                    explored
                  </p>
                  {repo.commits[0] && (
                    <div className="latest-commit">
                      <span className="eyebrow">LATEST COMMIT</span>
                      <p>
                        <GitBranch size={14} />
                        {repo.commits[0].message}
                      </p>
                      <small>
                        @{repo.commits[0].author} · {relative(repo.commits[0].date)}
                      </small>
                    </div>
                  )}
                  <p className="coverage">
                    Lighting follows your device’s local clock, including daylight saving.{' '}
                    {repo.historyCoverage || 'History coverage unavailable'}.{' '}
                    {repo.truncated
                      ? repo.cached
                        ? 'Only cached source samples are available. '
                        : 'GitHub returned a partial tree. '
                      : ''}
                    {Number.isFinite(Date.parse(repo.fetchedAt))
                      ? `Source data as of ${new Date(repo.fetchedAt).toLocaleDateString()}.`
                      : 'Source refresh date unavailable.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="file-list">
                    {repo.directories.map((directory) => {
                      const state = directoryPages[directory.name];
                      const loaded = repo.files.filter(
                        (f) =>
                          (f.path.includes('/') ? f.path.split('/')[0] : '.') === directory.name,
                      ).length;
                      return (
                        <button
                          key={'directory:' + directory.name}
                          disabled={
                            state?.pending || state?.cursor === null || loaded >= directory.count
                          }
                          onClick={() => engine.current?.onDirectory?.(directory.name)}
                        >
                          <Code2 size={13} />
                          <span>
                            {directory.name}
                            <small>
                              {loaded} of {state?.total ?? directory.count} source buildings ·{' '}
                              {state?.pending
                                ? 'Constructing next block…'
                                : state?.cursor === null || loaded >= directory.count
                                  ? 'Explored'
                                  : 'Explore more'}
                            </small>
                          </span>
                          <ArrowDown size={12} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="file-list">
                    {repo.files.map((f) => (
                      <button
                        key={f.path}
                        onClick={() =>
                          navigate(
                            '/' +
                              repo.id +
                              '/' +
                              f.path.split('/').map(encodeURIComponent).join('/'),
                          )
                        }
                      >
                        <Code2 size={13} />
                        <span>
                          {f.path}
                          <small>
                            {f.symbols ?? '—'} symbols · {f.analysis}
                          </small>
                        </span>
                        <ArrowUpRight size={12} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="construction-status">
              <span className="construction-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <p>
                The ground is yours.
                <br />
                <small>Roads and source buildings follow.</small>
              </p>
            </div>
          )}
        </aside>
      )}
      <div className="map-coordinate">
        <span>GITCITY ATLAS</span>
        <i />
        PERSISTENT WORLD
        <span className="coordinate-sub">
          {isWorld
            ? '00° 00′ N   /   00° 00′ E'
            : `${Math.round(coordinates(repoId || owner || '').x)} E / ${Math.round(coordinates(repoId || owner || '').z)} N`}
        </span>
      </div>
      <div className="map-controls">
        <button
          onClick={() => engine.current?.north()}
          aria-label="Face north"
          className="north-control"
        >
          <span>N</span>
          <Compass size={28} />
        </button>
        <div className="zoom-controls">
          <button onClick={() => engine.current?.zoom(0.78)} aria-label="Zoom in">
            <Plus size={18} />
          </button>
          <button onClick={() => engine.current?.zoom(1.28)} aria-label="Zoom out">
            <Minus size={18} />
          </button>
        </div>
        <button onClick={() => void share()} aria-label="Share this view">
          {copied ? <Check size={17} /> : <Share2 size={17} />}
        </button>
      </div>
      <div className="altitude">
        <span>{walking ? 'STREET LEVEL' : 'ALTITUDE'}</span>
        <strong>
          {height.toLocaleString()}
          <small> m</small>
        </strong>
        <div>
          <i style={{ height: `${Math.min(100, height / 18)}%` }} />
        </div>
      </div>
      {isWorld && (
        <section className="discover">
          <div className="discover-heading">
            <div>
              <span className="eyebrow">SOMEWHERE TO START</span>
              <h2>Great code. Great cities.</h2>
            </div>
            <button onClick={() => setModal('search')}>
              Explore a repository
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="city-cards">
            {atlas.slice(0, 4).map((city, index) => (
              <button
                key={city.id}
                className="city-card"
                style={{ '--accent': city.color } as React.CSSProperties}
                onClick={() => navigate('/' + city.id.split('/')[0])}
              >
                <div className="card-top">
                  <span className="city-icon">
                    {index === 0 ? (
                      '⚛'
                    ) : index === 1 ? (
                      'N'
                    ) : index === 2 ? (
                      <Code2 size={22} />
                    ) : (
                      'R'
                    )}
                  </span>
                  <span className="card-topic">{city.topic}</span>
                  <ArrowUpRight size={16} />
                </div>
                <h3>
                  {city.id.split('/')[0]}
                  <span>{city.name} neighborhood</span>
                </h3>
                <div className="card-bottom">
                  <span>
                    <i />
                    {city.language}
                  </span>
                  <span>
                    Visit city
                    <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {(highwayTravel || walkingTravel) && (
        <section
          className="highway-travel"
          aria-label={highwayTravel ? 'Highway journey' : 'Walking route'}
        >
          <div>
            <span className="eyebrow">ON FOOT</span>
            <strong>{(highwayTravel || walkingTravel)!.destination}</strong>
            <span>
              {(highwayTravel || walkingTravel)!.seconds < 10
                ? 'Approaching your destination'
                : (highwayTravel || walkingTravel)!.seconds < 60
                  ? 'Less than a minute remaining'
                  : `About ${Math.ceil((highwayTravel || walkingTravel)!.seconds / 60)} minutes remaining`}
            </span>
            {walkingTravel && (
              <span className="walking-distance">{walkingTravel.distance} m along the streets</span>
            )}
          </div>
          <button className="secondary" onClick={() => engine.current?.stopWalkingRoute()}>
            Stop walking
          </button>
        </section>
      )}
      {!isWorld && walking && (
        <div className="walking-controls">
          <button
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              engine.current?.keys.add('w');
            }}
            onPointerUp={() => engine.current?.keys.delete('w')}
            onPointerCancel={() => engine.current?.keys.delete('w')}
            onLostPointerCapture={() => engine.current?.keys.delete('w')}
            onPointerLeave={() => engine.current?.keys.delete('w')}
            aria-label="Walk forward"
          >
            <ArrowUpRight style={{ transform: 'rotate(-45deg)' }} size={22} />
          </button>
          <button
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              engine.current?.keys.add('s');
            }}
            onPointerUp={() => engine.current?.keys.delete('s')}
            onPointerCancel={() => engine.current?.keys.delete('s')}
            onLostPointerCapture={() => engine.current?.keys.delete('s')}
            onPointerLeave={() => engine.current?.keys.delete('s')}
            aria-label="Walk backward"
          >
            <ArrowDown size={22} />
          </button>
          <span>Drag to look around</span>
        </div>
      )}
      <footer className="statusbar">
        <div className="world-status">
          <i />
          {phase}
        </div>
        <span className="interaction-hint">
          Drag to orbit<span>·</span>Scroll to descend<span>·</span>Click to explore
        </span>
        <div>
          <button
            onClick={async () => {
              try {
                setSound(await engine.current!.audio.toggle());
              } catch {
                setNotice('Audio is unavailable on this device.');
              }
            }}
            aria-label={sound ? 'Mute ambient sound' : 'Enable ambient sound'}
          >
            {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>Sound {sound ? 'on' : 'off'}</span>
          </button>
          <button onClick={() => setModal('about')} aria-label="World guide">
            <HelpCircle size={15} />
          </button>
        </div>
      </footer>
      {webglError && (
        <div className="webgl-error" role="alert">
          {webglError}
          <button onClick={() => setModal('search')}>
            Find a repository
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Sparkles size={16} />
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
      <dialog
        aria-label={
          modal === 'highway'
            ? 'Dependency destinations'
            : modal === 'search'
              ? 'Find a city'
              : modal === 'file'
                ? 'Source building'
                : modal === 'hall'
                  ? 'City hall'
                  : modal === 'passport'
                    ? 'Contributor passport'
                    : 'World guide'
        }
        ref={dialog}
        onCancel={closeDialog}
        onClick={(e) => {
          if (e.target === dialog.current) closeDialog();
        }}
        className={`modal modal-${modal || 'closed'}`}
      >
        <div className="modal-toolbar">
          <button className="modal-close" onClick={closeDialog} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          {modal === 'highway' && (
            <>
              <span className="eyebrow">CONNECTED THROUGH CODE</span>
              <h2>Where does this road lead?</h2>
              <p>Explore the cities behind this repository’s dependencies.</p>
              <div className="owner-list">
                {highwayDestinations.map((id) => (
                  <div key={id}>
                    <button
                      onClick={() =>
                        navigate('/' + id.split('/').map(encodeURIComponent).join('/'))
                      }
                    >
                      <span>
                        {id.split('/')[0]}
                        <small>{id.split('/').slice(1).join('/')} neighborhood</small>
                      </span>
                      <span>
                        Visit <ArrowUpRight size={16} />
                      </span>
                    </button>
                    {Boolean(engine.current?.dependencyWalk(id).length) && (
                      <button
                        aria-label={`Walk to ${id}`}
                        onClick={() => {
                          if (engine.current?.walkToDependency(id)) setModal(null);
                        }}
                      >
                        <Footprints size={16} /> Walk along the connecting road{' '}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {modal === 'search' && (
            <>
              <span className="eyebrow">YOUR NEXT DESTINATION</span>
              <h2>There’s a city in every repo.</h2>
              <p>
                A username, a repository, or a link to a single file.
                <br />
                You don’t need an account to step inside.
              </p>
              <form onSubmit={submit}>
                <label htmlFor="destination">GitHub destination</label>
                <div className="destination-input">
                  <Github size={20} />
                  <input
                    id="destination"
                    autoFocus
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setSearchError('');
                    }}
                    placeholder="owner / repository"
                    autoComplete="off"
                  />
                  <button aria-label="Visit destination">
                    <ArrowRight size={21} />
                  </button>
                </div>
                {searchError && (
                  <p role="alert" className="form-error">
                    {searchError}
                  </p>
                )}
              </form>
              <div className="suggestions">
                {atlas.map((city) => (
                  <button key={city.id} onClick={() => navigate('/' + city.id)}>
                    <span style={{ background: city.color }} />
                    {city.id}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
              <div className="url-tip">
                <span>github.com</span> / owner / repo <ArrowRight size={13} />
                <strong>gitcity.co</strong> / owner / repo
              </div>
            </>
          )}
          {modal === 'about' && (
            <>
              <span className="eyebrow">THE WORLD GUIDE</span>
              <h2>
                Code is the architecture.
                <br />
                You are the life.
              </h2>
              <div className="guide-grid">
                <article>
                  <Globe2 />
                  <h3>One continuous world</h3>
                  <p>
                    Orbit repositories, descend into a district, and walk up to a source building. A
                    shared URL brings you straight there.
                  </p>
                </article>
                <article>
                  <Code2 />
                  <h3>Built from what’s real</h3>
                  <p>
                    Parsed symbols shape buildings. Dependencies connect cities. Commits light
                    windows. Uncharted places stay survey sites until their source arrives.
                  </p>
                </article>
                <article>
                  <GitBranch />
                  <h3>Leave your mark</h3>
                  <p>
                    Your activity earns cosmetic credits. Pull requests accepted by another human
                    outside your own repositories earn structure credits.
                  </p>
                </article>
                <article>
                  <ShieldCheck />
                  <h3>Belong by contributing</h3>
                  <p>
                    Tourists are welcome. Merged contributors become residents. GitHub permissions
                    and CODEOWNERS define civic responsibility.
                  </p>
                </article>
              </div>
              <div className="guide-controls">
                <span>
                  <kbd>Drag</kbd> Orbit / look
                </span>
                <span>
                  <kbd>Scroll</kbd> Change altitude
                </span>
                <span>
                  <kbd>W A S D</kbd> Walk
                </span>
                <span>
                  <kbd>/</kbd> Find a city
                </span>
              </div>
              <p className="coverage">
                Vehicle model derived from Car Concept by Eric Chadwick / Darmstadt Graphics Group
                GmbH, CC BY 4.0.{' '}
                <a href="/models/car-concept-license.txt" target="_blank" rel="noreferrer">
                  Asset credit and modifications
                </a>
              </p>
              <p className="coverage">
                Early world preview. Source analysis and history are bounded for fast visits.
                Unknown data is left unreported. Maintainers can opt out with a{' '}
                <code>.gitcity-opt-out</code> file or the <code>gitcity-opt-out</code> repository
                topic.
              </p>
            </>
          )}
          {modal === 'passport' && (
            <>
              <span className="eyebrow">YOUR OPEN-SOURCE PASSPORT</span>
              <h2>{player ? `Welcome, ${player.login}.` : 'You already belong here.'}</h2>
              <p>
                {player
                  ? 'Restore your GitHub history, then make this world a little more yours.'
                  : 'You don’t start from zero. Sign in to restore the contributions you’ve already made.'}
              </p>
              <div className="passport">
                <div className="passport-stamp">
                  <Globe2 size={42} />
                  <span>
                    GITCITY
                    <br />
                    OPEN WORLD
                  </span>
                </div>
                <div>
                  <small>TRAVELER</small>
                  <strong>{player ? '@' + player.login : 'Every curious human'}</strong>
                  <span>{player ? 'Contributor passport' : 'Tourist · always welcome'}</span>
                </div>
              </div>
              {player ? (
                <>
                  <button
                    className="primary wide"
                    onClick={() => navigate('/' + encodeURIComponent(player.login))}
                  >
                    <MapPin size={17} />
                    Visit your city
                    <ArrowRight size={16} />
                  </button>
                  <p className="coverage">
                    Your public repositories form the neighborhoods of your city. Repositories that
                    opt out are excluded.
                  </p>
                  <div className="balance-grid">
                    <div>
                      <Sparkles size={19} />
                      <strong>{player.soft}</strong>
                      <span>Cosmetic credits</span>
                      <small>Earned from your own commits</small>
                    </div>
                    <div>
                      <Landmark size={19} />
                      <strong>{player.hard}</strong>
                      <span>Structure credits</span>
                      <small>Earned from accepted outward work</small>
                    </div>
                  </div>
                  <button className="primary wide" disabled={working} onClick={() => void sync()}>
                    <GitBranch size={17} />
                    {working
                      ? syncPhase || 'Restoring your contribution history…'
                      : 'Restore contribution history'}
                    <ArrowRight size={16} />
                  </button>
                  <VerifyContribution
                    onVerified={refreshAcceptedWork}
                    onVisit={visitVerifiedContribution}
                  />
                  <button
                    className="text-button"
                    onClick={async () => {
                      await api('/api/logout', { method: 'POST' });
                      setPlayer(null);
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : configured ? (
                <button
                  className="primary wide"
                  onClick={() =>
                    window.location.assign(
                      '/auth/github?returnTo=' + encodeURIComponent(window.location.pathname),
                    )
                  }
                >
                  <Github size={18} />
                  Continue with GitHub
                  <ArrowUpRight size={16} />
                </button>
              ) : (
                <div className="setup-note">
                  You can explore the whole public world as a tourist. Contributor passports will
                  open when GitHub sign-in is configured for this deployment.
                </div>
              )}
              <p className="coverage">
                Gitcity displays public repositories only. Private repositories never appear on the
                platform, and signing in does not give Gitcity access to them.
              </p>
              <div className="passport-rule">
                <ShieldCheck size={17} />
                <span>Structure is earned. Presentation is yours.</span>
              </div>
            </>
          )}
          {modal === 'hall' && repo && (
            <>
              <span className="eyebrow">{repo.id} · CIVIC LAYER</span>
              <h2>A good place to contribute.</h2>
              <p>Start with an issue. Leave with a place in the city.</p>
              {player &&
                repo.residents?.some(
                  (resident) => resident.login.toLowerCase() === player.login.toLowerCase(),
                ) && (
                  <section className="accepted-work" aria-label="Your accepted work">
                    <h3 className="section-label">YOUR ACCEPTED WORK</h3>
                    <p>
                      Your verified contributions are marked on these buildings. Open a file to
                      visit its archive and attribution.
                    </p>
                    <div className="accepted-work-list">
                      {repo.residents
                        .filter(
                          (resident) => resident.login.toLowerCase() === player.login.toLowerCase(),
                        )
                        .map((resident) => (
                          <button
                            className="secondary wide"
                            key={resident.path}
                            onClick={() => {
                              setModal(null);
                              navigate(
                                `/${repo.id}/${resident.path.split('/').map(encodeURIComponent).join('/')}`,
                              );
                            }}
                          >
                            <span>
                              {resident.path}
                              <small>Accepted contribution · PR #{resident.pr}</small>
                            </span>
                            <ArrowRight size={16} />
                          </button>
                        ))}
                    </div>
                  </section>
                )}
              <h3 className="section-label">
                THE NOTICEBOARD <span>Open issue sample · from GitHub</span>
              </h3>
              <div className="bounties">
                {repo.issues.some((issue) => !engine.current?.isIssueClosed(repo.id, issue)) ? (
                  repo.issues
                    .filter((issue) => !engine.current?.isIssueClosed(repo.id, issue))
                    .map((issue) => (
                      <article className="bounty-card" key={issue.number}>
                        <a
                          className="bounty-link"
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="issue-number">#{issue.number}</span>
                          <span>
                            {issue.title}
                            <small>Contribution opportunity · no cash bounty promised</small>
                          </span>
                          <ExternalLink size={16} />
                        </a>
                        <button
                          className="secondary wide"
                          aria-label={`Explore issue #${issue.number}`}
                          onClick={() => {
                            setModal(null);
                            engine.current?.selectIssue(issue.number);
                            engine.current?.walkToIssue(issue.number);
                          }}
                        >
                          <MapPin size={15} /> Explore work site <ArrowRight size={15} />
                        </button>
                      </article>
                    ))
                ) : (
                  <div className="empty-notice">
                    {repo.issuesAvailable === false
                      ? 'Issue data is unavailable right now.'
                      : 'No open issues in the current sample.'}
                    <a
                      href={`https://github.com/${repo.id}/issues`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Browse open issues
                      <ArrowUpRight size={14} />
                    </a>
                  </div>
                )}
              </div>
              {player && (
                <VerifyContribution
                  onVerified={refreshAcceptedWork}
                  onVisit={visitVerifiedContribution}
                />
              )}
              <FieldNotebook
                key={repo.id}
                repo={repo}
                onVerified={player ? refreshAcceptedWork : undefined}
                onVisit={visitVerifiedContribution}
                onSignIn={() => setModal('passport')}
                isClosed={(issue) => Boolean(engine.current?.isIssueClosed(repo.id, issue))}
                resume={(number) => {
                  setModal(null);
                  engine.current?.selectIssue(number);
                  engine.current?.walkToIssue(number);
                }}
              />
              <div className="civic-summary">
                <span>{civicRole} · GitHub verified</span>
                <span>{repo.treasury || 0} upstream credits in the city treasury</span>
              </div>
              {civicRole === 'Mayor' && (
                <button
                  className="secondary wide"
                  disabled={working || (repo.treasury || 0) < 50}
                  onClick={() => void buildCommunity()}
                >
                  <Landmark size={16} />
                  Build community pavilion · 50 upstream credits
                </button>
              )}
              <h3 className="section-label">MAKE YOURSELF AT HOME</h3>
              <div className="shop">
                <button disabled={!player || working} onClick={() => void buy('amber')}>
                  <span className="swatch amber" />
                  <strong>Amber windows</strong>
                  <small>20 cosmetic credits</small>
                </button>
                <button disabled={!player || working} onClick={() => void buy('sage')}>
                  <span className="swatch sage" />
                  <strong>Sage palette</strong>
                  <small>20 cosmetic credits</small>
                </button>
                <button disabled={!player || working} onClick={() => void buy('pavilion')}>
                  <Landmark size={24} />
                  <strong>Civic pavilion</strong>
                  <small>50 structure credits</small>
                </button>
              </div>
              {!player && (
                <button className="text-button" onClick={() => setModal('passport')}>
                  Sign in to claim your contribution history
                  <ArrowRight size={14} />
                </button>
              )}
              <p className="coverage">
                A purchase never changes code-derived building geometry. Your contributions are
                verified against GitHub before currency is issued.
              </p>
            </>
          )}
          {modal === 'file' && file && repo && (
            <>
              <span className="eyebrow">INSIDE THE BUILDING</span>
              <h2 className="file-title">{file.path.split('/').pop()}</h2>
              <p className="file-path">
                {repo.id}/{file.path}
              </p>
              <div className="file-metrics">
                <span>{file.symbols ?? '—'} symbols</span>
                <span>{file.complexity ?? '—'} branches</span>
                <span>{file.lines ?? '—'} lines</span>
                <span>{file.analysis}</span>
              </div>
              {districtRole && (
                <p className="coverage">
                  {districtRole} · verified CODEOWNERS responsibility for this file
                </p>
              )}
              {repo.residents
                ?.filter((r) => r.path === file.path)
                .map((r) => (
                  <div className="building-plaque" key={r.login}>
                    <ShieldCheck size={18} />
                    <span>
                      This building carries <strong>@{r.login}</strong>’s name
                      <small>Accepted contribution · PR #{r.pr}</small>
                    </span>
                  </div>
                ))}
              {file.contributor && (
                <div className="building-plaque">
                  <GitBranch size={18} />
                  <span>
                    A contribution by <strong>@{file.contributor}</strong>
                    <small>{file.lastCommit && relative(file.lastCommit)}</small>
                  </span>
                </div>
              )}
              <pre className="source-code">{sourceError || source || 'Opening the archive…'}</pre>
              <a
                className="secondary wide"
                href={`https://github.com/${repo.id}/blob/${repo.defaultBranch}/${file.path}`}
                target="_blank"
                rel="noreferrer"
              >
                <Github size={16} />
                Open source on GitHub
                <ArrowUpRight size={15} />
              </a>
            </>
          )}
        </div>
      </dialog>
    </main>
  );
}
