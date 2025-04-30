
"use client";

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, PlusCircle, User as UserIcon } from 'lucide-react'; // Import UserIcon
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useProjectContext } from '@/components/providers/project-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Project } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton
import { useToast } from '@/hooks/use-toast'; // Import useToast

const AppHeader: React.FC = () => {
  const { auth, user, loading: authLoading, userRole, db } = useFirebase();
  const { selectedProjectId } = useProjectContext();
  const { toast } = useToast();

  // Fetch current project details for the header title
  const [project, projectLoading, projectError] = useCollectionData<Project>(
    db && selectedProjectId ? query(collection(db, 'projects'), where('__name__', '==', selectedProjectId)) : null,
    { idField: 'id' }
  );

  const currentProject = project?.[0];
  const projectName = currentProject?.name || "Project"; // Default text

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      // setSelectedProjectId(null); // Context handles this potentially, or redirect
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", variant: "destructive" });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      {/* Mobile Sidebar Trigger */}
      <SidebarTrigger className="sm:hidden" />

      {/* Project Title */}
      <div className="flex-1">
        <h1 className="text-xl font-semibold">
            {projectLoading ? <Skeleton className="h-6 w-48" /> : projectName}
        </h1>
        {/* Optional: Breadcrumbs can go here */}
      </div>


      {/* User Menu */}
      <div className="ml-auto flex items-center gap-4">
         {/* Optional: New Project Button (moved from sidebar logic?) */}
         {/* {(userRole === 'manager' || userRole === 'owner') && (
           <Button variant="destructive" className="hidden sm:inline-flex bg-red-600 hover:bg-red-700">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Project
            </Button>
         )} */}

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
                       <AvatarFallback className="bg-destructive text-destructive-foreground">
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
