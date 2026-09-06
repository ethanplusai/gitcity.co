'use client';
import { useState } from 'react';
import { FIELD_NOTES_KEY, FIELD_NOTES_EVENT } from '../../shared/field-notes.mjs';
import { useFieldNotes } from './useFieldNotes';
import type { Repo } from '../world/types';
import { notebookPullRequest, recordNotebookAcceptance } from '../../shared/field-notes.mjs';
import VerifyContribution, { type VerificationRefresh } from './VerifyContribution';

type Entry = {
  key: string;
  number: number;
  note: string;
  title: string;
  surveyedAt: number;
  pullRequest: string;
  verifiedAt: number | null;
};
function PullRequestFollowup({
  entry,
  repo,
  onVerified,
  onVisit,
}: {
  entry: Entry;
  repo: string;
  onVerified?: VerificationRefresh;
  onVisit?: (href: string) => void;
}) {
  const [url, setUrl] = useState(entry.pullRequest);
  const [message, setMessage] = useState('');
  const [verify, setVerify] = useState(false);
  return (
    <div className="field-pr-followup">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const canonical = notebookPullRequest(url, repo);
          if (!canonical) {
            setMessage(`Use a GitHub pull-request link in ${repo}.`);
            return;
          }
          try {
            const state = JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) || '{}');
            if (!state[entry.key]) throw new Error('missing note');
            if (state[entry.key].pullRequest !== canonical) delete state[entry.key].acceptance;
            state[entry.key].pullRequest = canonical;
            localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify(state));
            window.dispatchEvent(new Event(FIELD_NOTES_EVENT));
            setUrl(canonical);
            setVerify(false);
            setMessage(
              entry.verifiedAt && canonical === entry.pullRequest
                ? 'Verified pull request retained.'
                : 'Pull request saved. Return after it merges to verify acceptance.',
            );
          } catch {
            setMessage('This browser could not save the pull-request link.');
          }
        }}
      >
        <label>
          Track your pull request
          <input
            type="url"
            required
            maxLength={500}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={`https://github.com/${repo}/pull/123`}
          />
        </label>
        <button type="submit">Save pull request</button>
      </form>
      {entry.pullRequest && (
        <div className="field-note-actions">
          <a href={entry.pullRequest} target="_blank" rel="noreferrer">
            Open saved pull request ↗
          </a>
          {onVerified && (
            <button onClick={() => setVerify(!verify)}>Verify saved pull request</button>
          )}
        </div>
      )}
      {verify && onVerified && (
        <VerifyContribution
          key={entry.pullRequest}
          initialUrl={entry.pullRequest}
          onVisit={onVisit}
          onVerified={async (repo, number) => {
            setMessage('');
            const visit = await onVerified(repo, number);
            try {
              const state = JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) || '{}');
              const next = recordNotebookAcceptance(state, entry.key, repo, number);
              if (next !== state) {
                localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify(next));
                window.dispatchEvent(new Event(FIELD_NOTES_EVENT));
              }
            } catch {
              setMessage(
                'Acceptance is recorded by the city, but this browser could not save your notebook checkpoint.',
              );
            }
            return visit;
          }}
        />
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
export default function FieldNotebook({
  repo,
  resume,
  isClosed,
  onVerified,
  onVisit,
  onSignIn,
}: {
  repo: Repo;
  resume: (number: number) => void;
  isClosed?: (issue: Repo['issues'][number]) => boolean;
  onVerified?: VerificationRefresh;
  onVisit?: (href: string) => void;
  onSignIn?: () => void;
}) {
  const entries = useFieldNotes(repo.id);
  const [error, setError] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  function remove(key: string) {
    try {
      const state = JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) || '{}');
      delete state[key];
      localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify(state));
      window.dispatchEvent(new Event(FIELD_NOTES_EVENT));
      setCopyFallback('');
      setError('');
    } catch {
      setError('This browser could not remove the note.');
    }
  }
  return (
    <section className="field-notebook" aria-label="Your field notebook">
      <span className="eyebrow">YOUR FIELD NOTEBOOK</span>
      <p>
        {entries.length
          ? 'Pick up where you left off.'
          : 'Visit a work site and save a contribution plan. Find it here when you return.'}
      </p>
      {entries.map((entry) => {
        const issue = repo.issues.find((i) => i.number === entry.number);
        return (
          <article key={entry.key}>
            <h4>
              #{entry.number} · {issue?.title || entry.title || 'Saved investigation'}
            </h4>
            <p className="field-note-text">
              {entry.note || 'Site surveyed. Add a plan when you return.'}
            </p>
            <small>Surveyed {new Date(entry.surveyedAt).toLocaleDateString()}</small>
            <p className="field-note-stage">
              {entry.verifiedAt
                ? `Acceptance verified on this device · ${new Date(entry.verifiedAt).toLocaleDateString()}`
                : entry.pullRequest
                  ? onVerified
                    ? 'Pull request linked · verify here after it merges'
                    : 'Pull request linked · sign in after it merges to verify acceptance'
                  : 'Investigation saved · contribute on GitHub, then link your pull request here'}
            </p>
            {entry.pullRequest && !onVerified && onSignIn && (
              <button className="secondary wide" onClick={onSignIn}>
                Sign in to verify your contribution
              </button>
            )}
            <PullRequestFollowup
              entry={entry}
              repo={repo.id}
              onVerified={onVerified}
              onVisit={onVisit}
            />
            <div className="field-note-actions">
              <button
                onClick={async () => {
                  const brief = [
                    `${repo.id} #${entry.number} · ${issue?.title || entry.title || 'Investigation'}`,
                    `Issue: https://github.com/${repo.id}/issues/${entry.number}`,
                    `City: ${window.location.origin}/${repo.id}`,
                    '',
                    'My contribution plan',
                    entry.note || 'Investigation saved; no plan written yet.',
                  ].join('\n');
                  try {
                    await navigator.clipboard.writeText(brief);
                    setCopyFallback('');
                    setError(`Contribution plan for issue #${entry.number} copied.`);
                  } catch {
                    setCopyFallback(brief);
                    setError('Clipboard access is unavailable. Select and copy the plan below.');
                  }
                }}
              >
                Copy contribution plan
              </button>
              {issue && !isClosed?.(issue) && (
                <button
                  onClick={() => {
                    setError('');
                    resume(entry.number);
                  }}
                >
                  Resume investigation
                </button>
              )}
              <a
                href={`https://github.com/${repo.id}/issues/${entry.number}`}
                target="_blank"
                rel="noreferrer"
              >
                Open GitHub issue ↗
              </a>
              <button
                className="field-note-remove"
                aria-label={`Remove note for issue #${entry.number}`}
                onClick={() => remove(entry.key)}
              >
                Remove note
              </button>
            </div>
            {!issue && (
              <small>This issue is outside the current sample. Check GitHub for its status.</small>
            )}
          </article>
        );
      })}
      {error && <p role="status">{error}</p>}
      {copyFallback && (
        <label>
          Contribution plan to copy
          <textarea
            readOnly
            rows={7}
            value={copyFallback}
            onFocus={(event) => event.currentTarget.select()}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </label>
      )}
      <small>
        Saved on this device. Notes do not claim an issue or earn contribution currency.
      </small>
    </section>
  );
}
