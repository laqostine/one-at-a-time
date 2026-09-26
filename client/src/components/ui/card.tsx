import * as React from "react"
import { cn } from "@/lib/utils"

/** App card: subtle border, 16px radius, 18-24px padding. Fixed-size parents keep it from reflowing. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.035)] sm:p-5",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex min-h-7 items-center gap-2", className)}
      {...props}
    />
  )
}

/** Card title = small-caps label. Pass `as` to pick the heading level. */
function CardTitle({ className, as: Tag = "h2", ...props }: React.ComponentProps<"h2"> & { as?: "h2" | "h3" | "div" }) {
  return <Tag data-slot="card-title" className={cn("card-label", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-meta", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("ml-auto flex items-center gap-2", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("min-h-0", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center", className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
