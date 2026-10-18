export function monthLabel(month: string, short = false) {
  return new Intl.DateTimeFormat('en-GB', {
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' }),
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${month}-01T00:00:00+07:00`))
}
