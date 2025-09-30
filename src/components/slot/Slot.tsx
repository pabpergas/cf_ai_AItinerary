import React from 'react';
import { Slot as RadixSlot } from '@radix-ui/react-slot';

interface SlotProps {
  children: React.ReactNode;
  asChild?: boolean;
  [key: string]: any;
}

export function Slot({ children, asChild = false, ...props }: SlotProps) {
  return (
    <RadixSlot asChild={asChild} {...props}>
      {children}
    </RadixSlot>
  );
}
