
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
                    console.log(`Home: Fetching projects for Employee: ${user.uid}`);
                    // Employees see projects where they are in the 'assignedUsers' array
                    // This query requires a composite index: (assignedUsers Asc, createdAt Desc)
                    q = query(
                        projectsCollection,
                        where('assignedUsers', 'array-contains', user.uid),
                        orderBy('createdAt', 'desc')
                    );
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
   }, [db, user, userRole]); // Added toast dependency earlier, check if needed


  const [projects, projectsLoading, projectsError] = useCollectionData<Project>(projectsQuery as Query<Project>, {
    snapshotListenOptions: { includeMetadataChanges: true },
    idField: 'id', // Automatically add document ID to data object
  });

   // Automatically select the first project if none is selected and projects load
   useEffect(() => {
    if (selectedProjectId === null && !projectsLoading && projects && projects.length > 0) {
        setSelectedProjectId(projects[0].id);
    }
    // Add setSelectedProjectId to the dependency array
}, [projects, projectsLoading, selectedProjectId, setSelectedProjectId]);

   // Project selection is handled by the sidebar via context


  if (loading || projectsLoading) {
    return (
      <div className="flex flex-col space-y-4 p-4 md:p-6">
        {/* Skeleton for the Kanban board or content area */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
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

  if (userRole === 'owner') {
     // Owner specific view - Placeholder for Phase 3
     return (
        <div className="p-6">
            <p className="text-muted-foreground">Financial summaries will be displayed here in Phase 3.</p>
            {/* Show Kanban board or message based on project selection */}
             {selectedProjectId ? (
              <KanbanBoard projectId={selectedProjectId} />
            ) : projects && projects.length > 0 ? (
                 <p className="text-muted-foreground p-4">Select a project from the sidebar to view tasks.</p>
            ) : (
                 <p className="text-muted-foreground p-4">No projects available or you don't have access.</p>
            )
            }
        </div>
     );
  }


  // Employee and Manager view
  return (
    <>
       {/* Show Kanban board or message based on project selection */}
       {selectedProjectId ? (
         <KanbanBoard projectId={selectedProjectId} />
       ) : projects && projects.length > 0 ? (
         // If projects exist but none is selected (e.g., initially)
         <p className="text-muted-foreground p-4">Select a project from the sidebar to view tasks.</p>
       ) : (
         // If no projects are available for the user
         <p className="text-muted-foreground p-4">No projects available or you don't have access. Managers can create new projects.</p>
       )}
     </>
  );
}
