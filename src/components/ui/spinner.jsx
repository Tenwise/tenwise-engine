import { cn } from "@/lib/utils"

/** Small rotating ring. */
function Spinner({ className }) {
  return <span role="status" aria-label="Loading" className={cn("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />
}

export { Spinner }
