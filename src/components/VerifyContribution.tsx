'use client';
import { useId, useState } from 'react';
export type ContributionVisit = { href: string; label: string };
export type VerificationRefresh = (
  repo: string,
  number?: number,
) => Promise<ContributionVisit | void>;
const messages: Record<string, string> = {
  not_author: 'This pull request was authored by a different GitHub account.',
  not_merged: 'This pull request has not been merged yet. Come back after it is accepted.',
  own_repository: 'Work in a repository you own does not earn outward-contribution credits.',
  not_human_acceptance: 'Structure credits require acceptance by another human.',
  not_participating: 'This repository is private or has opted out of Gitcity.',
  already_recorded: 'This contribution is already recorded. No duplicate credits were issued.',
};
export default function VerifyContribution({
  onVerified,
  initialUrl = '',
  onVisit,
}: {
  onVerified: VerificationRefresh;
  onVisit?: (href: string) => void;
  initialUrl?: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [visit, setVisit] = useState<ContributionVisit | null>(null);
  return (
    <form
      className="verify-contribution"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setVisit(null);
        setMessage('Checking acceptance on GitHub…');
        try {
          const response = await fetch('/api/contributions/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not verify this contribution.');
          if (result.reason === 'accepted' || result.reason === 'already_recorded') {
            setMessage(
              result.reason === 'accepted'
                ? `Accepted work verified · +${result.awarded} structure credits. Your contribution and residency are recorded in ${result.repo}.`
                : messages.already_recorded,
            );
            try {
              setVisit((await onVerified(result.repo, result.number)) || null);
            } catch {
              setMessage(
                (text) =>
                  text + ' The city refresh failed; reopen the city to see the recorded result.',
              );
            }
          } else
            setMessage(
              messages[result.reason] || 'This contribution is not eligible for structure credits.',
            );
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={inputId}>Just got a pull request merged?</label>
      <p>Verify that contribution now, without restoring your full history.</p>
      <input
        id={inputId}
        type="url"
        required
        maxLength={500}
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          setVisit(null);
        }}
        placeholder="https://github.com/owner/repo/pull/123"
        autoComplete="off"
      />
      <button className="secondary wide" disabled={busy} type="submit">
        {busy ? 'Verifying accepted work…' : 'Verify pull request'}
      </button>
      {message && <p role="status">{message}</p>}
      {visit && onVisit && (
        <button type="button" className="primary wide" onClick={() => onVisit(visit.href)}>
          {visit.label}
        </button>
      )}
    </form>
  );
}
