"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(2,8,23,0.22)] transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-cyan-400/60 data-[state=checked]:bg-cyan-500 data-[state=unchecked]:border-slate-400/40 data-[state=unchecked]:bg-slate-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[18px] rounded-full bg-[#FFFFFF] shadow-[0_2px_8px_rgba(15,23,42,0.35)] ring-0 transition-transform data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-[2px] dark:bg-[#FFFFFF]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
