import * as React from "react"

type TooltipProps = {
  content: React.ReactNode
  children: React.ReactElement
}

export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  return (
    <div className="relative inline-block" onMouseLeave={() => setOpen(false)}>
      <div
        ref={triggerRef}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
        aria-describedby={open ? "tooltip" : undefined}
      >
        {children}
      </div>
      {open && (
        <div
          role="tooltip"
          id="tooltip"
          className="absolute z-50 mt-2 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow"
        >
          {content}
        </div>
      )}
    </div>
  )
}


