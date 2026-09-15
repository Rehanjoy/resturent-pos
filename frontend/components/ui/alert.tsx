import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * `warning`/`success`/`info` extend shadcn's default/destructive pair with
 * the rest of the brand kit's semantic palette. `warning` keeps dark text
 * (`--color-text`) rather than white or the warning color itself — the
 * brand kit's own contrast notes call out white-on-warning as sub-AA.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-2xl border px-4 py-3.5 text-left text-sm shadow-[0_10px_28px_rgba(86,43,25,.06)] backdrop-blur-xl has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-white/85 bg-white/72 text-text",
        destructive:
          "border-destructive/20 bg-white/82 text-destructive *:data-[slot=alert-description]:text-destructive/90",
        warning: "border-warning/30 bg-white/82 text-text *:data-[slot=alert-description]:text-text/80",
        success: "border-success/20 bg-white/82 text-success *:data-[slot=alert-description]:text-success/90",
        info: "border-info/20 bg-white/82 text-info *:data-[slot=alert-description]:text-info/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
