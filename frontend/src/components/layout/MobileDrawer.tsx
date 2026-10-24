import React from 'react';
import { Sidebar } from './Sidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="p-0 w-72 max-w-[85vw] border-r-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <Sidebar isCollapsed={false} className="w-full border-r-0 h-full" onNavigate={onClose} />
      </SheetContent>
    </Sheet>
  );
};
