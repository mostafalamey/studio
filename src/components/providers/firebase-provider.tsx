
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, type Firestore, doc, getDoc, DocumentSnapshot } from 'firebase/firestore'; // Import Firestore functions
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage'; // Import getStorage
import type { UserRole, AppUser } from '@/lib/types'; // Import UserRole and AppUser types

// --- IMPORTANT ---
// Ensure you have a .env.local file with your Firebase project credentials.
// These variables must be prefixed with NEXT_PUBLIC_ to be exposed to the browser.
// Example .env.local:
// NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
// NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

interface FirebaseContextValue {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  storage: FirebaseStorage | null; // Add storage
  functions: Functions | null;
  user: User | null;
  loading: boolean;
  userRole: UserRole | null; // Use UserRole type
}

const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  auth: null,
  db: null,
  storage: null, // Initialize storage as null
  functions: null,
  user: null,
  loading: true,
  userRole: null,
});

export const useFirebase = () => useContext(FirebaseContext);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null; // Variable for storage

// Initialize Firebase only once
if (typeof window !== 'undefined' && !getApps().length) {
  // Check if the essential API key is provided
  if (!firebaseConfig.apiKey) {
    console.error(
      'Firebase initialization failed: NEXT_PUBLIC_FIREBASE_API_KEY is missing. ' +
      'Please ensure your environment variables are set up correctly in .env.local'
    );
  } else if (!firebaseConfig.projectId) {
      console.error(
        'Firebase initialization failed: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing. ' +
        'Please ensure your environment variables are set up correctly in .env.local'
      );
  } else {
    try {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      functions = getFunctions(app);
      storage = getStorage(app); // Initialize storage
      console.log("Firebase Initialized");
    } catch (error) {
      console.error("Firebase initialization error:", error);
      // The error might be due to invalid config values (e.g., projectId)
      if (error instanceof Error) {
          if (error.message.includes('Invalid API key')) {
               console.error(
                 'Hint: The "Invalid API key" error often means the NEXT_PUBLIC_FIREBASE_API_KEY in your .env.local file is incorrect or missing.'
               );
          }
          if (error.message.includes('Firebase: Error (auth/invalid-api-key)')) {
              console.error(
                'Hint: The "auth/invalid-api-key" error often means the NEXT_PUBLIC_FIREBASE_API_KEY in your .env.local file is incorrect or missing, or not enabled for your project.'
              );
          }
          if (error.message.includes('projectId')) {
              console.error(
                'Hint: Check if NEXT_PUBLIC_FIREBASE_PROJECT_ID in your .env.local file is correct.'
              );
          }
      }
      // Handle initialization error appropriately
      app = null; // Ensure app is null if initialization fails
      auth = null;
      db = null;
      functions = null;
      storage = null;
    }
  }
} else if (getApps().length > 0) {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  storage = getStorage(app); // Get storage instance if app already exists
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null); // Use UserRole type

  useEffect(() => {
    // If Firebase failed to initialize (e.g., missing API key), auth will be null.
    if (!auth || !db) { // Also check for db
      console.warn("Firebase Auth or Firestore is not available. User authentication and data fetching will not work.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true); // Set loading true while fetching role
        try {
          // Fetch user role from Firestore 'users' collection
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap: DocumentSnapshot<AppUser> = await getDoc(userDocRef) as DocumentSnapshot<AppUser>;

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserRole(userData?.role || null); // Set role from Firestore or null if missing
            console.log("User logged in:", currentUser.uid, "Role:", userData?.role);
          } else {
            // Handle case where user exists in Auth but not in Firestore 'users' collection
            console.warn(`User document not found in Firestore for UID: ${currentUser.uid}. Assigning default role 'employee'.`);
            // Optionally create the document here or assign a default role
             setUserRole('employee'); // Assign default or handle as error
             // Example: Create user doc if missing (consider implications)
             // await setDoc(userDocRef, { uid: currentUser.uid, email: currentUser.email, role: 'employee', createdAt: Timestamp.now() });
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null); // Set role to null on error
        } finally {
             setLoading(false); // Set loading false after fetching role or error
        }
      } else {
        setUserRole(null); // No user logged in
        console.log("User logged out");
        setLoading(false); // Set loading false if no user
      }
      // setLoading(false); // Moved loading(false) inside the if/else blocks
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Dependencies remain empty as auth/db are initialized outside

  const value = {
    app,
    auth,
    db,
    storage, // Provide storage
    functions,
    user,
    loading,
    userRole,
  };

  // Render children only when Firebase is initialized and loading is complete,
  // or if loading is specifically for role fetching after login.
  // This basic check prevents rendering children if Firebase itself failed to init.
  if (!app && loading) {
      return <div>Error: Firebase failed to initialize. Check console and environment variables.</div>; // Or a proper loading/error component
  }

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
