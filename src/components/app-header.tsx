"use client";

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const AppHeader: React.FC = () => {
  // You might want to get the current project name here via context or props
  const currentProjectName = "Selected Project Name"; // Placeholder

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
       {/* Mobile Sidebar Trigger */}
       <SidebarTrigger className="sm:hidden" />

       {/* Optional: Breadcrumbs or Project Title */}
       {/* <h1 className="text-lg font-semibold hidden sm:flex">{currentProjectName}</h1> */}

       <div className="relative ml-auto flex-1 md:grow-0">
         {/* Placeholder Search */}
         {/* <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
         <Input
           type="search"
           placeholder="Search..."
           className="w-full rounded-lg bg-muted pl-8 md:w-[200px] lg:w-[320px]"
           disabled // Disabled for Phase 1
         /> */}
       </div>

       {/* Optional Header Actions (e.g., Notifications, User Menu) */}
       {/* <Button variant="outline" size="icon" className="ml-auto h-8 w-8">
         <Bell className="h-4 w-4" />
         <span className="sr-only">Toggle notifications</span>
       </Button> */}
    </header>
  );
};

export default AppHeader;
