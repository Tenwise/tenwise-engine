import { cn } from "@/lib/utils"

/** Text input on the app's tokens, with an optional leading icon. */
function Input({ className, icon: Icon, ...props }) {
  return (
    <label data-slot="input" className={cn("flex h-9 min-w-0 items-center gap-2 rounded-md border border-border bg-[var(--bg-primary)] px-3 text-muted-foreground focus-within:border-primary", className)}>
      {Icon && <Icon className="size-4 shrink-0" />}
      <input className="h-full min-w-0 flex-1 border-0 bg-transparent font-sans text-[13.5px] text-foreground shadow-none outline-none placeholder:text-[var(--text-tertiary)]" {...props} />
    </label>
  )
}

export { Input }
