import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const STAGING_HOSTS = ['staging.fitmeal.jp'];

function isStagingHost(host: string): boolean {
  const passthrough = ['app.fitmeal.jp', 'fitmeal.jp', 'www.fitmeal.jp', 'localhost'];
  if (passthrough.some((h) => host === h || host.startsWith(h + ':'))) {
    return false;
  }
  if (STAGING_HOSTS.some((h) => host === h || host.startsWith(h + ':'))) {
    return true;
  }
  if (host.endsWith('.vercel.app') || host.includes('.vercel.app:')) {
    return true;
  }
  return false;
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') ?? '';

  if (isStagingHost(host)) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
  };
}
