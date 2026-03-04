"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative w-full overflow-hidden", className)}
    {...props}
  />
))
Carousel.displayName = "Carousel"

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-full w-full", className)}
    {...props}
  />
))
CarouselContent.displayName = "CarouselContent"

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex-shrink-0 w-full h-full", 
      "transition-all duration-300 ease-in-out",
      className
    )}
    style={{
      touchAction: 'pan-y',
    }}
    {...props}
  />
))
CarouselItem.displayName = "CarouselItem"

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => (
  <Button
    ref={ref}
    variant={variant}
    size={size}
    className={cn(
      "absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg z-10",
      "hover:bg-background hover:scale-105 transition-all duration-200",
      className
    )}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span className="sr-only">Previous slide</span>
  </Button>
))
CarouselPrevious.displayName = "CarouselPrevious"

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => (
  <Button
    ref={ref}
    variant={variant}
    size={size}
    className={cn(
      "absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg z-10",
      "hover:bg-background hover:scale-105 transition-all duration-200",
      className
    )}
    {...props}
  >
    <ChevronRight className="h-4 w-4" />
    <span className="sr-only">Next slide</span>
  </Button>
))
CarouselNext.displayName = "CarouselNext"

const CarouselDots = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    count: number;
    activeIndex: number;
    onDotClick?: (index: number) => void;
  }
>(({ className, count, activeIndex, onDotClick, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10",
      className
    )}
    {...props}
  >
    {Array.from({ length: count }).map((_, index) => (
      <button
        key={index}
        type="button"
        onClick={() => onDotClick?.(index)}
        className={cn(
          "w-2 h-2 rounded-full transition-all duration-300",
          "bg-background/60 backdrop-blur-sm border border-border/50",
          index === activeIndex 
            ? "w-8 bg-primary border-primary" 
            : "hover:bg-background/80"
        )}
        aria-label={`Go to slide ${index + 1}`}
      />
    ))}
  </div>
))
CarouselDots.displayName = "CarouselDots"

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselDots,
}
