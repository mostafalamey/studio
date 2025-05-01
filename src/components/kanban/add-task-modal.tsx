
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import type { Priority, AppUser } from '@/lib/types';
import { useFirebase } from '@/components/providers/firebase-provider';
import { collection, addDoc, Timestamp, getDocs, query, doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'; // Added doc, setDoc, updateDoc, arrayUnion
import { useToast } from '@/hooks/use-toast';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onTaskAdd: (newTaskName: string) => void; // Callback after successful addition
}

interface AssigneeOption extends Pick<AppUser, 'uid' | 'displayName' | 'email'> {}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, projectId, onTaskAdd }) => {
  const { db, user, userRole } = useFirebase();
  const { toast } = useToast();
  const [taskName, setTaskName] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [priority, setPriority] = useState<Priority>('Medium');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch potential assignees (users) when the modal opens
  useEffect(() => {
    if (isOpen && db && (userRole === 'manager' || userRole === 'owner')) {
      const fetchUsers = async () => {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef); // Fetch all users for now
          const querySnapshot = await getDocs(q);
          const usersList = querySnapshot.docs.map(doc => ({ ...doc.data() } as AppUser));
          const options: AssigneeOption[] = usersList.map(u => ({
            uid: u.uid,
            displayName: u.displayName || u.email,
            email: u.email
          }));
          setAssigneeOptions(options);
        } catch (error) {
          console.error("Error fetching users:", error);
          toast({ title: "Error", description: "Could not load assignees.", variant: "destructive" });
        }
      };
      fetchUsers();
    }
  }, [isOpen, db, userRole, toast]);

  // Reset form when modal closes or projectId changes
  useEffect(() => {
    if (!isOpen) {
      setTaskName('');
      setDueDate(null);
      setPriority('Medium');
      setAssigneeId(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleAddTask = async () => {
    if (!db || !user || !taskName.trim() || !projectId) {
        toast({ title: "Missing Information", description: "Please provide a task name and ensure project is selected.", variant: "destructive" });
        return;
    }

    setIsSaving(true);

    const selectedAssignee = assigneeOptions.find(opt => opt.uid === assigneeId);

    try {
      // 1. Create the task document
      const tasksCollection = collection(db, 'tasks');
      const newTaskRef = doc(tasksCollection);
      const newTaskId = newTaskRef.id;

      await setDoc(newTaskRef, {
        id: newTaskId, // Store the generated ID within the document
        projectId: projectId,
        name: taskName.trim(),
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
        priority: priority,
        assigneeId: assigneeId,
        assigneeName: selectedAssignee?.displayName || '', // Store name if assignee selected
        comments: [],
        attachments: [],
        columnId: 'todo', // Default to 'todo' column
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
      });

      // 2. If an assignee exists, update the project's assignedUsers array
      if (assigneeId) {
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, {
          assignedUsers: arrayUnion(assigneeId) // Add the assignee's ID
        });
      }

      onTaskAdd(taskName.trim()); // Notify parent component
      onClose(); // Close modal

    } catch (error) {
      console.error("Error adding task or updating project:", error);
      toast({ title: "Error", description: "Failed to add task.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>Fill in the details for the new task.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="taskName" className="text-right">Task Name</Label>
            <Input
              id="taskName"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="col-span-3"
              disabled={isSaving}
              required
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="assigneeId" className="text-right">Assignee</Label>
             <Select
                value={assigneeId || 'unassigned'}
                onValueChange={(value) => setAssigneeId(value === 'unassigned' ? null : value)}
                disabled={isSaving || assigneeOptions.length === 0}
              >
               <SelectTrigger id="assigneeId" className="col-span-3">
                 <SelectValue placeholder="Select Assignee" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="unassigned">Unassigned</SelectItem>
                 {assigneeOptions.map(option => (
                   <SelectItem key={option.uid} value={option.uid}>
                     {option.displayName || option.email}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority)}
              disabled={isSaving}
            >
              <SelectTrigger id="priority" className="col-span-3">
                <SelectValue placeholder="Select Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dueDate" className="text-right">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                  disabled={isSaving}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate || undefined}
                  onSelect={(date) => setDueDate(date ?? null)} // Allow clearing the date
                  initialFocus
                />
                 <Button variant="ghost" className="w-full mt-1" onClick={() => setDueDate(null)}>Clear Date</Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleAddTask} disabled={!taskName.trim() || isSaving}>
            {isSaving ? 'Adding...' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskModal;
