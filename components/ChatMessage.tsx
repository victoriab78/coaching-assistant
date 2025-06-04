
import React from 'react';
import { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

const UserIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-slate-400">
    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
  </svg>
);

const AgentIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-sky-400">
    <path d="M12 .75a8.25 8.25 0 0 0-8.25 8.25c0 1.963.736 3.782 1.955 5.199A.75.75 0 0 0 6.65 14.5h10.7a.75.75 0 0 0 .945-.352c1.219-1.417 1.955-3.236 1.955-5.199A8.25 8.25 0 0 0 12 .75Z" />
    <path fillRule="evenodd" d="M9.535 16.352c-.837.395-1.656.92-2.38 1.556A.75.75 0 0 0 8.09 19.18c1.007.074 1.98.29 2.906.636a17.17 17.17 0 0 0 2.008.63c.95.266 1.938.403 2.95.403a.75.75 0 0 0 0-1.5c-.839 0-1.652-.111-2.408-.308a15.661 15.661 0 0 1-1.947-.574A16.004 16.004 0 0 1 12 17.25c-.547 0-1.088.05-1.621.148a.75.75 0 0 0-.844.954Z" clipRule="evenodd" />
  </svg>
);


const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-2.5 max-w-[75%]`}>
        {!isUser && (
          <div className="flex-shrink-0 p-2 bg-slate-700 rounded-full">
            <AgentIcon />
          </div>
        )}
        <div
          className={`p-3 rounded-lg shadow-md ${
            isUser ? 'bg-sky-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
          {/* <span className="text-xs text-slate-400 mt-1 block">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span> */}
        </div>
         {isUser && (
          <div className="flex-shrink-0 p-2 bg-slate-700 rounded-full">
            <UserIcon />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
