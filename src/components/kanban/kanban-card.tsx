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

// Priority border classes using CSS variables defined in globals.css
const priorityBorderStyles: Record<Priority, string> = {
    High: "priority-border-high",
    Medium: "priority-border-medium",
    Low: "priority-border-low",
};

// Badge styles based on priority (approximations from image)
const priorityBadgeStyles: Record<Priority, string> = {
  High: 'bg-status-red text-destructive-foreground border-transparent', // Use status-red background
  Medium: 'bg-status-yellow text-foreground border-transparent', // Use status-yellow background
  Low: 'bg-status-green text-foreground border-transparent', // Use status-green background
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


  const getInitials = (name?: string | null) => {
    if (!name || typeof name !== 'string') return '?'; // Add type check
    // Simple initials: first letter of first and last name
     const names = name.trim().split(' ');
     if (names.length === 1) return names[0][0].toUpperCase();
     return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };

  return (
    <div ref={drag} // Attach drag ref here
        onClick={onClick} // Attach onClick handler
        className={cn(
            "cursor-pointer group", // Make it clear it's clickable, add group for hover states
            isDragging ? 'opacity-50' : 'opacity-100'
        )}
        aria-label={`Task: ${task.name}`} // Updated aria-label
     >
      {/* Added border-l-4 for priority color */}
      <Card className={cn(
            "mb-2 shadow-sm hover:shadow-md transition-shadow duration-200 rounded-lg bg-card border-l-4",
            priorityBorderStyles[task.priority] // Apply dynamic border color
        )}>
        <CardHeader className="p-3 pb-1 flex flex-row justify-end items-start"> {/* Removed justify-between, only avatar remains */}
            {/* Assignee Avatar (moved to header) */}
           <Avatar className="h-6 w-6" title={`Assigned to: ${task.assigneeName || 'Unassigned'}`}>
             {/* Add AvatarImage if you store profile picture URLs */}
             {/* <AvatarImage src={task.assigneeAvatarUrl} alt={task.assigneeName} /> */}
             <AvatarFallback className={cn(
                    "text-xs font-semibold",
                    task.assigneeId ? "bg-destructive text-destructive-foreground" : "bg-muted" // Red background like image for assigned
                 )}>
                {task.assigneeId ? getInitials(task.assigneeName) : <User className="w-3 h-3" />}
             </AvatarFallback>
           </Avatar>
        </CardHeader>
        <CardContent className="p-3 pt-0 pb-2 space-y-1">
          {/* Task Name */}
           <p className="text-sm font-medium leading-snug text-card-foreground break-words">{task.name}</p>
            {/* Priority Badge */}
            <Badge variant="secondary" className={cn(
              "text-xs font-medium px-1.5 py-0.5 rounded capitalize",
              priorityBadgeStyles[task.priority]
            )}>
              {task.priority}
            </Badge>
          {/* Date */}
           <div className="flex items-center space-x-1 text-xs text-muted-foreground pt-1">
              <CalendarDays className="w-3 h-3" />
              <span>{formatDueDate(task.dueDate, 'yyyy-MM-dd')}</span> {/* Format date as YYYY-MM-DD */}
           </div>
        </CardContent>
        <CardFooter className="p-3 pt-0 flex justify-start items-center text-xs text-muted-foreground space-x-3">
            {/* Comments and Attachments */}
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
             {/* Show icons even if count is 0, but muted/grayed out */}
             {(!task.comments || task.comments.length === 0) && (
                <div className="flex items-center space-x-1 text-muted-foreground/50" title="0 comments">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>0</span>
                </div>
             )}
              {(!task.attachments || task.attachments.length === 0) && (
                <div className="flex items-center space-x-1 text-muted-foreground/50" title="0 attachments">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>0</span>
                </div>
             )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default KanbanCard;