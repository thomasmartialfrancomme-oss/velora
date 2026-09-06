import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const production = process.env.NODE_ENV === 'production';
  return {
    rules: production
      ? [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/properties', '/people', '/travel', '/lifestyle', '/vehicles', '/finance', '/documents', '/ai', '/briefing', '/settings', '/admin'] }]
      : [{ userAgent: '*', disallow: '/' }],
    sitemap: production ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/sitemap.xml` : undefined,
  };
}
