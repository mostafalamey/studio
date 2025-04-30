"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Assuming Textarea component exists
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Paperclip, Send, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import type { Task, Priority, Comment, Attachment, UserRole } from '@/lib/types';
import { useFirebase } from '@/components/providers/firebase-provider';
import { doc, updateDoc, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore'; // For potential assignee fetching
import { collection, getDocs, query, where } from 'firebase/firestore'; // For fetching users
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; // Firebase Storage

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onTaskUpdate: () => void; // Callback after successful update
}

// Define which fields are editable by whom
const editableFieldsByRole: Record<UserRole, (keyof Task)[]> = {
  employee: ['columnId', 'comments', 'attachments'], // Employees can only add comments/attachments via dedicated inputs
  manager: ['title', 'dueDate', 'priority', 'assigneeId', 'comments', 'attachments', 'columnId'], // Managers can edit most fields
  owner: ['title', 'dueDate', 'priority', 'assigneeId', 'comments', 'attachments', 'columnId'], // Owners have same edit rights as managers for tasks
};

interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
}


const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, task, onTaskUpdate }) => {
  const { db, user, userRole, functions: fbFunctions } = useFirebase(); // Added functions
  const storage = getStorage(); // Initialize storage
  const { toast } = useToast();
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(task.comments || []);
  const [attachments, setAttachments] = useState<Attachment[]>(task.attachments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<AppUser[]>([]); // State for assignee dropdown

   // Fetch potential assignees (users) when the modal opens or user role allows
   useEffect(() => {
    if (isOpen && db && (userRole === 'manager' || userRole === 'owner')) {
      const fetchUsers = async () => {
        try {
          // Fetch users who can be assigned (e.g., employees and managers)
          const usersRef = collection(db, 'users');
          // Example: Fetch all users - refine this based on who can be assigned
          const q = query(usersRef /*, where('role', 'in', ['employee', 'manager']) */ );
          const querySnapshot = await getDocs(q);
          const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser & { id: string }));
          // Map to uid and displayName for the dropdown
          const options = usersList.map(u => ({ uid: u.id, displayName: u.displayName || u.email, email: u.email, role: u.role }));
          setAssigneeOptions(options);
        } catch (error) {
          console.error("Error fetching users:", error);
          toast({ title: "Error", description: "Could not load assignees.", variant: "destructive" });
        }
      };
      fetchUsers();
    }
  }, [isOpen, db, userRole, toast]);


  // Reset editedTask when task prop changes (modal opens for a different task)
  useEffect(() => {
    setEditedTask({}); // Clear edits when task changes
    setComments(task.comments || []); // Reset comments
    setAttachments(task.attachments || []); // Reset attachments
    setNewComment(''); // Clear comment input
  }, [task]);

  const isEditable = (fieldName: keyof Task): boolean => {
    if (!userRole) return false;
    // Managers and Owners can edit fields listed for them
    if (userRole === 'manager' || userRole === 'owner') {
      return editableFieldsByRole[userRole].includes(fieldName);
    }
    // Employees can ONLY edit fields if they are the assignee
    if (userRole === 'employee') {
       // Employee can only change status (columnId implicitly via DnD), add comments/attachments
       // Direct editing of other fields is disabled in the form.
       return false; // Disable direct editing in form for employees
    }
    return false;
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedTask(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Task, value: string | null) => {
    setEditedTask(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setEditedTask(prev => ({ ...prev, dueDate: Timestamp.fromDate(date) }));
    } else {
      setEditedTask(prev => ({ ...prev, dueDate: null }));
    }
  };

   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !db || !user) return;

    const file = e.target.files[0];
    setIsUploading(true);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `attachments/${task.projectId}/${task.id}/${uniqueFileName}`);

    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const newAttachment: Attachment = {
        id: snapshot.ref.fullPath, // Use path as ID for deletion reference
        fileName: file.name,
        url: downloadURL,
        uploadedAt: Timestamp.now(),
        userId: user.uid,
      };

      // Update Firestore document
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        attachments: arrayUnion(newAttachment),
        updatedAt: Timestamp.now()
      });

      setAttachments(prev => [...prev, newAttachment]); // Update local state
      toast({ title: "Attachment Added", description: `${file.name} uploaded successfully.` });

    } catch (error) {
      console.error("Error uploading file:", error);
      toast({ title: "Upload Error", description: "Failed to upload attachment.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      // Reset file input if needed
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentToDelete: Attachment) => {
    if (!db || !user) return;

     // Check permissions: Only uploader or manager/owner can delete
    if (userRole !== 'manager' && userRole !== 'owner' && attachmentToDelete.userId !== user.uid) {
        toast({ title: "Permission Denied", description: "You cannot delete this attachment.", variant: "destructive" });
        return;
    }


    const confirmDelete = window.confirm(`Are you sure you want to delete ${attachmentToDelete.fileName}?`);
    if (!confirmDelete) return;


    const storageRef = ref(storage, attachmentToDelete.id); // Use the stored path/id

    try {
      // Delete from Storage
      await deleteObject(storageRef);

      // Delete from Firestore
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        attachments: arrayRemove(attachmentToDelete),
        updatedAt: Timestamp.now()
      });

      setAttachments(prev => prev.filter(att => att.id !== attachmentToDelete.id)); // Update local state
      toast({ title: "Attachment Deleted", description: `${attachmentToDelete.fileName} removed.` });

    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast({ title: "Deletion Error", description: "Failed to delete attachment.", variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !db || !user) return;

    setIsSaving(true); // Indicate saving comment

    const commentToAdd: Comment = {
      id: doc(collection(db, 'tasks')).id, // Generate a unique ID locally
      userId: user.uid,
      userName: user.displayName || user.email || 'Anonymous', // Use display name or email
      text: newComment.trim(),
      createdAt: Timestamp.now(),
    };

    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        comments: arrayUnion(commentToAdd), // Add comment to the array
        updatedAt: Timestamp.now()
      });

      setComments(prev => [...prev, commentToAdd]); // Optimistically update UI
      setNewComment(''); // Clear input
      toast({ title: "Comment Added" });

    } catch (error) {
      console.error("Error adding comment:", error);
      toast({ title: "Error", description: "Failed to add comment.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


   const handleSaveChanges = async () => {
    if (!db || !user || Object.keys(editedTask).length === 0) {
        // If no changes, just close
        if (Object.keys(editedTask).length === 0) {
            onClose();
            return;
        }
        // If db or user is not available (shouldn't happen if modal is open), show error
        toast({ title: "Error", description: "Cannot save changes. Please try again.", variant: "destructive" });
        return;
    };

    setIsSaving(true);
    const taskRef = doc(db, 'tasks', task.id);

    // Prepare update data, ensuring only allowed fields are included
    const updateData: Partial<Task> = {};
    for (const key in editedTask) {
        const fieldName = key as keyof Task;
        if (isEditable(fieldName)) {
            // Special handling for assigneeId to also update assigneeName
            if (fieldName === 'assigneeId') {
                const selectedAssignee = assigneeOptions.find(opt => opt.uid === editedTask.assigneeId);
                updateData.assigneeId = editedTask.assigneeId ?? null;
                updateData.assigneeName = selectedAssignee?.displayName ?? ''; // Denormalize name
            } else {
               (updateData as any)[fieldName] = (editedTask as any)[fieldName];
            }
        }
    }


    // Add updatedAt timestamp
    updateData.updatedAt = Timestamp.now();

    try {
      await updateDoc(taskRef, updateData);
      onTaskUpdate(); // Notify parent component
      onClose(); // Close modal
      // Toast is handled in the parent via onTaskUpdate callback
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Determine the current value for a field, prioritizing edited value
   const getCurrentValue = (fieldName: keyof Task) => {
    return editedTask[fieldName] !== undefined ? editedTask[fieldName] : task[fieldName];
  };

   const currentDueDate = getCurrentValue('dueDate');
   const displayDueDate = currentDueDate instanceof Timestamp ? currentDueDate.toDate() : null;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditable('title') ? (
              <Input
                name="title"
                value={(getCurrentValue('title') as string) || ''}
                onChange={handleInputChange}
                className="text-lg font-semibold"
                placeholder="Task Title"
                disabled={!isEditable('title') || isSaving}
              />
            ) : (
              <span className="text-lg font-semibold">{task.title}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Manage task details, comments, and attachments.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Main Content */}
        <div className="flex-grow overflow-y-auto pr-2 space-y-4 py-4">
          {/* Assignee and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assigneeId">Assignee</Label>
              {isEditable('assigneeId') && assigneeOptions.length > 0 ? (
                 <Select
                    name="assigneeId"
                    value={(getCurrentValue('assigneeId') as string) || ''}
                    onValueChange={(value) => handleSelectChange('assigneeId', value === 'unassigned' ? null : value)}
                    disabled={!isEditable('assigneeId') || isSaving}
                  >
                   <SelectTrigger id="assigneeId">
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
              ) : (
                <div className="flex items-center p-2 border rounded-md min-h-[40px] bg-muted/50">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm">{task.assigneeName || 'Unassigned'}</span>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
               {isEditable('priority') ? (
                <Select
                  name="priority"
                  value={getCurrentValue('priority') || 'Medium'}
                  onValueChange={(value) => handleSelectChange('priority', value as Priority)}
                  disabled={!isEditable('priority') || isSaving}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                 <div className="p-2 border rounded-md min-h-[40px] bg-muted/50 text-sm">
                     {task.priority}
                 </div>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            {isEditable('dueDate') ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !displayDueDate && "text-muted-foreground"
                    )}
                    disabled={!isEditable('dueDate') || isSaving}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {displayDueDate ? format(displayDueDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={displayDueDate || undefined}
                    onSelect={handleDateChange}
                    initialFocus
                  />
                   <Button variant="ghost" className="w-full mt-1" onClick={() => handleDateChange(undefined)}>Clear Date</Button>
                </PopoverContent>
              </Popover>
            ) : (
                 <div className="flex items-center p-2 border rounded-md min-h-[40px] bg-muted/50">
                     <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                     <span className="text-sm">{displayDueDate ? format(displayDueDate, 'PPP') : 'No Due Date'}</span>
                 </div>
            )}
          </div>

           {/* Attachments Section */}
           <div>
            <Label>Attachments</Label>
            <div className="space-y-2 mt-1">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-sm text-primary hover:underline truncate">
                    <Paperclip className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{att.fileName}</span>
                  </a>
                   { (userRole === 'manager' || userRole === 'owner' || att.userId === user?.uid) && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAttachment(att)} disabled={isSaving || isUploading}>
                           <Trash2 className="w-4 h-4" />
                         </Button>
                      )}
                </div>
              ))}
              {attachments.length === 0 && <p className="text-xs text-muted-foreground italic">No attachments yet.</p>}
            </div>
             {/* File Input - Allow all roles to attach */}
             {(userRole === 'employee' || userRole === 'manager' || userRole === 'owner') && (
                <div className="mt-2">
                   <Input
                     id="attachment-upload"
                     type="file"
                     onChange={handleFileChange}
                     disabled={isUploading || isSaving}
                     className="text-sm"
                   />
                   {isUploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
                 </div>
             )}
          </div>

          {/* Comments Section */}
          <div>
            <Label>Comments</Label>
            <div className="mt-1 max-h-48 overflow-y-auto space-y-2 border rounded-md p-2 bg-muted/30">
              {comments.length === 0 && <p className="text-xs text-muted-foreground italic">No comments yet.</p>}
              {comments.slice().reverse().map((comment) => ( // Show newest first
                <div key={comment.id} className="text-sm border-b pb-1 last:border-b-0">
                  <p className="font-medium">{comment.userName}</p>
                  <p className="text-muted-foreground text-xs">{comment.createdAt.toDate().toLocaleString()}</p>
                  <p className="mt-1">{comment.text}</p>
                </div>
              ))}
            </div>
            {/* Add Comment Input - Allow all roles to comment */}
             {(userRole === 'employee' || userRole === 'manager' || userRole === 'owner') && (
                <div className="mt-2 flex items-start space-x-2">
                   <Textarea
                     placeholder="Add a comment..."
                     value={newComment}
                     onChange={(e) => setNewComment(e.target.value)}
                     rows={2}
                     disabled={isSaving || isUploading}
                     className="flex-grow"
                   />
                   <Button onClick={handleAddComment} disabled={!newComment.trim() || isSaving || isUploading} size="icon">
                     <Send className="w-4 h-4" />
                   </Button>
                 </div>
             )}
          </div>
        </div>

        {/* Footer with Actions */}
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button variant="outline" disabled={isSaving || isUploading}>Cancel</Button>
          </DialogClose>
          {/* Only show Save Changes if user can edit *something* other than comments/attachments */}
           {(userRole === 'manager' || userRole === 'owner') && (
            <Button onClick={handleSaveChanges} disabled={isSaving || isUploading}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailModal;
