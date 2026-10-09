import { defineConfig } from 'orval'
import transformer from './scripts/openapi-transformer.ts'

export default defineConfig({
  cpBackend: {
    input: {
      target: './openapi/cp-be.json',
      override: { transformer },
    },
    output: {
      target: './src/lib/api/generated/endpoints.ts',
      mode: 'split',
      client: 'axios-functions',
      clean: true,
      formatter: 'prettier',
      tsconfig: './tsconfig.app.json',
      override: {
        mutator: {
          path: './src/lib/api/request.ts',
          name: 'apiRequest',
        },
      },
    },
  },
})
