import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // `h-11` (44px) rather than shadcn's default `h-8` — matches this
        // app's `min-h-11`/44px tap-target rule for every input.
        "h-11 w-full min-w-0 rounded-xl border border-white/85 bg-white/72 px-3.5 py-1 text-base shadow-sm backdrop-blur-xl transition-[border-color,background-color,box-shadow] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:bg-white/95 focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
