import assert from 'node:assert/strict';
import { repoData, fileData } from '../server/github.mjs';
const start = performance.now();
const data = await repoData('ethanplusai', 'gitcity.co');
assert.equal(data.id.toLowerCase(), 'ethanplusai/gitcity.co');
assert.ok(data.files.some((f) => f.analysis === 'TypeScript AST'));
const file = data.files.find((f) => f.analysis === 'TypeScript AST');
const archive = await fileData('ethanplusai', 'gitcity.co', file.path);
assert.ok(archive.source.length > 0);
assert.equal(archive.file.sha, file.sha);
console.log(
  JSON.stringify(
    {
      repo: data.id,
      files: data.totalFiles,
      analyzed: data.files.filter((f) => f.analysis !== 'unavailable').length,
      commits: data.commits.length,
      ci: data.ci,
      timezone: data.timezone,
      dependencies: data.dependencies.length,
      sourceVerified: file.path,
      seconds: Math.round((performance.now() - start) / 100) / 10,
    },
    null,
    2,
  ),
);
