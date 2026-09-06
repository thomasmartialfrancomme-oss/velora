import type { MetadataRoute } from 'next';

const PUBLIC_PATHS = ['/', '/membership', '/about', '/security', '/privacy', '/terms', '/access/request', '/login'];

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.NODE_ENV !== 'production') return [];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
