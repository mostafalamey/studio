import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'employee' | 'manager' | 'owner';

export type Priority = 'Low' | 'Medium' | 'High';

export type ColumnId = 'todo' | 'ongoing' | 'done' | 'blocked';

export interface Project {
  id: string;
  name: string;
  createdAt: Timestamp;
  // Add other project-specific fields if needed
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  dueDate: Timestamp | null; // Storing as Timestamp for easier querying/sorting
  priority: Priority;
  assigneeId: string | null; // Store user ID
  assigneeName?: string; // Optional: Store name for display, denormalized
  comments: Comment[];
  attachments: Attachment[];
  columnId: ColumnId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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


// Initial columns setup
export const initialColumns: Column[] = [
    { id: 'todo', title: 'To-Do' },
    { id: 'ongoing', title: 'Ongoing' },
    { id: 'done', title: 'Done' },
    { id: 'blocked', title: 'Blocked' },
];

// Helper function to format Firebase Timestamp to "L2-5 OCT" format
export function formatDueDate(timestamp: Timestamp | null): string {
  if (!timestamp) return 'No Due Date';

  const date = timestamp.toDate();
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
  // const yearLastTwo = date.getFullYear().toString().slice(-2); // Get last two digits of the year

  // Calculate the "L" value (Level/Week). This is a simple example, adjust logic as needed.
  // This example calculates the week number of the year.
  // const startOfYear = new Date(date.getFullYear(), 0, 1);
  // const diff = date.getTime() - startOfYear.getTime();
  // const oneDay = 1000 * 60 * 60 * 24;
  // const dayOfYear = Math.floor(diff / oneDay);
  // const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  // const level = `L${weekNumber}`;


  // return `${level}-${day} ${month} ${yearLastTwo}`; // Example: L40-5 OCT 23
   return `${day} ${month}`; // Simpler format: 5 OCT
}
