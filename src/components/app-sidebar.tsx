
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image'; // Import next/image
import Link from 'next/link'; // Import Link for navigation
import { usePathname } from 'next/navigation'; // Import usePathname for active state
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
import { LogOut, FolderKanban, PlusCircle, LayoutDashboard, Users, FileText, MoreHorizontal, Trash2, Sun, Moon, Edit } from 'lucide-react'; // Added Sun, Moon, Edit
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, where, addDoc, Timestamp, FirestoreError, CollectionReference, Query, FieldPath, doc, setDoc, deleteDoc, getDocs, writeBatch, updateDoc } from 'firebase/firestore'; // Added deleteDoc, getDocs, writeBatch, updateDoc
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
  DialogClose, // Import DialogClose
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
import { Switch } from "@/components/ui/switch"; // Import Switch
import { useTheme } from "next-themes"; // Import useTheme

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
  const [isEditingProject, setIsEditingProject] = useState(false); // State for edit operation
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editedProjectName, setEditedProjectName] = useState('');
  const [editedProjectDescription, setEditedProjectDescription] = useState('');
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const pathname = usePathname(); // Get current pathname
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false); // To prevent hydration mismatch for theme
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]); // Filtered projects for employees

   // --- Project Fetching Logic ---
   const [projectsQuery, setProjectsQuery] = useState<Query | null>(null);

   // Fetch projects based on role
   useEffect(() => {
        if (db && user) {
            const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
            let q: Query | null = null;
             try {
                if (userRole === 'manager' || userRole === 'owner') {
                    // Managers/Owners see all projects initially
                    q = query(projectsCollection, orderBy('createdAt', 'desc'));
                } else if (userRole === 'employee') {
                     // Employees: Fetch all projects for now, filtering happens later based on tasks
                     // Alternative: Could query projects where assignedUsers might contain the ID,
                     // but filtering based on *actual* assigned tasks is more accurate.
                     q = query(projectsCollection, orderBy('createdAt', 'desc'));
                 } else {
                     // Unknown role or no user role defined
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
            // No user logged in
            const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
            setProjectsQuery(query(projectsCollection, where('__name__', '==', 'nonexistent')));
        } else {
             // DB not available
             setProjectsQuery(null);
        }
   }, [db, user, userRole, toast]);


   const [projects, projectsLoading, projectsError] = useCollectionData<Project>(projectsQuery as Query<Project>, {
     snapshotListenOptions: { includeMetadataChanges: true },
     idField: 'id',
   });

    // Fetch all tasks assigned to the current employee (only if role is employee)
    const employeeTasksQuery = db && user && userRole === 'employee'
        ? query(collection(db, 'tasks') as CollectionReference<Task>, where('assigneeId', '==', user.uid))
        : null;

    const [employeeTasks, employeeTasksLoading, employeeTasksError] = useCollectionData<Task>(employeeTasksQuery, {
        snapshotListenOptions: { includeMetadataChanges: true },
        idField: 'id',
    });

    // Filter projects for employees based on assigned tasks
    useEffect(() => {
        if (userRole === 'employee') {
            if (!projectsLoading && projects && !employeeTasksLoading && employeeTasks) {
                const assignedProjectIds = new Set(employeeTasks.map(task => task.projectId));
                const finalProjects = projects.filter(project => assignedProjectIds.has(project.id));
                setFilteredProjects(finalProjects);

                // Auto-select logic based on filtered projects
                if (selectedProjectId === null && finalProjects.length > 0) {
                    setSelectedProjectId(finalProjects[0].id);
                } else if (selectedProjectId && !finalProjects.some(p => p.id === selectedProjectId)) {
                    setSelectedProjectId(finalProjects.length > 0 ? finalProjects[0].id : null);
                } else if (finalProjects.length === 0 && selectedProjectId !== null) {
                    // If no projects left for employee, deselect
                    setSelectedProjectId(null);
                }

            } else if (!projectsLoading && !employeeTasksLoading) {
                 // Handle cases where projects or tasks are loaded but empty
                 setFilteredProjects([]);
                 if (selectedProjectId !== null) {
                      setSelectedProjectId(null); // Deselect if no projects match
                 }
            } else {
                setFilteredProjects([]); // Default to empty while loading
            }
        } else if (userRole === 'manager' || userRole === 'owner') {
             // Managers/Owners see all fetched projects
            if (!projectsLoading && projects) {
                setFilteredProjects(projects);
                 // Auto-select for manager/owner
                 if (selectedProjectId === null && projects.length > 0) {
                     setSelectedProjectId(projects[0].id);
                 } else if (selectedProjectId && !projects.some(p => p.id === selectedProjectId)) {
                     // If currently selected project doesn't exist anymore (e.g., deleted)
                      setSelectedProjectId(projects.length > 0 ? projects[0].id : null);
                 } else if (projects.length === 0 && selectedProjectId !== null) {
                     setSelectedProjectId(null);
                 }
            } else {
                 setFilteredProjects([]);
            }
        } else {
             // No role or other cases
             setFilteredProjects([]);
             if (selectedProjectId !== null) {
                 setSelectedProjectId(null);
             }
        }
    }, [
        userRole,
        projects, projectsLoading,
        employeeTasks, employeeTasksLoading,
        selectedProjectId, setSelectedProjectId
    ]);

   // Combined loading state
   const combinedLoading = authLoading || projectsLoading || (userRole === 'employee' && employeeTasksLoading);
   const combinedError = projectsError || (userRole === 'employee' && employeeTasksError);


   // Log Firestore errors specifically
   useEffect(() => {
        const error = projectsError || employeeTasksError;
        if (error) {
            console.error("Firestore Error (Sidebar):", error);
             const isIndexError = error.message.includes('query requires an index');
            toast({
                title: isIndexError ? "Index Required" : "Database Error",
                description: isIndexError
                   ? `A Firestore index is required. Please create it using the link in the browser console.`
                   : `Failed to load data: ${error.message}.`,
                variant: "destructive",
                duration: isIndexError ? 20000 : 10000, // Show longer for index errors
            });
             if (isIndexError) {
                 const match = error.message.match(/(https:\/\/console\.firebase\.google\.com\/.*)/);
                 if (match && match[1]) {
                     console.error("Create Firestore Index:", match[1]);
                 }
             }
        }
    }, [projectsError, employeeTasksError, toast]);

   // Prevent hydration mismatch for theme switcher
   useEffect(() => {
      setIsMounted(true);
    }, []);


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
        updatedAt: Timestamp.now(), // Add updatedAt
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

    const openEditProjectModal = (project: Project) => {
        setEditingProject(project);
        setEditedProjectName(project.name);
        setEditedProjectDescription(project.description || '');
        setIsEditProjectModalOpen(true);
    };

    const handleEditProject = async () => {
        if (!db || !editingProject || !editedProjectName.trim()) return;
        setIsEditingProject(true);

        try {
            const projectRef = doc(db, 'projects', editingProject.id);
            await updateDoc(projectRef, {
                name: editedProjectName.trim(),
                description: editedProjectDescription.trim() || '',
                updatedAt: Timestamp.now(),
            });
            toast({ title: "Project Updated", description: `"${editedProjectName}" updated successfully.` });
            setIsEditProjectModalOpen(false);
            setEditingProject(null); // Clear editing project state
        } catch (error) {
            console.error("Error updating project:", error);
            toast({ title: "Error", description: "Failed to update project.", variant: "destructive" });
        } finally {
            setIsEditingProject(false);
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

  if (!isMounted) {
      // Render a skeleton or null during SSR/initial client render to avoid theme mismatch
      return (
          <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r border-sidebar-border">
              <SidebarHeader className="flex items-center justify-center h-24 border-b border-sidebar-border px-4 py-16">
                  <div className="flex flex-col items-center gap-2">
                       <Skeleton className="w-16 h-16 rounded-full" />
                       <Skeleton className="h-6 w-20 mt-2" />
                   </div>
              </SidebarHeader>
              <SidebarContent className="p-0">
                   <SidebarGroup className="p-2 pt-4">
                      <Skeleton className="h-6 w-1/3 mb-2" />
                       <Skeleton className="h-9 w-full mb-2" />
                       <SidebarMenuSkeleton showIcon />
                       <SidebarMenuSkeleton showIcon />
                   </SidebarGroup>
                    <SidebarGroup className="p-2">
                       <Skeleton className="h-6 w-1/3 mb-2" />
                       <SidebarMenuSkeleton showIcon />
                       <SidebarMenuSkeleton showIcon />
                   </SidebarGroup>
              </SidebarContent>
               <SidebarFooter className="p-2 mt-auto border-t border-sidebar-border">
                   {/* Skeleton for Theme switch */}
                    <div className="flex items-center justify-center p-2 space-x-2 group-data-[collapsible=icon]:justify-center">
                       <Skeleton className="w-5 h-5 rounded" />
                       <Skeleton className="w-11 h-6 rounded-full" />
                       <Skeleton className="w-5 h-5 rounded" />
                    </div>
               </SidebarFooter>
          </Sidebar>
      );
   }


  return (
     <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-r border-sidebar-border">
        {/* Logo Area */}
        <SidebarHeader className="flex items-center justify-center h-24 border-b border-sidebar-border px-4 py-16"> {/* Increased top/bottom padding */}
           {/* Container for logo and text, stacked vertically */}
           <div className="flex flex-col items-center gap-2"> {/* Use flex-col and items-center */}
                {/* Logo */}
                 <Image
                    src="/Logo_S.png" // Path relative to the public directory
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
                       className="w-full justify-center h-9 mb-6 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
                     <DialogClose asChild>
                        <Button variant="outline" disabled={isAddingProject}>Cancel</Button>
                     </DialogClose>
                     <Button onClick={handleAddProject} disabled={!newProjectName.trim() || isAddingProject}>
                       {isAddingProject ? 'Creating...' : 'Create Project'}
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
             )}

             <SidebarMenu>
                {combinedLoading ? (
                    [1, 2].map(i => <SidebarMenuSkeleton key={`skel-proj-${i}`} showIcon />)
                 ) : combinedError ? (
                     <p key="proj-error" className="text-xs text-destructive px-2">
                          Error loading projects. Check console & indexes.
                     </p>
                 ) : !filteredProjects || filteredProjects.length === 0 ? (
                     <p key="proj-empty" className="text-xs text-muted-foreground px-2 italic">
                          {userRole === 'manager' || userRole === 'owner' ? 'No projects yet. Add one!' : 'No projects assigned.'}
                     </p>
                 ) : (
                     // Use filteredProjects for rendering
                     filteredProjects.map((project) => (
                         <SidebarMenuItem key={project.id}> {/* Use project.id as key */}
                            <div className="flex items-center w-full">
                             {/* Wrap button in Link for navigation */}
                             <Link href="/" passHref legacyBehavior>
                               <SidebarMenuButton
                                   onClick={() => handleSelectProject(project.id)}
                                   isActive={pathname === '/' && selectedProjectId === project.id} // Active if on home and this project selected
                                   tooltip={{ children: project.name }} // Show tooltip when collapsed
                                   className="justify-start group-data-[collapsible=icon]:justify-center flex-grow" // Use flex-grow
                               >
                                   <FolderKanban className="flex-shrink-0" />
                                   <span className="truncate">{project.name}</span>
                               </SidebarMenuButton>
                             </Link>

                             {/* Three Dots Menu for Edit/Delete (Managers/Owners only) */}
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
                                             onClick={() => openEditProjectModal(project)}
                                             disabled={isDeletingProject || isEditingProject}
                                         >
                                             <Edit className="mr-2 h-4 w-4" />
                                             <span>Edit Project</span>
                                         </DropdownMenuItem>
                                         <DropdownMenuSeparator />
                                         <DropdownMenuItem
                                             className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                             onClick={() => openDeleteConfirmation(project)}
                                             disabled={isDeletingProject || isEditingProject}
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
                      <Link href="/dashboard" passHref legacyBehavior>
                          <SidebarMenuButton
                              isActive={pathname === '/dashboard'}
                              tooltip={{ children: "Dashboard" }}
                              className="justify-start group-data-[collapsible=icon]:justify-center"
                              disabled // Disable for now
                          >
                              <LayoutDashboard className="flex-shrink-0" />
                              <span className="truncate">Dashboard</span>
                          </SidebarMenuButton>
                       </Link>
                  </SidebarMenuItem>
                   <SidebarMenuItem key="team">
                      <Link href="/team" passHref legacyBehavior>
                          <SidebarMenuButton
                              isActive={pathname.startsWith('/team')} // Active if path starts with /team
                              tooltip={{ children: "Team" }}
                              className="justify-start group-data-[collapsible=icon]:justify-center"
                              // disabled // Enable the team link
                          >
                              <Users className="flex-shrink-0" />
                              <span className="truncate">Team</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
             </SidebarMenu>
         </SidebarGroup>
      </SidebarContent>

       {/* Footer - Theme Switch */}
      <SidebarFooter className="p-2 mt-auto border-t border-sidebar-border">
         <div className="flex items-center justify-center p-2 space-x-2 group-data-[collapsible=icon]:justify-center">
           <Sun className="h-5 w-5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
           <Switch
             id="theme-switch"
             checked={theme === 'dark'}
             onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
             aria-label="Toggle theme"
             className="group-data-[collapsible=icon]:hidden"
           />
           <Moon className="h-5 w-5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
           {/* Icon-only version when collapsed */}
           <Button
                variant="ghost"
                size="icon"
                className="hidden group-data-[collapsible=icon]:flex h-8 w-8"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Toggle Theme"
            >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="sr-only">Toggle Theme</span>
           </Button>
         </div>
      </SidebarFooter>

       {/* Edit Project Modal */}
        <Dialog open={isEditProjectModalOpen} onOpenChange={setIsEditProjectModalOpen}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Edit Project</DialogTitle>
               <DialogDescription>Modify the name and description of the project.</DialogDescription>
             </DialogHeader>
             <div className="grid gap-4 py-4">
               <div className="grid grid-cols-4 items-center gap-4">
                 <Label htmlFor="edit-project-name" className="text-right">Name</Label>
                 <Input
                   id="edit-project-name"
                   value={editedProjectName}
                   onChange={(e) => setEditedProjectName(e.target.value)}
                   className="col-span-3"
                   disabled={isEditingProject}
                 />
               </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-project-description" className="text-right pt-2">Description</Label>
                  <Textarea
                    id="edit-project-description"
                    value={editedProjectDescription}
                    onChange={(e) => setEditedProjectDescription(e.target.value)}
                    className="col-span-3 min-h-[80px]"
                    disabled={isEditingProject}
                    placeholder="Optional: Add a brief description..."
                  />
                </div>
             </div>
             <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" disabled={isEditingProject}>Cancel</Button>
                </DialogClose>
               <Button onClick={handleEditProject} disabled={!editedProjectName.trim() || isEditingProject}>
                 {isEditingProject ? 'Saving...' : 'Save Changes'}
               </Button>
             </DialogFooter>
           </DialogContent>
        </Dialog>


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
