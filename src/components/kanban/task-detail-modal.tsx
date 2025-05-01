
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Assuming Textarea component exists
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Paperclip, Send, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import type { Task, Priority, Comment, Attachment, UserRole, AppUser } from '@/lib/types'; // Import AppUser
import { useFirebase } from '@/components/providers/firebase-provider';
import { doc, updateDoc, Timestamp, arrayUnion, arrayRemove, collection, getDocs, query, deleteDoc } from 'firebase/firestore'; // Added deleteDoc
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'; // Firebase Storage
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog" // Import AlertDialog components

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onTaskUpdate: () => void; // Callback after successful update
}

// Define which fields are editable by whom
const editableFieldsByRole: Record<UserRole, (keyof Task)[]> = {
  employee: ['columnId', 'comments', 'attachments'], // Employees can only add comments/attachments via dedicated inputs and change status via DnD
  manager: ['name', 'dueDate', 'priority', 'assigneeId', 'comments', 'attachments', 'columnId'], // Managers can edit most fields
  owner: ['name', 'dueDate', 'priority', 'assigneeId', 'comments', 'attachments', 'columnId'], // Owners have same edit rights as managers for tasks
};

// Interface for user data used in the dropdown
interface AssigneeOption extends Pick<AppUser, 'uid' | 'displayName' | 'email'> {
    // Combines required fields for the dropdown
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
  const [isDeleting, setIsDeleting] = useState(false); // State for delete operation
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]); // State for assignee dropdown

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
          const usersList = querySnapshot.docs.map(doc => ({ ...doc.data() } as AppUser ));
          // Map to uid and displayName/email for the dropdown
          const options: AssigneeOption[] = usersList.map(u => ({
              uid: u.uid,
              displayName: u.displayName || u.email, // Fallback to email if displayName is missing
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


  // Reset editedTask when task prop changes (modal opens for a different task)
  useEffect(() => {
    setEditedTask({}); // Clear edits when task changes
    setComments(task.comments || []); // Reset comments
    setAttachments(task.attachments || []); // Reset attachments
    setNewComment(''); // Clear comment input
    setIsSaving(false); // Reset saving state
    setIsUploading(false); // Reset uploading state
    setIsDeleting(false); // Reset deleting state
  }, [task, isOpen]); // Add isOpen to ensure reset on modal re-open

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
       // Return true only for fields they can interact with via specific UI elements (comments/attachments)
       return ['comments', 'attachments'].includes(fieldName);
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
      // Set dueDate to null if date is cleared
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
        attachments: arrayRemove(attachments.find(att => att.id === attachmentToDelete.id)), // Ensure removing the exact object reference if needed
        updatedAt: Timestamp.now()
      });

      setAttachments(prev => prev.filter(att => att.id !== attachmentToDelete.id)); // Update local state
      toast({ title: "Attachment Deleted", description: `${attachmentToDelete.fileName} removed.` });

    } catch (error) {
      console.error("Error deleting attachment:", error);
       // Check if the error is because the object doesn't exist (already deleted?)
       if ((error as any).code === 'storage/object-not-found') {
            toast({ title: "Info", description: "Attachment already removed from storage.", variant: "default" });
            // Still attempt to remove from Firestore if it wasn't already
             try {
                const taskRef = doc(db, 'tasks', task.id);
                await updateDoc(taskRef, {
                   attachments: arrayRemove(attachments.find(att => att.id === attachmentToDelete.id)),
                   updatedAt: Timestamp.now()
                });
                setAttachments(prev => prev.filter(att => att.id !== attachmentToDelete.id));
             } catch (firestoreError) {
                console.error("Error removing attachment from Firestore after storage error:", firestoreError);
                toast({ title: "Deletion Error", description: "Failed to update task details after storage issue.", variant: "destructive" });
             }
       } else {
         toast({ title: "Deletion Error", description: "Failed to delete attachment.", variant: "destructive" });
       }
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
    if (!db || !user) {
        toast({ title: "Error", description: "Cannot save changes. Authentication or database connection issue.", variant: "destructive" });
        return;
    };

    setIsSaving(true);
    const taskRef = doc(db, 'tasks', task.id);
    const projectRef = doc(db, 'projects', task.projectId); // Reference to the project

    // Detect if assignee changed
    const originalAssigneeId = task.assigneeId;
    const newAssigneeId = editedTask.assigneeId ?? null; // Use null for unassigned
    const assigneeChanged = editedTask.hasOwnProperty('assigneeId') && newAssigneeId !== originalAssigneeId;

    // Prepare update data for the task
    const updateData: Partial<Task> = {};
    for (const key in editedTask) {
        const fieldName = key as keyof Task;
        if (isEditable(fieldName)) {
            if (fieldName === 'assigneeId') {
                const selectedAssignee = assigneeOptions.find(opt => opt.uid === newAssigneeId);
                updateData.assigneeId = newAssigneeId;
                updateData.assigneeName = selectedAssignee?.displayName ?? '';
            } else {
               (updateData as any)[fieldName] = (editedTask as any)[fieldName];
            }
        }
    }

    // Add updatedAt timestamp if there are changes
     if (Object.keys(updateData).length > 0 || assigneeChanged) {
        updateData.updatedAt = Timestamp.now();
     } else {
         setIsSaving(false);
         onClose(); // No changes, just close
         return;
     }

    try {
      // 1. Update the task document
      await updateDoc(taskRef, updateData);

      // 2. If assignee changed and there's a new assignee, update the project's assignedUsers
      // Note: Removing the old assignee from the array is more complex as it requires checking
      // if they have other tasks in the project. For simplicity, we only add here.
      // A background function could periodically clean up this array.
      if (assigneeChanged && newAssigneeId) {
        await updateDoc(projectRef, {
          assignedUsers: arrayUnion(newAssigneeId)
        });
      }

      onTaskUpdate(); // Notify parent component (e.g., for toast)
      onClose(); // Close modal
    } catch (error) {
      console.error("Error updating task or project:", error);
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


   const handleDeleteTask = async () => {
    if (!db || !task || !user || (userRole !== 'manager' && userRole !== 'owner')) {
      toast({ title: "Permission Denied", description: "You do not have permission to delete this task.", variant: "destructive" });
      return;
    }

    setIsDeleting(true);
    const taskRef = doc(db, 'tasks', task.id);

    // TODO: Delete associated storage attachments if necessary
    // This requires listing files in the storage folder and deleting them individually.
    // const attachmentsFolderRef = ref(storage, `attachments/${task.projectId}/${task.id}`);
    // Consider implementing this if orphaned files are a concern.

    try {
      // First delete attachments from storage
      for (const attachment of attachments) {
        try {
          const attachmentRef = ref(storage, attachment.id);
          await deleteObject(attachmentRef);
          console.log(`Deleted attachment from storage: ${attachment.fileName}`);
        } catch (storageError) {
          // Log error but continue trying to delete the task doc
          console.error(`Error deleting attachment ${attachment.fileName} from storage:`, storageError);
          // Optionally notify user that specific attachment deletion failed
          // toast({ title: "Attachment Deletion Warning", description: `Could not delete file ${attachment.fileName} from storage.`, variant: "default" });
        }
      }

      // Then delete the Firestore document
      await deleteDoc(taskRef);

      // TODO: Consider removing user from project's assignedUsers if this was their last task.
      // This is complex and might be better handled by a periodic cleanup function.

      toast({ title: "Task Deleted", description: `Task "${task.name}" and its attachments were successfully deleted.` });
      onClose(); // Close the modal after deletion
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "Failed to delete task.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };


  // Determine the current value for a field, prioritizing edited value
   const getCurrentValue = (fieldName: keyof Task) => {
    // Use nullish coalescing for cleaner fallback
    return editedTask[fieldName] ?? task[fieldName];
  };

   const currentDueDate = getCurrentValue('dueDate');
   const displayDueDate = currentDueDate instanceof Timestamp ? currentDueDate.toDate() : null;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Removed DialogTitle from here as requested for accessibility fix in dialog.tsx */}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
           {/* Input or Span for Title */}
           {isEditable('name') ? (
             <DialogTitle>
               <Input
                 name="name"
                 value={(getCurrentValue('name') as string) || ''}
                 onChange={handleInputChange}
                 className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0" // Style to look like text
                 placeholder="Task Name"
                 disabled={!isEditable('name') || isSaving || isDeleting}
               />
             </DialogTitle>
           ) : (
             <DialogTitle>
                <span className="text-lg font-semibold">{task.name}</span>
             </DialogTitle>
           )}
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
                    value={(getCurrentValue('assigneeId') as string) || 'unassigned'} // Default to 'unassigned' if null/undefined
                    onValueChange={(value) => handleSelectChange('assigneeId', value === 'unassigned' ? null : value)}
                    disabled={!isEditable('assigneeId') || isSaving || isDeleting}
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
                    <span className="text-sm">{getCurrentValue('assigneeName') || 'Unassigned'}</span>
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
                  disabled={!isEditable('priority') || isSaving || isDeleting}
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
                     {getCurrentValue('priority')}
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
                    disabled={!isEditable('dueDate') || isSaving || isDeleting}
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
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAttachment(att)} disabled={isSaving || isUploading || isDeleting}>
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
                     disabled={isUploading || isSaving || isDeleting}
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
              {comments.slice().sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map((comment) => ( // Sort by date descending
                <div key={comment.id} className="text-sm border-b pb-1 last:border-b-0">
                  <p className="font-medium">{comment.userName}</p>
                  <p className="text-muted-foreground text-xs">{comment.createdAt.toDate().toLocaleString()}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{comment.text}</p>
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
                     disabled={isSaving || isUploading || isDeleting}
                     className="flex-grow"
                   />
                   <Button onClick={handleAddComment} disabled={!newComment.trim() || isSaving || isUploading || isDeleting} size="icon">
                     <Send className="w-4 h-4" />
                   </Button>
                 </div>
             )}
          </div>
        </div>

        {/* Footer with Actions */}
        <DialogFooter className="pt-4 border-t flex justify-between">
          {/* Left side: Delete button (Managers/Owners only) */}
          <div>
            {(userRole === 'manager' || userRole === 'owner') && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                   <Button variant="destructive" disabled={isSaving || isUploading || isDeleting}>
                     <Trash2 className="w-4 h-4 mr-2" />
                     Delete Task
                   </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the task
                      "{task.name}" and all associated attachments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                       onClick={handleDeleteTask}
                       disabled={isDeleting}
                       className={cn(buttonVariants({ variant: "destructive" }))} // Ensure destructive style
                     >
                      {isDeleting ? 'Deleting...' : 'Delete Task'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Right side: Cancel and Save buttons */}
          <div className="flex space-x-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving || isUploading || isDeleting}>Cancel</Button>
            </DialogClose>
            {/* Only show Save Changes if user can edit *something* other than comments/attachments */}
             {(userRole === 'manager' || userRole === 'owner') && (
              <Button onClick={handleSaveChanges} disabled={isSaving || isUploading || isDeleting || !Object.keys(editedTask).some(key => isEditable(key as keyof Task))}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
             )}
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailModal;
