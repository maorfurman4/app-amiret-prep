import type { MetadataRoute } from 'next';

const BASE_URL = 'https://amiret-prep.vercel.app';

const routes = [
  '',
  '/exam',
  '/practice',
  '/diagnostic',
  '/vocabulary',
  '/strategies',
  '/tips',
  '/tips/sentence-completion',
  '/tips/restatement',
  '/tips/reading-comprehension',
  '/leaderboard',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(route => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.7,
  }));
}
