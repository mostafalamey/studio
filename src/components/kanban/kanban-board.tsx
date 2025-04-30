
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
    tasksQuery = query(
        tasksCollection,
        where('projectId', '==', projectId),
        orderBy('createdAt', 'asc') // Example ordering, adjust as needed
    );

    // Filter for employees: show only tasks assigned to them
    if (userRole === 'employee' && user) {
        // Modify the query to filter by assigneeId
        tasksQuery = query(tasksQuery, where('assigneeId', '==', user.uid));
    }
  }


  const [tasksData, loading, error] = useCollectionData<Task>(tasksQuery as Query<Task>, {
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
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-6">
         {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 rounded-lg" />)}
       </div>
     );
   }

   if (error) {
     return <div className="text-destructive p-4">Error loading tasks: {error.message}</div>;
   }

  return (
    <DndProvider backend={HTML5Backend}>
      {/* Add Task Button for Managers/Owners */}
      {(userRole === 'manager' || userRole === 'owner') && (
        <div className="px-4 md:px-6 pt-4 mb-4">
          <Button onClick={openAddTaskModal}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      )}
      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 md:p-6">
        {initialColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasks.filter((task) => task.columnId === column.id)}
            onDropTask={handleDropTask}
            onTaskClick={openTaskDetailModal} // Pass the click handler
          />
        ))}
      </div>
       {/* Task Detail Modal */}
       {selectedTask && (
         <TaskDetailModal
           isOpen={isDetailModalOpen}
           onClose={closeTaskDetailModal}
           task={selectedTask}
           onTaskUpdate={handleTaskUpdate} // Pass update handler
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

