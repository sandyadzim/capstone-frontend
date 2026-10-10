export function formatIdr(value: string) {
  const [whole, fraction] = value.split('.')
  return `Rp ${BigInt(whole).toLocaleString('id-ID')},${fraction}`
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}
