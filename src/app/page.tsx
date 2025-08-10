import ChatInterface from '@/components/chat/chat-interface';
import { Linkedin } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-gradient-to-r from-violet-200 to-pink-200">
      <main className="flex flex-1 flex-col items-center justify-center p-4 overflow-hidden">
        <ChatInterface />
      </main>
      <footer className="w-full p-4 text-center text-gray-700 text-sm">
        <div className="flex items-center justify-center gap-2">
           <span>© 2025 CONNECT Training Solutions (P) Ltd.</span>
            <a 
              href="https://www.linkedin.com/company/connect-training-solutions-private-limited/" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="p-1 bg-[#0077B5] rounded-md hover:bg-[#005E90] transition-colors"
            >
              <Linkedin size={18} className="text-white" />
            </a>
        </div>
      </footer>
    </div>
  );
}
