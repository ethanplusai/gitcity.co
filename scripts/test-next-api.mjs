// Run against the compiled Next server or a deployment, not the custom dev server.
const base = process.argv[2];
if (!base) throw new Error('Provide the compiled server or deployment URL.');
async function json(path) {
  const response = await fetch(new URL(path, base), {
    redirect: 'error',
    headers: process.env.DEPLOYMENT_BYPASS
      ? { 'x-vercel-protection-bypass': process.env.DEPLOYMENT_BYPASS }
      : {},
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`${path.split('?')[0]}: HTTP ${response.status}`);
  return response.json();
}
const repo = await json('/api/repos/vuejs/core');
const path = repo.files[0].path;
const source = await json('/api/source/vuejs/core?path=' + encodeURIComponent(path));
if (source.file?.path !== path) throw new Error('Next routing changed the requested source path.');
console.log('PASS compiled Next repository and source-file routes');
