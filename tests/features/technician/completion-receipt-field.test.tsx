// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CompletionReceiptField } from '@/features/technician/completion-receipt-field'
import { photo } from '../admin/reports/fixtures'

const createUrl = vi.fn<(file: Blob) => string>()
const revokeUrl = vi.fn()
beforeEach(() => {
  createUrl
    .mockReset()
    .mockImplementation(
      (file) => `blob:${file instanceof File ? file.name : 'receipt'}`,
    )
  revokeUrl.mockReset()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createUrl
      static revokeObjectURL = revokeUrl
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function Field({
  saved = false,
  disabled = false,
}: {
  saved?: boolean
  disabled?: boolean
}) {
  const [file, setFile] = useState<File>()
  const [error, setError] = useState<string>()
  return (
    <CompletionReceiptField
      saved={
        saved
          ? { ...photo, fileUrl: 'https://example.test/paid%20receipt.pdf' }
          : null
      }
      file={file}
      onChange={setFile}
      disabled={disabled}
      error={error}
      onError={setError}
    />
  )
}
function choose(file: File, saved = false) {
  fireEvent.change(
    screen.getByLabelText(
      saved ? 'Replace receipt (optional)' : 'Choose receipt',
    ),
    { target: { files: [file] } },
  )
}
it('shows one upload control and no preview until a receipt is available', () => {
  render(<Field />)
  expect(screen.getByText('No file chosen')).toBeVisible()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /remove/i }),
  ).not.toBeInTheDocument()
})
it.each(['image/png', 'application/pdf'])(
  'opens the selected %s in a new tab with the filename in the upload field',
  (type) => {
    const view = render(<Field />)
    const file = new File(
      ['receipt'],
      type === 'image/png' ? 'receipt.png' : 'receipt.pdf',
      { type },
    )
    choose(file)
    expect(screen.getByText(file.name)).toBeVisible()
    const preview = screen.getByRole('link', {
      name: 'Preview receipt (opens in new tab)',
    })
    expect(preview).toHaveAttribute('href', `blob:${file.name}`)
    expect(preview).toHaveAttribute('target', '_blank')
    expect(preview).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /remove/i }),
    ).not.toBeInTheDocument()
    view.unmount()
    expect(revokeUrl).toHaveBeenCalledWith(`blob:${file.name}`)
  },
)
it('shows saved filename and previews the saved file until a replacement is selected', () => {
  render(<Field saved />)
  expect(screen.getByText('paid receipt.pdf')).toBeVisible()
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.test/paid%20receipt.pdf',
  )
  choose(new File(['image'], 'replacement.png', { type: 'image/png' }), true)
  expect(screen.getByText('replacement.png')).toBeVisible()
  expect(screen.queryByText('paid receipt.pdf')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    'blob:replacement.png',
  )
})
it('replaces the selected file and releases the previous preview URL', () => {
  render(<Field />)
  choose(new File(['pdf'], 'first.pdf', { type: 'application/pdf' }))
  choose(new File(['image'], 'second.png', { type: 'image/png' }))
  expect(screen.getByText('second.png')).toBeVisible()
  expect(screen.queryByText('first.pdf')).not.toBeInTheDocument()
  expect(revokeUrl).toHaveBeenCalledWith('blob:first.pdf')
  expect(screen.getByRole('link')).toHaveAttribute('href', 'blob:second.png')
})
it('retains the accepted receipt when an invalid replacement is rejected or the chooser is cancelled', () => {
  render(<Field />)
  choose(new File(['pdf'], 'first.pdf', { type: 'application/pdf' }))
  choose(new File(['invalid'], 'wrong.txt', { type: 'text/plain' }))
  expect(screen.getByText('first.pdf')).toBeVisible()
  expect(screen.queryByText('wrong.txt')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Choose receipt')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Choose a JPEG, PNG, WebP image or PDF.',
  )
  fireEvent.change(screen.getByLabelText('Choose receipt'), {
    target: { files: [] },
  })
  expect(screen.getByRole('link')).toHaveAttribute('href', 'blob:first.pdf')
  expect(createUrl).toHaveBeenCalledTimes(1)
})
it('disables upload and preview while submission is locked', () => {
  render(<Field saved disabled />)
  expect(screen.getByLabelText('Replace receipt (optional)')).toBeDisabled()
  expect(screen.getByRole('link')).toHaveAttribute('aria-disabled', 'true')
})
