import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { format } from 'prettier'
import { z } from 'zod'

const source = new URL(process.argv[2] ?? 'http://localhost:3001/api/docs-json')
if (!['http:', 'https:'].includes(source.protocol)) {
  throw new Error('The OpenAPI source must be an HTTP(S) URL.')
}

const response = await fetch(source, { signal: AbortSignal.timeout(10_000) })
if (!response.ok) {
  throw new Error(`OpenAPI download failed: HTTP ${response.status}.`)
}

// Reject error envelopes/SPA fallback pages before replacing the local snapshot.
// Orval performs the full OpenAPI parsing when generating the client.
const document = z
  .object({
    openapi: z.string().regex(/^3\./),
    info: z.object({ title: z.string(), version: z.string() }).loose(),
    paths: z
      .record(z.string().regex(/^\/api(?:\/|$)/), z.unknown())
      .refine((paths) => Object.keys(paths).length > 0),
  })
  .loose()
  .parse(await response.json())

const destination = new URL('../openapi/cp-be.json', import.meta.url)
const temporary = new URL(
  `../openapi/cp-be.${process.pid}.tmp`,
  import.meta.url,
)
await mkdir(new URL('../openapi/', import.meta.url), { recursive: true })
try {
  await writeFile(
    temporary,
    await format(JSON.stringify(document), { parser: 'json' }),
  )
  await rename(temporary, destination)
} finally {
  await rm(temporary, { force: true })
}
console.log(`OpenAPI snapshot saved to ${fileURLToPath(destination)}.`)
