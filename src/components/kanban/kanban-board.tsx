
"use client";

import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import KanbanColumn from './kanban-column';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, doc, updateDoc, FirestoreError, CollectionReference, Query, Timestamp } from 'firebase/firestore'; // Added Timestamp
import type { Task, ColumnId, Project, Column } from '@/lib/types'; // Import types
import { initialColumns } from '@/lib/types'; // Import initial columns
import TaskDetailModal from './task-detail-modal'; // Import the modal
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button'; // Import Button
import { PlusCircle } from 'lucide-react'; // Import PlusCircle
import AddTaskModal from './add-task-modal'; // Import AddTaskModal
import { cn } from '@/lib/utils'; // Import cn for conditional class names

interface KanbanBoardProps {
  projectId: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const { db, user, userRole } = useFirebase();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // State for add task modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Firestore query for tasks
  let tasksQuery: Query | CollectionReference | null = null;
  if (db && projectId) {
    const tasksCollection = collection(db, 'tasks') as CollectionReference<Task>;
    // Base query for the project, ordered by creation time or another relevant field
    let baseQuery = query(
        tasksCollection,
        where('projectId', '==', projectId),
        orderBy('createdAt', 'asc') // Example ordering, adjust as needed
    );

    // Filter for employees: show only tasks assigned to them OR unassigned tasks
     if (userRole === 'employee' && user) {
         // Employees see tasks assigned to them or tasks that are unassigned.
         // Firestore doesn't directly support OR queries on different fields easily.
         // A common workaround is to fetch assigned tasks and then potentially fetch unassigned ones
         // separately, or restructure data (e.g., add an 'assignees' array field).
         // For Phase 1, show only assigned tasks for employees.
         tasksQuery = query(baseQuery, where('assigneeId', '==', user.uid));
     } else if (userRole === 'manager' || userRole === 'owner') {
        // Managers and Owners see all tasks for the project
        tasksQuery = baseQuery;
     } else {
       // If role is not employee/manager/owner, or user is not defined, show no tasks
        tasksQuery = query(baseQuery, where('__name__', '==', 'nonexistent')); // Query that returns nothing
     }
  }


  const [tasksData, loading, error] = useCollectionData<Task>(tasksQuery as Query<Task> | null, {
    snapshotListenOptions: { includeMetadataChanges: true },
    idField: 'id',
  });

  useEffect(() => {
    if (tasksData) {
      setTasks(tasksData);
    }
     // Clear tasks when projectId changes to avoid showing stale data
     return () => {
       setTasks([]);
     };
  }, [tasksData, projectId]); // Add projectId as dependency

  const handleDropTask = async (taskId: string, newColumnId: ColumnId) => {
    if (!db) return;

    const taskToMove = tasks.find(task => task.id === taskId);

    // Role-based restriction for drag-and-drop
    if (userRole === 'employee' && taskToMove?.assigneeId !== user?.uid) {
      toast({
        title: "Permission Denied",
        description: "You can only move tasks assigned to you.",
        variant: "destructive",
      });
      return; // Prevent moving if employee didn't assign the task
    }


    const taskRef = doc(db, 'tasks', taskId);
    try {
      await updateDoc(taskRef, { columnId: newColumnId, updatedAt: Timestamp.now() }); // Use Timestamp.now()
      // Optimistic update (already handled by react-firebase-hooks)
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
      // Revert optimistic update if needed (though react-firebase-hooks might handle this)
    }
  };

  const openTaskDetailModal = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const closeTaskDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedTask(null);
  };

   const openAddTaskModal = () => {
    setIsAddModalOpen(true);
  };

  const closeAddTaskModal = () => {
    setIsAddModalOpen(false);
  };


   const handleTaskUpdate = () => {
     // This function will be called by the modal on successful update
     // to potentially refresh data or show a toast.
     toast({ title: "Task Updated", description: "Task details have been saved." });
     // No need to manually refetch, react-firebase-hooks handles it.
   };

   const handleTaskAdd = (newTaskName: string) => {
    toast({ title: "Task Added", description: `"${newTaskName}" created successfully.` });
    // No need to refetch, react-firebase-hooks handles it.
    closeAddTaskModal();
  };


  if (loading) {
     return (
        // Loading state with skeletons, maintaining the flex layout
        <div className="flex-1 flex gap-4 p-4 md:p-6 overflow-x-auto">
          {[...Array(initialColumns.length)].map((_, i) => (
             <div key={i} className="flex flex-col flex-1 min-w-[280px] max-w-[320px] bg-secondary p-3 rounded-lg"> {/* Skeleton column */}
               <Skeleton className="h-6 w-1/2 mb-4" />
               <Skeleton className="h-24 w-full mb-2 rounded-lg" />
               <Skeleton className="h-20 w-full mb-2 rounded-lg" />
               <Skeleton className="h-28 w-full rounded-lg" />
             </div>
          ))}
        </div>
     );
   }

   if (error) {
     return <div className="text-destructive p-4">Error loading tasks: {error.message}</div>;
   }

  return (
    <DndProvider backend={HTML5Backend}>
       <div className="flex flex-col flex-1 h-full overflow-hidden"> {/* Container takes available height */}
         {/* Add Task Button */}
         {(userRole === 'manager' || userRole === 'owner') && (
           <div className="px-4 md:px-6 pt-4 mb-4 flex-shrink-0">
             <Button onClick={openAddTaskModal}>
               <PlusCircle className="w-4 h-4 mr-2" />
               Add Task
             </Button>
           </div>
         )}

         {/* Kanban Columns Area - Flex, horizontal scroll on overflow */}
         <div className="flex flex-1 gap-4 p-4 md:px-6 md:pb-6 overflow-x-auto">
           {initialColumns.map((column) => (
             <KanbanColumn
               key={column.id}
               column={column}
               tasks={tasks.filter((task) => task.columnId === column.id)}
               onDropTask={handleDropTask}
               onTaskClick={openTaskDetailModal}
             />
           ))}
         </div>
       </div>

       {/* Task Detail Modal */}
       {selectedTask && (
         <TaskDetailModal
           isOpen={isDetailModalOpen}
           onClose={closeTaskDetailModal}
           task={selectedTask}
           onTaskUpdate={handleTaskUpdate}
         />
       )}
        {/* Add Task Modal */}
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
