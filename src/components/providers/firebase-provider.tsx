
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
  loading: boolean; // Represents auth loading state
  userRole: UserRole | null; // Use UserRole type
}

const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  auth: null,
  db: null,
  storage: null, // Initialize storage as null
  functions: null,
  user: null,
  loading: true, // Auth state initially loading
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
      app = null;
      auth = null;
      db = null;
      functions = null;
      storage = null;
    }
  }
} else if (getApps().length > 0) {
  // Ensure instances are grabbed if app already exists (e.g., HMR)
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  storage = getStorage(app);
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isClientChecked, setIsClientChecked] = useState(false); // Track client-side readiness
  const [authLoading, setAuthLoading] = useState(true); // Track auth state loading

  useEffect(() => {
    // This effect runs only on the client
    setIsClientChecked(true);

    // Check if Firebase instances are valid before subscribing
    if (!auth || !db) {
      console.warn("Firebase Auth or Firestore is not available. Authentication and data fetching will not work.");
      setAuthLoading(false); // Auth check is "done" (failed)
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch role only if user is logged in
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef) as DocumentSnapshot<AppUser>;

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserRole(userData?.role || null);
            console.log("User logged in:", currentUser.uid, "Role:", userData?.role);
          } else {
            console.warn(`User document not found in Firestore for UID: ${currentUser.uid}. Assigning default role 'employee'.`);
             // Handle missing user doc - assign default or log error
             // Example: Create user doc if missing (consider security implications)
             // await setDoc(userDocRef, { uid: currentUser.uid, email: currentUser.email, role: 'employee', createdAt: Timestamp.now() });
             setUserRole('employee'); // Assign default role
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null); // Set role to null on error
        } finally {
           setAuthLoading(false); // Auth check complete (success or fail)
        }
      } else {
        // No user logged in
        setUserRole(null);
        console.log("User logged out");
        setAuthLoading(false); // Auth check complete (no user)
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs once on client mount

  const value = {
    app,
    auth,
    db,
    storage,
    functions,
    user,
    loading: authLoading, // Expose authLoading state as 'loading'
    userRole,
  };

  // During SSR and initial client render before useEffect runs, isClientChecked is false.
  // Render null or a consistent placeholder to prevent hydration mismatch.
  if (!isClientChecked) {
    // Return null or a simple, non-interactive placeholder.
    // This MUST be consistent between server and initial client render.
    return null;
    // Example placeholder (ensure it doesn't cause hydration issues itself):
    // return <div className="loading-placeholder">Loading Firebase...</div>;
  }

  // After the client check, if Firebase core instances are still null (initialization failed), show error.
  // This check runs *after* hydration, so it won't cause mismatch if config is correct.
  if (!app || !auth || !db) {
      // Log the config being used for easier debugging
      // console.log('Firebase Config Used:', firebaseConfig);
      return <div>Error: Firebase failed to initialize. Check console and ensure environment variables (NEXT_PUBLIC_FIREBASE_...) are correctly set in .env.local</div>;
  }

  // Once client is checked and Firebase is initialized, provide context and render children.
  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
