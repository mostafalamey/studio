"use client";

import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { motion, AnimatePresence } from 'framer-motion'; // Import motion and AnimatePresence
import KanbanColumn from './kanban-column';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData, useDocumentData } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, doc, updateDoc, FirestoreError, CollectionReference, Query, Timestamp, getDoc } from 'firebase/firestore';
import type { Task, ColumnId, Project, Column } from '@/lib/types';
import { initialColumns } from '@/lib/types';
import TaskDetailModal from './task-detail-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import AddTaskModal from './add-task-modal';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  projectId: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const { db, user, userRole } = useFirebase();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskRect, setSelectedTaskRect] = useState<DOMRect | null>(null); // Store card position

  // Firestore query for project details
  const projectRef = db && projectId ? doc(db, 'projects', projectId) : null;
  const [project, projectLoading, projectError] = useDocumentData<Project>(projectRef, {
     idField: 'id',
  });

  // Firestore query for tasks
  let tasksQuery: Query | CollectionReference | null = null;
  if (db && projectId) {
    const tasksCollection = collection(db, 'tasks') as CollectionReference<Task>;
    let baseQuery = query(
        tasksCollection,
        where('projectId', '==', projectId),
        orderBy('createdAt', 'asc') // Order by creation time
    );

    if (userRole === 'employee' && user) {
        // Employee query requires a composite index (projectId, assigneeId, createdAt)
        // Ensure this index is created in Firestore: projectId ASC, assigneeId ASC, createdAt ASC
        console.log(`KanbanBoard: Querying tasks for employee ${user.uid} in project ${projectId}`);
        tasksQuery = query(baseQuery, where('assigneeId', '==', user.uid));
    } else if (userRole === 'manager' || userRole === 'owner') {
        // Manager/Owner query requires a composite index (projectId, createdAt)
        // Ensure this index is created in Firestore: projectId ASC, createdAt ASC
         console.log(`KanbanBoard: Querying tasks for manager/owner in project ${projectId}`);
        tasksQuery = baseQuery;
    } else {
        console.log(`KanbanBoard: Unknown user role or no user. Returning empty query.`);
        // No user role or user, return no tasks
        tasksQuery = query(baseQuery, where('__name__', '==', 'nonexistent'));
    }
  }

  const [tasksData, tasksLoading, tasksError] = useCollectionData<Task>(tasksQuery as Query<Task> | null, {
    snapshotListenOptions: { includeMetadataChanges: true },
    idField: 'id',
  });

   // Log Firestore errors specifically for indexes
   useEffect(() => {
        if (tasksError) {
            console.error("Firestore Error fetching tasks:", tasksError);
             // Check for specific index error message
             const isIndexError = tasksError.message.includes('query requires an index');
             if (isIndexError) {
                 const match = tasksError.message.match(/(https:\/\/console\.firebase\.google\.com\/.*)/);
                 if (match && match[1]) {
                     console.error("Firestore Index Required: Please create the index using this link:", match[1]);
                     toast({
                        title: "Database Index Required",
                        description: `A Firestore index is needed for optimal performance. Please check the browser console for the creation link. Link: ${match[1]}`,
                        variant: "destructive",
                        duration: 20000, // Show longer for index errors
                    });
                 } else {
                     toast({
                        title: "Database Index Required",
                        description: `A Firestore index is needed. Check the browser console for details. Error: ${tasksError.message}`,
                        variant: "destructive",
                        duration: 20000,
                     });
                 }
             } else {
                 // Generic error toast
                 toast({
                    title: "Database Error",
                    description: `Failed to load tasks: ${tasksError.message}.`,
                    variant: "destructive",
                 });
             }
        }
    }, [tasksError, toast]);

  useEffect(() => {
    if (tasksData) {
      setTasks(tasksData);
      console.log(`KanbanBoard: Received ${tasksData.length} tasks for project ${projectId}`);
    } else {
         console.log(`KanbanBoard: No task data received for project ${projectId}. Loading: ${tasksLoading}`);
         setTasks([]); // Ensure tasks are cleared if data is null/undefined
    }
     // Cleanup function to clear tasks when projectId changes or component unmounts
     return () => {
       console.log(`KanbanBoard: Cleaning up tasks for project ${projectId}`);
       setTasks([]);
     };
  }, [tasksData, projectId, tasksLoading]); // Added tasksLoading

  const handleDropTask = async (taskId: string, newColumnId: ColumnId) => {
    if (!db) return;

    const taskToMove = tasks.find(task => task.id === taskId);

    if (userRole === 'employee' && taskToMove?.assigneeId !== user?.uid) {
      toast({
        title: "Permission Denied",
        description: "You can only move tasks assigned to you.",
        variant: "destructive",
      });
      return;
    }

    const taskRef = doc(db, 'tasks', taskId);
    try {
      await updateDoc(taskRef, { columnId: newColumnId, updatedAt: Timestamp.now() });
       toast({
         title: "Task Moved",
         description: `Task moved to ${initialColumns.find(c => c.id === newColumnId)?.title}.`,
       });
      console.log(`Task ${taskId} moved to ${newColumnId}`);
    } catch (err) {
      console.error("Error moving task:", err);
      toast({
        title: "Error",
        description: "Failed to move task. Please try again.",
        variant: "destructive",
      });
    }
  };

   const openTaskDetailModal = (task: Task, cardElement: HTMLElement | null) => {
    setSelectedTask(task);
    setSelectedTaskRect(cardElement?.getBoundingClientRect() || null); // Get card position
    setIsDetailModalOpen(true);
   };


  const closeTaskDetailModal = () => {
    setIsDetailModalOpen(false);
     // No need to reset selectedTask/Rect here, AnimatePresence handles exit animation
     // Resetting them immediately would break the exit animation
     // setSelectedTask(null);
     // setSelectedTaskRect(null);
  };

   const openAddTaskModal = () => {
    setIsAddModalOpen(true);
  };

  const closeAddTaskModal = () => {
    setIsAddModalOpen(false);
  };

   const handleTaskUpdate = () => {
     toast({ title: "Task Updated", description: "Task details have been saved." });
   };

   const handleTaskAdd = (newTaskName: string) => {
    toast({ title: "Task Added", description: `"${newTaskName}" created successfully.` });
    closeAddTaskModal();
  };

  // Combine loading states
  const isLoading = tasksLoading || projectLoading;

  if (isLoading) {
     return (
        <div className="flex flex-col flex-1 h-full overflow-hidden p-4 md:p-6">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 pb-4"> {/* Use grid layout */}
            {initialColumns.map((column) => (
              <div key={column.id} className="flex flex-col bg-border p-3 rounded-lg min-h-[200px]"> {/* Adjusted widths */}
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

   // Specific handling for index error in UI
   if (tasksError && tasksError.message.includes('query requires an index')) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <h2 className="text-lg font-semibold text-destructive mb-2">Database Configuration Needed</h2>
            <p className="text-muted-foreground mb-4">
                A required database index is missing to display tasks efficiently.
            </p>
            <p className="text-sm text-muted-foreground">
                Please check the browser's developer console (usually F12) for a link to create the necessary index in Firebase.
            </p>
             <p className="text-xs text-muted-foreground mt-2 break-all">
                 (Error details: {tasksError.message})
            </p>
        </div>
    );
   }


   if (tasksError || projectError) {
     const error = tasksError || projectError;
     return <div className="text-destructive p-4">Error loading data: {error?.message}</div>;
   }

    const projectName = project?.name || (projectId ? "Loading Project..." : "Select a Project");

  return (
     <DndProvider backend={HTML5Backend}>
       {/* AnimatePresence for modal transitions */}
       <AnimatePresence>
          {/* Container uses flex-1 to fill space, overflow-hidden for horizontal control */}
          <motion.div // Add motion.div for layout animations if needed
            key={`kanbanBoard-${projectId}`} // Add a key for AnimatePresence, include projectId
            className="flex flex-col flex-1 h-full overflow-hidden p-4 md:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Top Bar: Project Name & Add Task Button */}
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h1 className="text-xl font-semibold truncate">
                  {projectName}
                  {(tasksError || projectError) && <span className="text-destructive ml-2 text-sm">(Error)</span>}
              </h1>
              {(userRole === 'manager' || userRole === 'owner') && (
                <Button onClick={openAddTaskModal} className="bg-primary hover:bg-primary/90">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  New Task
                </Button>
              )}
            </div>

            {/* Kanban Columns Area - Grid layout */}
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 pb-4 overflow-y-auto">
               {initialColumns.map((column) => (
                   <KanbanColumn
                     key={column.id}
                     column={column}
                     tasks={tasks.filter((task) => task.columnId === column.id)}
                     onDropTask={handleDropTask}
                     onTaskClick={openTaskDetailModal} // Pass the handler
                   />
               ))}
             </div>
          </motion.div>

         {/* Task Detail Modal - Conditionally render with motion */}
          {isDetailModalOpen && selectedTask && (
           <TaskDetailModal
              key="taskDetailModal" // Key for AnimatePresence
              isOpen={isDetailModalOpen}
              onClose={closeTaskDetailModal}
              task={selectedTask}
              onTaskUpdate={handleTaskUpdate}
              initialRect={selectedTaskRect} // Pass initial position
           />
          )}
        </AnimatePresence>

       {/* Add Task Modal (Doesn't need the card animation) */}
       {isAddModalOpen && (
        <AddTaskModal
          isOpen={isAddModalOpen}
          onClose={closeAddTaskModal}
          projectId={projectId}
          onTaskAdd={handleTaskAdd}
        />
      )}
    </DndProvider>
  );
};

export default KanbanBoard;

    