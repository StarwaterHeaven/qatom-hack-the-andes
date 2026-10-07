// Your code goes here. Each catalog item in catalog.json names one handler below.
//
// A handler receives the validated inputs (unknown inputs were already refused, defaults filled in)
// and returns { result, summary } plus, optionally, item, alias, answer_type, as_of, out_of_range, next_steps.
// Throw ApiError(status, code, message, extra) for errors agents can act on.
//
// The example: a repo card for any public GitHub repository. Swap it for the function your repo is about.

import { ApiError, feedbackHandler } from '../../lib/qatom-kit.mjs';

const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

function parseRepo(input) {
  const s = String(input).trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (!REPO.test(s)) throw new ApiError(400, 'bad_value', 'repo must look like owner/name or a github.com URL.');
  return { repo: s, alias: s !== input ? { requested: input, resolved: s } : undefined };
}

async function github(path, env) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'qatom-repo-card',
      ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (r.status === 404) throw new ApiError(404, 'item_not_found', 'No public repository with that name.');
  if (r.status === 403 || r.status === 429) throw new ApiError(429, 'rate_limited', 'GitHub is rate-limiting this store. Try again in a few minutes.');
  if (!r.ok) throw new ApiError(502, 'internal_error', `GitHub answered ${r.status}.`);
  return r.json();
}

export const handlers = {
  // Paid: a compact card about a repository, shaped for agents.
  async repo_card({ repo }, { env }) {
    const { repo: name, alias } = parseRepo(repo);
    const g = await github(`/repos/${name}`, env);
    const daysSincePush = Math.round((Date.now() - Date.parse(g.pushed_at)) / 86_400_000);
    return {
      item: g.full_name.toLowerCase(),
      alias,
      answer_type: 'current',
      result: {
        repo: g.full_name,
        description: g.description,
        stars: g.stargazers_count,
        forks: g.forks_count,
        open_issues: g.open_issues_count,
        language: g.language,
        license: g.license?.spdx_id || null,
        default_branch: g.default_branch,
        pushed_at: g.pushed_at,
        days_since_push: daysSincePush,
        archived: g.archived,
        topics: g.topics || [],
        url: g.html_url,
      },
      summary: `${g.full_name}: ${g.stargazers_count} stars, ${g.language || 'no main language'}, last push ${daysSincePush} days ago${g.archived ? ', archived' : ''}.`,
    };
  },

  // Free: does the repo exist? Name only, nothing a script could sample for value.
  async repo_check({ repo }, { env }) {
    const { repo: name, alias } = parseRepo(repo);
    const g = await github(`/repos/${name}`, env);
    return {
      item: g.full_name.toLowerCase(),
      alias,
      answer_type: 'published',
      result: { repo: g.full_name, exists: true, paid_item_has: ['stars', 'forks', 'issues', 'license', 'activity', 'topics'] },
      summary: `${g.full_name} exists. The paid repo card has activity, license and popularity.`,
      next_steps: [{ action: 'Buy the repo card', item: 'repo_card' }],
    };
  },

  feedback: feedbackHandler,
};
