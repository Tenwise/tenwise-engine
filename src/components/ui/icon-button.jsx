import { cn } from "@/lib/utils"

/** Square ghost button for toolbars; `active` marks a pressed state. */
function IconButton({ active, className, type = "button", ...props }) {
  return (
    <button
      type={type}
      data-slot="icon-button"
      // Booleans only: a SQLite 0/1 flag would render the invalid aria-pressed="0".
      aria-pressed={active === undefined ? undefined : Boolean(active)}
      className={cn(
        "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        active ? "bg-[var(--bg-active)] text-foreground" : "bg-transparent text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { IconButton }
