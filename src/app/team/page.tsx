
"use client";

import React, { useState } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs, Timestamp, CollectionReference } from 'firebase/firestore';
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
import { PlusCircle, Trash2, Edit, Users, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Login from '@/components/auth/login'; // Import the Login component

// Sub-component for displaying and managing teams
const TeamsManager: React.FC<{ users: AppUser[], teams: Team[] | undefined, teamsLoading: boolean, teamsError: Error | undefined }> = ({ users, teams, teamsLoading, teamsError }) => {
    const { db, userRole } = useFirebase();
    const { toast } = useToast();
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [isDeletingTeam, setIsDeletingTeam] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null); // Team being edited
    const [newTeamName, setNewTeamName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]); // For add/edit modal
    const [isSavingTeam, setIsSavingTeam] = useState(false);

    // Filter users who can be team members (e.g., employees)
    const potentialMembers = users.filter(u => u.role === 'employee');

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
        setIsDeletingTeam(true); // Use this to open the AlertDialog implicitly via state
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
            createdAt: editingTeam ? editingTeam.createdAt : Timestamp.now(), // Keep original createdAt if editing
            updatedAt: Timestamp.now(),
        };

        try {
            if (editingTeam) {
                // Update existing team
                const teamRef = doc(db, 'teams', editingTeam.id);
                await updateDoc(teamRef, teamData);
                toast({ title: "Team Updated", description: `Team "${teamData.name}" updated successfully.` });
            } else {
                // Add new team
                const teamRef = doc(collection(db, 'teams'));
                await setDoc(teamRef, { ...teamData, id: teamRef.id });
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

        setIsSavingTeam(true); // Reuse saving state for deletion in progress indication
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
                {(userRole === 'manager' || userRole === 'owner') && (
                    <Button onClick={openAddTeamModal}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Create Team
                    </Button>
                )}
            </div>

            {(!teams || teams.length === 0) && !teamsLoading && (
                <p className="text-muted-foreground italic">No teams created yet.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams?.map(team => (
                    <Card key={team.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle>{team.name}</CardTitle>
                                {(userRole === 'manager' || userRole === 'owner') && (
                                    <div className="flex space-x-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTeamModal(team)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => openDeleteConfirmation(team)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <h4 className="text-sm font-medium mb-2">Members:</h4>
                            {team.members && team.members.length > 0 ? (
                                <ul className="space-y-1">
                                    {team.members.map(memberId => (
                                        <li key={memberId} className="text-sm text-muted-foreground flex items-center">
                                            <Users className="w-3 h-3 mr-2 flex-shrink-0" />
                                            {getUserName(memberId)}
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
                                                {member.displayName || member.email}
                                            </Label>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No employees available to add.</p>
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


// Sub-component for managing user roles (Owner only)
const RolesManager: React.FC<{ users: AppUser[], usersLoading: boolean, usersError: Error | undefined }> = ({ users, usersLoading, usersError }) => {
    const { db } = useFirebase();
    const { toast } = useToast();
    const [isSavingRole, setIsSavingRole] = useState<string | null>(null); // Store UID of user being saved

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        if (!db) return;
        setIsSavingRole(userId);
        const userRef = doc(db, 'users', userId);
        try {
            await updateDoc(userRef, { role: newRole });
            toast({ title: "Role Updated", description: `User role updated successfully.` });
        } catch (error) {
            console.error("Error updating role:", error);
            toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
            // Consider refetching or reverting UI change on error if not using real-time updates
        } finally {
            setIsSavingRole(null);
        }
    };

    if (usersLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/3 mb-4" />
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
            <h2 className="text-2xl font-semibold">Manage User Roles</h2>
            <Card>
                <CardContent className="pt-6 space-y-4">
                    {users.map(user => (
                        <div key={user.uid} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg gap-4">
                            <div>
                                <p className="font-medium">{user.displayName || user.email}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor={`role-${user.uid}`} className="text-sm">Role:</Label>
                                <Select
                                    value={user.role}
                                    onValueChange={(value) => handleRoleChange(user.uid, value as UserRole)}
                                    disabled={isSavingRole === user.uid || user.role === 'owner'} // Disable select while saving or if user is owner
                                >
                                    <SelectTrigger id={`role-${user.uid}`} className="w-[150px]">
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="employee">Employee</SelectItem>
                                        <SelectItem value="manager">Manager</SelectItem>
                                        <SelectItem value="owner" disabled>Owner</SelectItem>
                                    </SelectContent>
                                </Select>
                                {isSavingRole === user.uid && <Badge variant="secondary">Saving...</Badge>}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};

// Main Team Page Component
export default function TeamPage() {
    const { db, user, userRole, loading: authLoading } = useFirebase();

    // Fetch all users
    const usersQuery = db ? query(collection(db, 'users') as CollectionReference<AppUser>, orderBy('displayName')) : null;
    const [users, usersLoading, usersError] = useCollectionData<AppUser>(usersQuery, { idField: 'uid' });

    // Fetch all teams
    const teamsQuery = db ? query(collection(db, 'teams') as CollectionReference<Team>, orderBy('name')) : null;
    const [teams, teamsLoading, teamsError] = useCollectionData<Team>(teamsQuery, { idField: 'id' });

    if (authLoading) { // Only check authLoading initially
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-8 w-1/2" />
                <div className="space-y-4">
                    <Skeleton className="h-40 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                </div>
            </div>
        );
    }

    // After authLoading is false, check if the user is authenticated
    if (!user) {
        return <Login />;
    }

    // If user is authenticated, check role for access control
    if (userRole === 'employee') {
        return (
            <div className="p-6 text-center">
                <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
                <p className="text-muted-foreground">You do not have permission to view this page.</p>
            </div>
        );
    }

    // If user is manager or owner, render the content
    return (
        <div className="p-4 md:p-6 space-y-8">
            <h1 className="text-3xl font-bold">Team Management</h1>

            {/* Team Management Section (Managers & Owners) */}
            {(userRole === 'manager' || userRole === 'owner') && users && (
                <TeamsManager
                    users={users}
                    teams={teams}
                    teamsLoading={teamsLoading}
                    teamsError={teamsError}
                />
            )}

            {/* Role Management Section (Owners Only) */}
            {userRole === 'owner' && users && (
                <RolesManager
                    users={users}
                    usersLoading={usersLoading}
                    usersError={usersError}
                />
            )}
        </div>
    );
}
