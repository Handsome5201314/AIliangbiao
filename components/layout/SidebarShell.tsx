'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
}

interface SidebarShellProps {
  navItems: NavItem[];
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  topBar?: ReactNode;
}

function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 px-3 py-4">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
            pathname === item.href
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'text-background/70 hover:bg-background/10 hover:text-background'
          )}
        >
          {item.icon}
          <span>{item.name}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function SidebarShell({ navItems, header, footer, children, topBar }: SidebarShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      <div className="border-b border-background/10 px-6 py-5">
        {header}
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks items={navItems} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      </div>
      <div className="border-t border-background/10 p-4">
        {footer}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col bg-foreground text-background lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-none bg-foreground p-0 text-background">
          <div className="flex h-full flex-col">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
        {/* Mobile header bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {navItems.find((item) => item.href === pathname)?.name || ''}
          </span>
        </header>

        {/* Desktop top bar (optional) */}
        {topBar && (
          <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-border bg-card/80 px-8 backdrop-blur lg:flex lg:h-16">
            {topBar}
          </header>
        )}

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
