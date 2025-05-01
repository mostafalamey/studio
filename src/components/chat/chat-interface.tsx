
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, addDoc, Timestamp, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
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
            return `chats/${targetId}`;
        } else {
            // User-to-user chat
            const chatId = [user.uid, targetId].sort().join('_');
            return `chats/${chatId}`;
        }
    };

    const chatDocPath = getChatDocPath();

    // Ensure the chat document exists (especially for user-to-user)
    useEffect(() => {
        const ensureChatDoc = async () => {
            if (!db || !chatDocPath || targetType !== 'user') return;
            const chatDocRef = doc(db, chatDocPath);
            try {
                const docSnap = await getDoc(chatDocRef);
                if (!docSnap.exists()) {
                    // Create the chat document if it doesn't exist
                    await setDoc(chatDocRef, {
                        participants: [user?.uid, targetId].sort(), // Store participants for potential queries
                        createdAt: serverTimestamp(),
                        lastMessageAt: serverTimestamp(), // Initialize last message timestamp
                        type: 'user'
                    });
                    console.log(`Created chat document: ${chatDocPath}`);
                }
            } catch (error) {
                console.error("Error ensuring chat document exists:", error);
            }
        };
        ensureChatDoc();
    }, [db, chatDocPath, targetType, user?.uid, targetId]);


    const messagesQuery = db && chatDocPath ? query(collection(db, chatDocPath, 'messages'), orderBy('createdAt', 'asc')) : null;
    const [messages, loading, error] = useCollectionData<ChatMessage>(messagesQuery, { idField: 'id' });

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user || !newMessage.trim() || !chatDocPath) return;

        setIsSending(true);
        const messageData: Omit<ChatMessage, 'id'> = {
            senderId: user.uid,
            senderName: user.displayName || user.email || 'Anonymous',
            text: newMessage.trim(),
            createdAt: Timestamp.now(), // Use client-side timestamp for immediate display
        };

        try {
            const messagesCollectionRef = collection(db, chatDocPath, 'messages');
            await addDoc(messagesCollectionRef, messageData);

            // Update last message timestamp on the parent chat document
             const chatDocRef = doc(db, chatDocPath);
             await setDoc(chatDocRef, { lastMessageAt: Timestamp.now() }, { merge: true });


            setNewMessage('');
        } catch (err) {
            console.error("Error sending message:", err);
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
        <Card className="flex flex-col h-full border-l rounded-none"> {/* Full height, remove right border */}
            <CardHeader className="flex flex-row items-center justify-between border-b p-4">
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
                    const isSender = msg.senderId === user?.uid;
                    return (
                        <div key={msg.id} className={`flex items-end space-x-2 ${isSender ? 'justify-end' : 'justify-start'}`}>
                             {!isSender && (
                                <Avatar className="h-6 w-6 self-start">
                                     <AvatarFallback className="text-xs bg-muted">{getInitials(msg.senderName)}</AvatarFallback>
                                </Avatar>
                             )}
                            <div className={`max-w-[75%] p-2 px-3 rounded-lg ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                {!isSender && <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>}
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                                <p className={`text-xs mt-1 ${isSender ? 'text-primary-foreground/70' : 'text-muted-foreground/80'} text-right`}>
                                    {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                             {isSender && (
                                <Avatar className="h-6 w-6 self-start">
                                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">{getInitials(user?.displayName || user?.email)}</AvatarFallback>
                                </Avatar>
                             )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} /> {/* For auto-scrolling */}
            </CardContent>
            <CardFooter className="p-4 border-t">
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
