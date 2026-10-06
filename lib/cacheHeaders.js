// Prisdataene oppdateres én gang i døgnet (kl. 03:00), så svarene kan caches
// i Vercels CDN. Etter 10 minutter serveres cachet svar mens et nytt hentes i
// bakgrunnen, slik at brukerne nesten aldri venter på Supabase-pagineringen.
export const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600',
}
