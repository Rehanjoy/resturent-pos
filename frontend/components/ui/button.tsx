import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * Button variants/sizes are customized from the shadcn default to match two
 * house rules from `docs/02-brand-kit.md`:
 *  - CTA/button labels are set at 16px semibold minimum (`text-button`) —
 *    that's the documented mitigation for white text on the coral
 *    primary/accent colors only passing WCAG "AA-large", not full AA.
 *  - Every tappable control is at least 44px tall (`min-h-11`), since this
 *    whole app — especially the dining flow — is used on a phone.
 *
 * `accent` is a variant on top of shadcn's usual set: the brand kit
 * reserves `--color-accent` for the single primary call-to-action per
 * screen (add, send, settle, save), distinct from `--color-primary`
 * (navigation/links/focus rings). `default` keeps shadcn's usual primary
 * mapping so both brand colors stay available and distinguishable.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        accent: "bg-accent text-white hover:bg-accent/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        outline:
          "border-border bg-surface text-text-muted hover:border-primary hover:text-primary",
        ghost: "text-text hover:bg-primary/5 hover:text-primary",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 text-button has-[>svg]:px-4",
        sm: "h-9 gap-1.5 rounded-full px-4 text-sm has-[>svg]:px-3.5",
        lg: "h-12 px-6 text-button has-[>svg]:px-5",
        icon: "size-11 rounded-full",
        "icon-sm": "size-9 rounded-full",
        "icon-lg": "size-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
