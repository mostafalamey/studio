
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
        "flex flex-col h-full min-w-[280px] flex-1 rounded-lg", // Use flex-1 for responsive width, remove fixed width
        isOver && canDrop ? 'bg-accent/60' : 'bg-secondary/50' // Lighter bg, slight accent on hover
      )}
      style={{ flexBasis: '280px' }} // Set a base width, flex-grow handles expansion
    >
      {/* Removed outer Card component, using div for bg color */}
      <div className="flex flex-col flex-grow p-3"> {/* Add padding to the main div */}
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-secondary/50 pt-1 pb-2 z-10 -mx-3 px-3"> {/* Sticky header with padding */}
          <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
          <Badge variant="secondary" className="text-xs font-semibold rounded-full px-2 py-0.5">
            {tasks.length}
          </Badge>
        </div>
        <div className="space-y-2 overflow-y-auto flex-grow min-h-[100px] -mx-1 px-1"> {/* Allow content to scroll, add negative margin compensation */}
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
           {/* Spacer div to push content up */}
           <div className="flex-grow"></div>
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;
