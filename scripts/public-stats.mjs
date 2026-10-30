// Public REST endpoints work with the repository-scoped Actions token.
// The upstream GraphQL query includes user fields that this token cannot read.
export async function fetchPublicStats(username, token, fetcher = fetch) {
  const get = async (endpoint) => {
    const response = await fetcher(`https://api.github.com${endpoint}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(`GitHub public stats request failed: HTTP ${response.status}`);
    }
    return response.json();
  };
  const count = async (kind, query) => {
    const result = await get(`/search/${kind}?q=${encodeURIComponent(query)}&per_page=1`);
    if (result.incomplete_results || !Number.isSafeInteger(result.total_count) || result.total_count < 0) {
      throw new Error("GitHub returned an incomplete or invalid search count");
    }
    return result.total_count;
  };
  let totalStars = 0;
  for (let page = 1; ; page++) {
    const repos = await get(`/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&page=${page}`);
    if (!Array.isArray(repos)) throw new Error("Invalid repositories response");
    for (const repo of repos) {
      if (!Number.isSafeInteger(repo.stargazers_count) || repo.stargazers_count < 0) {
        throw new Error("Invalid repository star count");
      }
      totalStars += repo.stargazers_count;
    }
    if (repos.length < 100) break;
  }
  // Search requests are sequential to respect GitHub's search rate limits.
  const totalCommits = await count("commits", `author:${username} is:public`);
  const totalPRs = await count("issues", `author:${username} type:pr is:public`);
  const totalIssues = await count("issues", `author:${username} type:issue is:public`);
  return { name: username, totalStars, totalCommits, totalPRs, totalIssues };
}
