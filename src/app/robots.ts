import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/demo/',
        '/embed/',
        '/sign-in/',
        '/sign-up/',
        '/api/',
      ],
    },
    sitemap: 'https://www.sapybase.com/sitemap.xml',
  }
}
