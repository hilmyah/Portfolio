import * as React from "react"
import { cn } from "@/lib/utils"

export function Slider({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="range"
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-muted outline-none",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
        "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary",
        className
      )}
      {...props}
    />
  )
}
