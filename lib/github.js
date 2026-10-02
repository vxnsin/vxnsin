const axios = require('axios');

const USER = 'vxnsin';

const QUERY = `query($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false, first: 100, orderBy: { field: PUSHED_AT, direction: DESC }) {
      totalCount
      nodes {
        name
        pushedAt
        stargazerCount
        languages(first: 8, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`;

async function loadGithub() {
  const token = process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN fehlt, GitHub-Statistiken werden uebersprungen.');

  const response = await axios.post('https://api.github.com/graphql',
    { query: QUERY, variables: { login: USER } },
    { headers: { Authorization: `bearer ${token}`, 'User-Agent': USER }, timeout: 20000 });

  if (response.data.errors) throw new Error(response.data.errors.map(e => e.message).join('; '));
  const user = response.data.data.user;
  const repos = user.repositories.nodes;

  const languages = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      const entry = languages.get(node.name) || { name: node.name, color: node.color || '#8b949e', size: 0 };
      entry.size += size;
      languages.set(node.name, entry);
    }
  }
  const totalSize = [...languages.values()].reduce((sum, l) => sum + l.size, 0) || 1;
  const topLanguages = [...languages.values()]
    .sort((a, b) => b.size - a.size)
    .slice(0, 6)
    .map(l => ({ ...l, share: l.size / totalSize }));

  const collection = user.contributionsCollection;
  const weeks = collection.contributionCalendar.weeks
    .map(week => week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0));

  return {
    contributions: collection.contributionCalendar.totalContributions,
    commits: collection.totalCommitContributions + collection.restrictedContributionsCount,
    repos: user.repositories.totalCount,
    stars: repos.reduce((sum, r) => sum + r.stargazerCount, 0),
    followers: user.followers.totalCount,
    joined: new Date(user.createdAt).getFullYear(),
    weeks: weeks.slice(-52),
    topLanguages,
    lastPush: repos[0] ? { name: repos[0].name, at: repos[0].pushedAt } : null
  };
}

module.exports = { loadGithub, USER };
