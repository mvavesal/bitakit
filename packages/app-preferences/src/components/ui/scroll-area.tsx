'use client';
import * as React from 'react';
import { cn } from 'cn';
import { ScrollArea as Primitive } from 'radix-ui';

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root data-slot="scroll-area" className={cn('relative', className)} {...props}>
      <Primitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-(length:--focus-ring-width) focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </Primitive.Viewport>
      <ScrollBar />
      <ScrollBar orientation="horizontal" />
      <Primitive.Corner />
    </Primitive.Root>
  );
}
function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Primitive.ScrollAreaScrollbar>) {
  return (
    <Primitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-t-transparent data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-l-transparent',
        className,
      )}
      {...props}
    >
      <Primitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </Primitive.ScrollAreaScrollbar>
  );
}
export { ScrollArea, ScrollBar };
