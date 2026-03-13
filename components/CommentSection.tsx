import React, { useState, useEffect, useRef } from "react";
import { Comment, User, UserRole } from "../types";
import { Send, Trash2, MessageSquare, Shield, Crown, Clock, Bold, Italic, Highlighter, Code, Image as ImageIcon, X } from "lucide-react";

interface CommentSectionProps {
  comments: Comment[];
  currentUser: User | null;
  onAddComment: (text: string, images?: string[]) => void;
  onDeleteComment: (commentId: string) => void;
  onNavigateLogin: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  allUsers?: User[]; // Optional: for getting profile icons
}

function TimeAgo({ timestamp }: { timestamp: number }) {
  const [timeLabel, setTimeLabel] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = Date.now();
      const diff = Math.floor((now - timestamp) / 1000); // seconds

      if (diff < 60) {
        setTimeLabel("Just now");
      } else if (diff < 3600) {
        const mins = Math.floor(diff / 60);
        setTimeLabel(`${mins} min${mins > 1 ? 's' : ''} ago`);
      } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        setTimeLabel(`${hours} hr${hours > 1 ? 's' : ''} ago`);
      } else {
        setTimeLabel(new Date(timestamp).toLocaleDateString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <span className="flex items-center gap-1.5 opacity-70">
      <Clock size={11} />
      {timeLabel}
    </span>
  );
}

function UserAvatar({ username, role, profileIcon, users }: { username: string, role: UserRole, profileIcon?: string, users?: User[] }) {
  const user = users?.find(u => u.username === username);
  const icon = profileIcon || user?.profileIcon;
  const hasIcon = icon && icon.trim() && icon !== 'null';
  const initial = username.charAt(0).toUpperCase();
  
  let bgClass = "bg-gray-700 text-gray-300";
  let borderClass = "border-transparent";
  let badgeIcon = null;

  if (role === 'owner') {
    bgClass = "bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-lg shadow-amber-900/30";
    borderClass = "border-amber-400/50";
    badgeIcon = <Crown size={10} className="absolute -bottom-1 -right-1 text-amber-200 bg-amber-900/80 rounded-full p-0.5 box-content border border-amber-500/50" />;
  } else if (role === 'admin') {
    bgClass = "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30";
    borderClass = "border-blue-400/50";
    badgeIcon = <Shield size={10} className="absolute -bottom-1 -right-1 text-blue-200 bg-blue-900/80 rounded-full p-0.5 box-content border border-blue-500/50" />;
  }

  return (
    <div className={`relative w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 ${borderClass} ${!hasIcon ? bgClass : 'bg-gray-800'} select-none transition-transform group-hover:scale-105 overflow-hidden`}>
      {hasIcon ? (
        <img 
          src={icon} 
          alt={username} 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent) {
              const initialSpan = parent.querySelector('.avatar-initial') as HTMLElement;
              if (initialSpan) initialSpan.style.display = 'flex';
            }
          }}
        />
      ) : null}
      <span className={hasIcon ? 'hidden avatar-initial' : ''}>{initial}</span>
      {badgeIcon}
    </div>
  );
}

function RichTextRenderer({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|==.*?==|`.*?`)/g);
  
  return (
    <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={index} className="italic text-gray-400">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('==') && part.endsWith('==') && part.length > 4) {
          return <mark key={index} className="bg-green-900/40 text-green-400 px-1 rounded border border-green-800/30 font-medium">{part.slice(2, -2)}</mark>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={index} className="bg-black/30 text-red-300 font-mono text-xs px-1.5 py-0.5 rounded border border-red-900/30">{part.slice(1, -1)}</code>;
        }
        return part;
      })}
    </p>
  );
}

