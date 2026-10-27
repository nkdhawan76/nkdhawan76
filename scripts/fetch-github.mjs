import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const USERNAME = process.env.GITHUB_USERNAME || 'nkdhawan76';

async function fetchGraphQL(token) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'github-contribution-fetcher',
    },
    body: JSON.stringify({ query, variables: { login: USERNAME } }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }

  const calendar = json.data.user.contributionsCollection.contributionCalendar;
  const days = [];
  const levelMap = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
  };

  for (const week of calendar.weeks) {
    for (const d of week.contributionDays) {
      days.push({
        date: d.date,
        count: d.contributionCount,
        level: levelMap[d.contributionLevel] ?? 0,
      });
    }
  }

  return { total: calendar.totalContributions, days };
}

async function fetchPublic() {
  const url = `https://github.com/users/${USERNAME}/contributions`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
  });
  const html = await res.text();

  const totalMatch = html.match(/([0-9,]+)\s+contributions\s+in\s+the\s+last\s+year/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ''), 10) : 0;

  const days = [];
  const regex = /<td[^>]*data-date="([^"]+)"[^>]*id="([^"]+)"[^>]*data-level="([0-9])"[^>]*>[\s\S]*?<tool-tip[^>]*for="\2"[^>]*>([^<]+)<\/tool-tip>/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const date = match[1];
    const level = parseInt(match[3], 10);
    const tip = match[4].trim();
    let count = 0;
    const countMatch = tip.match(/([0-9]+)\s+contribution/);
    if (countMatch) {
      count = parseInt(countMatch[1], 10);
    }
    days.push({ date, count, level, tip });
  }

  return { total: total || days.reduce((a, b) => a + b.count, 0), days };
}

async function main() {
  console.log(`Fetching GitHub contribution data for ${USERNAME}...`);
  let token = process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      token = execSync('gh auth token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
  }

  let result;
  if (token) {
    try {
      console.log('Using GitHub GraphQL API with token...');
      result = await fetchGraphQL(token);
    } catch (e) {
      console.warn('GraphQL API failed, falling back to public HTML parser:', e.message);
      result = await fetchPublic();
    }
  } else {
    console.log('No token provided, fetching public contribution history...');
    result = await fetchPublic();
  }

  const { total, days } = result;
  const startDate = days.length > 0 ? days[0].date : '';
  const counts = days.map((d) => d.count);
  const levels = days.map((d) => d.level).join('');

  // Find best day
  let bestDay = { date: '', count: 0 };
  for (const d of days) {
    if (d.count > bestDay.count) {
      bestDay = { date: d.date, count: d.count };
    }
  }

  const out = {
    username: USERNAME,
    startDate,
    total,
    bestDay,
    counts,
    levels,
    days,
    updatedAt: new Date().toISOString(),
  };

  const outPath = path.resolve('data/github.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Saved ${days.length} days (${total} contributions) to ${outPath}`);
  console.log(`Best day: ${bestDay.count} commits on ${bestDay.date}`);
}

main().catch((err) => {
  console.error('Error fetching data:', err);
  process.exit(1);
});
