
"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs, Timestamp, CollectionReference, getDoc, Query } from 'firebase/firestore'; // Added getDoc
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
import { PlusCircle, Trash2, Edit, Users, UserPlus, ChevronRight, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Login from '@/components/auth/login';
import ChatInterface from '@/components/chat/chat-interface'; // Import ChatInterface

// Sub-component for displaying and managing teams (Managers/Owners)
const TeamsManager: React.FC<{ users: AppUser[], teams: Team[] | undefined, teamsLoading: boolean, teamsError: Error | undefined, onSelectTeam: (team: Team) => void }> = ({ users, teams, teamsLoading, teamsError, onSelectTeam }) => {
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
        // Use AlertDialogTrigger or manage state to show AlertDialog
        setIsDeletingTeam(true); // Example: managing state
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

        setIsSavingTeam(true);
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
                    <Card key={team.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelectTeam(team)}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle>{team.name}</CardTitle>
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

// Sub-component for managing user roles (Owner only)
const RolesManager: React.FC<{ users: AppUser[], usersLoading: boolean, usersError: Error | undefined }> = ({ users, usersLoading, usersError }) => {
    const { db } = useFirebase();
    const { toast } = useToast();
    const [isSavingRole, setIsSavingRole] = useState<string | null>(null);

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
                                    disabled={isSavingRole === user.uid || user.role === 'owner'}
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

// Sub-component for displaying team members and initiating chat (Managers/Owners)
const TeamMembersList: React.FC<{ team: Team, users: AppUser[], onSelectUser: (user: AppUser) => void, onSelectTeamChat: (team: Team) => void, onBack: () => void }> = ({ team, users, onSelectUser, onSelectTeamChat, onBack }) => {
    const teamMembers = users.filter(user => team.members?.includes(user.uid));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onBack}>&larr; Back to Teams</Button>
                <h2 className="text-2xl font-semibold">{team.name} Members</h2>
            </div>
             <Card className="hover:shadow-md transition-shadow cursor-pointer bg-secondary" onClick={() => onSelectTeamChat(team)}>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Chat with "{team.name}" Team
                        <MessageSquare className="w-5 h-5 text-primary" />
                    </CardTitle>
                </CardHeader>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map(member => (
                    <Card key={member.uid} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelectUser(member)}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {member.displayName || member.email}
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </CardTitle>
                            <CardDescription>{member.role}</CardDescription>
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
const EmployeeTeamView: React.FC<{ currentUser: AppUser, users: AppUser[], teams: Team[] | undefined, onSelectUser: (user: AppUser) => void }> = ({ currentUser, users, teams, onSelectUser }) => {
    const [myTeam, setMyTeam] = useState<Team | null>(null);
    const [teammates, setTeammates] = useState<AppUser[]>([]);

    useEffect(() => {
        // Find the team the current employee belongs to
        const foundTeam = teams?.find(team => team.members?.includes(currentUser.uid));
        setMyTeam(foundTeam || null);

        if (foundTeam) {
            // Filter out the current user to get teammates
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teammates.map(member => (
                    <Card key={member.uid} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelectUser(member)}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {member.displayName || member.email}
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </CardTitle>
                            <CardDescription>{member.role}</CardDescription>
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
        setSelectedChatTarget(null); // Clear chat when selecting team members view
    };

    const handleSelectUser = (userToChat: AppUser) => {
        setSelectedChatTarget({ id: userToChat.uid, type: 'user', name: userToChat.displayName || userToChat.email || 'User' });
        setSelectedTeam(null); // Clear team selection when selecting user chat
    };

     const handleSelectTeamChat = (team: Team) => {
        setSelectedChatTarget({ id: team.id, type: 'team', name: `${team.name} (Team Chat)` });
        // Keep selectedTeam potentially, or clear it based on desired flow
         setSelectedTeam(null); // Let's clear team member view when starting team chat
     };

    const handleBackToTeams = () => {
        setSelectedTeam(null);
        setSelectedChatTarget(null);
    };

     const handleCloseChat = () => {
        setSelectedChatTarget(null);
        // Decide where to navigate back to. Maybe back to team list/members?
        // For simplicity, let's just clear the chat for now.
        // If a team was previously selected to view members, we might want to restore that view.
        // Or simply go back to the main team management/list view.
        // handleBackToTeams(); // Option: Go back to default view
     };

    if (authLoading || usersLoading || teamsLoading) { // Check all loading states
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

     // Handle potential errors after loading
     if (usersError) return <p className="text-destructive p-6">Error loading users: {usersError.message}</p>;
     // teamsError is handled within TeamsManager component

    // Determine current user details
     const currentUserDetails = users?.find(u => u.uid === user.uid);


    // Main content layout: Sidebar/List on left, Chat on right
     return (
        <div className="flex h-[calc(100vh-4rem)]"> {/* Adjust height based on header */}

            {/* Left Panel: Team/User List or Role Management */}
            <div className={`p-4 md:p-6 space-y-8 overflow-y-auto ${selectedChatTarget ? 'hidden md:block md:w-1/3 lg:w-1/4 xl:w-1/5 border-r' : 'w-full'}`}>
                <h1 className="text-3xl font-bold">Team</h1>

                {/* Employee View */}
                {userRole === 'employee' && currentUserDetails && users && (
                    <EmployeeTeamView
                        currentUser={currentUserDetails}
                        users={users}
                        teams={teams}
                        onSelectUser={handleSelectUser}
                    />
                )}

                 {/* Manager/Owner View */}
                 {(userRole === 'manager' || userRole === 'owner') && users && (
                     <>
                         {!selectedTeam ? (
                            <TeamsManager
                                users={users}
                                teams={teams}
                                teamsLoading={teamsLoading}
                                teamsError={teamsError}
                                onSelectTeam={handleSelectTeam}
                            />
                         ) : (
                             <TeamMembersList
                                team={selectedTeam}
                                users={users}
                                onSelectUser={handleSelectUser}
                                onSelectTeamChat={handleSelectTeamChat}
                                onBack={handleBackToTeams}
                            />
                         )}

                         {/* Role Management (Owners Only) - Show below team management */}
                         {userRole === 'owner' && !selectedTeam && ( // Show only in main team view
                             <div className="mt-12 pt-8 border-t">
                                 <RolesManager
                                     users={users}
                                     usersLoading={usersLoading}
                                     usersError={usersError}
                                 />
                             </div>
                         )}
                     </>
                 )}
            </div>

            {/* Right Panel: Chat Interface */}
            {selectedChatTarget && (
                <div className="flex-grow"> {/* Chat takes remaining space */}
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
