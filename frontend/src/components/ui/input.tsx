import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1.5 text-base shadow-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
          // Red border & ring when invalid
          "aria-invalid:!border-red-500 aria-invalid:!ring-red-500/20 aria-invalid:focus-visible:!border-red-500 aria-invalid:focus-visible:!ring-red-500/30 aria-[invalid=true]:!border-red-500 aria-[invalid=true]:!ring-red-500/20 aria-[invalid=true]:focus-visible:!border-red-500 aria-[invalid=true]:focus-visible:!ring-red-500/30",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
