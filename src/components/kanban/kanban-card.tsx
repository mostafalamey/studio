"use client";

import React from 'react';
import { useDrag } from 'react-dnd';
import type { Task, Priority } from '@/lib/types';
import { formatDueDate } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, MessageSquare, Paperclip, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/components/providers/firebase-provider'; // Import useFirebase


interface KanbanCardProps {
  task: Task;
   onClick: () => void; // Add onClick prop
}

const ItemTypes = {
  TASK: 'task',
};

const priorityStyles: Record<Priority, string> = {
  Low: 'bg-green-100 text-green-800 border-green-300',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 status-yellow', // Use status-yellow for background
  High: 'bg-red-100 text-red-800 border-red-300 status-red', // Use status-red for background
};

const KanbanCard: React.FC<KanbanCardProps> = ({ task, onClick }) => {
  const { userRole, user } = useFirebase(); // Get user role and user

   const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.TASK,
    item: { id: task.id, columnId: task.columnId },
    canDrag: () => {
      // Only managers/owners or the assigned employee can drag
      if (userRole === 'manager' || userRole === 'owner') {
        return true;
      }
      return userRole === 'employee' && task.assigneeId === user?.uid;
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [task.id, task.columnId, userRole, user?.uid, task.assigneeId]); // Add dependencies


  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div ref={drag} // Attach drag ref here
        onClick={onClick} // Attach onClick handler
        className={cn(
            "cursor-pointer", // Make it clear it's clickable
            isDragging ? 'opacity-50' : 'opacity-100'
        )}
        aria-label={`Task: ${task.name}`} // Updated aria-label
     >
      <Card className="mb-2 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-lg bg-card">
        <CardHeader className="p-3 pb-1">
           {/* Remove CardTitle */}
           {/* Use a simple paragraph or div for the name */}
           <p className="text-sm font-medium leading-tight text-card-foreground">{task.name}</p>
        </CardHeader>
        <CardContent className="p-3 pt-1 pb-2 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center space-x-2">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{formatDueDate(task.dueDate)}</span>
          </div>
           <Badge variant="outline" className={cn("text-xs", priorityStyles[task.priority])}>
               {task.priority}
           </Badge>
        </CardContent>
        <CardFooter className="p-3 pt-0 flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            {task.comments?.length > 0 && (
              <div className="flex items-center space-x-1" title={`${task.comments.length} comments`}>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{task.comments.length}</span>
              </div>
            )}
            {task.attachments?.length > 0 && (
              <div className="flex items-center space-x-1" title={`${task.attachments.length} attachments`}>
                <Paperclip className="w-3.5 h-3.5" />
                <span>{task.attachments.length}</span>
              </div>
            )}
          </div>
          <Avatar className="h-6 w-6" title={`Assigned to: ${task.assigneeName || 'Unassigned'}`}>
             {/* Add AvatarImage if you store profile picture URLs */}
             {/* <AvatarImage src={task.assigneeAvatarUrl} alt={task.assigneeName} /> */}
             <AvatarFallback className="text-xs bg-muted">
                {task.assigneeId ? getInitials(task.assigneeName) : <User className="w-3 h-3" />}
             </AvatarFallback>
           </Avatar>
        </CardFooter>
      </Card>
    </div>
  );
};

export default KanbanCard;
