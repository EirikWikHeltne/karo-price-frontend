'use client'
import { useState, useEffect } from 'react'

/**
 * Henter dato for siste prisoppdatering fra /api/siste-oppdatering.
 * Hvis endepunktet ikke gir noen dato, utledes den fra nyeste
 * `sist_oppdatert` i `rows` (når tilgjengelig).
 */
export function useLastUpdated(rows) {
  const [lastUpdated, setLastUpdated] = useState(null)
  const [fromApi, setFromApi] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/siste-oppdatering', { cache: 'no-store' })
      .then(r => r.json())
      .then(({ dato }) => {
        if (cancelled || !dato) return
        // Midt på dagen for å unngå at tidssone-forskyvning flytter datoen
        setLastUpdated(new Date(dato + 'T12:00:00'))
        setFromApi(true)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (fromApi || !rows?.length) return
    const dates = rows.map(r => r.sist_oppdatert).filter(Boolean).sort()
    if (dates.length) setLastUpdated(new Date(dates[dates.length - 1]))
  }, [rows, fromApi])

  return lastUpdated
}
