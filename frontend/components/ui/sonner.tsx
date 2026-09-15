"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// This app has no dark mode (see the note in `app/globals.css`), so the
// toaster is always rendered in the `light` theme rather than pulling in
// `next-themes` just to resolve a theme that never changes.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      richColors
      expand
      visibleToasts={5}
      gap={10}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "rgba(255,255,255,.86)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "rgba(255,255,255,.9)",
          "--border-radius": "1.15rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !border-white/90 !bg-white/86 !p-4 !shadow-[0_18px_48px_rgba(65,35,24,.18)] !backdrop-blur-2xl",
          title: "!font-heading !text-sm !font-semibold !text-text",
          description: "!text-xs !leading-5 !text-text-muted",
          actionButton: "!min-h-9 !rounded-full !bg-primary !px-4 !font-semibold !text-white",
          cancelButton: "!min-h-9 !rounded-full !bg-background !px-4 !font-semibold !text-text",
          closeButton: "!border-white !bg-white !text-text-muted !shadow-sm",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
