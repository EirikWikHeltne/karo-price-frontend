// Columns to always keep in API responses (product metadata)
const KEEP_COLS = new Set([
  'id', 'produkt', 'merke', 'varenummer', 'kategori',
  'sist_oppdatert', 'laveste_pris', 'hoyeste_pris', 'dato',
])

// Columns to always strip (known non-price data that might be numeric)
const STRIP_PATTERNS = [/_id$/, /_at$/, /_date$/, /^(is|has|kan)_/]

/**
 * Strip unexpected columns from a database row before sending to the client.
 * Keeps known metadata columns and columns whose values look like retailer prices.
 * Strips columns that look like IDs, timestamps, or flags.
 */
export function cleanRow(row) {
  const clean = {}
  for (const [k, v] of Object.entries(row)) {
    if (KEEP_COLS.has(k)) {
      clean[k] = v
      continue
    }
    // Skip columns matching metadata patterns
    if (STRIP_PATTERNS.some(p => p.test(k))) continue
    // Keep columns with numeric values (likely retailer prices)
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      clean[k] = v
    }
  }
  return clean
}

/**
 * Clean an array of rows.
 */
export function cleanRows(rows) {
  if (!rows?.length) return rows
  return rows.map(cleanRow)
}

/**
 * Extract only retailer price columns from a row (strips all metadata).
 * Used when converting prissammenligning data to history format.
 */
export function extractPriceColumns(row) {
  const prices = {}
  for (const [k, v] of Object.entries(row)) {
    if (KEEP_COLS.has(k)) continue
    if (STRIP_PATTERNS.some(p => p.test(k))) continue
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      prices[k] = v
    }
  }
  return prices
}
