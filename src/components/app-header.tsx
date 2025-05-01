
"use client";

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, User as UserIcon } from 'lucide-react'; // Import UserIcon
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirebase } from '@/components/providers/firebase-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { useToast } from '@/hooks/use-toast'; // Import useToast

const AppHeader: React.FC = () => {
  const { auth, user, loading: authLoading, userRole } = useFirebase();
  const { toast } = useToast();

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    // Simple initials: first letter of first and last name
     const names = name.trim().split(' ');
     if (names.length === 1) return names[0][0].toUpperCase();
     return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };


  const handleLogout = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      // Context handles project selection potentially, or redirect might happen
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", variant: "destructive" });
    }
  };


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      {/* Mobile Sidebar Trigger */}
      <SidebarTrigger className="sm:hidden" />

      {/* Spacer to push User Menu to the right */}
      <div className="flex-1">
         {/* Content removed */}
      </div>


      {/* User Menu */}
      <div className="ml-auto flex items-center gap-4">
         {/* Optional: Action buttons could go here if needed */}

          {authLoading ? (
             <Skeleton className="h-9 w-24" /> // Skeleton for user area
          ) : user ? (
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <div className="text-right hidden sm:block">
                       <p className="text-sm font-medium">{user.displayName || user.email}</p>
                       <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                    </div>
                    <Avatar className="h-8 w-8">
                       <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User'}/>
                       <AvatarFallback className="bg-primary text-primary-foreground"> {/* Changed to primary */}
                         {getInitials(user.displayName || user.email)}
                       </AvatarFallback>
                    </Avatar>
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuLabel>My Account</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem disabled>
                   <UserIcon className="mr-2 h-4 w-4" />
                   <span>Profile</span>
                 </DropdownMenuItem>
                 <DropdownMenuItem disabled>
                   <span>Settings</span>
                 </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                   <LogOut className="mr-2 h-4 w-4" />
                   <span>Log out</span>
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
          ) : (
             <Button variant="outline" disabled>Login</Button> // Or link to login page
          )}
       </div>
    </header>
  );
};

export default AppHeader;
