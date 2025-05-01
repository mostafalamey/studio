"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, addDoc, Timestamp, serverTimestamp, doc, setDoc, getDoc, CollectionReference, Query } from 'firebase/firestore'; // Added CollectionReference, Query
import type { ChatMessage } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ChatInterfaceProps {
    targetId: string;
    targetType: 'user' | 'team';
    targetName: string;
    onClose: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ targetId, targetType, targetName, onClose }) => {
    const { db, user } = useFirebase();
    const { toast } = useToast();
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const getChatDocPath = () => {
        if (!user) return null;
        if (targetType === 'team') {
            // Team chat path
            return `chats/team_${targetId}`; // Prefix team chats to avoid collision with user chat IDs
        } else {
            // User-to-user chat path (sorted UIDs)
            const chatId = [user.uid, targetId].sort().join('_');
            return `chats/${chatId}`;
        }
    };

    const chatDocPath = getChatDocPath();
    console.log(`[ChatInterface Debug] Chat Doc Path: ${chatDocPath}, Target ID: ${targetId}, Target Type: ${targetType}`); // Log chat path

    // Ensure the chat document exists (especially for user-to-user)
    useEffect(() => {
        const ensureChatDoc = async () => {
             // Only create for user chats, assume team chats are handled elsewhere or don't need pre-creation
            if (!db || !chatDocPath || targetType !== 'user' || !user) return;
            const chatDocRef = doc(db, chatDocPath);
            try {
                const docSnap = await getDoc(chatDocRef);
                if (!docSnap.exists()) {
                    // Create the chat document if it doesn't exist
                    await setDoc(chatDocRef, {
                        participants: [user.uid, targetId].sort(), // Store participants for potential queries
                        createdAt: serverTimestamp(),
                        lastMessageAt: serverTimestamp(), // Initialize last message timestamp
                        type: 'user' // Mark as user chat
                    });
                    console.log(`[ChatInterface Debug] Created chat document: ${chatDocPath}`);
                } else {
                    console.log(`[ChatInterface Debug] Chat document already exists: ${chatDocPath}`);
                }
            } catch (error) {
                console.error("[ChatInterface Debug] Error ensuring chat document exists:", error);
            }
        };
        ensureChatDoc();
    }, [db, chatDocPath, targetType, user?.uid, targetId, user]); // Removed user from dep array as user.uid is used


     // Query for messages - Use three-argument form of collection()
     // Ensure chatDocPath is not null before creating the collection reference
     const messagesCollectionRef = db && chatDocPath ? collection(db, chatDocPath, 'messages') : null;
     const messagesQuery = messagesCollectionRef ? query(messagesCollectionRef, orderBy('createdAt', 'asc')) : null;
     console.log(`[ChatInterface Debug] Messages Query constructed: ${messagesQuery ? 'Yes' : 'No'}`); // Log if query is built


    const [messages, loading, error] = useCollectionData<ChatMessage>(messagesQuery as Query<ChatMessage> | null, { // Explicit type assertion
        snapshotListenOptions: { includeMetadataChanges: true },
        idField: 'id'
    });


    // Debugging logs for messages
    useEffect(() => {
        console.log(`[ChatInterface Debug] Messages Loading: ${loading}`);
        if (error) {
            console.error("[ChatInterface Debug] Messages Error:", error);
        }
        // Log the actual messages array
        console.log("[ChatInterface Debug] Fetched Messages Array:", messages);
    }, [messages, loading, error]);


    useEffect(() => {
        // Scroll to bottom when new messages arrive or loading finishes
        if (!loading) {
            console.log("[ChatInterface Debug] Scrolling to bottom.");
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user || !newMessage.trim() || !chatDocPath) {
             console.warn("[ChatInterface Debug] Send message aborted: Missing db, user, message, or chatDocPath.");
             return;
         }

        setIsSending(true);
        const messageData: Omit<ChatMessage, 'id'> = {
            senderId: user.uid,
            senderName: user.displayName || user.email || 'Anonymous',
            text: newMessage.trim(),
            createdAt: Timestamp.now(), // Use client-side timestamp for immediate display
        };

        try {
            const messagesCollectionRef = collection(db, chatDocPath, 'messages'); // Correct path for subcollection
            await addDoc(messagesCollectionRef, messageData);
            console.log(`[ChatInterface Debug] Message sent to ${chatDocPath}/messages`);


            // Update last message timestamp on the parent chat document
             const chatDocRef = doc(db, chatDocPath);
             // Ensure type is always set/updated along with lastMessageAt
             await setDoc(chatDocRef, { lastMessageAt: Timestamp.now(), type: targetType }, { merge: true });
             console.log(`[ChatInterface Debug] Updated lastMessageAt for ${chatDocPath}`);


            setNewMessage('');
        } catch (err) {
            console.error("[ChatInterface Debug] Error sending message:", err);
            toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };

    const getInitials = (name?: string | null) => {
        if (!name) return '?';
        const names = name.trim().split(' ');
        if (names.length === 1) return names[0][0].toUpperCase();
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      };

    return (
        // Use h-full to take full height of its flex container
        <Card className="flex flex-col h-full border-l rounded-none"> {/* Full height, remove right border */}
            <CardHeader className="flex flex-row items-center justify-between border-b p-4 flex-shrink-0"> {/* Prevent header shrinking */}
                <CardTitle className="text-lg">{targetName}</CardTitle>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="w-5 h-5" />
                    <span className="sr-only">Close Chat</span>
                </Button>
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">
                {loading && (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-3/4" />
                        <Skeleton className="h-10 w-1/2 ml-auto" />
                        <Skeleton className="h-10 w-2/3" />
                    </div>
                )}
                 {error && <p className="text-destructive">Error loading messages: {error.message}</p>}
                {!loading && !error && (!messages || messages.length === 0) && (
                    <p className="text-muted-foreground text-center italic">No messages yet. Start the conversation!</p>
                )}
                {messages?.map((msg) => {
                     // Ensure msg and msg.id are valid before rendering
                    if (!msg || !msg.id) {
                        console.warn("[ChatInterface Debug] ChatMessage missing or has no id:", msg);
                        return null; // Skip rendering this message if id is missing
                    }
                    const isSender = msg.senderId === user?.uid;
                     // Log each message being rendered
                     // console.log(`[ChatInterface Debug] Rendering message ID: ${msg.id}, Sender: ${msg.senderName}, Text: ${msg.text}`);
                    return (
                        // Use msg.id as the key, which should be unique
                        <div key={msg.id} className={`flex items-end space-x-2 ${isSender ? 'justify-end' : 'justify-start'}`}>
                             {!isSender && (
                                <Avatar className="h-6 w-6 self-start flex-shrink-0"> {/* Prevent avatar shrinking */}
                                     <AvatarFallback className="text-xs bg-muted">{getInitials(msg.senderName)}</AvatarFallback>
                                </Avatar>
                             )}
                            <div className={`max-w-[75%] p-2 px-3 rounded-lg ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {!isSender && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                                <p className={`text-xs mt-1 ${isSender ? 'text-primary-foreground/70' : 'text-muted-foreground/80'} text-right`}>
                                     {/* Check if createdAt exists and is a Timestamp before formatting */}
                                     {msg.createdAt && typeof msg.createdAt.toDate === 'function' ?
                                       msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                       'Sending...'} {/* Placeholder if timestamp isn't ready */}
                                </p>
                            </div>
                             {isSender && (
                                <Avatar className="h-6 w-6 self-start flex-shrink-0"> {/* Prevent avatar shrinking */}
                                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">{getInitials(user?.displayName || user?.email)}</AvatarFallback>
                                </Avatar>
                             )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} /> {/* For auto-scrolling */}
            </CardContent>
            <CardFooter className="p-4 border-t flex-shrink-0"> {/* Prevent footer shrinking */}
                <form onSubmit={handleSendMessage} className="flex w-full space-x-2">
                    <Input
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={isSending || loading}
                        className="flex-grow"
                    />
                    <Button type="submit" disabled={!newMessage.trim() || isSending || loading}>
                        <Send className="w-4 h-4" />
                        <span className="sr-only">Send</span>
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
};

export default ChatInterface;
