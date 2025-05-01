"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import KanbanBoard from '@/components/kanban/kanban-board';
import Login from '@/components/auth/login';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, where, FirestoreError, CollectionReference, Query } from 'firebase/firestore';
import type { Project } from '@/lib/types'; // Ensure Project type is imported
import { useProjectContext } from '@/components/providers/project-provider'; // Import project context

export default function Home() {
  const { user, loading, db, userRole } = useFirebase();
  // Get selectedProjectId and setSelectedProjectId from context
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();

  // Conditionally define the query based on user role
   const [projectsQuery, setProjectsQuery] = useState<Query | null>(null);

   useEffect(() => {
        if (db && user) {
            const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
            let q: Query | null = null;
             try {
                 if (userRole === 'manager' || userRole === 'owner') {
                    console.log("Home: Fetching projects for Manager/Owner");
                    // Managers and Owners see all projects
                    q = query(projectsCollection, orderBy('createdAt', 'desc'));
                 } else if (userRole === 'employee') {
                    // Employees: Fetch all projects for now, filtering happens in sidebar
                    // This assumes the sidebar handles filtering projects based on assigned tasks
                     console.log(`Home: Fetching all projects initially for Employee: ${user.uid}`);
                     q = query(projectsCollection, orderBy('createdAt', 'desc'));
                 } else {
                     console.log(`Home: Fetching projects for unknown/invalid role: ${userRole}`);
                     // Query for a non-existent document ID to return nothing
                     q = query(projectsCollection, where('__name__', '==', 'nonexistent'));
                 }
             } catch (error) {
                  console.error("Error constructing projects query in Home:", error);
                  q = query(projectsCollection, where('__name__', '==', 'nonexistent'));
                  // Consider showing a toast or error message here
             }
             setProjectsQuery(q);
        } else if (db) {
            console.log("Home: Fetching projects: No user logged in.");
            const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
            setProjectsQuery(query(projectsCollection, where('__name__', '==', 'nonexistent')));
        } else {
             console.log("Home: Fetching projects: DB not available.");
             setProjectsQuery(null);
        }
   }, [db, user, userRole]);


  const [projects, projectsLoading, projectsError] = useCollectionData<Project>(projectsQuery as Query<Project>, {
    snapshotListenOptions: { includeMetadataChanges: true },
    idField: 'id', // Automatically add document ID to data object
  });

   // Automatically select the first project if none is selected and projects load
   // This logic might be better handled solely in the sidebar now that it filters projects
   // Keep it for now, but review if sidebar's auto-selection is sufficient
   useEffect(() => {
    if (selectedProjectId === null && !projectsLoading && projects && projects.length > 0) {
        // Ensure the project list isn't empty before selecting
        // Sidebar might have filtered this list already for employees
        const firstVisibleProject = projects[0]; // Or use filtered list from sidebar if available
        if (firstVisibleProject) {
           setSelectedProjectId(firstVisibleProject.id);
        }
    }
   }, [projects, projectsLoading, selectedProjectId, setSelectedProjectId]);

   // Project selection is handled by the sidebar via context


  if (loading || projectsLoading) {
    return (
      // Consistent skeleton structure for all roles during loading
      <div className="flex flex-col flex-1 h-full overflow-hidden p-4 md:p-6">
         <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-28" />
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 pb-4"> {/* Use grid layout */}
            {[1, 2, 3, 4].map((i) => (
                <div key={`col-skel-${i}`} className="flex flex-col bg-border p-3 rounded-lg min-h-[200px]"> {/* Adjusted widths */}
                  <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-5 w-8 rounded-full" />
                  </div>
                  <Skeleton className="h-24 w-full mb-2 rounded-lg" />
                  <Skeleton className="h-20 w-full mb-2 rounded-lg" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                </div>
            ))}
         </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (projectsError) {
    return <div className="text-destructive p-4">Error loading projects: {projectsError.message}</div>;
  }

   // Unified view for Owner, Manager, and Employee
   // The KanbanBoard component now handles its own padding and height
   return (
     <>
       {selectedProjectId ? (
         <KanbanBoard projectId={selectedProjectId} />
       ) : projects && projects.length > 0 ? (
         // If projects exist but none is selected (e.g., initially or after filter)
         <p className="text-muted-foreground p-4">Select a project from the sidebar to view tasks.</p>
       ) : (
         // If no projects are available for the user or after filtering
         <p className="text-muted-foreground p-4">
             {userRole === 'manager' || userRole === 'owner'
               ? "No projects available. Create a new project to get started."
               : "No projects assigned to you or available."}
         </p>
       )}
       {/* Owner specific financial summaries (if needed) can be added conditionally elsewhere or as a separate page */}
       {userRole === 'owner' && (
         <div className="p-4 text-sm text-muted-foreground italic">
           {/* Placeholder for Phase 3 Financial Summaries - kept outside the main Kanban flow */}
           {/* Financial summaries might appear below the board or in a dedicated section/page */}
           {/* <p>Financial summaries (Phase 3) will be displayed here.</p> */}
         </div>
       )}
     </>
   );
}
