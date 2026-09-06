'use client';
import { useEffect, useState } from 'react';
import { FIELD_NOTES_KEY, FIELD_NOTES_EVENT, fieldNotes } from '../../shared/field-notes.mjs';

export function useFieldNotes(repo: string) {
  const [snapshot, setSnapshot] = useState<{
    repo: string;
    entries: ReturnType<typeof fieldNotes>;
  }>({ repo, entries: [] });
  useEffect(() => {
    const read = () => {
      try {
        setSnapshot({
          repo,
          entries: fieldNotes(JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) || '{}'), repo),
        });
      } catch {
        setSnapshot({ repo, entries: [] });
      }
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener(FIELD_NOTES_EVENT, read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener(FIELD_NOTES_EVENT, read);
    };
  }, [repo]);
  return snapshot.repo === repo ? snapshot.entries : [];
}
