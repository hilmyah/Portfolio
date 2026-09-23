import * as React from "react"
import { cn } from "@/lib/utils"

type SwitchProps = {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  label?: string
}

export function Switch({ checked, onCheckedChange, className, label }: SwitchProps) {
  const [internal, setInternal] = React.useState(!!checked)
  const isControlled = typeof checked === "boolean"
  const value = isControlled ? checked! : internal

  const toggle = () => {
    const next = !value
    if (!isControlled) setInternal(next)
    onCheckedChange?.(next)
  }

  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={toggle}
      className={cn(
        "inline-flex h-6 w-11 items-center rounded-full border border-border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        value && "bg-primary",
        className
      )}
    >
      <span
        className={cn(
          "block h-5 w-5 translate-x-0.5 rounded-full bg-background transition-all",
          value && "translate-x-[22px]"
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  )
}


