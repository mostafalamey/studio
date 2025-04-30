"use client";

import React, { useState } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger, // Re-added trigger if needed in header
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, FolderKanban, PlusCircle, Settings } from 'lucide-react'; // Added icons
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, where, addDoc, Timestamp, FirestoreError, CollectionReference, Query } from 'firebase/firestore';
import type { Project, UserRole } from '@/lib/types'; // Ensure Project type is imported
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton component


// Define props if sidebar needs external control, e.g., selected project ID
interface AppSidebarProps {
  // selectedProjectId?: string | null; // Example prop
  // onSelectProject?: (projectId: string) => void; // Example prop
}

const AppSidebar: React.FC<AppSidebarProps> = (/* { selectedProjectId, onSelectProject } */) => {
  const { auth, user, userRole, db, loading: authLoading } = useFirebase();
  const { toast } = useToast();
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);

   // --- Project Fetching Logic (moved from page.tsx) ---
   const [currentlySelectedProjectId, setCurrentlySelectedProjectId] = useState<string | null>(null);

   // Conditionally define the query based on user role
   let projectsQuery: Query | CollectionReference | null = null;
   if (db) {
     const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
     if (userRole === 'manager' || userRole === 'owner') {
       projectsQuery = query(projectsCollection, orderBy('createdAt', 'desc'));
     } else if (userRole === 'employee' && user) {
        // Placeholder: Filter projects based on employee assignments (requires data model change or complex query)
        // For Phase 1 simplicity, let's show projects they are assigned to, assuming a simple direct assignment or showing all.
        // Showing all for now, refine later based on exact requirements.
       projectsQuery = query(projectsCollection, orderBy('createdAt', 'desc'));
       // Example of filtering by assignee (requires tasks subcollection or denormalization):
       // const tasksRef = collectionGroup(db, 'tasks');
       // const userTasksQuery = query(tasksRef, where('assigneeId', '==', user.uid));
       // Fetch task projectIds, then fetch projects (more complex)
     } else {
       projectsQuery = null; // No query if not logged in or role invalid
     }
   }

   const [projects, projectsLoading, projectsError] = useCollectionData<Project>(projectsQuery as Query<Project>, {
     snapshotListenOptions: { includeMetadataChanges: true },
     idField: 'id',
   });

   // Automatically select the first project if none is selected and projects load
   React.useEffect(() => {
    if (!currentlySelectedProjectId && projects && projects.length > 0) {
      // Check if the `onSelectProject` prop exists and call it
      // if (onSelectProject) {
      //   onSelectProject(projects[0].id);
      // }
      setCurrentlySelectedProjectId(projects[0].id); // Also keep internal state for highlighting
    }
  }, [projects, currentlySelectedProjectId /*, onSelectProject */]);

   const handleSelectProject = (projectId: string) => {
    // if (onSelectProject) {
    //   onSelectProject(projectId);
    // }
    setCurrentlySelectedProjectId(projectId);
    // Potentially close mobile sidebar if open
    // useSidebar().setOpenMobile(false);
  };
   // --- End Project Fetching Logic ---


  const handleLogout = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      setCurrentlySelectedProjectId(null); // Clear selection on logout
      // User state change will trigger re-render via FirebaseProvider
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", variant: "destructive" });
    }
  };

  const handleAddProject = async () => {
    if (!db || !newProjectName.trim()) return;
    setIsAddingProject(true);

    try {
      const projectsCollection = collection(db, 'projects');
      const docRef = await addDoc(projectsCollection, {
        name: newProjectName.trim(),
        createdAt: Timestamp.now(),
        // Add createdBy field if needed: createdBy: user?.uid
      });
      toast({ title: "Project Created", description: `"${newProjectName}" added successfully.` });
      setNewProjectName('');
      setIsAddProjectModalOpen(false); // Close modal on success
      handleSelectProject(docRef.id); // Select the newly created project
    } catch (error) {
      console.error("Error adding project:", error);
      toast({ title: "Error", description: "Failed to create project.", variant: "destructive" });
    } finally {
      setIsAddingProject(false);
    }
  };


  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
     <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="items-center border-b border-sidebar-border">
         {/* Simple Logo/Title */}
         <div className="flex items-center gap-2 p-2 flex-grow overflow-hidden">
            {/* Placeholder for a logo */}
            <svg className="w-6 h-6 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <span className="font-semibold text-lg truncate group-data-[collapsible=icon]:hidden">ACS ProjectFlow</span>
         </div>
         {/* Consider moving trigger to header if sidebar is collapsible */}
         {/* <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:hidden" /> */}
      </SidebarHeader>

      <SidebarContent className="p-0">
         <SidebarGroup className="p-2">
            <SidebarGroupLabel className="group-data-[collapsible=icon]:px-2">Projects</SidebarGroupLabel>
            {/* Add Project Button for Managers/Owners */}
             {(userRole === 'manager' || userRole === 'owner') && (
               <Dialog open={isAddProjectModalOpen} onOpenChange={setIsAddProjectModalOpen}>
                 <DialogTrigger asChild>
                   <Button
                       variant="ghost"
                       className="w-full justify-start h-8 mb-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2"
                       title="Add Project"
                     >
                     <PlusCircle className="w-4 h-4 mr-2 group-data-[collapsible=icon]:mr-0" />
                     <span className="group-data-[collapsible=icon]:hidden">Add Project</span>
                   </Button>
                 </DialogTrigger>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>Create New Project</DialogTitle>
                     <DialogDescription>Enter a name for your new project.</DialogDescription>
                   </DialogHeader>
                   <div className="grid gap-4 py-4">
                     <div className="grid grid-cols-4 items-center gap-4">
                       <Label htmlFor="project-name" className="text-right">Name</Label>
                       <Input
                         id="project-name"
                         value={newProjectName}
                         onChange={(e) => setNewProjectName(e.target.value)}
                         className="col-span-3"
                         disabled={isAddingProject}
                       />
                     </div>
                   </div>
                   <DialogFooter>
                     <Button variant="outline" onClick={() => setIsAddProjectModalOpen(false)} disabled={isAddingProject}>Cancel</Button>
                     <Button onClick={handleAddProject} disabled={!newProjectName.trim() || isAddingProject}>
                       {isAddingProject ? 'Creating...' : 'Create Project'}
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
             )}

             <SidebarMenu>
                 {projectsLoading && (
                    <>
                       <SidebarMenuSkeleton showIcon />
                       <SidebarMenuSkeleton showIcon />
                       <SidebarMenuSkeleton showIcon />
                    </>
                 )}
                 {projectsError && <p className="text-xs text-destructive px-2">Error loading projects.</p>}
                  {!projectsLoading && !projectsError && projects?.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 italic">No projects found.</p>
                  )}
                  {projects?.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                       onClick={() => handleSelectProject(project.id)}
                       isActive={currentlySelectedProjectId === project.id}
                       tooltip={{ children: project.name }} // Show tooltip when collapsed
                       className="justify-start group-data-[collapsible=icon]:justify-center"
                    >
                      <FolderKanban className="flex-shrink-0" />
                      <span className="truncate">{project.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
             </SidebarMenu>
         </SidebarGroup>
      </SidebarContent>

       <SidebarSeparator />

      <SidebarFooter className="p-2">
        {authLoading ? (
           <div className="flex items-center gap-2 p-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1 group-data-[collapsible=icon]:hidden">
                   <Skeleton className="h-4 w-3/4" />
                   <Skeleton className="h-3 w-1/2" />
                </div>
           </div>
        ) : user ? (
          <div className="flex items-center gap-2 p-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {getInitials(user.displayName || user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium truncate">{user.displayName || user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole || 'Loading role...'}</p>
            </div>
             {/* Settings Button - Placeholder */}
            {/* <Button variant="ghost" size="icon" className="h-8 w-8 group-data-[collapsible=icon]:hidden" title="Settings">
                <Settings className="w-4 h-4" />
            </Button> */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleLogout} title="Logout">
                <LogOut className="w-4 h-4" />
             </Button>

          </div>
        ) : (
          <div className="p-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            Not logged in.
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
