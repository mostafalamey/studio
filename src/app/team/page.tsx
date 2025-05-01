
"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs, Timestamp, CollectionReference, getDoc, Query } from 'firebase/firestore'; // Added getDoc
import { createUserWithEmailAndPassword, deleteUser as deleteAuthUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'; // Import Auth functions
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { AppUser, UserRole, Team } from '@/lib/types';
import { PlusCircle, Trash2, Edit, Users, UserPlus, ChevronRight, MessageSquare, ArrowLeft } from 'lucide-react'; // Added UserPlus
import { Badge } from '@/components/ui/badge';
import Login from '@/components/auth/login';
import ChatInterface from '@/components/chat/chat-interface'; // Import ChatInterface
import { cn } from '@/lib/utils'; // Import cn

// Sub-component for displaying and managing teams (Managers/Owners)
const TeamsManager: React.FC<{
    users: AppUser[],
    teams: Team[] | undefined,
    teamsLoading: boolean,
    teamsError: Error | undefined,
    onSelectTeam: (team: Team) => void,
    selectedChatTargetId: string | null // Added prop
}> = ({ users, teams, teamsLoading, teamsError, onSelectTeam, selectedChatTargetId }) => {
    const { db, userRole } = useFirebase();
    const { toast } = useToast();
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [isDeletingTeam, setIsDeletingTeam] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null); // Team being edited
    const [newTeamName, setNewTeamName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]); // For add/edit modal
    const [isSavingTeam, setIsSavingTeam] = useState(false);

    // Filter users who can be team members (e.g., employees, maybe managers too?)
    const potentialMembers = users.filter(u => u.role === 'employee' || u.role === 'manager');

    const openAddTeamModal = () => {
        setEditingTeam(null);
        setNewTeamName('');
        setSelectedMembers([]);
        setIsTeamModalOpen(true);
    };

    const openEditTeamModal = (team: Team) => {
        setEditingTeam(team);
        setNewTeamName(team.name);
        setSelectedMembers(team.members || []);
        setIsTeamModalOpen(true);
    };

    const openDeleteConfirmation = (team: Team) => {
        setTeamToDelete(team);
        setIsDeletingTeam(true);
    };

    const closeDeleteConfirmation = () => {
        setTeamToDelete(null);
        setIsDeletingTeam(false);
    };


    const closeTeamModal = () => {
        setIsTeamModalOpen(false);
        setEditingTeam(null);
        setNewTeamName('');
        setSelectedMembers([]);
        setIsSavingTeam(false);
    };

    const handleSaveTeam = async () => {
        if (!db || !newTeamName.trim()) return;

        setIsSavingTeam(true);
        const teamData: Omit<Team, 'id'> = {
            name: newTeamName.trim(),
            members: selectedMembers,
            createdAt: editingTeam ? editingTeam.createdAt : Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        try {
            if (editingTeam) {
                const teamRef = doc(db, 'teams', editingTeam.id);
                await updateDoc(teamRef, teamData);
                toast({ title: "Team Updated", description: `Team "${teamData.name}" updated successfully.` });
            } else {
                const teamRef = doc(collection(db, 'teams'));
                await setDoc(teamRef, { ...teamData, id: teamRef.id }); // Ensure ID is saved
                toast({ title: "Team Created", description: `Team "${teamData.name}" created successfully.` });
            }
            closeTeamModal();
        } catch (error) {
            console.error("Error saving team:", error);
            toast({ title: "Error", description: "Failed to save team.", variant: "destructive" });
        } finally {
            setIsSavingTeam(false);
        }
    };

    const handleDeleteTeam = async () => {
        if (!db || !teamToDelete) return;

        setIsSavingTeam(true); // Use isSavingTeam to disable buttons during delete
        const teamRef = doc(db, 'teams', teamToDelete.id);

        try {
            await deleteDoc(teamRef);
            toast({ title: "Team Deleted", description: `Team "${teamToDelete.name}" deleted.` });
            closeDeleteConfirmation();
        } catch (error) {
            console.error("Error deleting team:", error);
            toast({ title: "Error", description: "Failed to delete team.", variant: "destructive" });
        } finally {
            setIsSavingTeam(false);
        }
    };

    if (teamsLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={`team-skel-${i}`} className="h-40 rounded-lg" />)}
            </div>
        );
    }

    if (teamsError) {
        return <p className="text-destructive">Error loading teams: {teamsError.message}</p>;
    }

    const getUserName = (uid: string): string => {
        const user = users.find(u => u.uid === uid);
        return user?.displayName || user?.email || 'Unknown User';
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Manage Teams</h2>
                <Button onClick={openAddTeamModal}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Create Team
                </Button>
            </div>

            {(!teams || teams.length === 0) && !teamsLoading && (
                <p className="text-muted-foreground italic">No teams created yet.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams?.map(team => (
                     <Card
                        key={team.id}
                        className={cn(
                            "hover:shadow-md transition-shadow cursor-pointer bg-border",
                            selectedChatTargetId === team.id && "ring-2 ring-primary" // Highlight if this team chat is active
                        )}
                        onClick={() => onSelectTeam(team)}
                     >
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="truncate">{team.name}</CardTitle> {/* Added truncate */}
                                <div className="flex space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditTeamModal(team); }}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); openDeleteConfirmation(team); }}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <h4 className="text-sm font-medium mb-2">Members ({team.members?.length || 0}):</h4>
                             {team.members && team.members.length > 0 ? (
                                <ul className="space-y-1 max-h-20 overflow-y-auto">
                                    {team.members.map(memberId => (
                                        <li key={memberId} className="text-sm text-muted-foreground flex items-center">
                                            <Users className="w-4 h-4 mr-2 flex-shrink-0" /> {/* Adjusted icon size */}
                                            <span className="truncate">{getUserName(memberId)}</span> {/* Added truncate */}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No members assigned.</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Add/Edit Team Modal */}
            <Dialog open={isTeamModalOpen} onOpenChange={closeTeamModal}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle>{editingTeam ? 'Edit Team' : 'Create New Team'}</DialogTitle>
                         <DialogDescription>
                             {editingTeam ? 'Modify the team name and members.' : 'Set a name and select members for the new team.'}
                         </DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 py-4">
                         <div className="space-y-2">
                             <Label htmlFor="team-name">Team Name</Label>
                             <Input
                                 id="team-name"
                                 value={newTeamName}
                                 onChange={(e) => setNewTeamName(e.target.value)}
                                 placeholder="e.g., Marketing Team"
                                 disabled={isSavingTeam}
                             />
                         </div>
                         <div className="space-y-2">
                             <Label>Members</Label>
                             <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                                 {potentialMembers.length > 0 ? (
                                     potentialMembers.map(member => (
                                         <div key={member.uid} className="flex items-center space-x-2">
                                             <input
                                                 type="checkbox"
                                                 id={`member-${member.uid}`}
                                                 checked={selectedMembers.includes(member.uid)}
                                                 onChange={(e) => {
                                                     const checked = e.target.checked;
                                                     setSelectedMembers(prev =>
                                                         checked ? [...prev, member.uid] : prev.filter(id => id !== member.uid)
                                                     );
                                                 }}
                                                 disabled={isSavingTeam}
                                                 className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                                             />
                                             <Label htmlFor={`member-${member.uid}`} className="text-sm font-normal cursor-pointer">
                                                 {member.displayName || member.email} <span className="text-xs text-muted-foreground">({member.role})</span>
                                             </Label>
                                         </div>
                                     ))
                                 ) : (
                                     <p className="text-sm text-muted-foreground italic">No eligible users available to add.</p>
                                 )}
                             </div>
                         </div>
                     </div>
                     <DialogFooter>
                         <Button variant="outline" onClick={closeTeamModal} disabled={isSavingTeam}>Cancel</Button>
                         <Button onClick={handleSaveTeam} disabled={!newTeamName.trim() || isSavingTeam}>
                             {isSavingTeam ? 'Saving...' : (editingTeam ? 'Save Changes' : 'Create Team')}
                         </Button>
                     </DialogFooter>
                 </DialogContent>
            </Dialog>

            {/* Delete Team Confirmation */}
             <AlertDialog open={isDeletingTeam} onOpenChange={closeDeleteConfirmation}>
                 <AlertDialogContent>
                     <AlertDialogHeader>
                         <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                         <AlertDialogDescription>
                             This action cannot be undone. This will permanently delete the team
                             <span className="font-semibold"> "{teamToDelete?.name}"</span>.
                         </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                         <AlertDialogCancel onClick={closeDeleteConfirmation} disabled={isSavingTeam}>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                             onClick={handleDeleteTeam}
                             disabled={isSavingTeam}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         >
                             {isSavingTeam ? 'Deleting...' : 'Delete Team'}
                         </AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
             </AlertDialog>
        </div>
    );
};

// Renamed component: Manages users (add, delete, roles) - Owner only
const UsersManager: React.FC<{ users: AppUser[], usersLoading: boolean, usersError: Error | undefined }> = ({ users, usersLoading, usersError }) => {
    const { db, auth, user: currentUser } = useFirebase(); // Get current user and auth
    const { toast } = useToast();
    const [isSavingRole, setIsSavingRole] = useState<string | null>(null);
    const [roleToChange, setRoleToChange] = useState<{ user: AppUser; newRole: UserRole } | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserDisplayName, setNewUserDisplayName] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('employee');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [isReauthPromptOpen, setIsReauthPromptOpen] = useState(false); // For re-authentication before deletion
    const [reauthPassword, setReauthPassword] = useState('');
    const [isReauthenticating, setIsReauthenticating] = useState(false);

    const openAddUserModal = () => {
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserDisplayName('');
        setNewUserRole('employee');
        setIsAddUserModalOpen(true);
    };

    const closeAddUserModal = () => {
        setIsAddUserModalOpen(false);
        setIsAddingUser(false); // Reset saving state
    };

    const handleAddUser = async () => {
        if (!auth || !db || !newUserEmail.trim() || !newUserPassword.trim()) {
            toast({ title: "Missing Information", description: "Email and password are required.", variant: "destructive" });
            return;
        }
        if (newUserPassword.length < 6) {
             toast({ title: "Password Too Short", description: "Password must be at least 6 characters.", variant: "destructive" });
             return;
        }

        setIsAddingUser(true);
        try {
            // IMPORTANT: This creates a user in Firebase Authentication only.
            // Handling this securely often involves a backend function to prevent abuse.
            // For this example, we proceed client-side with the understanding of security risks.
            const userCredential = await createUserWithEmailAndPassword(auth, newUserEmail, newUserPassword);
            const newUser = userCredential.user;

            // Add user document to Firestore
            await setDoc(doc(db, "users", newUser.uid), {
                uid: newUser.uid,
                email: newUser.email,
                displayName: newUserDisplayName.trim() || newUser.email,
                role: newUserRole,
                createdAt: Timestamp.now(),
            });

            toast({ title: "User Added", description: `User ${newUser.email} created successfully.` });
            closeAddUserModal();
        } catch (error: any) {
            console.error("Error adding user:", error);
            toast({ title: "Error", description: `Failed to add user: ${error.message}`, variant: "destructive" });
        } finally {
            setIsAddingUser(false);
        }
    };


    const handleRoleSelect = (userToUpdate: AppUser, newRole: UserRole) => {
        if (!currentUser || userToUpdate.uid === currentUser.uid || userToUpdate.role === newRole) return;
        setRoleToChange({ user: userToUpdate, newRole });
        setIsConfirmModalOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setRoleToChange(null);
    };


    const confirmRoleChange = async () => {
        if (!db || !roleToChange) return;
        setIsSavingRole(roleToChange.user.uid);
        setIsConfirmModalOpen(false);
        const userRef = doc(db, 'users', roleToChange.user.uid);
        try {
            await updateDoc(userRef, { role: roleToChange.newRole });
            toast({ title: "Role Updated", description: `${roleToChange.user.displayName || roleToChange.user.email}'s role updated to ${roleToChange.newRole}.` });
        } catch (error) {
            console.error("Error updating role:", error);
            toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
        } finally {
            setIsSavingRole(null);
            setRoleToChange(null);
        }
    };

    const openDeleteUserConfirmation = (user: AppUser) => {
        if (currentUser?.uid === user.uid) {
            toast({title: "Cannot Delete Self", description: "You cannot delete your own account.", variant: "destructive"});
            return;
        }
        setUserToDelete(user);
    };

    const closeDeleteUserConfirmation = () => {
        setUserToDelete(null);
        setIsReauthPromptOpen(false); // Close re-auth prompt as well
        setReauthPassword('');
        setIsDeletingUser(false);
        setIsReauthenticating(false);
    };

     const promptForReauthentication = () => {
        if (!userToDelete) return;
        setIsReauthPromptOpen(true); // Open re-authentication modal
    };


    // Handles the actual deletion after successful re-authentication
    const handleDeleteUser = async () => {
        if (!db || !auth?.currentUser || !userToDelete || isDeletingUser) return;

        setIsDeletingUser(true);

        try {
            // --- Server-side deletion is STRONGLY recommended for production ---
            // This client-side deletion requires re-authentication and is complex.
            // Ideally, trigger a Cloud Function here.

            // 1. Delete Firestore user document (this is safe client-side)
            await deleteDoc(doc(db, 'users', userToDelete.uid));
            console.log(`Firestore document for user ${userToDelete.uid} deleted.`);

            // 2. Attempt to delete Firebase Auth user (Requires recent login / re-auth)
            // This part is tricky and less reliable from the client.
            // Re-authentication step is necessary here for security.
            // We assume re-authentication was successful if this function is called.

            // If Firebase Admin SDK is available (e.g., in Cloud Function), use it:
            // await admin.auth().deleteUser(userToDelete.uid);

            // Client-side (less ideal): This requires `userToDelete` to be the currently
            // logged-in user, which is NOT the case here. Deleting arbitrary users
            // client-side is generally not directly possible for security reasons.
            // This block demonstrates the concept but won't work as intended for deleting *other* users.
            /*
            if (auth.currentUser && auth.currentUser.uid === userToDelete.uid) { // This condition will be false
                await deleteAuthUser(auth.currentUser);
                console.log(`Firebase Auth user ${userToDelete.uid} deleted.`);
            } else {
                console.warn(`Cannot delete Firebase Auth user ${userToDelete.uid} directly from client-side for another user.`);
                 toast({ title: "Partial Deletion", description: `Removed user ${userToDelete.email} from database, but Auth deletion requires server-side function.`, variant: "default", duration: 10000});
                 // Consider triggering a backend function here
            }
            */
           // Simulate triggering backend deletion (replace with actual call)
           console.warn(`Simulating server-side deletion for Auth user ${userToDelete.uid}. Implement a Cloud Function for this.`);
           // Placeholder for a potential Cloud Function call
           // await callCloudFunction('deleteUserAuth', { userId: userToDelete.uid });


            toast({ title: "User Removed", description: `User ${userToDelete.email} has been removed. (Auth deletion simulated)` });
            closeDeleteUserConfirmation(); // Close both modals

        } catch (error: any) {
            console.error("Error deleting user:", error);
            toast({ title: "Error", description: `Failed to delete user: ${error.message}.`, variant: "destructive" });
        } finally {
            setIsDeletingUser(false);
            setIsReauthenticating(false); // Reset reauth state
        }
    };

    // Handle re-authentication attempt
    const handleReauthenticateAndDelete = async () => {
        if (!auth?.currentUser || !reauthPassword || !userToDelete) return;

        setIsReauthenticating(true);
        try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email!, reauthPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            // Re-authentication successful, proceed with deletion
            console.log("Re-authentication successful.");
            await handleDeleteUser(); // Call the actual deletion logic
        } catch (error: any) {
            console.error("Re-authentication failed:", error);
            toast({ title: "Authentication Failed", description: "Incorrect password. User deletion cancelled.", variant: "destructive" });
             // Keep the re-auth modal open for retry? Or close? Decide UX.
             // For now, close the process.
             // closeDeleteUserConfirmation();
             setIsReauthenticating(false); // Allow retry
        }
        // No finally block here, handleDeleteUser has its own
    };


    if (usersLoading) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-9 w-28" />
                </div>
                {[1, 2, 3].map(i => (
                    <div key={`user-skel-${i}`} className="flex justify-between items-center p-4 border rounded-lg">
                        <Skeleton className="h-5 w-2/5" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                ))}
            </div>
        );
    }

    if (usersError) {
        return <p className="text-destructive">Error loading users: {usersError.message}</p>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Manage Users</h2>
                <Button onClick={openAddUserModal}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                </Button>
            </div>
            <Card>
                <CardContent className="pt-6 space-y-4">
                    {users.map(user => {
                         const isCurrentUser = currentUser?.uid === user.uid;
                         return (
                            <div key={user.uid} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg gap-4">
                                {/* User Info */}
                                <div className="flex-grow">
                                    <p className="font-medium">{user.displayName || user.email}</p>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                                {/* Actions: Role Select & Delete Button */}
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                    <Label htmlFor={`role-${user.uid}`} className="text-sm sr-only">Role:</Label> {/* Hide label visually */}
                                    <Select
                                        value={user.role}
                                        onValueChange={(value) => handleRoleSelect(user, value as UserRole)}
                                        disabled={isSavingRole === user.uid || isCurrentUser || isDeletingUser} // Disable during operations or for self
                                    >
                                        <SelectTrigger id={`role-${user.uid}`} className="w-[130px] h-9">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="employee">Employee</SelectItem>
                                            <SelectItem value="manager">Manager</SelectItem>
                                            <SelectItem value="owner">Owner</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {/* Delete User Button */}
                                     {!isCurrentUser && ( // Only show delete for other users
                                         <Button
                                             variant="ghost"
                                             size="icon"
                                             className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                             onClick={() => openDeleteUserConfirmation(user)}
                                             disabled={isDeletingUser || isSavingRole === user.uid} // Disable during operations
                                             title="Delete User"
                                         >
                                             <Trash2 className="w-4 h-4" />
                                         </Button>
                                     )}
                                    {isSavingRole === user.uid && <Badge variant="secondary">Saving...</Badge>}
                                    {isCurrentUser && <Badge variant="outline">You</Badge>}
                                </div>
                            </div>
                        );
                     })}
                </CardContent>
            </Card>

            {/* Add User Modal */}
            <Dialog open={isAddUserModalOpen} onOpenChange={closeAddUserModal}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle>Add New User</DialogTitle>
                         <DialogDescription>
                             Create a new user account. An email and password are required.
                             <br/><span className="text-xs text-destructive">Note: Secure user creation should ideally be handled server-side.</span>
                         </DialogDescription>
                     </DialogHeader>
                     <div className="grid gap-4 py-4">
                         <div className="space-y-2">
                             <Label htmlFor="new-user-email">Email *</Label>
                             <Input
                                 id="new-user-email"
                                 type="email"
                                 value={newUserEmail}
                                 onChange={(e) => setNewUserEmail(e.target.value)}
                                 placeholder="user@example.com"
                                 disabled={isAddingUser}
                                 required
                             />
                         </div>
                         <div className="space-y-2">
                             <Label htmlFor="new-user-password">Password *</Label>
                             <Input
                                 id="new-user-password"
                                 type="password"
                                 value={newUserPassword}
                                 onChange={(e) => setNewUserPassword(e.target.value)}
                                 placeholder="Min 6 characters"
                                 disabled={isAddingUser}
                                 required
                                 minLength={6}
                             />
                         </div>
                         <div className="space-y-2">
                             <Label htmlFor="new-user-displayname">Display Name</Label>
                             <Input
                                 id="new-user-displayname"
                                 value={newUserDisplayName}
                                 onChange={(e) => setNewUserDisplayName(e.target.value)}
                                 placeholder="Optional, uses email if blank"
                                 disabled={isAddingUser}
                             />
                         </div>
                         <div className="space-y-2">
                            <Label htmlFor="new-user-role">Role</Label>
                            <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as UserRole)} disabled={isAddingUser}>
                                <SelectTrigger id="new-user-role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="employee">Employee</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="owner">Owner</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                     </div>
                     <DialogFooter>
                         <Button variant="outline" onClick={closeAddUserModal} disabled={isAddingUser}>Cancel</Button>
                         <Button onClick={handleAddUser} disabled={!newUserEmail.trim() || !newUserPassword.trim() || isAddingUser}>
                             {isAddingUser ? 'Adding...' : 'Add User'}
                         </Button>
                     </DialogFooter>
                 </DialogContent>
            </Dialog>

            {/* Role Change Confirmation Modal */}
             <AlertDialog open={isConfirmModalOpen} onOpenChange={closeConfirmModal}>
                 <AlertDialogContent>
                     <AlertDialogHeader>
                         <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
                         <AlertDialogDescription>
                             Are you sure you want to change
                             <span className="font-semibold"> {roleToChange?.user.displayName || roleToChange?.user.email}'s </span>
                             role from <span className="font-semibold capitalize">{roleToChange?.user.role}</span> to
                             <span className="font-semibold capitalize"> {roleToChange?.newRole}</span>?
                         </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                         <AlertDialogCancel onClick={closeConfirmModal} disabled={isSavingRole !== null}>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                             onClick={confirmRoleChange}
                             disabled={isSavingRole !== null}
                         >
                             {isSavingRole === roleToChange?.user.uid ? 'Confirming...' : 'Confirm'}
                         </AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
             </AlertDialog>

              {/* Delete User Confirmation / Re-authentication Prompt */}
             <AlertDialog open={!!userToDelete} onOpenChange={closeDeleteUserConfirmation}>
                 <AlertDialogContent>
                     <AlertDialogHeader>
                         <AlertDialogTitle>Delete User "{userToDelete?.displayName || userToDelete?.email}"?</AlertDialogTitle>
                         <AlertDialogDescription>
                            This action is irreversible. It will remove the user's data from the database.
                            Deleting the authentication record requires a server-side function or recent admin login.
                            <br/><strong className="text-destructive">You must re-enter your password to confirm deletion.</strong>
                         </AlertDialogDescription>
                     </AlertDialogHeader>
                      {/* Re-authentication input */}
                      <div className="space-y-2 pt-4">
                         <Label htmlFor="reauth-password">Your Password</Label>
                         <Input
                             id="reauth-password"
                             type="password"
                             value={reauthPassword}
                             onChange={(e) => setReauthPassword(e.target.value)}
                             placeholder="Enter your password to confirm"
                             disabled={isReauthenticating || isDeletingUser}
                         />
                         {isReauthenticating && <p className="text-xs text-muted-foreground">Verifying...</p>}
                     </div>
                     <AlertDialogFooter>
                         <AlertDialogCancel onClick={closeDeleteUserConfirmation} disabled={isReauthenticating || isDeletingUser}>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                             onClick={handleReauthenticateAndDelete} // This function now handles re-auth THEN deletion
                             disabled={!reauthPassword || isReauthenticating || isDeletingUser}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         >
                             {isDeletingUser ? 'Deleting...' : (isReauthenticating ? 'Verifying...' : 'Confirm & Delete')}
                         </AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
             </AlertDialog>
        </div>
    );
};


// Sub-component for displaying team members and initiating chat (Managers/Owners)
const TeamMembersList: React.FC<{ team: Team, users: AppUser[], onSelectUser: (user: AppUser) => void, onSelectTeamChat: (team: Team) => void, isChatActive: boolean, selectedChatTargetId: string | null }> = ({ team, users, onSelectUser, onSelectTeamChat, isChatActive, selectedChatTargetId }) => {
    const teamMembers = users.filter(user => team.members?.includes(user.uid));

    return (
        <div className="space-y-6">
             <h2 className="text-2xl font-semibold">{team.name} Members</h2>
             <Card
                 className={cn(
                     "hover:shadow-md transition-shadow cursor-pointer bg-border",
                     selectedChatTargetId === team.id && "ring-2 ring-primary"
                 )}
                 onClick={() => onSelectTeamChat(team)}
             >
                 <CardHeader>
                     <CardTitle className="flex items-center justify-between text-base">
                         Chat with "{team.name}" Team
                         <MessageSquare className="w-5 h-5 text-primary" />
                     </CardTitle>
                 </CardHeader>
             </Card>
            <div className={cn(
                "gap-4",
                isChatActive ? "flex flex-col" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            )}>
                {teamMembers.map(member => (
                    <Card
                        key={member.uid}
                        className={cn(
                            "hover:shadow-md transition-shadow cursor-pointer bg-border",
                             selectedChatTargetId === member.uid && "ring-2 ring-primary"
                        )}
                        onClick={() => onSelectUser(member)}
                    >
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between text-base truncate">
                                {member.displayName || member.email}
                                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            </CardTitle>
                             <CardDescription className="truncate">{member.role}</CardDescription>
                        </CardHeader>
                    </Card>
                ))}
                {teamMembers.length === 0 && (
                    <p className="text-muted-foreground italic col-span-full">This team has no members.</p>
                )}
            </div>
        </div>
    );
};

// Sub-component for employees to see their teammates and initiate chat
const EmployeeTeamView: React.FC<{ currentUser: AppUser, users: AppUser[], teams: Team[] | undefined, onSelectUser: (user: AppUser) => void, isChatActive: boolean, selectedChatTargetId: string | null }> = ({ currentUser, users, teams, onSelectUser, isChatActive, selectedChatTargetId }) => {
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [teammates, setTeammates] = useState<AppUser[]>([]);

    useEffect(() => {
        const foundTeam = teams?.find(team => team.members?.includes(currentUser.uid));
        setMyTeam(foundTeam || null);

        if (foundTeam) {
            const memberDetails = users.filter(user =>
                foundTeam.members?.includes(user.uid) && user.uid !== currentUser.uid
            );
            setTeammates(memberDetails);
        } else {
            setTeammates([]);
        }
    }, [currentUser, teams, users]);

    if (!myTeam) {
        return <p className="text-muted-foreground italic">You are not currently assigned to a team.</p>;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold">My Team: {myTeam.name}</h2>
             <div className={cn(
                 "gap-4",
                 isChatActive ? "flex flex-col" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
             )}>
                {teammates.map(member => (
                    <Card
                        key={member.uid}
                        className={cn(
                             "hover:shadow-md transition-shadow cursor-pointer bg-border",
                             selectedChatTargetId === member.uid && "ring-2 ring-primary"
                        )}
                        onClick={() => onSelectUser(member)}
                     >
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between text-base truncate">
                                {member.displayName || member.email}
                                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            </CardTitle>
                            <CardDescription className="truncate">{member.role}</CardDescription>
                        </CardHeader>
                    </Card>
                ))}
                {teammates.length === 0 && (
                    <p className="text-muted-foreground italic col-span-full">You have no teammates in this team yet.</p>
                )}
            </div>
        </div>
    );
};


// Main Team Page Component
export default function TeamPage() {
    const { db, user, userRole, loading: authLoading } = useFirebase();
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [selectedChatTarget, setSelectedChatTarget] = useState<{ id: string; type: 'user' | 'team'; name: string } | null>(null);

    // Fetch all users
    const usersQuery = db ? query(collection(db, 'users') as CollectionReference<AppUser>, orderBy('displayName')) : null;
    const [users, usersLoading, usersError] = useCollectionData<AppUser>(usersQuery, { idField: 'uid' });

    // Fetch all teams
    const teamsQuery = db ? query(collection(db, 'teams') as CollectionReference<Team>, orderBy('name')) : null;
    const [teams, teamsLoading, teamsError] = useCollectionData<Team>(teamsQuery, { idField: 'id' });

    const handleSelectTeam = (team: Team) => {
        setSelectedTeam(team);
        setSelectedChatTarget(null);
    };

    const handleSelectUser = (userToChat: AppUser) => {
        setSelectedChatTarget({ id: userToChat.uid, type: 'user', name: userToChat.displayName || userToChat.email || 'User' });
    };

     const handleSelectTeamChat = (team: Team) => {
        setSelectedChatTarget({ id: team.id, type: 'team', name: `${team.name} (Team Chat)` });
        setSelectedTeam(team);
     };

    const handleBackToDefaultView = () => {
        setSelectedTeam(null);
        setSelectedChatTarget(null);
    };

     const handleCloseChat = () => {
        setSelectedChatTarget(null);
     };

    if (authLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-8 w-1/2" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-40 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                </div>
            </div>
        );
    }


    if (!user) {
        return <Login />;
    }

     if (usersLoading || teamsLoading) {
         return (
             <div className="p-6 space-y-6">
                 <Skeleton className="h-8 w-1/2" />
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <Skeleton className="h-40 rounded-lg" />
                     <Skeleton className="h-40 rounded-lg" />
                     <Skeleton className="h-40 rounded-lg" />
                 </div>
                 {userRole === 'owner' && (
                      <div className="mt-12 pt-8 border-t space-y-4">
                           <div className="flex justify-between items-center mb-4">
                              <Skeleton className="h-8 w-1/3" />
                              <Skeleton className="h-9 w-28" />
                           </div>
                          {[1, 2].map(i => (
                              <div key={`user-skel-${i}`} className="flex justify-between items-center p-4 border rounded-lg">
                                  <Skeleton className="h-5 w-2/5" />
                                  <div className="flex items-center space-x-2">
                                      <Skeleton className="h-9 w-24" />
                                      <Skeleton className="h-9 w-9" />
                                  </div>
                              </div>
                          ))}
                      </div>
                 )}
             </div>
         );
     }

     if (usersError) return <p className="text-destructive p-6">Error loading users: {usersError.message}</p>;

    const currentUserDetails = users?.find(u => u.uid === user.uid);


     return (
        <div className="flex h-[calc(100vh-4rem)]">

            {/* Left Panel: Navigation/List View */}
            <div className={cn(
                `p-4 md:p-6 space-y-8 overflow-y-auto border-r transition-all duration-300 ease-in-out`,
                selectedChatTarget ? 'w-full md:w-1/3 lg:w-1/4 flex flex-col' : 'w-full'
            )}>
                {(selectedTeam || selectedChatTarget) && (
                     <Button variant="ghost" size="sm" onClick={handleBackToDefaultView} className="mb-4 flex items-center flex-shrink-0"> {/* Prevent shrinking */}
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to {userRole === 'employee' ? 'Team View' : 'Teams List'}
                    </Button>
                )}

                {!selectedTeam && !selectedChatTarget && (
                     <h1 className="text-3xl font-bold mb-6">Team</h1>
                 )}


                {userRole === 'employee' && currentUserDetails && users && !selectedTeam && !selectedChatTarget && (
                    <EmployeeTeamView
                        currentUser={currentUserDetails}
                        users={users}
                        teams={teams}
                        onSelectUser={handleSelectUser}
                        isChatActive={!!selectedChatTarget}
                        selectedChatTargetId={selectedChatTarget?.id || null}
                    />
                )}

                 {(userRole === 'manager' || userRole === 'owner') && users && (
                     <>
                         {!selectedTeam && !selectedChatTarget && (
                             <>
                                 <TeamsManager
                                     users={users}
                                     teams={teams}
                                     teamsLoading={teamsLoading}
                                     teamsError={teamsError}
                                     onSelectTeam={handleSelectTeam}
                                     selectedChatTargetId={selectedChatTarget?.id || null} // Pass selectedChatTargetId
                                 />
                                 {userRole === 'owner' && (
                                      <div className="mt-12 pt-8 border-t">
                                           <UsersManager // Use the renamed component
                                              users={users}
                                              usersLoading={usersLoading}
                                              usersError={usersError}
                                          />
                                      </div>
                                  )}
                             </>
                         )}

                         {selectedTeam && (
                             <TeamMembersList
                                team={selectedTeam}
                                users={users}
                                onSelectUser={handleSelectUser}
                                onSelectTeamChat={handleSelectTeamChat}
                                isChatActive={!!selectedChatTarget}
                                selectedChatTargetId={selectedChatTarget?.id || null}
                             />
                         )}
                     </>
                 )}
            </div>

            {/* Right Panel: Chat Interface */}
            {selectedChatTarget && (
                 <div className="flex-grow">
                      <ChatInterface
                         targetId={selectedChatTarget.id}
                         targetType={selectedChatTarget.type}
                         targetName={selectedChatTarget.name}
                         onClose={handleCloseChat}
                     />
                 </div>
             )}
        </div>
    );
}

