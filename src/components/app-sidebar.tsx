
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image'; // Import next/image
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
import { Button } from '@/components/ui/button';
import { LogOut, FolderKanban, PlusCircle, LayoutDashboard, Users, FileText, MoreHorizontal, Trash2 } from 'lucide-react'; // Added MoreHorizontal, Trash2
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, where, addDoc, Timestamp, FirestoreError, CollectionReference, Query, FieldPath, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore'; // Added deleteDoc, getDocs, writeBatch
import { getStorage, ref, deleteObject, listAll } from 'firebase/storage'; // Import storage functions
import type { Project, UserRole, Task } from '@/lib/types'; // Added Task type
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"; // Import DropdownMenu components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog" // Import AlertDialog components
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton component
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { useProjectContext } from '@/components/providers/project-provider'; // Import project context hook


interface AppSidebarProps {}

const AppSidebar: React.FC<AppSidebarProps> = () => {
  const { auth, user, userRole, db, loading: authLoading } = useFirebase();
  const storage = getStorage(); // Initialize storage
  const { toast } = useToast();
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false); // State for delete operation
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
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
                    // This query requires a composite index: (assignedUsers Asc, createdAt Desc)
                    q = query(
                        projectsCollection,
                        where('assignedUsers', 'array-contains', user.uid),
                        orderBy('createdAt', 'desc')
                    );
                 } else {
                     console.log(`Fetching projects for unknown/invalid role: ${userRole}`);
                     // Query for a non-existent document ID to return nothing
                     q = query(projectsCollection, where('__name__', '==', 'nonexistent'));
                 }
             } catch (error) {
                  console.error("Error constructing projects query:", error);
                  q = query(projectsCollection, where('__name__', '==', 'nonexistent'));
                  toast({
                      title: "Query Error",
                      description: "Could not construct project query. Check Firestore indexes.",
                      variant: "destructive",
                  });
             }
             setProjectsQuery(q);
        } else if (db) {
            console.log("Fetching projects: No user logged in.");
            const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
            setProjectsQuery(query(projectsCollection, where('__name__', '==', 'nonexistent')));
        } else {
             console.log("Fetching projects: DB not available.");
             setProjectsQuery(null);
        }
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
            toast({
                title: "Database Error",
                description: `Failed to load projects: ${projectsError.message}. Ensure necessary Firestore indexes are created.`,
                variant: "destructive",
                 duration: 10000, // Show longer for index errors
            });
        }
    }, [projectsError, toast]);


   const handleSelectProject = (projectId: string | null) => {
     setSelectedProjectId(projectId);
   };
   // --- End Project Fetching Logic ---


  const handleAddProject = async () => {
    if (!db || !newProjectName.trim() || !user) return;
    setIsAddingProject(true);

    try {
      const projectsCollection = collection(db, 'projects');
      const newProjectRef = doc(projectsCollection); // Auto-generate ID
      await setDoc(newProjectRef, {
        id: newProjectRef.id, // Store generated ID in document
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || '',
        createdAt: Timestamp.now(),
        createdBy: user.uid,
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

  const openDeleteConfirmation = (project: Project) => {
    setProjectToDelete(project);
    setIsDeleteConfirmationOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!db || !projectToDelete || (userRole !== 'manager' && userRole !== 'owner')) {
        toast({ title: "Permission Denied", description: "You cannot delete this project.", variant: "destructive" });
        setIsDeleteConfirmationOpen(false);
        setProjectToDelete(null);
        return;
    }

    setIsDeletingProject(true);
    const projectId = projectToDelete.id;
    const projectName = projectToDelete.name;

    try {
        const batch = writeBatch(db);

        // 1. Query all tasks associated with the project
        const tasksRef = collection(db, 'tasks');
        const q = query(tasksRef, where('projectId', '==', projectId));
        const tasksSnapshot = await getDocs(q);

        // 2. Iterate through tasks to delete attachments and add task deletion to batch
        for (const taskDoc of tasksSnapshot.docs) {
            const task = taskDoc.data() as Task;
            console.log(`Processing task ${taskDoc.id} for deletion`);

            // Delete attachments from Storage
            if (task.attachments && task.attachments.length > 0) {
                for (const attachment of task.attachments) {
                    try {
                        const attachmentRef = ref(storage, attachment.id); // Assuming attachment.id is the storage path
                        await deleteObject(attachmentRef);
                        console.log(`Deleted attachment: ${attachment.fileName}`);
                    } catch (storageError: any) {
                         if (storageError.code !== 'storage/object-not-found') {
                            console.error(`Error deleting attachment ${attachment.fileName} from storage:`, storageError);
                            // Optionally warn user, but continue batch deletion
                            toast({ title: "Attachment Deletion Warning", description: `Could not delete file ${attachment.fileName} from storage.`, variant: "default" });
                         } else {
                             console.log(`Attachment ${attachment.fileName} not found in storage (already deleted?).`);
                         }
                    }
                }
            }

            // Add task deletion to the batch
            batch.delete(taskDoc.ref);
            console.log(`Added task ${taskDoc.id} to delete batch`);
        }

        // 3. Add project deletion to the batch
        const projectRef = doc(db, 'projects', projectId);
        batch.delete(projectRef);
        console.log(`Added project ${projectId} to delete batch`);

        // 4. Commit the batch
        await batch.commit();
        console.log(`Batch committed for project ${projectId} deletion.`);

        toast({ title: "Project Deleted", description: `Project "${projectName}" and all its tasks/attachments were deleted.` });

        // 5. Unselect project if it was selected
        if (selectedProjectId === projectId) {
            setSelectedProjectId(null);
        }

    } catch (error) {
        console.error("Error deleting project and associated data:", error);
        toast({ title: "Deletion Error", description: `Failed to delete project "${projectName}".`, variant: "destructive" });
    } finally {
        setIsDeletingProject(false);
        setIsDeleteConfirmationOpen(false);
        setProjectToDelete(null);
    }
};


  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };


  return (
     <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r border-sidebar-border">
        {/* Logo Area */}
        <SidebarHeader className="flex items-center justify-center h-24 border-b border-sidebar-border px-4 py-16"> {/* Increased top/bottom padding */}
           {/* Container for logo and text, stacked vertically */}
           <div className="flex flex-col items-center gap-2"> {/* Use flex-col and items-center */}
                {/* Logo */}
                 <Image
                    src="/Logo_S.png"
                    alt="ACS Logo"
                    width={64} // Increased width
                    height={64} // Increased height
                    className="group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 flex-shrink-0" // Smaller when collapsed
                    data-ai-hint="ACS logo"
                    priority
                />
               {/* App Name */}
               <span className="font-bold text-xl text-primary group-data-[collapsible=icon]:hidden whitespace-nowrap"> {/* Increased font size */}
                 ACS PF
               </span>
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
                    <Button
                       variant="default"
                       className="w-full justify-center h-9 mb-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
                          Error loading projects. Check console & indexes.
                     </p>
                 ) : !projects || projects.length === 0 ? (
                     <p key="proj-empty" className="text-xs text-muted-foreground px-2 italic">
                          {userRole === 'manager' || userRole === 'owner' ? 'No projects yet. Add one!' : 'No projects assigned.'}
                     </p>
                 ) : (
                     // Project list
                     projects.map((project) => (
                         <SidebarMenuItem key={project.id}> {/* Use project.id as key */}
                            <div className="flex items-center w-full">
                             <SidebarMenuButton
                                 onClick={() => handleSelectProject(project.id)}
                                 isActive={selectedProjectId === project.id} // Use context state for isActive
                                 tooltip={{ children: project.name }} // Show tooltip when collapsed
                                 className="justify-start group-data-[collapsible=icon]:justify-center flex-grow" // Use flex-grow
                             >
                                 <FolderKanban className="flex-shrink-0" />
                                 <span className="truncate">{project.name}</span>
                             </SidebarMenuButton>

                             {/* Three Dots Menu for Delete (Managers/Owners only) */}
                              {(userRole === 'manager' || userRole === 'owner') && (
                                 <DropdownMenu>
                                     <DropdownMenuTrigger asChild>
                                         <Button
                                             variant="ghost"
                                             size="icon"
                                             className="h-8 w-8 ml-auto flex-shrink-0 group-data-[collapsible=icon]:hidden"
                                             title="Project Actions"
                                             onClick={(e) => e.stopPropagation()} // Prevent triggering project selection
                                         >
                                             <MoreHorizontal className="w-4 h-4" />
                                             <span className="sr-only">Project Actions</span>
                                         </Button>
                                     </DropdownMenuTrigger>
                                     <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                         <DropdownMenuItem
                                             className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                             onClick={() => openDeleteConfirmation(project)}
                                             disabled={isDeletingProject}
                                         >
                                             <Trash2 className="mr-2 h-4 w-4" />
                                             <span>Delete Project</span>
                                         </DropdownMenuItem>
                                     </DropdownMenuContent>
                                 </DropdownMenu>
                              )}
                              </div>
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
                          isActive={false}
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
                          isActive={false}
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
         {/* Content removed */}
      </SidebarFooter>

        {/* Delete Project Confirmation Dialog */}
         {projectToDelete && (
            <AlertDialog open={isDeleteConfirmationOpen} onOpenChange={setIsDeleteConfirmationOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the project
                      <span className="font-semibold"> "{projectToDelete.name}" </span>
                       and all associated tasks and attachments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingProject} onClick={() => { setProjectToDelete(null); setIsDeleteConfirmationOpen(false); }}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                       onClick={handleDeleteProject}
                       disabled={isDeletingProject}
                       className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // Ensure destructive style
                     >
                      {isDeletingProject ? 'Deleting...' : 'Delete Project'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
         )}

    </Sidebar>
  );
};

export default AppSidebar;

    
    