"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Image from "next/image";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { getResponse } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import Markdown from "markdown-to-jsx";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
}

const initialMessage: Message = {
    id: "initial-message",
    role: "bot",
    content: "Hi! I'm Connecto, your career assistant, here to help you with information about company hiring processes, salaries, and roles based on previous years' hiring data. How can I assist you with your placement preparation today?",
};


export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const botResponse = await getResponse({
        message: currentInput,
        history: messages.slice(0, -1), // Pass history without the current user message
      });
      const botMessage: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        content: botResponse,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get response from the bot.",
      });
       const lastUserMessageIndex = newMessages.findLastIndex(m => m.role === 'user');
       if (lastUserMessageIndex !== -1) {
         setMessages(prev => prev.slice(0, lastUserMessageIndex));
       }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl h-full flex flex-col mx-auto md:shadow-xl md:rounded-2xl md:bg-card/80 md:backdrop-blur-sm md:border-white/10 border-0 rounded-none">
      <CardHeader className="border-b md:border-white/10 shrink-0">
        <CardTitle className="flex items-center gap-3 text-xl font-headline">
          <Image src="/logo.png" alt="Connecto Logo" width={32} height={32} className="rounded-md" />
          Connecto
        </CardTitle>
        <Separator className="hidden md:block"/>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full" viewportRef={viewportRef}>
            <div className="p-6 flex flex-col gap-6">
                {messages.map((message) => (
                <div
                    key={message.id}
                    className={cn(
                    "flex items-start gap-3 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300",
                    message.role === "user" ? "justify-end" : "justify-start"
                    )}
                >
                    {message.role === "bot" && (
                    <Avatar className="h-8 w-8 bg-muted text-muted-foreground">
                        <AvatarFallback><Bot size={20} /></AvatarFallback>
                    </Avatar>
                    )}
                    <div
                    className={cn(
                        "p-3 rounded-lg max-w-sm md:max-w-md lg:max-w-lg",
                        message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                    >
                    <div className="prose prose-sm max-w-none text-sm leading-6">
                        <Markdown>{message.content}</Markdown>
                    </div>
                    </div>
                    {message.role === "user" && (
                     <Avatar className="h-8 w-8 bg-accent text-accent-foreground">
                        <AvatarFallback><User size={20} /></AvatarFallback>
                    </Avatar>
                    )}
                </div>
                ))}
                {isLoading && (
                <div className="flex items-start gap-3 justify-start animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300">
                    <Avatar className="h-8 w-8 bg-muted text-muted-foreground">
                        <AvatarFallback><Bot size={20} /></AvatarFallback>
                    </Avatar>
                    <div className="p-3 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                </div>
                )}
            </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t md:border-white/10 shrink-0">
        <form onSubmit={handleSubmit} className="flex w-full items-center gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
              }
            }}
            placeholder="Type your message..."
            className="flex-1 resize-none min-h-[40px] max-h-[120px] bg-input border-0 focus-visible:ring-1 focus-visible:ring-primary ring-offset-0"
            rows={1}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
