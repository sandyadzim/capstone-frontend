import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ReportPhoto } from '../report-schema'

function SavedImage({
  url,
  label,
  preview = false,
}: {
  url: string
  label: string
  preview?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <p
        role="status"
        className="flex h-full min-h-32 items-center justify-center p-3 text-center text-sm text-muted-foreground"
      >
        Image unavailable
      </p>
    )
  return (
    <img
      src={url}
      alt={label}
      loading="lazy"
      onError={() => setFailed(true)}
      className={
        preview
          ? 'max-h-[60dvh] w-full rounded-md bg-muted object-contain'
          : 'size-full object-cover'
      }
    />
  )
}

export function ReportPhotos({
  photos,
  label,
}: {
  photos: ReportPhoto[]
  label: string
}) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-3">
      {photos.map((photo, index) => {
        const title = `${label.slice(0, -1)} ${index + 1}`
        return (
          <li
            key={photo.id}
            className="group relative size-32 overflow-hidden rounded-lg border bg-muted"
          >
            <SavedImage key={photo.fileUrl} url={photo.fileUrl} label={title} />
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute inset-0 m-auto size-11 bg-background opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
                    aria-label={`View ${title.toLowerCase()}`}
                  />
                }
              >
                <Search aria-hidden="true" />
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl motion-reduce:animate-none!">
                <DialogHeader className="pr-12">
                  <DialogTitle>Image preview</DialogTitle>
                  <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <SavedImage
                  key={photo.fileUrl}
                  url={photo.fileUrl}
                  label={title}
                  preview
                />
              </DialogContent>
            </Dialog>
          </li>
        )
      })}
    </ul>
  )
}
