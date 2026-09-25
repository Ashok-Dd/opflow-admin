import type { MetadataRoute } from 'next';

/** The admin site is never indexed (and is not linked from the landing site). */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
