import React, { useState, useMemo, useEffect } from "react";
import { BugReport, User } from "../types";
import { Bug, AlertOctagon, CheckCircle, Clock, Sparkles, Box, Search, MessageSquare, Tag, Link as LinkIcon, Youtube, FileCode, Image, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import BugDetailModal from "./BugDetailModal";

interface BugListProps {
  reports: BugReport[];
  onToggleStatus: (id: string) => void;
  onUpdateReport?: (report: BugReport) => void;
  isAdmin: boolean;
  mcVersions: string[];
  modVersions: string[];
  currentUser: User | null;
  onAddComment: (bugId: string, text: string, images?: string[]) => void;
  onDeleteComment: (bugId: string, commentId: string) => void;
  onNavigateLogin: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const getLinkIcon = (url: string) => {
    if (url.includes('youtube') || url.includes('youtu.be') || url.includes('twitch') || url.includes('streamable')) return <Youtube size={14} className="text-red-400"/>;
    if (url.includes('pastebin') || url.includes('gist') || url.includes('mclo.gs')) return <FileCode size={14} className="text-yellow-400"/>;
    if (url.includes('imgur') || url.includes('prnt') || url.includes('png') || url.includes('jpg')) return <Image size={14} className="text-green-400"/>;
    return <LinkIcon size={14} className="text-blue-400"/>;
};

export default function BugList({ reports, onToggleStatus, onUpdateReport, isAdmin, mcVersions, modVersions, currentUser, onAddComment, onDeleteComment, onNavigateLogin, onNotify }: BugListProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>(() => {
    if (typeof window === 'undefined') return 'active';
    const params = new URLSearchParams(window.location.search);
    if (params.has('resolved')) return 'resolved';
    return params.has('active') ? 'active' : 'active';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('active');
      url.searchParams.delete('resolved');
      url.searchParams.set(activeTab, '');
      window.history.replaceState(null, '', url.toString().replace(/=$/, ''));
    }
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [versionFilter, setVersionFilter] = useState("All");
  const [mcVersionFilter, setMcVersionFilter] = useState("All");

  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);

  const selectedBug = useMemo(() => {
    if (!selectedBugId) return null;
    return reports.find(bug => bug.id === selectedBugId) || null;
  }, [selectedBugId, reports]);

  const tabFilteredReports = useMemo(() => {
    if (activeTab === 'active') {
      return reports.filter(r => r.status !== 'Resolved');
    } else {
      return reports.filter(r => r.status === 'Resolved');
    }
  }, [reports, activeTab]);

  const filteredReports = useMemo(() => {
    return tabFilteredReports.filter(bug => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (bug.title + bug.description).toLowerCase().includes(searchLower) ||
                            (bug.tags && bug.tags.some(tag => tag.toLowerCase().includes(searchLower)));
      
      const matchesStatus = statusFilter === 'All' || bug.status === statusFilter;
      const matchesSeverity = severityFilter === 'All' || bug.severity === severityFilter;
      const matchesVersion = versionFilter === 'All' || bug.versions.includes(versionFilter);
      const matchesMcVersion = mcVersionFilter === 'All' || bug.mcVersions.includes(mcVersionFilter);
      
      return matchesSearch && matchesStatus && matchesSeverity && matchesVersion && matchesMcVersion;
    });
  }, [tabFilteredReports, searchQuery, statusFilter, severityFilter, versionFilter, mcVersionFilter]);

  const sortedReports = useMemo(() => {
    return [...filteredReports].sort((a, b) => {
      if (activeTab === 'active') {
        const statusOrder = { 'Open': 0, 'In Progress': 1 };
        if (statusOrder[a.status as keyof typeof statusOrder] !== statusOrder[b.status as keyof typeof statusOrder]) {
          return (statusOrder[a.status as keyof typeof statusOrder] || 2) - (statusOrder[b.status as keyof typeof statusOrder] || 2);
        }
      }
      return b.timestamp - a.timestamp;
    });
  }, [filteredReports, activeTab]);

  const openCount = reports.filter(r => r.status === 'Open' || r.status === 'In Progress').length;
  const resolvedCount = reports.filter(r => r.status === 'Resolved').length;
  const assignedCount = reports.filter(r => r.assignedTo && r.assignedTo.trim() !== '' && r.status !== 'Resolved').length;
  const inProgressCount = reports.filter(r => r.status === 'In Progress').length;

  return (
    <div>
      
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'active'
              ? 'text-white border-minecraft-grass'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Issue Tracker
          </div>
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'resolved'
              ? 'text-white border-green-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Resolved Issues
          </div>
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="w-full md:w-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3 mb-3 md:mb-2">
            <Bug className="text-minecraft-grass w-5 h-5 sm:w-6 sm:h-6" />
            {activeTab === 'active' ? 'Issue Tracker' : 'Resolved Issues'}
          </h2>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <span className="bg-gray-800 border border-gray-700 text-gray-300 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap">
              Total: {activeTab === 'active' ? openCount : resolvedCount}
            </span>
            {activeTab === 'active' ? (
              <>
                <span className="bg-green-900/20 border border-green-900/50 text-green-400 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap">
                  Active: {openCount}
                </span>
                <span className="bg-blue-900/20 border border-blue-900/50 text-blue-400 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap">
                  Assigned: {assignedCount}
                </span>
                <span className="bg-yellow-900/20 border border-yellow-900/50 text-yellow-400 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap">
                  In Progress: {inProgressCount}
                </span>
              </>
            ) : (
              <span className="bg-green-900/20 border border-green-900/50 text-green-400 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap">
                Resolved: {resolvedCount}
              </span>
            )}
          </div>
        </div>

        
        <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[300px]">
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                <input 
                type="text" 
                placeholder="Search issues or tags..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 h-10 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600"
                />
            </div>
            
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 w-full">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 h-10 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8 w-full md:w-auto"
                >
                    <option value="All">All Status</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                </select>

                <select 
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 h-10 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8 w-full md:w-auto"
                >
                    <option value="All">All Severity</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>

                <select 
                    value={versionFilter}
                    onChange={(e) => setVersionFilter(e.target.value)}
                    className="bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 h-10 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8 w-full md:w-auto"
                >
                    <option value="All">All Mod Ver</option>
                    {modVersions.map(v => <option key={v} value={v}>v{v}</option>)}
                </select>

                <select 
                    value={mcVersionFilter}
                    onChange={(e) => setMcVersionFilter(e.target.value)}
                    className="bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 h-10 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8 w-full md:w-auto"
                >
                    <option value="All">All MC Ver</option>
                    {mcVersions.map(v => <option key={v} value={v}>MC {v}</option>)}
                </select>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sortedReports.map((bug) => (
          <div key={bug.id} onClick={() => setSelectedBugId(bug.id)} className="group bg-[#1e1e1e] hover:bg-[#252525] transition-all duration-200 border border-gray-800 hover:border-gray-700 rounded-xl p-5 shadow-sm cursor-pointer relative overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-5 justify-between items-start sm:items-center">
                <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center gap-3 mb-2 w-full">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border font-mono uppercase tracking-wide flex-shrink-0
                    ${bug.severity === 'Critical' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 
                        bug.severity === 'High' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                        bug.severity === 'Medium' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 
                        'text-green-400 border-green-500/30 bg-green-500/10'}`}>
                    {bug.severity}
                    </span>
                    <h3 className="text-white font-semibold text-lg truncate min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap group-hover:text-green-400 transition-colors">{bug.title}</h3>
                    {bug.aiAnalysis && (
                    <span className="bg-purple-900/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                        <Sparkles size={12} /> Verified
                    </span>
                    )}
                </div>
                
                <p className="text-gray-400 text-sm leading-relaxed mb-3 line-clamp-2">{bug.description}</p>
                
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-y-1 text-xs text-gray-500">
                        <span className="mr-2">•</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          bug.status === 'Resolved' ? 'bg-green-900/20 text-green-400' : 
                          bug.status === 'In Progress' ? 'bg-blue-900/20 text-blue-400' : 
                          'bg-gray-800 text-gray-300'
                        }`}>{bug.status}</span>
                        <span className="mx-2">•</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          bug.severity === 'Critical' ? 'bg-red-900/20 text-red-400' :
                          bug.severity === 'High' ? 'bg-orange-900/20 text-orange-400' :
                          bug.severity === 'Medium' ? 'bg-yellow-900/20 text-yellow-400' :
                          'bg-green-900/20 text-green-400'
                        }`}>{bug.severity}</span>
                        {bug.assignedTo && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-blue-400 text-xs">Assigned: {bug.assignedTo}</span>
                          </>
                        )}
                        {bug.status === 'Resolved' && bug.resolvedBy && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-green-400 text-xs">Resolved by: {bug.resolvedBy}</span>
                          </>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-y-1 text-xs text-gray-500 font-mono">
                        <span className="mr-2">•</span>
                        <span className="flex items-center gap-1"><Box size={12} /> MC {bug.mcVersions.join(', ')}</span>
                        <span className="mx-2 text-gray-700">•</span>
                        <span>v{bug.versions.join(', ')}</span>
                        <span className="mx-2 text-gray-700">•</span>
                        <span>{new Date(bug.timestamp).toLocaleDateString()}</span>
                    </div>
                    
                    {bug.tags && bug.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {bug.tags.map((tag, i) => (
                                <span key={i} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700 flex items-center gap-1">
                                    <Tag size={10} />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {bug.links && bug.links.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {bug.links.map((link, i) => (
                                <span key={i} className="flex items-center gap-1 text-[10px] text-blue-400/70 bg-blue-900/5 px-2 py-0.5 rounded border border-blue-900/20">
                                    {getLinkIcon(link)}
                                    Link
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pl-0 sm:pl-4 border-t sm:border-t-0 border-gray-800 pt-3 sm:pt-0 mt-1 sm:mt-0">
                    <div className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full border
                        ${bug.status === 'Resolved' ? 'bg-green-900/20 border-green-800 text-green-400' : 
                        bug.status === 'In Progress' ? 'bg-blue-900/20 border-blue-800 text-blue-400' : 
                        'bg-gray-800/50 border-gray-700/50 text-gray-300'}`}>
                        {bug.status === 'Resolved' ? <CheckCircle size={14} /> : 
                        bug.status === 'In Progress' ? <Clock size={14} /> : 
                        <AlertOctagon size={14} />}
                        {bug.status}
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedBugId(bug.id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                        >
                            <MessageSquare size={14} /> 
                            {bug.comments?.length || 0}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedBugId(bug.id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-minecraft-grass/10 hover:bg-minecraft-grass/20 border border-green-900/30 text-xs font-semibold text-green-400 hover:text-green-300 transition-colors"
                        >
                            <ExternalLink size={14} /> 
                            View
                        </button>
                    </div>
                </div>
            </div>
          </div>
        ))}
        {sortedReports.length === 0 && (
           <div className="text-center py-16 bg-[#1e1e1e] rounded-xl border border-gray-800 border-dashed">
             <p className="text-gray-500 text-lg">No bugs found matching criteria.</p>
           </div>
        )}
      </div>

      
      {selectedBug && (
        <BugDetailModal 
            bug={selectedBug}
            isOpen={!!selectedBug}
            onClose={() => setSelectedBugId(null)}
            currentUser={currentUser}
            isAdmin={isAdmin}
            onToggleStatus={onToggleStatus}
            onUpdateReport={onUpdateReport}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onNavigateLogin={onNavigateLogin}
            onNotify={onNotify}
        />
      )}
    </div>
  );
}