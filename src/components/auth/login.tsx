
"use client";

import React, { useState } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { doc, setDoc } from 'firebase/firestore'; // Import Firestore functions


const Login: React.FC = () => {
  const { auth, db } = useFirebase(); // Add db
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState(''); // For sign up
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login Successful", description: "Welcome back!" });
      // No need to redirect, parent component will re-render
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Failed to log in.');
      toast({ title: "Login Failed", description: err.message || 'Please check your credentials.', variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!auth || !db) return; // Ensure db is available
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        toast({ title: "Sign Up Failed", description: "Passwords do not match.", variant: "destructive" });
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // **IMPORTANT:** Add user document to Firestore with default role
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: displayName || user.email, // Use display name or email
          role: 'employee', // Assign a default role (e.g., 'employee')
          createdAt: new Date(),
        });


        // Optionally update Firebase Auth profile display name (client-side update)
        // await updateProfile(user, { displayName: displayName });

        toast({ title: "Sign Up Successful", description: "Welcome! Your account has been created." });
        // No need to redirect, parent component will re-render after auth state change
      } catch (err: any) {
        console.error("Sign up error:", err);
        setError(err.message || 'Failed to sign up.');
        toast({ title: "Sign Up Failed", description: err.message || 'Please try again.', variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };


  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
       <Tabs defaultValue="login" className="w-[400px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
           <TabsContent value="login">
             <Card>
                <CardHeader>
                  <CardTitle>Login</CardTitle>
                  <CardDescription>Access your ACS ProjectFlow account.</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="m@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? 'Logging in...' : 'Login'}
                    </Button>
                  </CardFooter>
                </form>
             </Card>
           </TabsContent>
           <TabsContent value="signup">
              <Card>
                 <CardHeader>
                   <CardTitle>Sign Up</CardTitle>
                   <CardDescription>Create a new ACS ProjectFlow account.</CardDescription>
                 </CardHeader>
                 <form onSubmit={handleSignUp}>
                   <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Display Name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Your Name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                     <div className="space-y-2">
                       <Label htmlFor="signup-email">Email</Label>
                       <Input
                         id="signup-email"
                         type="email"
                         placeholder="m@example.com"
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         required
                         disabled={isLoading}
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="signup-password">Password</Label>
                       <Input
                         id="signup-password"
                         type="password"
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         required
                         minLength={6} // Basic validation
                         disabled={isLoading}
                       />
                     </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                     {error && <p className="text-sm text-destructive">{error}</p>}
                   </CardContent>
                   <CardFooter>
                     <Button type="submit" className="w-full" disabled={isLoading}>
                       {isLoading ? 'Signing up...' : 'Sign Up'}
                     </Button>
                   </CardFooter>
                 </form>
              </Card>
           </TabsContent>
        </Tabs>
    </div>
  );
};

export default Login;
