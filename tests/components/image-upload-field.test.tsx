// @vitest-environment jsdom
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ImageUploadField } from '@/components/image-upload-field'

it('supports another label, input ID, file count, and size limit', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumbnail')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  function Form() {
    const [files, setFiles] = useState<File[]>([])
    return (
      <ImageUploadField
        id="banner-image"
        label="Banner image"
        files={files}
        maxFiles={1}
        maxSizeMiB={1}
        onChange={setFiles}
      />
    )
  }
  render(<Form />)
  const user = userEvent.setup()
  const input = screen.getByLabelText('Banner image')
  expect(input).toHaveAttribute('id', 'banner-image')
  await user.upload(input, [
    new File(['first'], 'first.png', { type: 'image/png' }),
    new File(['second'], 'second.png', { type: 'image/png' }),
  ])
  expect(screen.getByText('Choose up to 1 image.')).toBeInTheDocument()
  await user.upload(
    input,
    new File([new Uint8Array(1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    }),
  )
  expect(
    screen.getByText('Each image must be 1 MiB or smaller.'),
  ).toBeInTheDocument()
  await user.upload(
    input,
    new File(['image'], 'banner.png', { type: 'image/png' }),
  )
  expect(screen.getByAltText('Selected image: banner.png')).toBeInTheDocument()
  expect(input).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Preview image 1: banner.png' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Remove image 1: banner.png' }),
  ).toBeInTheDocument()
})
