'use client';

import { useParams } from 'next/navigation';
import { redirect } from 'next/navigation';

/**
 * Catch-all route: gitcity.co/facebook/react → /city?repo=facebook/react
 * This lets people just swap "github.com" with "gitcity.co" in their browser bar.
 */
export default function RepoRedirect() {
  const params = useParams();
  const owner = params.owner as string;
  const repo = params.repo as string;

  if (owner && repo) {
    redirect(`/city?repo=${owner}/${repo}`);
  }

  redirect('/');
}
