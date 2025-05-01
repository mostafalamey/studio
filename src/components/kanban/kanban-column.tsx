
"use client";

import React from 'react';
import { useDrop } from 'react-dnd';
import KanbanCard from './kanban-card';
import type { Task, ColumnId, Column } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge'; // Import Badge
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
  }), [column.id, onDropTask]);

  return (
    <div
      ref={drop}
      className={cn(
        "flex flex-col h-full flex-1 rounded-lg min-w-0", // Use flex-1 for responsive width, remove fixed min-width, add min-w-0
        isOver && canDrop ? 'bg-accent/60' : 'bg-border' // Darker bg (bg-border), slight accent on hover
      )}
      // Remove explicit style flexBasis
    >
      {/* Removed outer Card component, using div for bg color */}
      <div className="flex flex-col flex-grow p-3 overflow-hidden"> {/* Add overflow-hidden to parent */}
        <div className={cn(
            "flex items-center justify-between mb-4 sticky top-0 pt-1 pb-2 z-10 -mx-3 px-3 flex-shrink-0",
             isOver && canDrop ? 'bg-accent/60' : 'bg-border' // Match background color
            )}> {/* Sticky header with padding, prevent shrinking */}
          <h3 className="text-sm font-semibold text-foreground truncate">{column.title}</h3> {/* Allow truncation */}
          <Badge variant="secondary" className="text-xs font-semibold rounded-full px-2 py-0.5 flex-shrink-0"> {/* Prevent shrinking */}
            {tasks.length}
          </Badge>
        </div>
        {/* Make this div scrollable vertically */}
        <div className="space-y-2 overflow-y-auto flex-grow min-h-[100px] -mx-1 px-1">
          {tasks.length === 0 && !isOver && (
            <div className="text-center text-muted-foreground italic py-4 text-sm">Drop tasks here</div>
          )}
           {tasks.map((task) => (
             <KanbanCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
           ))}
           {isOver && canDrop && (
             <div className="h-16 rounded-lg border-2 border-dashed border-primary bg-primary/10 flex items-center justify-center text-primary text-sm">
               Drop here
             </div>
           )}
           {/* Spacer div is likely not needed with overflow-y-auto on the parent */}
           {/* <div className="flex-grow"></div> */}
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;
