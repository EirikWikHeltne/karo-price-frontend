export function fmt(val) {
  if (val === null || val === undefined) return ''
  return Number(val).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtShort(val) {
  if (val === null || val === undefined) return ''
  return Number(val).toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
