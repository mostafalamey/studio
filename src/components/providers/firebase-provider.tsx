
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage'; // Import getStorage

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
  userRole: 'employee' | 'manager' | 'owner' | null;
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
      if (error instanceof Error && error.message.includes('Invalid API key')) {
           console.error(
             'Hint: The "Invalid API key" error often means the NEXT_PUBLIC_FIREBASE_API_KEY in your .env.local file is incorrect or missing.'
           );
      }
      // Handle initialization error appropriately
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
  const [userRole, setUserRole] = useState<'employee' | 'manager' | 'owner' | null>(null);

  useEffect(() => {
    // If Firebase failed to initialize (e.g., missing API key), auth will be null.
    if (!auth) {
      console.warn("Firebase Auth is not available. User authentication will not work.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Fetch user role (replace with your actual logic)
          // This is a placeholder. You need to fetch the role from Firestore
          // based on the currentUser.uid and set it using setUserRole.
          // Example: const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          // if (userDoc.exists()) setUserRole(userDoc.data().role);
          setUserRole('manager'); // Placeholder: Set role based on your logic
          console.log("User logged in:", currentUser.uid);
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
        console.log("User logged out");
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Removed 'auth' dependency as it's initialized outside and won't change

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

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
