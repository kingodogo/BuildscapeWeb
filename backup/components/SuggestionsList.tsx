import React, { useState, useMemo } from "react";
import { Suggestion, User } from "../types";
import { Lightbulb, CheckCircle, Clock, Sparkles, Box, Search, MessageSquare, Tag, Link as LinkIcon, ThumbsUp, ExternalLink, AlertCircle, X } from "lucide-react";
import BugDetailModal from "./BugDetailModal";

interface SuggestionsListProps {
  suggestions: Suggestion[];
  onToggleStatus?: (id: string) => void;
  isAdmin: boolean;
  mcVersions: string[];
  modVersions: string[];
  currentUser: User | null;
  onAddComment?: (suggestionId: string, text: string, images?: string[]) => void;
  onDeleteComment?: (suggestionId: string, commentId: string) => void;
  onNavigateLogin: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export default function SuggestionsList({ 
  suggestions, 
  onToggleStatus, 
  isAdmin, 
  mcVersions, 
  modVersions, 
  currentUser, 
  onAddComment, 
  onDeleteComment, 
  onNavigateLogin, 
  onNotify
}: SuggestionsListProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  const tabFilteredSuggestions = useMemo(() => {
    if (activeTab === 'active') {
      return suggestions.filter(s => s.status !== 'Implemented' && s.status !== 'Rejected');
    } else {
      return suggestions.filter(s => s.status === 'Implemented' || s.status === 'Rejected');
    }
  }, [suggestions, activeTab]);

  const filteredSuggestions = useMemo(() => {
    return tabFilteredSuggestions.filter(suggestion => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (suggestion.title + suggestion.description).toLowerCase().includes(searchLower) ||
                            (suggestion.tags && suggestion.tags.some(tag => tag.toLowerCase().includes(searchLower)));
      
      const matchesStatus = statusFilter === 'All' || suggestion.status === statusFilter;
      const matchesCategory = categoryFilter === 'All' || suggestion.category === categoryFilter;
      const matchesPriority = priorityFilter === 'All' || suggestion.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [tabFilteredSuggestions, searchQuery, statusFilter, categoryFilter, priorityFilter]);

  const sortedSuggestions = useMemo(() => {
    return [...filteredSuggestions].sort((a, b) => {
      if (activeTab === 'active') {
        const statusOrder = { 'Open': 0, 'Under Review': 1, 'Planned': 2 };
        if (statusOrder[a.status as keyof typeof statusOrder] !== statusOrder[b.status as keyof typeof statusOrder]) {
          return (statusOrder[a.status as keyof typeof statusOrder] || 3) - (statusOrder[b.status as keyof typeof statusOrder] || 3);
        }
      }

      const upvotesA = a.upvotes || 0;
      const upvotesB = b.upvotes || 0;
      if (upvotesA !== upvotesB) {
        return upvotesB - upvotesA;
      }
      return b.timestamp - a.timestamp;
    });
  }, [filteredSuggestions, activeTab]);

  const activeCount = suggestions.filter(s => s.status === 'Open' || s.status === 'Under Review' || s.status === 'Planned').length;
  const closedCount = suggestions.filter(s => s.status === 'Implemented' || s.status === 'Rejected').length;
  const acceptedCount = suggestions.filter(s => s.status === 'Implemented').length;
  const deniedCount = suggestions.filter(s => s.status === 'Rejected').length;

  const getStatusColor = (status: Suggestion['status']) => {
    switch (status) {
      case 'Implemented': return 'bg-green-900/20 border-green-800 text-green-400';
      case 'Planned': return 'bg-blue-900/20 border-blue-800 text-blue-400';
      case 'Under Review': return 'bg-yellow-900/20 border-yellow-800 text-yellow-400';
      case 'Rejected': return 'bg-red-900/20 border-red-800 text-red-400';
      default: return 'bg-gray-800/50 border-gray-700/50 text-gray-300';
    }
  };

  const getStatusIcon = (status: Suggestion['status']) => {
    switch (status) {
      case 'Implemented': return <CheckCircle size={14} />;
      case 'Planned': return <Clock size={14} />;
      case 'Under Review': return <AlertCircle size={14} />;
      case 'Rejected': return <X size={14} />;
      default: return <Lightbulb size={14} />;
    }
  };

  const getCategoryColor = (category: Suggestion['category']) => {
    switch (category) {
      case 'Feature': return 'bg-purple-900/20 border-purple-800 text-purple-300';
      case 'Enhancement': return 'bg-blue-900/20 border-blue-800 text-blue-300';
      case 'Block': return 'bg-green-900/20 border-green-800 text-green-300';
      case 'Item': return 'bg-yellow-900/20 border-yellow-800 text-yellow-300';
      default: return 'bg-gray-800 border-gray-700 text-gray-300';
    }
  };

  return (
    <div>
      
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'active'
              ? 'text-white border-blue-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Suggestions
          </div>
        </button>
        <button
          onClick={() => setActiveTab('closed')}
          className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'closed'
              ? 'text-white border-green-500'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Approved/Closed
          </div>
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Lightbulb className="text-blue-500" />
            {activeTab === 'active' ? 'Suggestions & Feature Requests' : 'Approved/Closed Suggestions'}
          </h2>
          <div className="flex gap-2 font-mono text-xs mt-2">
            <span className="bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1 rounded-full">
              Total: {activeTab === 'active' ? activeCount : closedCount}
            </span>
            {activeTab === 'active' ? (
              <span className="bg-blue-900/20 border border-blue-900/50 text-blue-400 px-3 py-1 rounded-full">
                Active: {activeCount}
              </span>
            ) : (
              <>
                <span className="bg-green-900/20 border border-green-900/50 text-green-400 px-3 py-1 rounded-full">
                  Accepted: {acceptedCount}
                </span>
                <span className="bg-red-900/20 border border-red-900/50 text-red-400 px-3 py-1 rounded-full">
                  Denied: {deniedCount}
                </span>
              </>
            )}
          </div>
        </div>

        
        <div className="flex flex-col gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
                <input 
                type="text" 
                placeholder="Search suggestions or tags..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-gray-700 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
            </div>
            
            <div className="flex flex-wrap gap-2">
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#1e1e1e] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                    <option value="All">All Status</option>
                    <option value="Open">Open</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Planned">Planned</option>
                    <option value="Implemented">Implemented</option>
                    <option value="Rejected">Rejected</option>
                </select>

                <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-[#1e1e1e] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                    <option value="All">All Categories</option>
                    <option value="Feature">Feature</option>
                    <option value="Enhancement">Enhancement</option>
                    <option value="Block">Block</option>
                    <option value="Item">Item</option>
                    <option value="Other">Other</option>
                </select>

                <select 
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-[#1e1e1e] border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                    <option value="All">All Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sortedSuggestions.map((suggestion) => (
          <div 
            key={suggestion.id} 
            onClick={() => setSelectedSuggestion(suggestion)} 
            className="group bg-[#1e1e1e] hover:bg-[#252525] transition-all duration-200 border border-gray-800 hover:border-gray-700 rounded-xl p-5 shadow-sm cursor-pointer relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row gap-5 justify-between items-start sm:items-center">
                <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-3 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border font-mono uppercase tracking-wide ${getCategoryColor(suggestion.category)}`}>
                    {suggestion.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border font-mono uppercase tracking-wide
                    ${suggestion.priority === 'High' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 
                        suggestion.priority === 'Medium' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 
                        'text-green-400 border-green-500/30 bg-green-500/10'}`}>
                    {suggestion.priority}
                    </span>
                    <h3 className="text-white font-semibold text-lg truncate pr-2 group-hover:text-blue-400 transition-colors">{suggestion.title}</h3>
                </div>
                
                <p className="text-gray-400 text-sm leading-relaxed mb-3 line-clamp-2">{suggestion.description}</p>
                
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-mono">
                        {suggestion.mcVersions && suggestion.mcVersions.length > 0 && (
                            <>
                                <span className="flex items-center gap-1"><Box size={12} /> MC {suggestion.mcVersions.join(', ')}</span>
                                <span className="text-gray-700">|</span>
                            </>
                        )}
                        {suggestion.modVersions && suggestion.modVersions.length > 0 && (
                            <>
                                <span>v{suggestion.modVersions.join(', ')}</span>
                                <span className="text-gray-700">|</span>
                            </>
                        )}
                        <span>{new Date(suggestion.timestamp).toLocaleDateString()}</span>
                        <span className="text-gray-700">|</span>
                        <span className="text-gray-400">by {suggestion.author}</span>
                    </div>
                    
                    {suggestion.tags && suggestion.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {suggestion.tags.map((tag, i) => (
                                <span key={i} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700 flex items-center gap-1">
                                    <Tag size={10} />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {suggestion.links && suggestion.links.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {suggestion.links.map((link, i) => (
                                <span key={i} className="flex items-center gap-1 text-[10px] text-blue-400/70 bg-blue-900/5 px-2 py-0.5 rounded border border-blue-900/20">
                                    <LinkIcon size={10} />
                                    Link
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pl-0 sm:pl-4 border-t sm:border-t-0 border-gray-800 pt-3 sm:pt-0 mt-1 sm:mt-0">
                    <div className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full border ${getStatusColor(suggestion.status)}`}>
                        {getStatusIcon(suggestion.status)}
                        {suggestion.status}
                    </div>

                    <div className="flex gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-xs font-semibold text-gray-400">
                            <ThumbsUp size={14} /> 
                            {suggestion.upvotes || 0}
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedSuggestion(suggestion); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                        >
                            <MessageSquare size={14} /> 
                            {suggestion.comments?.length || 0}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedSuggestion(suggestion); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600/10 hover:bg-blue-600/20 border border-blue-900/30 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <ExternalLink size={14} /> 
                            View
                        </button>
                    </div>
                </div>
            </div>
          </div>
        ))}
        {sortedSuggestions.length === 0 && (
           <div className="text-center py-16 bg-[#1e1e1e] rounded-xl border border-gray-800 border-dashed">
             <p className="text-gray-500 text-lg">No suggestions found matching criteria.</p>
           </div>
        )}
      </div>

      
      {selectedSuggestion && (
        <BugDetailModal 
            bug={{
              id: selectedSuggestion.id,
              title: selectedSuggestion.title,
              description: selectedSuggestion.description,
              stepsToReproduce: '',
              versions: selectedSuggestion.modVersions || [],
              mcVersions: selectedSuggestion.mcVersions || [],
              author: selectedSuggestion.author,
              severity: selectedSuggestion.priority === 'High' ? 'High' : selectedSuggestion.priority === 'Medium' ? 'Medium' : 'Low',
              status: selectedSuggestion.status === 'Open' ? 'Open' : selectedSuggestion.status === 'Under Review' ? 'In Progress' : selectedSuggestion.status === 'Implemented' ? 'Resolved' : 'Open',
              timestamp: selectedSuggestion.timestamp,
              comments: selectedSuggestion.comments,
              tags: selectedSuggestion.tags,
              links: selectedSuggestion.links
            }}
            isOpen={!!selectedSuggestion}
            onClose={() => setSelectedSuggestion(null)}
            currentUser={currentUser}
            isAdmin={isAdmin}
            onToggleStatus={onToggleStatus ? (id) => onToggleStatus(id) : () => {}}
            onAddComment={onAddComment ? (id, text, images) => onAddComment(id, text, images) : () => {}}
            onDeleteComment={onDeleteComment ? (id, commentId) => onDeleteComment(id, commentId) : () => {}}
            onNavigateLogin={onNavigateLogin}
            onNotify={onNotify}
        />
      )}
    </div>
  );
}

