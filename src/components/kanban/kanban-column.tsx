
"use client";

import React from 'react';
import { useDrop } from 'react-dnd';
import KanbanCard from './kanban-card';
import type { Task, ColumnId, Column } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  onDropTask: (taskId: string, newColumnId: ColumnId) => void;
  onTaskClick: (task: Task) => void; // Add this prop
}

const ItemTypes = {
  TASK: 'task',
};

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, tasks, onDropTask, onTaskClick }) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ItemTypes.TASK,
    drop: (item: { id: string; columnId: ColumnId }) => {
      if (item.columnId !== column.id) {
        onDropTask(item.id, column.id);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
     // canDrop: (item: { id: string; columnId: ColumnId }) => {
     //   // Add logic here if certain tasks cannot be dropped into certain columns
     //   return true; // Default: allow dropping any task
     // },
  }), [column.id, onDropTask]);

  return (
    <div
      ref={drop}
      className={cn(
        "flex flex-col rounded-lg h-full min-h-[calc(100vh-250px)]", // Removed fixed width and flex-shrink, adjusted min-height
        isOver && canDrop ? 'bg-accent' : 'bg-secondary' // Use secondary for default background
      )}
      // Removed fixed minHeight style, relying on Tailwind class now
    >
      <Card className="flex flex-col flex-grow bg-secondary border-none shadow-none"> {/* Use secondary color, remove internal border/shadow */}
        <CardHeader className="p-3 sticky top-0 bg-secondary z-10 border-b"> {/* Make header sticky */}
          <CardTitle className="text-base font-semibold text-foreground">{column.title} ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-3 overflow-y-auto flex-grow"> {/* Allow content to scroll */}
          {tasks.length === 0 && !isOver && (
            <div className="text-center text-muted-foreground italic py-4">No tasks</div>
          )}
           {tasks.map((task) => (
             <KanbanCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
           ))}
           {isOver && canDrop && (
             <div className="h-16 rounded-lg border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center text-primary">
               Drop here
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KanbanColumn;

