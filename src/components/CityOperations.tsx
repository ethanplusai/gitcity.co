'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Navigation, Package, MapPin, Check, X, Trophy } from 'lucide-react';
import { services, completeService } from '../../shared/operations.mjs';
import type { WorldEngine, MissionView } from '../world/engine';
import type { Repo } from '../world/types';
type Progress = {
  reputation: number;
  rounds: Record<string, number>;
  completed: { id: string; kind: string; seconds: number; repo: string }[];
};
const EMPTY: Progress = { reputation: 0, rounds: {}, completed: [] };
export default function CityOperations({
  repo,
  engine,
}: {
  repo: Repo;
  engine: WorldEngine | null;
}) {
  const [progress, setProgress] = useState<Progress>(() => {
      try {
        const p = JSON.parse(localStorage.getItem('gitcity.services.v1') || 'null');
        if (p && Array.isArray(p.completed) && typeof p.reputation === 'number' && p.rounds)
          return p;
      } catch {}
      return EMPTY;
    }),
    [mission, setMission] = useState<MissionView | null>(null),
    [report, setReport] = useState('');
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  useEffect(() => {
    if (!engine) return;
    return engine.subscribeOperations(setMission, (job, seconds) => {
      if (!job) return;
      const next = completeService(progressRef.current, job, seconds);
      setProgress(next);
      progressRef.current = next;
      try {
        localStorage.setItem('gitcity.services.v1', JSON.stringify(next));
      } catch {}
      setReport(
        `Round complete · +${job.reward} service reputation · ${Math.round(seconds)} seconds`,
      );
    });
  }, [engine]);
  const bounds = mission?.map?.bounds || {
    minX: -(mission?.side || 1) * 12,
    maxX: (mission?.side || 1) * 12,
    minZ: -(mission?.side || 1) * 12,
    maxZ: (mission?.side || 1) * 12,
  };
  const playing = mission !== null;
  useEffect(() => {
    document.body.classList.toggle('city-service-active', playing);
    return () => document.body.classList.remove('city-service-active');
  }, [playing]);
  const service = services.find((s) => s.id === mission?.name);
  const level = 1 + Math.floor(progress.reputation / 150);
  const rounds = progress.completed.filter((p) => p.repo === repo.id);
  return (
    <>
      <section className="dispatch-board" aria-label="Neighborhood dispatch">
        <div className="dispatch-heading">
          <span className="eyebrow">NEIGHBORHOOD DISPATCH</span>
          <Package size={16} />
        </div>
        <h3>A city needs more than buildings.</h3>
        <p>Take a round. Learn its streets. Become a familiar face.</p>
        <div className="service-standing">
          <Trophy size={15} />
          <strong>Steward level {level}</strong>
          <span>{progress.reputation} reputation</span>
        </div>
        {report && (
          <div className="service-report" role="status">
            <Check size={16} />
            {report}
          </div>
        )}
        {!mission ? (
          services.map((service) => {
            const best = rounds
              .filter((r) => r.kind === service.id)
              .sort((a, b) => a.seconds - b.seconds)[0];
            return (
              <button
                className="service-card"
                key={service.id}
                disabled={!repo.files.length}
                onClick={() => {
                  setReport('');
                  engine?.startJob(service.id, progress.rounds[repo.id + ':' + service.id] || 0);
                }}
              >
                <div>
                  <strong>{service.name}</strong>
                  <span>{service.description}</span>
                  <small>
                    {best ? `Personal best ${best.seconds}s · ` : ''}+{service.reward} reputation ·
                    4 stops
                  </small>
                </div>
                <ArrowRight size={16} />
              </button>
            );
          })
        ) : (
          <p className="service-active">
            <Navigation size={16} /> A round is in progress. Follow your street marker.
          </p>
        )}
        <small className="service-disclaimer">
          City-life gameplay · saved on this device. Service reputation never changes GitHub
          activity, ownership or contribution currency.
        </small>
      </section>
      {mission &&
        createPortal(
          <section className="mission-hud" aria-label="Active service round">
            <div className="mission-title">
              <span>
                <Package size={15} />
                {service?.name}
              </span>
              <button onClick={() => engine?.cancelJob()} aria-label="Abandon service round">
                <X size={15} />
              </button>
            </div>
            <div className="mission-progress">
              {Array.from({ length: mission.total }, (_, i) => (
                <i className={i <= mission.index ? 'current' : ''} key={i} />
              ))}
            </div>
            <h3>
              {mission.path === '@depot' ? 'Return to the depot' : mission.path.split('/').pop()}
            </h3>
            <p>{mission.path === '@depot' ? 'City hall forecourt' : mission.path}</p>
            <div className="mission-metrics">
              <span>
                <MapPin size={13} />
                {Math.round(mission.distance)} street units
              </span>
              <span>
                {Math.floor(mission.seconds / 60)}:
                {String(Math.floor(mission.seconds % 60)).padStart(2, '0')}
              </span>
            </div>
            <svg
              className="street-map"
              viewBox={`${bounds.minX - 7} ${bounds.minZ - 7} ${bounds.maxX - bounds.minX + 14} ${bounds.maxZ - bounds.minZ + 14}`}
              role="img"
              aria-label="Neighborhood street map: blue is you, gold is the service stop"
            >
              <rect
                x={bounds.minX - 5}
                y={bounds.minZ - 5}
                width={bounds.maxX - bounds.minX + 10}
                height={bounds.maxZ - bounds.minZ + 10}
                rx="2"
                fill="#243633"
              />
              {mission.map
                ? mission.map.streets.map((edge, i) => (
                    <path
                      key={i}
                      d={`M ${edge.a.x} ${edge.a.z} L ${edge.b.x} ${edge.b.z}`}
                      stroke="#74887b"
                      strokeWidth=".6"
                    />
                  ))
                : Array.from({ length: mission.side + 1 }, (_, i) => {
                    const n = -mission.side * 12 + i * 24;
                    return (
                      <g key={i} stroke="#74887b" strokeWidth=".6">
                        <path d={`M ${n} ${-mission.side * 12} V ${mission.side * 12}`} />
                        <path d={`M ${-mission.side * 12} ${n} H ${mission.side * 12}`} />
                      </g>
                    );
                  })}
              {Boolean(mission.route?.length) && (
                <polyline
                  points={[mission.position, ...mission.route!]
                    .map((p) => `${p.x},${p.z}`)
                    .join(' ')}
                  fill="none"
                  stroke="#f3bf78"
                  strokeWidth=".65"
                  strokeDasharray="1.5 1"
                />
              )}
              <circle cx={mission.target.x} cy={mission.target.z} r="1.8" fill="#f3bf78" />
              <circle
                cx={mission.position.x}
                cy={mission.position.z}
                r="1.3"
                fill="#8bd3de"
                stroke="#e2f5f2"
                strokeWidth=".4"
              />
            </svg>
            <button
              className="primary wide"
              disabled={!mission.arrived}
              onClick={() => engine?.interact()}
            >
              <Check size={15} />
              {mission.path === '@depot' ? 'Finish round' : service?.verb}
              <kbd>E</kbd>
            </button>
            {!mission.arrived && (
              <button className="secondary wide" onClick={() => engine?.navigateToStop()}>
                <Navigation size={14} />
                {mission.walking ? 'Follow streets to stop' : 'Return to street level'}
              </button>
            )}
            <small>
              WASD / arrows to walk · Shift to run · E to interact
              <br />
              Drag to look. On touch, use Follow streets.
            </small>
          </section>,
          document.body,
        )}
    </>
  );
}
