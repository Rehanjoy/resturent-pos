import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // `bg-border` rather than shadcn's default `bg-muted`: in this
      // project `--muted` is the same blush tone as the page `--background`
      // (see `app/globals.css`), so a `bg-muted` skeleton would be
      // invisible against the page canvas. `bg-border` stays visible
      // whether the skeleton sits on the blush page or a white card.
      className={cn("animate-pulse rounded-md bg-border", className)}
      {...props}
    />
  )
}

export { Skeleton }
