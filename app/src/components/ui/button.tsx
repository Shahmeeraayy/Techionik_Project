import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-[transform,box-shadow,background-color,border-color,color] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(135deg,#4f7cff,#7aa2ff)] text-primary-foreground shadow-[0_18px_40px_rgba(79,124,255,0.24)] hover:-translate-y-0.5 hover:shadow-[0_24px_46px_rgba(79,124,255,0.3)]",
        destructive:
          "bg-destructive text-white shadow-[0_16px_36px_rgba(127,29,29,0.24)] hover:-translate-y-0.5 hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,255,0.9))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_rgba(79,124,255,0.08)] hover:-translate-y-0.5 hover:bg-white hover:text-foreground dark:bg-white/[0.03] dark:border-white/10 dark:hover:bg-white/[0.07]",
        secondary:
          "bg-secondary/95 text-secondary-foreground shadow-[0_10px_28px_rgba(79,124,255,0.08)] hover:-translate-y-0.5 hover:bg-secondary/75",
        ghost:
          "hover:bg-accent/70 hover:text-accent-foreground dark:hover:bg-white/[0.06]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-9 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-2xl px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
