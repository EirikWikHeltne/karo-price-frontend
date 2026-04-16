// Known pharmacy retailers and their display styles
export const KNOWN_RETAILER_STYLES = {
  farmasiet:   { label: 'Farmasiet',   color: '#2563EB' },
  boots:       { label: 'Boots',       color: '#E11D48' },
  vitusapotek: { label: 'Vitusapotek', color: '#059669' },
  apotek1:     { label: 'Apotek 1',    color: '#7C3AED' },
}

const KNOWN_RETAILER_KEYS = new Set(Object.keys(KNOWN_RETAILER_STYLES))

// Columns that are definitely NOT retailer price columns.
// Covers Supabase defaults, product metadata, computed fields, timestamps.
const NON_RETAILER_COLS = new Set([
  // Primary keys & identifiers
  'id', 'row_id', '_id', 'uuid', 'product_id', 'produkt_id',
  'prissammenligning_id', 'prishistorikk_id',
  // Product metadata
  'produkt', 'merke', 'varenummer', 'kategori', 'navn', 'name',
  'beskrivelse', 'description', 'ean', 'gtin', 'sku',
  // Timestamps & dates
  'sist_oppdatert', 'dato', 'created_at', 'updated_at',
  'opprettet', 'endret', 'timestamp', 'date',
  // Computed price fields
  'laveste_pris', 'hoyeste_pris', 'snitt_pris', 'gjennomsnitt',
  'spread', 'prisforskjell', 'differanse',
  // Counts & flags
  'antall', 'count', 'total', 'aktiv', 'active',
  // Long-format columns (used by maybeNormalize in historikk API)
  'kilde', 'apotek', 'kjede', 'retailer', 'butikk', 'pharmacy',
  'pris', 'price', 'verdi', 'value',
])

// Pattern-based exclusion for column names that look like metadata
function isLikelyMetadata(colName) {
  if (NON_RETAILER_COLS.has(colName)) return true
  // Columns ending with common metadata suffixes
  if (/_id$/.test(colName)) return true
  if (/_at$/.test(colName)) return true
  if (/_date$/.test(colName)) return true
  if (/^(is|has|kan)_/.test(colName)) return true
  return false
}

const FALLBACK_COLORS = ['#D97706', '#0891B2', '#BE185D', '#65A30D', '#DC2626', '#9333EA']

/**
 * Derive retailer columns from data rows.
 * Prioritises known retailer keys, then accepts unknown numeric columns
 * only if they pass metadata-pattern filtering.
 */
export function deriveRetailers(data) {
  if (!data?.length) return []

  const keys = []
  const seen = new Set()

  // First pass: find known retailers (guaranteed correct)
  for (const row of data) {
    for (const k of Object.keys(row)) {
      if (KNOWN_RETAILER_KEYS.has(k) && !seen.has(k)) {
        const val = row[k]
        if (val !== null && val !== undefined && !isNaN(Number(val))) {
          seen.add(k)
          keys.push(k)
        }
      }
    }
    // Early exit once we've found all known retailers
    if (seen.size === KNOWN_RETAILER_KEYS.size) break
  }

  // Second pass: detect unknown retailer columns (new pharmacies added to DB)
  for (const row of data) {
    for (const k of Object.keys(row)) {
      if (seen.has(k) || isLikelyMetadata(k)) continue
      const val = row[k]
      if (val !== null && val !== undefined && !isNaN(Number(val))) {
        seen.add(k)
        keys.push(k)
      }
    }
  }

  let colorIdx = 0
  return keys.map(key => ({
    key,
    label: KNOWN_RETAILER_STYLES[key]?.label
      || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')),
    color: KNOWN_RETAILER_STYLES[key]?.color
      || FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length],
  }))
}

/** Format a number as Norwegian currency (e.g. 129,90) */
export function fmt(val) {
  if (val === null || val === undefined) return null
  return Number(val).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Format a number as a short integer (e.g. 130) */
export function fmtShort(val) {
  if (val === null || val === undefined) return ''
  return Number(val).toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