export default function CommentSection({ comments, currentUser, onAddComment, onDeleteComment, onNavigateLogin, onNotify, allUsers }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && attachedImages.length === 0) return;
    onAddComment(newComment, attachedImages);
    setNewComment("");
    setAttachedImages([]);
  };

  const insertFormat = (prefix: string, suffix: string) => {
    if (!textAreaRef.current) return;
    const textarea = textAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${prefix}${selected || 'text'}${suffix}${after}`;
    setNewComment(newText);
    
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length + (selected ? 0 : 4));
    }, 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
        onNotify("File too large. Max size is 1MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
            setAttachedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const canDelete = (comment: Comment) => {
    if (!currentUser) return false;
    if (currentUser.role === 'owner' || currentUser.role === 'admin') return true;
    return currentUser.username === comment.author;
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-800/50">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-gray-800/50 p-1.5 rounded-lg">
            <MessageSquare size={16} className="text-gray-400" />
        </div>
        <h4 className="text-sm font-bold text-gray-200">
          Discussion <span className="text-gray-500 font-normal ml-1">({comments.length})</span>
        </h4>
      </div>

      <div className="space-y-5 mb-8">
        {comments.length === 0 ? (
          <div className="text-center py-8 bg-gray-800/20 rounded-xl border border-dashed border-gray-800">
            <p className="text-gray-500 text-sm">No comments yet. Start the conversation!</p>
          </div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-4 group animate-slideUp">
              <div className="flex-shrink-0 pt-1">
                <UserAvatar username={c.author} role={c.role} users={allUsers} />
              </div>
              
              <div className={`flex-1 rounded-2xl rounded-tl-none p-4 border transition-all relative shadow-sm
                ${c.role === 'owner' ? 'bg-gradient-to-br from-amber-950/30 to-[#1a1a1a] border-amber-900/40 shadow-amber-900/10' : 
                  c.role === 'admin' ? 'bg-gradient-to-br from-blue-950/30 to-[#1a1a1a] border-blue-900/40 shadow-blue-900/10' : 
                  'bg-[#1a1a1a] border-gray-800'}`}>
                
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.role === 'owner' && <Crown size={14} className="text-amber-500 fill-amber-500/20" />}
                    {c.role === 'admin' && <Shield size={14} className="text-blue-400 fill-blue-400/20" />}

                    <span className={`text-sm font-bold tracking-tight ${
                      c.role === 'owner' ? 'text-amber-100' : 
                      c.role === 'admin' ? 'text-blue-100' : 
                      'text-gray-200'
                    }`}>
                      {c.author}
                    </span>

                    {c.role === 'owner' && (
                      <span className="text-[10px] uppercase font-extrabold tracking-widest bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                        DEV
                      </span>
                    )}
                    {c.role === 'admin' && (
                      <span className="text-[10px] uppercase font-extrabold tracking-widest bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                        STAFF
                      </span>
                    )}
                    
                    <span className="text-gray-700 text-[10px] mx-1">|</span>
                    
                    <div className="text-[11px] text-gray-500 font-medium">
                      <TimeAgo timestamp={c.timestamp} />
                    </div>
                  </div>

                  {canDelete(c) && (
                    <button 
                      onClick={() => onDeleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded text-gray-500 hover:text-red-400 transition-all"
                      title="Delete Comment"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                
                <RichTextRenderer text={c.text} />

                {c.images && c.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700/30">
                        {c.images.map((img, i) => (
                            <img 
                                key={i} 
                                src={img} 
                                alt="attachment" 
                                className="h-24 w-auto rounded-lg border border-gray-700 cursor-pointer hover:opacity-90 transition-opacity shadow-sm object-cover"
                                onClick={() => window.open(img, '_blank')}
                            />
                        ))}
                    </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {currentUser ? (
        <div className="bg-[#161616] border border-gray-700 rounded-xl overflow-hidden shadow-inner focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500/50 transition-all">
            <div className="flex items-center gap-1 p-2 border-b border-gray-800 bg-[#1a1a1a]">
                <button type="button" onClick={() => insertFormat('**', '**')} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Bold"><Bold size={14} /></button>
                <button type="button" onClick={() => insertFormat('*', '*')} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Italic"><Italic size={14} /></button>
                <button type="button" onClick={() => insertFormat('==', '==')} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Highlight"><Highlighter size={14} /></button>
                <button type="button" onClick={() => insertFormat('`', '`')} className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Code"><Code size={14} /></button>
                <div className="w-px h-4 bg-gray-700 mx-1"></div>
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="p-1.5 rounded text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors" 
                    title="Upload Image"
                >
                    <ImageIcon size={14} />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileSelect}
                />
            </div>

            <form onSubmit={handleSubmit} className="p-2">
                <textarea
                    ref={textAreaRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={`Reply as ${currentUser.username}...`}
                    rows={2}
                    className="w-full bg-transparent text-sm text-white placeholder-gray-600 outline-none resize-none p-2"
                />
                
                {attachedImages.length > 0 && (
                    <div className="flex gap-2 mb-2 px-2 flex-wrap">
                        {attachedImages.map((img, i) => (
                            <div key={i} className="relative group">
                                <img src={img} alt="preview" className="h-14 w-14 object-cover rounded-lg border border-gray-600" />
                                <button 
                                    type="button"
                                    onClick={() => removeImage(i)}
                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 hover:scale-100 shadow-md"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <button 
                        type="submit"
                        disabled={!newComment.trim() && attachedImages.length === 0}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-md hover:shadow-lg btn-shine"
                    >
                        Post Comment <Send size={12} />
                    </button>
                </div>
            </form>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-gray-900 to-[#1a1a1a] rounded-xl p-6 text-center border border-gray-800/60">
          <p className="text-sm text-gray-400 mb-3">Join the community to leave a comment.</p>
          <div className="flex justify-center gap-3">
            <button 
                onClick={onNavigateLogin}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg transition-colors border border-gray-700"
            >
                Log In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}