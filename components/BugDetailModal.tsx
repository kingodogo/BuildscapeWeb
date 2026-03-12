import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BugReport, User } from "../types";
import { X, Calendar, User as UserIcon, Box, Tag, Link as LinkIcon, Youtube, FileCode, Image, CheckCircle, AlertOctagon, Clock, Sparkles, Terminal, Edit, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import CommentSection from "./CommentSection";
import { AuthService } from "../services/auth";
import { analyzeBugReport } from "../services/geminiService";

interface BugDetailModalProps {
  bug: BugReport;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  isAdmin: boolean;
  onToggleStatus: (id: string) => void;
  onUpdateReport?: (report: BugReport) => void;
  onAddComment: (bugId: string, text: string, images?: string[]) => void;
  onDeleteComment: (bugId: string, commentId: string) => void;
  onNavigateLogin: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const LinkPreviewItem = ({ url }: { url: string }) => {
    let hostname = "";
    try {
        hostname = new URL(url).hostname;
    } catch (e) {
        return <LinkIcon size={16} className="text-gray-500" />;
    }

    const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (youtubeMatch && youtubeMatch[1]) {
        return (
            <div className="relative w-12 h-9 flex-shrink-0 overflow-hidden rounded border border-gray-700 bg-black">
                <img 
                    src={`https://img.youtube.com/vi/${youtubeMatch[1]}/default.jpg`} 
                    alt="YouTube" 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-red-600/80 rounded-full p-0.5">
                        <Youtube size={8} className="text-white fill-white" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-black/40 rounded border border-gray-700/50 p-1.5">
            <img 
                src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`} 
                alt="Icon" 
                className="w-full h-full object-contain"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
            />
            <LinkIcon size={14} className="text-gray-500 hidden" />
        </div>
    );
};

export default function BugDetailModal({ 
    bug, isOpen, onClose, currentUser, isAdmin, onToggleStatus, onUpdateReport, onAddComment, onDeleteComment, onNavigateLogin, onNotify 
}: BugDetailModalProps) {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [assignedTo, setAssignedTo] = useState<string>(bug.assignedTo || '');
    const [isEditingAssignment, setIsEditingAssignment] = useState(false);
    const [isRerunningAnalysis, setIsRerunningAnalysis] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            AuthService.getAllUsers().then(setAllUsers).catch(() => {
            });
        }
    }, [isOpen]);
    
    useEffect(() => {
        setAssignedTo(bug.assignedTo || '');
        setIsEditingAssignment(false);
    }, [bug.assignedTo]);
    
    const handleAssignmentChange = async (newAssignment: string) => {
        if (!onUpdateReport) return;
        
        const updatedBug = { ...bug, assignedTo: newAssignment || undefined };
        setAssignedTo(newAssignment);
        setIsEditingAssignment(false);
        onUpdateReport(updatedBug);
        onNotify(newAssignment ? `Assigned to ${newAssignment}` : "Assignment removed", "success");
    };
    
    const handleRerunAnalysis = async () => {
        if (!onUpdateReport || !currentUser) return;
        
        setIsRerunningAnalysis(true);
        try {
            const analysisResult = await analyzeBugReport(
                bug.title,
                bug.description,
                bug.stepsToReproduce || '',
                bug.mcVersions || [],
                bug.expectedBehavior,
                bug.actualBehavior,
                'admin',
                currentUser.username
            );
            
            const updatedBug = {
                ...bug,
                aiAnalysis: analysisResult
            };
            
            onUpdateReport(updatedBug);
            onNotify("Analysis completed successfully", "success");
        } catch (error: any) {
            console.error("Error rerunning analysis:", error);
            onNotify(error.message || "Failed to rerun analysis", "error");
        } finally {
            setIsRerunningAnalysis(false);
        }
    };
    
    const modalContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        
        const scrollY = window.pageYOffset || window.scrollY || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || window.scrollX || document.documentElement.scrollLeft;
        
        (window as any)._modalScrollY = scrollY;
        (window as any)._modalScrollX = scrollX;
        
        const body = document.body;
        const html = document.documentElement;
        
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = `-${scrollX}px`;
        body.style.width = '100%';
        body.style.overflow = 'hidden';
        html.style.overflow = 'hidden';
        
        return () => { 
            const savedScrollY = (window as any)._modalScrollY || 0;
            const savedScrollX = (window as any)._modalScrollX || 0;
            
            body.style.position = '';
            body.style.top = '';
            body.style.left = '';
            body.style.width = '';
            body.style.overflow = '';
            html.style.overflow = '';
            
            requestAnimationFrame(() => {
                window.scrollTo(savedScrollX, savedScrollY);
            });
            
            delete (window as any)._modalScrollY;
            delete (window as any)._modalScrollX;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const modalContent = (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center" 
            style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                overflowY: 'auto',
                overscrollBehavior: 'contain'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div 
                className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            ></div>
            
            <div 
                ref={modalContainerRef}
                className="relative w-full max-w-5xl bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl flex flex-col animate-scaleIn overflow-hidden" 
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    maxHeight: '90vh',
                    position: 'relative',
                    zIndex: 1,
                    margin: 'auto',
                    maxWidth: 'calc(100vw - 2rem)'
                }}
                tabIndex={-1}
            >
                
                <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-800 bg-[#1a1a1a] flex-shrink-0 z-10 min-w-0">
                    <div className="flex-1 pr-4 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-1 rounded border font-mono uppercase tracking-wide
                                ${bug.severity === 'Critical' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 
                                bug.severity === 'High' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                                bug.severity === 'Medium' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 
                                'text-[#00FFFF] border-[#00FFFF]/30 bg-[#00FFFF]/10'}`}>
                                {bug.severity}
                            </span>
                            <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border
                                ${bug.status === 'Resolved' ? 'bg-[#00FFFF]/10 border-[#00FFFF]/30 text-[#00FFFF]' : 
                                bug.status === 'In Progress' ? 'bg-[#00fbff]/10 border-[#00fbff]/30 text-[#00fbff]' : 
                                'bg-gray-800/50 border-gray-700/50 text-gray-300'}`}>
                                {bug.status === 'Resolved' ? <CheckCircle size={12} /> : 
                                bug.status === 'In Progress' ? <Clock size={12} /> : 
                                <AlertOctagon size={12} />}
                                {bug.status}
                            </div>
                            {bug.aiAnalysis && (
                                <span className="bg-purple-900/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                                    <Sparkles size={12} /> Verified
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight break-words word-break break-all">{bug.title}</h2>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 font-mono">
                            <span className="flex items-center gap-1"><UserIcon size={12}/> {bug.author}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(bug.timestamp).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isAdmin && (
                            <button 
                                onClick={() => onToggleStatus(bug.id)}
                                className={`px-4 py-2 rounded-lg border text-xs font-bold shadow-sm whitespace-nowrap transition-colors
                                    ${bug.status === 'Resolved' 
                                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-yellow-500 hover:text-yellow-400' 
                                    : bug.status === 'In Progress'
                                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-[#00FFFF] hover:text-[#00fbff]'
                                    : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-[#00fbff] hover:text-[#00fbff]'}`}
                            >
                                {bug.status === 'Open' ? 'Start Progress' : 
                                bug.status === 'In Progress' ? 'Mark Resolved' : 
                                'Reopen Issue'}
                            </button>
                        )}
                        <button 
                            onClick={onClose}
                            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-[#121212] overscroll-contain min-w-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full min-w-0">
                        <div className="md:col-span-2 space-y-4 md:space-y-6 min-w-0 w-full">
                            
                            <div className="min-w-0">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                    <FileCode size={14} /> Description
                                </h3>
                                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-5 text-gray-300 text-sm whitespace-pre-wrap leading-relaxed shadow-sm overflow-x-auto break-words word-break break-all">
                                    {bug.description}
                                </div>
                            </div>

                            <div className="min-w-0">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                    <Terminal size={14} /> Steps to Reproduce
                                </h3>
                                <div className="bg-black/40 border border-gray-800 rounded-lg p-4 md:p-5 font-mono text-sm text-gray-300 whitespace-pre-wrap shadow-inner relative group overflow-x-auto break-words word-break break-all">
                                    {bug.stepsToReproduce || "No steps provided."}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(bug.expectedBehavior) && (
                                    <div className="min-w-0">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                            <Box size={14} /> Expected Behavior
                                        </h3>
                                        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-gray-300 text-sm shadow-sm break-words word-break break-all whitespace-pre-wrap">
                                            {bug.expectedBehavior}
                                        </div>
                                    </div>
                                )}
                                {(bug.actualBehavior) && (
                                    <div className="min-w-0">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                            <AlertOctagon size={14} /> Actual Behavior
                                        </h3>
                                        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-gray-300 text-sm shadow-sm break-words word-break break-all whitespace-pre-wrap">
                                            {bug.actualBehavior}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {bug.aiAnalysis && (
                                <div className="bg-purple-900/10 border border-purple-900/30 rounded-lg p-4 md:p-5 md:hidden">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-xs font-bold text-purple-400 uppercase flex items-center gap-2">
                                            <Sparkles size={14} /> {bug.aiAnalysis.analyzedBy === 'admin' ? 'Admin Analysed' : 'Automated Analysis'}
                                        </h3>
                                        {isAdmin && onUpdateReport && (
                                            <button
                                                onClick={handleRerunAnalysis}
                                                disabled={isRerunningAnalysis}
                                                className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2 py-1 rounded border border-purple-700/50 hover:border-purple-600 transition-colors disabled:opacity-50"
                                                title="Rerun analysis"
                                            >
                                                <RefreshCw size={12} className={isRerunningAnalysis ? 'animate-spin' : ''} />
                                                {isRerunningAnalysis ? 'Analyzing...' : 'Rerun'}
                                            </button>
                                        )}
                                    </div>
                                    {bug.aiAnalysis.analyzedBy === 'admin' && bug.aiAnalysis.analyzedByUser && (
                                        <p className="text-[10px] text-purple-300/70 mb-2">Analyzed by {bug.aiAnalysis.analyzedByUser}</p>
                                    )}
                                    <p className="text-sm text-gray-300 mb-3 leading-relaxed">{bug.aiAnalysis.summary}</p>
                                    {bug.aiAnalysis.suggestions.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-purple-900/20">
                                            <span className="text-[10px] text-purple-400 uppercase font-bold mb-2 block">Suggestions</span>
                                            <ul className="list-disc list-inside text-xs text-gray-400 space-y-1.5">
                                                {bug.aiAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                            {!bug.aiAnalysis && isAdmin && onUpdateReport && (
                                <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 md:p-5 md:hidden">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-400">No analysis available</p>
                                        <button
                                            onClick={handleRerunAnalysis}
                                            disabled={isRerunningAnalysis}
                                            className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 px-3 py-1.5 rounded border border-purple-700/50 hover:border-purple-600 transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw size={12} className={isRerunningAnalysis ? 'animate-spin' : ''} />
                                            {isRerunningAnalysis ? 'Analyzing...' : 'Run Analysis'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <CommentSection 
                                comments={bug.comments || []}
                                currentUser={currentUser}
                                onAddComment={(text, images) => onAddComment(bug.id, text, images)}
                                onDeleteComment={(commentId) => onDeleteComment(bug.id, commentId)}
                                onNavigateLogin={onNavigateLogin}
                                onNotify={onNotify}
                                allUsers={allUsers}
                            />
                        </div>

                        <div className="flex flex-col space-y-4 md:space-y-6 min-w-0 w-full">
                            
                            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-5 shadow-sm min-w-0">
                                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 md:mb-4 flex items-center gap-2">
                                    <Box size={14} /> Environment
                                </h3>
                                <div className="space-y-3 md:space-y-4">
                                    <div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1.5">Minecraft Version</div>
                                        <div className="flex flex-wrap gap-2">
                                            {bug.mcVersions.map(v => (
                                                <span key={v} className="bg-[#00FFFF]/10 text-[#00FFFF] border border-[#00FFFF]/30 px-2 md:px-2.5 py-1 rounded text-xs font-mono font-medium whitespace-nowrap">{v}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1.5">Mod Version</div>
                                        <div className="flex flex-wrap gap-2">
                                            {bug.versions.map(v => (
                                                <span key={v} className="bg-[#00fbff]/10 text-[#00fbff] border border-[#00fbff]/30 px-2 md:px-2.5 py-1 rounded text-xs font-mono font-medium whitespace-nowrap">v{v}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {bug.tags && bug.tags.length > 0 && (
                                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-5 shadow-sm min-w-0">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 md:mb-4 flex items-center gap-2">
                                        <Tag size={14} /> Keywords
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {bug.tags.map((tag, i) => (
                                            <span key={i} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-gray-700 transition-colors cursor-default break-words">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {bug.links && bug.links.length > 0 && (
                                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-5 shadow-sm min-w-0">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 md:mb-4 flex items-center gap-2">
                                        <LinkIcon size={14} /> Attached Links
                                    </h3>
                                    <div className="space-y-2">
                                        {bug.links.map((link, i) => (
                                            <a 
                                                key={i} 
                                                href={link} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 md:gap-3 text-xs text-blue-400 hover:text-white transition-all bg-black/30 p-2 rounded border border-gray-800/50 hover:border-gray-600 group animate-slideUp min-w-0"
                                                style={{ animationDelay: `${i * 0.1}s` }}
                                            >
                                                <LinkPreviewItem url={link} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="truncate font-medium text-gray-300 group-hover:text-blue-300 transition-colors">
                                                        {new URL(link).hostname}
                                                    </div>
                                                    <div className="truncate text-[10px] text-gray-500 opacity-70">
                                                        {link}
                                                    </div>
                                                </div>
                                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-gray-500 flex-shrink-0" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-5 shadow-sm min-w-0">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                        <UserIcon size={14} /> Assigned Staff
                                    </h3>
                                    {isAdmin && onUpdateReport && (
                                        <button
                                            onClick={() => setIsEditingAssignment(!isEditingAssignment)}
                                            className="text-xs text-[#00fbff] hover:text-[#00FFFF] transition-colors flex-shrink-0"
                                        >
                                            {isEditingAssignment ? 'Cancel' : 'Edit'}
                                        </button>
                                    )}
                                </div>
                                
                                {isEditingAssignment && isAdmin && onUpdateReport ? (
                                    <select
                                        value={assignedTo}
                                        onChange={(e) => handleAssignmentChange(e.target.value)}
                                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-white text-sm focus:ring-2 focus:ring-[#00FFFF]/20 focus:border-[#00FFFF] outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8 min-w-0"
                                    >
                                        <option value="">Unassigned</option>
                                        {allUsers.filter(u => u.role === 'admin' || u.role === 'owner').map(user => (
                                            <option key={user.id} value={user.username}>
                                                {user.username} ({user.role})
                                            </option>
                                        ))}
                                    </select>
                                ) : assignedTo ? (
                                    <div className="bg-[#00FFFF]/5 border border-[#00FFFF]/20 rounded-lg p-3 md:p-4 flex items-center gap-2 md:gap-3 min-w-0">
                                        {(() => {
                                            const assignedUser = allUsers?.find(u => u.username === assignedTo);
                                            const hasIcon = assignedUser?.profileIcon && assignedUser.profileIcon.trim() && assignedUser.profileIcon !== 'null';
                                            return (
                                                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#00FFFF]/20 flex items-center justify-center text-[#00FFFF] font-bold text-xs md:text-sm border border-[#00FFFF]/30 flex-shrink-0 overflow-hidden">
                                                    {hasIcon ? (
                                                        <img 
                                                            src={assignedUser.profileIcon} 
                                                            alt={assignedTo}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const parent = e.currentTarget.parentElement;
                                                                if (parent) {
                                                                    const initial = parent.querySelector('.assigned-initial') as HTMLElement;
                                                                    if (initial) initial.style.display = 'flex';
                                                                }
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span className={`${hasIcon ? 'hidden assigned-initial' : ''}`}>
                                                        {assignedTo.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs md:text-sm text-[#00fbff] font-bold truncate">{assignedTo}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-3 md:p-4 text-center">
                                        <p className="text-xs text-gray-500 italic">No staff assigned yet.</p>
                                    </div>
                                )}
                            </div>

                            {bug.aiAnalysis && (
                                <div className="hidden md:flex md:flex-col bg-purple-900/10 border border-purple-900/30 rounded-lg overflow-hidden flex-1 min-h-0">
                                    <div className="flex items-center justify-between p-4 md:p-5 pb-3 flex-shrink-0 border-b border-purple-900/20">
                                        <h3 className="text-xs font-bold text-purple-400 uppercase flex items-center gap-2">
                                            <Sparkles size={14} /> {bug.aiAnalysis.analyzedBy === 'admin' ? 'Admin Analysed' : 'Automated Analysis'}
                                        </h3>
                                        {isAdmin && onUpdateReport && (
                                            <button
                                                onClick={handleRerunAnalysis}
                                                disabled={isRerunningAnalysis}
                                                className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2 py-1 rounded border border-purple-700/50 hover:border-purple-600 transition-colors disabled:opacity-50"
                                                title="Rerun analysis"
                                            >
                                                <RefreshCw size={12} className={isRerunningAnalysis ? 'animate-spin' : ''} />
                                                {isRerunningAnalysis ? 'Analyzing...' : 'Rerun'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5 min-h-0">
                                        {bug.aiAnalysis.analyzedBy === 'admin' && bug.aiAnalysis.analyzedByUser && (
                                            <p className="text-[10px] text-purple-300/70 mb-2">Analyzed by {bug.aiAnalysis.analyzedByUser}</p>
                                        )}
                                        <p className="text-sm text-gray-300 mb-3 leading-relaxed">{bug.aiAnalysis.summary}</p>
                                        {bug.aiAnalysis.suggestions.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-purple-900/20">
                                                <span className="text-[10px] text-purple-400 uppercase font-bold mb-2 block">Suggestions</span>
                                                <ul className="list-disc list-inside text-xs text-gray-400 space-y-1.5">
                                                    {bug.aiAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!bug.aiAnalysis && isAdmin && onUpdateReport && (
                                <div className="hidden md:block bg-gray-900/30 border border-gray-800 rounded-lg p-4 md:p-5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-400">No analysis available</p>
                                        <button
                                            onClick={handleRerunAnalysis}
                                            disabled={isRerunningAnalysis}
                                            className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 px-3 py-1.5 rounded border border-purple-700/50 hover:border-purple-600 transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw size={12} className={isRerunningAnalysis ? 'animate-spin' : ''} />
                                            {isRerunningAnalysis ? 'Analyzing...' : 'Run Analysis'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}