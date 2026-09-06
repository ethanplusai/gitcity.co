'use client';
import { useEffect, useState } from 'react';
import { discoverWorksites, worksiteInvitation } from '../../shared/worksite-discovery.mjs';
import { useFieldNotes } from './useFieldNotes';
import FieldNotebook from './FieldNotebook';
import type { VerificationRefresh } from './VerifyContribution';
import { FIELD_NOTES_KEY, FIELD_NOTES_EVENT } from '../../shared/field-notes.mjs';
import { createPortal } from 'react-dom';
import {
  cityPopulation,
  issueKind,
  issueKinds,
  canSurvey,
  saveSurvey,
} from '../../shared/street-life.mjs';
import type { Repo } from '../world/types';
import type { WorldEngine } from '../world/engine';
export default function CityChallenges({
  repo,
  engine,
  onVerified,
  onVisit,
  onSignIn,
}: {
  repo: Repo;
  engine: WorldEngine | null;
  onVerified?: VerificationRefresh;
  onVisit?: (href: string) => void;
  onSignIn?: () => void;
}) {
  const [selected, setSelected] = useState<number | 'visitor' | 'traffic' | null>(null);
  const [proximity, setProximity] = useState({ distance: Infinity, walking: false });
  const [journey, setJourney] = useState<{
    destination: string;
    point: { x: number; z: number };
    arrived: boolean;
  } | null>(null);
  const [note, setNote] = useState('');
  const [workFilter, setWorkFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [paused, setPaused] = useState(false);
  const [checking, setChecking] = useState(false);
  const [closed, setClosed] = useState<Record<number, string>>({});
  const isClosed = (issue: Repo['issues'][number]) =>
    Boolean(
      closed[issue.number] && (!issue.updatedAt || issue.updatedAt <= closed[issue.number]),
    ) || Boolean(engine?.isIssueClosed(repo.id, issue));
  const savedNotes = useFieldNotes(repo.id);
  const continuing = savedNotes.find((entry) =>
    repo.issues.some((issue) => issue.number === entry.number && !isClosed(issue)),
  );
  const openIssues = repo.issues.filter((issue) => !isClosed(issue));
  const workSites: Repo['issues'] = discoverWorksites(openIssues, savedNotes, workFilter);
  const nextSite = workSites.find(
    (issue) => !savedNotes.some((note) => note.number === issue.number),
  );
  const population = cityPopulation(repo.stars, repo.usage?.weekly);
  const issue = repo.issues.find((i) => i.number === selected);
  useEffect(
    () =>
      engine?.subscribeStreetLife(
        (target, trip) => {
          setJourney(trip || null);
          setSelected(target);
          setMessage('');
          setProximity({ distance: Infinity, walking: false });
        },
        (distance, walking) => setProximity({ distance, walking }),
      ),
    [engine],
  );
  useEffect(() => {
    if (typeof selected !== 'number') return;
    try {
      const saved = JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) || '{}')[
        `${repo.id}#${selected}`
      ];
      setNote(saved?.note || '');
    } catch {
      setNote('');
    }
  }, [selected, repo.id]);
  useEffect(() => {
    document.body.classList.toggle('city-issue-active', selected !== null);
    return () => document.body.classList.remove('city-issue-active');
  }, [selected]);
  function dismiss() {
    setSelected(null);
    engine?.clearIssueTarget();
  }
  function survey() {
    if (!issue || !engine?.surveyIssue(issue.number)) return;
    try {
      const state = JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) || '{}');
      const next = saveSurvey(
        state,
        repo.id,
        issue.number,
        note,
        proximity.distance,
        proximity.walking,
      );
      if (next === state) return;
      next[`${repo.id}#${issue.number}`].title = issue.title;
      localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(FIELD_NOTES_EVENT));
      setMessage('Field notes saved on this device. The GitHub issue remains open.');
    } catch {
      setMessage('This browser could not save your field notes.');
    }
  }
  async function check() {
    if (!issue) return;
    setChecking(true);
    try {
      const response = await fetch(`/api/issues/${repo.id}/${issue.number}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'GitHub status unavailable');
      if (engine?.active !== repo.id) return;
      if (data.state === 'closed') {
        engine?.closeIssue(issue.number, data.updatedAt);
        setClosed((previous) => ({ ...previous, [issue.number]: data.updatedAt }));
        setMessage(
          `GitHub confirms this issue is closed${data.stateReason === 'not_planned' ? ' as not planned' : ''}. Its street marker has been removed.`,
        );
      } else setMessage('GitHub confirms this issue is still open.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <section className="city-pulse">
        <span className="eyebrow">LIFE ON THE STREETS</span>
        <p>
          {population.visitors} visitors · {population.cars} vehicles
        </p>
        <small>
          Illustrative visitors from stars; traffic from {population.trafficSource}. These are
          simulated inhabitants, not live GitHub users.
        </small>
        <div className="pulse-actions">
          <button onClick={() => engine?.meetTraveler()}>Meet a city guide</button>
          <button onClick={() => setPaused(engine?.toggleStreetLife() || false)}>
            {paused ? 'Resume' : 'Pause'} street life
          </button>
        </div>
        {continuing && (
          <button
            className="secondary wide"
            onClick={() => {
              engine?.selectIssue(continuing.number);
              engine?.walkToIssue(continuing.number);
            }}
          >
            Continue your investigation · #{continuing.number}
          </button>
        )}
        <h3>Explore the work sites</h3>
        <label className="worksite-filter">
          Find work
          <select value={workFilter} onChange={(event) => setWorkFilter(event.target.value)}>
            <option value="all">All open sites</option>
            <option value="newcomer">Good first issues</option>
            <option value="help">Maintainers welcome help</option>
            <option value="pothole">Road repairs · bugs</option>
            <option value="wayfinding">Wayfinding · documentation</option>
            <option value="worksite">Proposed works · features</option>
            <option value="unexplored">Not yet surveyed</option>
            <option value="saved">My saved plans</option>
          </select>
        </label>
        <small aria-live="polite">
          {workSites.length} matching sites in the current issue sample
        </small>
        {nextSite && (
          <button
            className="secondary wide"
            onClick={() => {
              engine?.selectIssue(nextSite.number);
              engine?.walkToIssue(nextSite.number);
            }}
          >
            Explore next work site · #{nextSite.number}
          </button>
        )}
        {workSites.map((i) => (
          <button
            className="work-order"
            key={i.number}
            onClick={() => engine?.selectIssue(i.number)}
          >
            <small>
              {issueKinds[issueKind(i)].name} · #{i.number}
            </small>
            {i.title}
            {worksiteInvitation(i) && <small>Maintainer label: {worksiteInvitation(i)}</small>}
            {savedNotes.some((entry) => entry.number === i.number) && (
              <small>
                {savedNotes.find((entry) => entry.number === i.number)?.pullRequest
                  ? 'Pull request linked on this device'
                  : 'Contribution plan saved on this device'}
              </small>
            )}
          </button>
        ))}
        {!workSites.length && openIssues.length > 0 && (
          <small>No sites match this filter. Try another kind of work.</small>
        )}
        {!openIssues.length && (
          <small>
            {repo.issuesAvailable === false
              ? 'GitHub issue data is unavailable.'
              : 'No open issues in the current sample.'}
          </small>
        )}
      </section>
      <FieldNotebook
        key={repo.id}
        repo={repo}
        isClosed={isClosed}
        onVerified={onVerified}
        onVisit={onVisit}
        onSignIn={onSignIn}
        resume={(number) => engine?.selectIssue(number)}
      />
      {selected !== null &&
        createPortal(
          <aside className="street-encounter" aria-label="Street encounter">
            <button
              className="encounter-close"
              aria-label="Close street encounter"
              onClick={dismiss}
            >
              ×
            </button>
            {issue ? (
              <>
                <span className="eyebrow">
                  {issueKinds[issueKind(issue)].name} · #{issue.number}
                </span>
                <h2>{issue.title}</h2>
                <p>
                  {issueKinds[issueKind(issue)].meaning}. This street problem represents the report
                  below.
                </p>
                <p className="issue-excerpt">
                  {issue.body?.slice(0, 400) || 'Open the GitHub report for the full details.'}
                </p>
                {!isClosed(issue) && (
                  <>
                    <button onClick={() => engine?.walkToIssue(issue.number)}>
                      Walk to this issue
                    </button>
                    <small>
                      {canSurvey(proximity.distance, proximity.walking)
                        ? 'On site · ready to survey'
                        : 'Walk close to the marker to save field notes.'}
                    </small>
                    <label>
                      Contribution plan
                      <textarea
                        maxLength={2000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="What will you investigate or change?"
                      />
                    </label>
                    <button
                      disabled={!canSurvey(proximity.distance, proximity.walking)}
                      onClick={survey}
                    >
                      Save field notes
                    </button>
                  </>
                )}
                <a href={issue.url} target="_blank" rel="noreferrer">
                  Open report on GitHub ↗
                </a>
                <button disabled={checking} onClick={() => void check()}>
                  {checking ? 'Checking GitHub…' : 'Check GitHub status'}
                </button>
                <small>
                  Notes earn no currency. Real accepted contributions determine city growth.
                </small>
              </>
            ) : selected === 'traffic' ? (
              <>
                <span className="eyebrow">CITY TRAFFIC</span>
                <h2>Interest keeps the streets moving.</h2>
                <p>
                  Vehicle density represents {population.trafficSource}, compressed to a maximum of
                  20 vehicles. Drivers travel between destinations, yield near you, and route around
                  bug-linked road repairs.
                </p>
              </>
            ) : (
              <>
                <span className="eyebrow">A SIMULATED CITY GUIDE</span>
                <h2>There’s work around the next corner.</h2>
                <p>
                  Stars bring visitors here. Open issues become places to investigate: bugs damage
                  roads, documentation needs wayfinding, and features become proposed works.
                </p>
                {repo.issues
                  .filter((i) => !isClosed(i))
                  .slice(0, 3)
                  .map((i) => (
                    <button key={i.number} onClick={() => engine?.selectIssue(i.number)}>
                      Visit #{i.number}: {i.title}
                    </button>
                  ))}
                <p>
                  Survey a site, save a plan, then contribute on GitHub. A local survey never
                  pretends to fix the code.
                </p>
              </>
            )}
            {journey && typeof selected !== 'number' && (
              <section aria-label="Traveler destination">
                <span className="eyebrow">{journey.arrived ? 'VISITING' : 'HEADING TO'}</span>
                <p>{journey.destination}</p>
                <button
                  onClick={() => {
                    engine?.walkToDestination(journey.point, journey.destination);
                    setSelected(null);
                  }}
                >
                  Walk to this destination
                </button>
              </section>
            )}
            {message && <p role="status">{message}</p>}
          </aside>,
          document.body,
        )}
    </>
  );
}
