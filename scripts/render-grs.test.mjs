import test from "node:test";
import assert from "node:assert/strict";
import { handlerToSvg, validateSvg } from "./render-grs.mjs";
import { fetchPublicStats } from "./public-stats.mjs";

test("error cards are rejected even with HTTP 200", async () => {
  const errorSvg = '<svg><text data-testid="message">API error</text></svg>';
  await assert.rejects(handlerToSvg((req, res) => res.send(errorSvg), {}), /Refusing/);
  await assert.rejects(handlerToSvg((req, res) => res.status(503).send('<svg></svg>'), {}), /Refusing/);
  for (const body of [null, '<html>error</html>', '<svg>truncated']) {
    assert.throws(() => validateSvg(body), /Refusing/);
  }
  assert.equal(validateSvg('<svg><text>Stats</text></svg>'), '<svg><text>Stats</text></svg>');
});

test("public stats paginate stars and use explicit public/all-time search counts", async () => {
  const calls = [];
  const stats = await fetchPublicStats('example', 'test-token', async (input) => {
    const url = new URL(input);
    calls.push(url);
    let data;
    if (url.pathname.endsWith('/repos')) {
      data = url.searchParams.get('page') === '1'
        ? Array.from({ length: 100 }, () => ({ stargazers_count: 2 }))
        : [{ stargazers_count: 7 }];
    } else {
      assert.match(url.searchParams.get('q'), /is:public/);
      data = { total_count: url.pathname.endsWith('/commits') ? 42
        : url.searchParams.get('q').includes('type:pr') ? 5 : 3, incomplete_results: false };
    }
    return { ok: true, json: async () => data };
  });
  assert.deepEqual(stats, { name: 'example', totalStars: 207, totalCommits: 42, totalPRs: 5, totalIssues: 3 });
  assert.equal(calls.length, 5);
});

test("API failures and incomplete counts cannot become zero stats", async () => {
  await assert.rejects(fetchPublicStats('example', 'token', async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(fetchPublicStats('example', 'token', async (url) => ({
    ok: true,
    json: async () => url.includes('/repos?') ? [] : { total_count: 20, incomplete_results: true },
  })), /incomplete/);
});
