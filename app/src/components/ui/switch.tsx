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
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-slate-300/70 bg-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-[#57c7c7]/70 data-[state=checked]:bg-[#2F8E92] data-[state=unchecked]:border-white/12 data-[state=unchecked]:bg-[#101b2c] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/12 dark:bg-[#101b2c] dark:data-[state=checked]:border-[#57c7c7]/70 dark:data-[state=checked]:bg-[#2F8E92] dark:data-[state=unchecked]:border-white/12 dark:data-[state=unchecked]:bg-[#101b2c]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-[0_2px_10px_rgba(15,23,42,0.45)] ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5 dark:bg-white"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
