
"use client";

import React, { useState, useEffect } from 'react';
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
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, FolderKanban, PlusCircle, LayoutDashboard, Users, FileText } from 'lucide-react'; // Added icons
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, where, addDoc, Timestamp, FirestoreError, CollectionReference, Query, FieldPath, doc, setDoc } from 'firebase/firestore'; // Added FieldPath, doc, setDoc
import type { Project, UserRole } from '@/lib/types';
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProjectContext } from '@/components/providers/project-provider';


interface AppSidebarProps {}

const AppSidebar: React.FC<AppSidebarProps> = () => {
  const { auth, user, userRole, db, loading: authLoading } = useFirebase();
  const { toast } = useToast();
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

   // --- Project Fetching Logic ---
   const [projectsQuery, setProjectsQuery] = useState<Query | null>(null);

   useEffect(() => {
        if (db && user) {
            const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
            let q: Query | null = null;
             try {
                if (userRole === 'manager' || userRole === 'owner') {
                    console.log("Fetching projects for Manager/Owner");
                    // Managers and Owners see all projects
                    q = query(projectsCollection, orderBy('createdAt', 'desc'));
                } else if (userRole === 'employee') {
                    console.log(`Fetching projects for Employee: ${user.uid}`);
                    // Employees see projects where they are in the 'assignedUsers' array
                    q = query(
                        projectsCollection,
                        where('assignedUsers', 'array-contains', user.uid), // Ensure user.uid is correctly passed
                        orderBy('createdAt', 'desc')
                    );
                 } else {
                     console.log(`Fetching projects for unknown/invalid role: ${userRole}`);
                     // Handle cases where user role might not be set yet or is invalid
                     // Query for a non-existent document ID to return nothing
                     q = query(projectsCollection, where('__name__', '==', 'nonexistent'));
                 }
             } catch (error) {
                  console.error("Error constructing projects query:", error);
                  // Optionally set query to null or a 'nonexistent' query on error
                  q = query(projectsCollection, where('__name__', '==', 'nonexistent'));
                  toast({
                      title: "Query Error",
                      description: "Could not construct project query.",
                      variant: "destructive",
                  });
             }
             setProjectsQuery(q);
        } else if (db) {
            console.log("Fetching projects: No user logged in.");
            // If db exists but user doesn't (e.g., logged out), show no projects
            const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
            setProjectsQuery(query(projectsCollection, where('__name__', '==', 'nonexistent')));
        } else {
             console.log("Fetching projects: DB not available.");
             // If db doesn't exist (initial load?), set query to null
             setProjectsQuery(null);
        }
     // Depend on db, user, and userRole changes
   }, [db, user, userRole, toast]);


   const [projects, projectsLoading, projectsError] = useCollectionData<Project>(projectsQuery, {
     snapshotListenOptions: { includeMetadataChanges: true },
     idField: 'id',
   });

   // Log fetched projects for debugging
   useEffect(() => {
       if (!projectsLoading && projects) {
           console.log("Fetched projects:", projects);
       }
   }, [projects, projectsLoading]);


   // Log Firestore errors specifically
   useEffect(() => {
        if (projectsError) {
            console.error("Firestore Error fetching projects:", projectsError);
            // Detailed toast for Firestore errors
            toast({
                title: "Database Error",
                description: `Failed to load projects: ${projectsError.message} (Code: ${projectsError.code})`,
                variant: "destructive",
            });
        }
    }, [projectsError, toast]);


   const handleSelectProject = (projectId: string | null) => {
     setSelectedProjectId(projectId);
   };
   // --- End Project Fetching Logic ---


  const handleLogout = async () => {
    if (!auth) return;
    try {
      await auth.signOut();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      setSelectedProjectId(null); // Clear selected project on logout
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Logout Failed", variant: "destructive" });
    }
  };

   const handleAddProject = async () => {
    if (!db || !newProjectName.trim() || !user) return;
    setIsAddingProject(true);

    try {
      const projectsCollection = collection(db, 'projects');
      // Use doc() without an ID to get an auto-generated ID, then set()
      const newProjectRef = doc(projectsCollection);
      await setDoc(newProjectRef, {
        id: newProjectRef.id, // Store the generated ID within the document
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || '',
        createdAt: Timestamp.now(),
        createdBy: user.uid, // Link project to the creator
        assignedUsers: [], // Initialize with empty array
      });
      toast({ title: "Project Created", description: `"${newProjectName}" added successfully.` });
      setNewProjectName('');
      setNewProjectDescription('');
      setIsAddProjectModalOpen(false);
      handleSelectProject(newProjectRef.id); // Select the newly created project
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
     <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r border-sidebar-border">
        {/* Logo Area */}
       <SidebarHeader className="items-center justify-center h-16 border-b border-sidebar-border">
          <div className="flex flex-col items-center gap-1 p-2 overflow-hidden">
              {/* Placeholder Logo SVG */}
               <svg className="w-8 h-8 text-destructive group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:h-6" data-ai-hint="logo wireless signal" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M16.9999 8.5C16.9999 7.67 16.3299 7 15.4999 7C14.6699 7 13.9999 7.67 13.9999 8.5C13.9999 9.33 14.6699 10 15.4999 10C16.3299 10 16.9999 9.33 16.9999 8.5z"/><path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/><path d="M7.00006 8.5C7.00006 7.67 6.33006 7 5.50006 7C4.67006 7 4.00006 7.67 4.00006 8.5C4.00006 9.33 4.67006 10 5.50006 10C6.33006 10 7.00006 9.33 7.00006 8.5z"/><path d="M12 14c-2.76 0-5 2.24-5 5h10c0-2.76-2.24-5-5-5z" opacity=".3"/><path d="M12 6c-3.31 0-6 2.69-6 6 0 1.84.83 3.5 2.15 4.61.5.42 1.21.4 1.7-.03.44-.4.46-1.1.04-1.54C8.99 14.19 8.5 13.17 8.5 12c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5c0 1.17-.49 2.19-1.43 2.94-.42.44-.4 1.14.04 1.54.49.43 1.2.45 1.7.03C17.17 15.5 18 13.84 18 12c0-3.31-2.69-6-6-6z"/></svg>
              <span className="font-bold text-primary text-sm group-data-[collapsible=icon]:hidden">ACS PM</span>
          </div>
       </SidebarHeader>

      <SidebarContent className="p-0">
        {/* Projects Section */}
         <SidebarGroup className="p-2 pt-4">
            <SidebarGroupLabel className="group-data-[collapsible=icon]:px-2">PROJECTS</SidebarGroupLabel>
            {/* Add Project Button for Managers/Owners */}
             {(userRole === 'manager' || userRole === 'owner') && (
               <Dialog open={isAddProjectModalOpen} onOpenChange={setIsAddProjectModalOpen}>
                 <DialogTrigger asChild>
                   {/* Replaced with simpler button for consistency, can be styled further */}
                    <Button
                       variant="default" // Changed to default for prominence like image
                       className="w-full justify-center h-9 mb-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground" // Red button like image
                       title="Add Project"
                     >
                     <PlusCircle className="w-4 h-4 mr-2 group-data-[collapsible=icon]:mr-0" />
                     <span className="group-data-[collapsible=icon]:hidden">New Project</span>
                   </Button>
                 </DialogTrigger>
                 <DialogContent>
                   <DialogHeader>
                     <DialogTitle>Create New Project</DialogTitle>
                     <DialogDescription>Enter a name and description for your new project.</DialogDescription>
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
                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="project-description" className="text-right pt-2">Description</Label>
                        <Textarea
                          id="project-description"
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                          className="col-span-3 min-h-[80px]"
                          disabled={isAddingProject}
                          placeholder="Optional: Add a brief description..."
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
                {projectsLoading ? (
                    [1, 2].map(i => <SidebarMenuSkeleton key={`skel-proj-${i}`} showIcon />)
                 ) : projectsError ? (
                     <p key="proj-error" className="text-xs text-destructive px-2">
                          Error loading projects. Check console for details.
                     </p>
                 ) : !projects || projects.length === 0 ? (
                     <p key="proj-empty" className="text-xs text-muted-foreground px-2 italic">
                          {userRole === 'manager' || userRole === 'owner' ? 'No projects yet. Add one!' : 'No projects found or assigned.'}
                     </p>
                 ) : (
                     // Project list
                     projects.map((project) => (
                         <SidebarMenuItem key={project.id}> {/* Use project.id as key */}
                             <SidebarMenuButton
                                 onClick={() => handleSelectProject(project.id)}
                                 isActive={selectedProjectId === project.id} // Use context state for isActive
                                 tooltip={{ children: project.name }} // Show tooltip when collapsed
                                 className="justify-start group-data-[collapsible=icon]:justify-center"
                             >
                                 {/* Using FolderKanban, but could be FileText based on image */}
                                 <FolderKanban className="flex-shrink-0" />
                                 <span className="truncate">{project.name}</span>
                             </SidebarMenuButton>
                         </SidebarMenuItem>
                     ))
                 )}
             </SidebarMenu>
         </SidebarGroup>

         {/* Main Menu Section */}
         <SidebarGroup className="p-2">
             <SidebarGroupLabel className="group-data-[collapsible=icon]:px-2">MAIN MENU</SidebarGroupLabel>
             <SidebarMenu>
                 <SidebarMenuItem key="dashboard">
                      <SidebarMenuButton
                          // onClick={() => { /* Navigate to Dashboard view */ }}
                          isActive={false} // Determine active state based on current route/view
                          tooltip={{ children: "Dashboard" }}
                          className="justify-start group-data-[collapsible=icon]:justify-center"
                          disabled // Disable for now
                      >
                          <LayoutDashboard className="flex-shrink-0" />
                          <span className="truncate">Dashboard</span>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
                   <SidebarMenuItem key="team">
                      <SidebarMenuButton
                          // onClick={() => { /* Navigate to Team view */ }}
                          isActive={false} // Determine active state based on current route/view
                          tooltip={{ children: "Team" }}
                          className="justify-start group-data-[collapsible=icon]:justify-center"
                          disabled // Disable for now
                      >
                          <Users className="flex-shrink-0" />
                          <span className="truncate">Team</span>
                      </SidebarMenuButton>
                  </SidebarMenuItem>
             </SidebarMenu>
         </SidebarGroup>
      </SidebarContent>

       {/* Footer - Removed User Info and Logout */}
      <SidebarFooter className="p-2 mt-auto border-t border-sidebar-border">
         {/* Content removed as per request */}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
