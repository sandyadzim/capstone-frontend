import { expect, it } from 'vitest'
import transformer from '../../scripts/openapi-transformer'

it('corrects the two nullable text fields without changing unrelated schemas', async () => {
  const result = await transformer({
    openapi: '3.0.0',
    info: { title: 'CP Backend API', version: '1.0' },
    paths: {},
    components: {
      schemas: {
        ReportAssignmentResponseDto: {
          type: 'object',
          properties: { note: { type: 'object', nullable: true } },
        },
        ReportDetailResponseDto: {
          type: 'object',
          properties: { rejectionReason: { type: 'object', nullable: true } },
        },
        OtherDto: {
          type: 'object',
          properties: { note: { type: 'object', nullable: true } },
        },
      },
    },
  })
  expect(result.components?.schemas).toMatchObject({
    ReportAssignmentResponseDto: {
      properties: { note: { type: 'string', nullable: true } },
    },
    ReportDetailResponseDto: {
      properties: { rejectionReason: { type: 'string', nullable: true } },
    },
    OtherDto: {
      properties: { note: { type: 'object', nullable: true } },
    },
  })
})

it('preserves corrected upstream schemas and skips missing or changed fields', async () => {
  const document = {
    openapi: '3.0.0',
    info: { title: 'CP Backend API', version: '1.0' },
    paths: {},
    components: {
      schemas: {
        ReportAssignmentResponseDto: {
          type: 'object',
          properties: {
            note: { type: 'string', nullable: true, maxLength: 160 },
          },
        },
        ReportDetailResponseDto: {
          type: 'object',
          properties: {
            rejectionReason: {
              type: 'object',
              nullable: true,
              properties: { message: { type: 'string' } },
            },
          },
        },
      },
    },
  } as const
  expect(await transformer(structuredClone(document))).toEqual(document)
  expect(
    await transformer({
      openapi: '3.0.0',
      info: { title: 'CP Backend API', version: '1.0' },
      paths: {},
    }),
  ).toMatchObject({ paths: {} })
})
