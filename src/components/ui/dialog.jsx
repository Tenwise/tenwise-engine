import { HiOutlineXMark as XIcon } from "react-icons/hi2"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

// shadcn's dialog parts, built from one factory instead of one near-identical
// wrapper each: a Radix part (or element) tagged with data-slot, with its
// base classes merged ahead of any className passed in.
function slotted(Part, slot, baseClass) {
  function Slotted({ className, ...props }) {
    return <Part data-slot={slot} className={baseClass ? cn(baseClass, className) : className} {...props} />
  }
  Slotted.displayName = slot
  return Slotted
}

const Dialog = slotted(DialogPrimitive.Root, "dialog")
const DialogTrigger = slotted(DialogPrimitive.Trigger, "dialog-trigger")
const DialogPortal = slotted(DialogPrimitive.Portal, "dialog-portal")
const DialogClose = slotted(DialogPrimitive.Close, "dialog-close")
const DialogOverlay = slotted(DialogPrimitive.Overlay, "dialog-overlay",
  "fixed inset-0 z-[1000] bg-black/60 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0")
const DialogHeader = slotted("div", "dialog-header", "flex flex-col gap-2 text-center sm:text-left")
const DialogTitle = slotted(DialogPrimitive.Title, "dialog-title", "text-lg leading-none font-semibold")
const DialogDescription = slotted(DialogPrimitive.Description, "dialog-description", "text-sm text-muted-foreground")

function DialogFooter({ className, showCloseButton = false, children, ...props }) {
  return (
    <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props}>
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <button type="button" className="h-7 cursor-pointer rounded-md border border-border bg-transparent px-2.5 text-xs text-foreground hover:bg-[var(--bg-hover)]">Close</button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogContent({ className, children, showCloseButton = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-[1000] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

// Every export is a component; the plugin can't see that through slotted().
/* eslint-disable react-refresh/only-export-components */
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
/* eslint-enable react-refresh/only-export-components */
