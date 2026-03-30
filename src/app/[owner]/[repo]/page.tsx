import { redirect } from 'next/navigation';

/**
 * Catch-all route: gitcity.co/facebook/react → /city?repo=facebook/react
 * This lets people just swap "github.com" with "gitcity.co" in their browser bar.
 *
 * Server component for proper SEO and instant redirect.
 */
export default async function RepoRedirect({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  if (owner && repo) {
    redirect(`/city?repo=${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  redirect('/');
}
