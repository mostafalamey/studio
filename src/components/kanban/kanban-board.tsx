"use client";

import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import KanbanColumn from './kanban-column';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, doc, updateDoc, FirestoreError, CollectionReference, Query } from 'firebase/firestore';
import type { Task, ColumnId, Project, Column } from '@/lib/types'; // Import types
import { initialColumns } from '@/lib/types'; // Import initial columns
import TaskDetailModal from './task-detail-modal'; // Import the modal
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface KanbanBoardProps {
  projectId: string;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projectId }) => {
  const { db, user, userRole } = useFirebase();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Firestore query for tasks
  let tasksQuery: Query | CollectionReference | null = null;
  if (db && projectId) {
    const tasksCollection = collection(db, 'tasks') as CollectionReference<Task>;
    // Base query for the project, ordered by creation time or another relevant field
    tasksQuery = query(
        tasksCollection,
        where('projectId', '==', projectId),
        orderBy('createdAt', 'asc') // Example ordering, adjust as needed
    );

    // Further filter for employees if needed (though handled by DnD restrictions primarily)
    // if (userRole === 'employee' && user) {
    //   tasksQuery = query(tasksQuery, where('assigneeId', '==', user.uid));
    // }
  }


  const [tasksData, loading, error] = useCollectionData<Task>(tasksQuery as Query<Task>, {
    snapshotListenOptions: { includeMetadataChanges: true },
    idField: 'id',
  });

  useEffect(() => {
    if (tasksData) {
      setTasks(tasksData);
    }
  }, [tasksData]);

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
      await updateDoc(taskRef, { columnId: newColumnId, updatedAt: new Date() });
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

  const openTaskModal = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

   const handleTaskUpdate = () => {
     // This function will be called by the modal on successful update
     // to potentially refresh data or show a toast.
     toast({ title: "Task Updated", description: "Task details have been saved." });
     // No need to manually refetch, react-firebase-hooks handles it.
   };


  if (loading) {
     return (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-6">
         <Skeleton className="h-64 rounded-lg" />
         <Skeleton className="h-64 rounded-lg" />
         <Skeleton className="h-64 rounded-lg" />
         <Skeleton className="h-64 rounded-lg" />
       </div>
     );
   }

   if (error) {
     return <div className="text-destructive p-4">Error loading tasks: {error.message}</div>;
   }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex space-x-4 overflow-x-auto p-4 md:p-6 flex-1">
        {initialColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasks.filter((task) => task.columnId === column.id)}
            onDropTask={handleDropTask}
            onTaskClick={openTaskModal} // Pass the click handler
          />
        ))}
      </div>
       {selectedTask && (
         <TaskDetailModal
           isOpen={isModalOpen}
           onClose={closeTaskModal}
           task={selectedTask}
           onTaskUpdate={handleTaskUpdate} // Pass update handler
         />
       )}
    </DndProvider>
  );
};

export default KanbanBoard;
