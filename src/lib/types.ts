
import type { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns'; // Import date-fns format

export type UserRole = 'employee' | 'manager' | 'owner';

export type Priority = 'Low' | 'Medium' | 'High';

export type ColumnId = 'todo' | 'ongoing' | 'done' | 'blocked';

export interface Project {
  id: string;
  name: string;
  description?: string; // Optional description
  createdAt: Timestamp;
  createdBy: string; // User ID of the creator
  assignedUsers?: string[]; // Array of user IDs who have tasks in this project
}

export interface Task {
  id: string;
  projectId: string;
  name: string; // Renamed from title
  dueDate: Timestamp | null; // Storing as Timestamp for easier querying/sorting
  priority: Priority;
  assigneeId: string | null; // Store user ID
  assigneeName?: string; // Optional: Store name for display, denormalized
  comments: Comment[];
  attachments: Attachment[];
  columnId: ColumnId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // Add creator info if needed
}

export interface Comment {
  id: string;
  userId: string;
  userName: string; // Denormalized for display
  text: string;
  createdAt: Timestamp;
}

export interface Attachment {
  id: string; // Using Firestore document ID or Storage path as ID
  fileName: string;
  url: string; // URL to the file in Firebase Storage
  uploadedAt: Timestamp;
  userId: string; // ID of the user who uploaded
}

export interface Column {
    id: ColumnId;
    title: string;
}

// Interface for user data stored in Firestore ('users' collection)
export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role: UserRole;
  createdAt: Timestamp;
  // Add other user-specific fields if needed
}

// Interface for team data stored in Firestore ('teams' collection)
export interface Team {
    id: string;
    name: string;
    members: string[]; // Array of user IDs (AppUser.uid)
    createdAt: Timestamp;
    updatedAt: Timestamp;
    // Add other team-specific fields if needed, e.g., description, team lead ID
}

// Interface for chat messages stored in Firestore ('chats/{chatId}/messages')
export interface ChatMessage {
    id: string; // Firestore document ID
    senderId: string; // AppUser.uid
    senderName: string; // Denormalized for display
    text: string;
    createdAt: Timestamp;
}


// Initial columns setup
export const initialColumns: Column[] = [
    { id: 'todo', title: 'To-Do' },
    { id: 'ongoing', title: 'Ongoing' },
    { id: 'done', title: 'Done' },
    { id: 'blocked', title: 'Blocked' },
];

// Helper function to format Firebase Timestamp using date-fns
export function formatDueDate(timestamp: Timestamp | null, formatString: string = 'yyyy-MM-dd'): string {
  if (!timestamp) return 'No Due Date';

  try {
    const date = timestamp.toDate();
    return format(date, formatString); // Use date-fns format
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Invalid Date';
  }
}
