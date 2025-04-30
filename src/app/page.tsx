"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import KanbanBoard from '@/components/kanban/kanban-board';
import Login from '@/components/auth/login';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, where, FirestoreError, CollectionReference, Query } from 'firebase/firestore';
import type { Project } from '@/lib/types'; // Ensure Project type is imported

export default function Home() {
  const { user, loading, db, userRole } = useFirebase();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Conditionally define the query based on user role
  let projectsQuery: Query | CollectionReference | null = null;
  if (db) {
    const projectsCollection = collection(db, 'projects') as CollectionReference<Project>;
    if (userRole === 'manager' || userRole === 'owner') {
      // Managers and Owners see all projects
      projectsQuery = query(projectsCollection, orderBy('createdAt', 'desc'));
    } else if (userRole === 'employee' && user) {
       // Placeholder: Employees might see projects they are assigned tasks in.
       // This requires a more complex query or data structure modification (e.g., adding user IDs to projects).
       // For now, let's show no projects, or adjust based on specific requirements.
       // Option 1: Show no projects by default for employees
       // projectsQuery = query(projectsCollection, where('__name__', '==', 'nonexistent')); // Query that returns nothing
       // Option 2: Show all projects (temporary, adjust later)
       projectsQuery = query(projectsCollection, orderBy('createdAt', 'desc'));
    } else {
      // No user or role, or invalid role
      projectsQuery = null; // No query if not logged in or role invalid
    }
  }


  const [projects, projectsLoading, projectsError] = useCollectionData<Project>(projectsQuery as Query<Project>, {
    snapshotListenOptions: { includeMetadataChanges: true },
    idField: 'id', // Automatically add document ID to data object
  });

   // Automatically select the first project if none is selected and projects load
   useEffect(() => {
    if (!selectedProjectId && projects && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

   // Handle project selection from sidebar (passed via context or prop drilling if needed)
   // This function would typically be passed down to the sidebar.
   // For simplicity here, we'll assume the sidebar can update this state.
   const handleSelectProject = (projectId: string) => {
     setSelectedProjectId(projectId);
   };


  if (loading || projectsLoading) {
    return (
      <div className="flex flex-col space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-1/4" />
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
            <h1 className="text-2xl font-semibold mb-4">Owner Dashboard</h1>
            <p className="text-muted-foreground">Financial summaries will be displayed here in Phase 3.</p>
            {/* You could still show the project list or a specific owner view */}
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
