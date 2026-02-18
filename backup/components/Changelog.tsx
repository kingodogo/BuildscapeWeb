import React, { useMemo, useState, useEffect, useRef } from "react";
import { AppConfig, ChangelogEntry, BugReport, User } from "../types";
import { FileCode, Download, Calendar, Search, Filter, ChevronUp, ChevronDown, X, Bug as BugIcon, Edit, Share2, Lock, Globe, EyeOff } from "lucide-react";
import BugDetailModal from "./BugDetailModal";
import { sanitizeHTMLPermissive } from "../utils/sanitize";

interface ChangelogProps {
  config: AppConfig;
  reports?: BugReport[];
  currentUser?: User | null;
  isAdmin?: boolean;
  onToggleStatus?: (id: string) => void;
  onUpdateReport?: (report: BugReport) => void;
  onAddComment?: (bugId: string, text: string, images?: string[]) => void;
  onDeleteComment?: (bugId: string, commentId: string) => void;
  onNavigateLogin?: () => void;
  onNotify?: (msg: string, type?: 'success' | 'error') => void;
  onEditChangelog?: (changelog: ChangelogEntry) => void;
  unlistedChangelogId?: string | null;
}

export default function Changelog({ 
  config, 
  reports = [], 
  currentUser = null, 
  isAdmin = false,
  onToggleStatus = () => {},
  onUpdateReport,
  onAddComment = () => {},
  onDeleteComment = () => {},
  onNavigateLogin = () => {},
  onNotify = () => {},
  onEditChangelog,
  unlistedChangelogId = null
}: ChangelogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<string>("all");
  const [selectedMcVersion, setSelectedMcVersion] = useState<string>("all");
  const [selectedModVersion, setSelectedModVersion] = useState<string>("all");
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [highlightElements, setHighlightElements] = useState<HTMLElement[]>([]);
  const changelogRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [hoveredBugId, setHoveredBugId] = useState<string | null>(null);
  
  // Validate config after hooks
  if (!config) {
    return (
      <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
            <h3 className="text-red-400 font-bold mb-1">Configuration Error</h3>
            <p className="text-red-300 text-sm">Configuration is missing. Please refresh the page.</p>
          </div>
        </div>
      </div>
    );
  }
  
  const selectedBug = useMemo(() => {
    if (!selectedBugId) return null;
    return reports.find(bug => bug.id === selectedBugId) || null;
  }, [selectedBugId, reports]);

  const allChangelogs = useMemo(() => {
    try {
      if (!config || !config.changelogs) return [];
      const entries = Array.isArray(config.changelogs) ? config.changelogs : [];
      return entries
        .filter(entry => entry && entry.modVersion && typeof entry.modVersion === 'string') // Filter out invalid entries
        .sort((a, b) => {
          if (a.isLatest) return -1;
          if (b.isLatest) return 1;
          if (!a.modVersion || !b.modVersion) return 0;
          try {
            const aParts = a.modVersion.split('.').map(Number);
            const bParts = b.modVersion.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
              const aVal = aParts[i] || 0;
              const bVal = bParts[i] || 0;
              if (aVal > bVal) return -1;
              if (aVal < bVal) return 1;
            }
          } catch (e) {
            // If sorting fails, maintain original order
            return 0;
          }
          return 0;
        });
    } catch (e) {
      console.error("Error processing changelogs:", e);
      return [];
    }
  }, [config?.changelogs]);

  const allMcVersions = useMemo(() => {
    const versions = new Set<string>();
    allChangelogs.forEach(entry => {
      entry.mcVersions.forEach(v => versions.add(v));
    });
    return Array.from(versions).sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal > bVal) return -1;
        if (aVal < bVal) return 1;
      }
      return 0;
    });
  }, [allChangelogs]);

  const allModVersions = useMemo(() => {
    const versions = new Set<string>();
    allChangelogs.forEach(entry => {
      versions.add(entry.modVersion);
    });
    return Array.from(versions).sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal > bVal) return -1;
        if (aVal < bVal) return 1;
      }
      return 0;
    });
  }, [allChangelogs]);

  const changelogs = useMemo(() => {
    return allChangelogs.filter(entry => {
      // Handle visibility filtering
      // Default to 'private' for new entries, but allow 'public' for entries that explicitly have it
      // For backward compatibility, if visibility is undefined (old entries), default to 'public'
      // But if visibility is explicitly set to 'private', respect it
      const visibility = entry.visibility !== undefined ? entry.visibility : 'public';
      
      // If unlistedChangelogId is provided, only show that specific unlisted changelog
      if (unlistedChangelogId) {
        if (entry.id === unlistedChangelogId && visibility === 'unlisted') {
          return true; // Show the specific unlisted changelog
        }
        return false; // Hide all others when viewing unlisted
      }
      
      // Normal visibility filtering
      if (visibility === 'private') {
        // Only show private changelogs to admins
        if (!isAdmin) {
          return false;
        }
      } else if (visibility === 'unlisted') {
        // Hide unlisted changelogs from normal view (they need direct link)
        return false;
      }
      // public visibility - show to everyone (no filter needed)
      
      if (selectedVersion !== "all" && entry.modVersion !== selectedVersion) {
        return false;
      }
      if (selectedModVersion !== "all" && entry.modVersion !== selectedModVersion) {
        return false;
      }
      if (selectedMcVersion !== "all" && (!Array.isArray(entry.mcVersions) || !entry.mcVersions.includes(selectedMcVersion))) {
        return false;
      }
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesTitle = entry.title?.toLowerCase().includes(searchLower) || false;
        const matchesChangelog = (entry.changelog || '').toLowerCase().includes(searchLower);
        const matchesFileName = (entry.fileName || '').toLowerCase().includes(searchLower);
        const matchesModVersion = (entry.modVersion || '').toLowerCase().includes(searchLower);
        const matchesMcVersions = Array.isArray(entry.mcVersions) ? entry.mcVersions.some(v => String(v).toLowerCase().includes(searchLower)) : false;
        if (!matchesTitle && !matchesChangelog && !matchesFileName && !matchesModVersion && !matchesMcVersions) {
          return false;
        }
      }
      return true;
    });
  }, [allChangelogs, searchTerm, selectedVersion, selectedModVersion, selectedMcVersion, isAdmin, unlistedChangelogId]);

  const highlightText = (text: string, searchTerm: string): string => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-500/50 text-yellow-100">$1</mark>');
  };

  const escapeHtml = (text: string): string => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const processPatchReferences = (text: string, entryId: string): string => {
    return text.replace(/@([a-zA-Z0-9_-]+)/g, (match, patchId) => {
      const report = reports.find(r => r.id === patchId);
      if (!report) {
        return `<span class="text-gray-500 font-mono text-sm">@${escapeHtml(patchId)}</span>`;
      }
      
      const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
      };
      
      // Format MC versions (comma-separated if multiple)
      const mcVersionsStr = report.mcVersions && report.mcVersions.length > 0 
        ? `MC ${report.mcVersions.join(', ')}` 
        : 'MC N/A';
      const modVersion = report.versions && report.versions.length > 0 ? `v${report.versions[0]}` : 'vN/A';
      const dateStr = formatDate(report.timestamp);
      
      const statusColors = {
        'Open': 'bg-gray-700/50 text-gray-300',
        'In Progress': 'bg-blue-700/50 text-blue-300',
        'Resolved': 'bg-green-700/50 text-green-300'
      };
      
      const severityColors = {
        'Critical': 'bg-red-700/50 text-red-300',
        'High': 'bg-orange-700/50 text-orange-300',
        'Medium': 'bg-yellow-700/50 text-yellow-300',
        'Low': 'bg-green-700/50 text-green-300'
      };
      
      const severityTagColors = {
        'Critical': 'bg-red-900/30 text-red-600 border-red-700',
        'High': 'bg-orange-900/30 text-orange-600 border-orange-700',
        'Medium': 'bg-yellow-900/30 text-yellow-600 border-yellow-700',
        'Low': 'bg-green-900/30 text-green-600 border-green-700'
      };
      
      const escapedTitle = escapeHtml(report.title);
      const escapedDescription = escapeHtml(report.description || '');
      const escapedStatus = escapeHtml(report.status);
      const escapedSeverity = escapeHtml(report.severity);
      const escapedAssigned = report.assignedTo ? escapeHtml(report.assignedTo) : '';
      const escapedMcVersion = escapeHtml(mcVersionsStr);
      const escapedModVersion = escapeHtml(modVersion);
      const escapedDate = escapeHtml(dateStr);
      
      const severityTagClass = severityTagColors[report.severity as keyof typeof severityTagColors] || severityTagColors['Low'];
      const statusTagClass = statusColors[report.status as keyof typeof statusColors] || statusColors['Open'];
      const severityTagClass2 = severityColors[report.severity as keyof typeof severityColors] || severityColors['Low'];
      
      return `
        <div 
          class="inline-block px-3 py-2 rounded-lg border cursor-pointer hover:opacity-90 transition-all bg-gray-800/50 border-gray-700 hover:border-blue-500 my-1"
          data-bug-id="${escapeHtml(patchId)}"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded text-xs font-semibold border ${severityTagClass}">${escapedSeverity.toUpperCase()}</span>
            <span class="font-medium text-green-400">${escapedTitle}</span>
          </div>
          ${escapedDescription ? `<div class="text-gray-400 text-sm mb-2">${escapedDescription}</div>` : ''}
          <div class="flex flex-wrap items-center gap-y-1 text-xs">
            <span class="mr-2 text-gray-500">•</span>
            <span class="px-1.5 py-0.5 rounded font-semibold ${statusTagClass}">${escapedStatus}</span>
            <span class="mx-2 text-gray-500">•</span>
            <span class="px-1.5 py-0.5 rounded font-semibold ${severityTagClass2}">${escapedSeverity}</span>
            ${report.assignedTo ? `<span class="mx-2 text-gray-500">•</span><span class="text-blue-400">Assigned: ${escapedAssigned}</span>` : ''}
          </div>
          <div class="flex flex-wrap items-center gap-y-1 text-xs text-gray-400 mt-1">
            <span class="mr-2 text-gray-500">•</span>
            <span>${escapedMcVersion}</span>
            <span class="mx-2 text-gray-500">•</span>
            <span>${escapedModVersion}</span>
            <span class="mx-2 text-gray-500">•</span>
            <span>${escapedDate}</span>
          </div>
        </div>
      `;
    });
  };

  const renderChangelog = (changelog: string, type: 'html' | 'markdown' | 'text', entryId: string) => {
    if (!changelog || typeof changelog !== 'string') {
      return <p className="text-gray-500">No changelog content available.</p>;
    }
    const shouldHighlight = searchTerm.length > 0;

    if (type === 'html') {
      let processedContent = processPatchReferences(changelog, entryId);
      const highlightedContent = shouldHighlight ? highlightText(processedContent, searchTerm) : processedContent;
      const sanitized = sanitizeHTMLPermissive(highlightedContent);
      return <div dangerouslySetInnerHTML={{ __html: sanitized }} className="prose prose-invert max-w-none" data-changelog-id={entryId} />;
    }
    
    if (type === 'markdown') {
      const htmlTagRegex = /<[^>]+>/g;
      const hasHtml = htmlTagRegex.test(changelog);
      
      if (hasHtml) {
        let processedContent = processPatchReferences(changelog, entryId);
        const highlightedContent = shouldHighlight ? highlightText(processedContent, searchTerm) : processedContent;
        const sanitized = sanitizeHTMLPermissive(highlightedContent);
        return <div dangerouslySetInnerHTML={{ __html: sanitized }} className="prose prose-invert max-w-none" data-changelog-id={entryId} />;
      }
      
      const lines = changelog.split('\n');
      return (
        <div className="space-y-2" data-changelog-id={entryId}>
          {lines.map((line, idx) => {
            if (line.startsWith('# ')) {
              const content = line.substring(2);
              let processedContent = processPatchReferences(content, entryId);
              processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
              processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
              processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
              const highlightedContent = shouldHighlight ? highlightText(processedContent, searchTerm) : processedContent;
              const sanitized = sanitizeHTMLPermissive(highlightedContent);
              return <h1 key={idx} className="text-2xl font-bold text-white mt-4 mb-2" dangerouslySetInnerHTML={{ __html: sanitized }} />;
            }
            if (line.startsWith('## ')) {
              const content = line.substring(3);
              let processedContent = processPatchReferences(content, entryId);
              processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
              processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
              processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
              const highlightedContent = shouldHighlight ? highlightText(processedContent, searchTerm) : processedContent;
              const sanitized = sanitizeHTMLPermissive(highlightedContent);
              return <h2 key={idx} className="text-xl font-bold text-white mt-3 mb-2" dangerouslySetInnerHTML={{ __html: sanitized }} />;
            }
            if (line.startsWith('### ')) {
              const content = line.substring(4);
              let processedContent = processPatchReferences(content, entryId);
              processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
              processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
              processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
              const highlightedContent = shouldHighlight ? highlightText(processedContent, searchTerm) : processedContent;
              const sanitized = sanitizeHTMLPermissive(highlightedContent);
              return <h3 key={idx} className="text-lg font-bold text-gray-300 mt-2 mb-1" dangerouslySetInnerHTML={{ __html: sanitized }} />;
            }
            if (line.startsWith('- ') || line.startsWith('* ')) {
              const contentWithoutMarkdown = line.replace(/^[-*]\s+/, '');
              let processedContent = processPatchReferences(contentWithoutMarkdown, entryId);
              processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
              processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
              processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
              const highlightedContent = shouldHighlight ? highlightText(processedContent, searchTerm) : processedContent;
              const sanitized = sanitizeHTMLPermissive(highlightedContent);
              return <li key={idx} className="ml-4 text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
            }
            if (line.trim() === '') {
              return <br key={idx} />;
            }
            let processedLine = processPatchReferences(line, entryId);
            processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
            processedLine = processedLine.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-green-400 hover:underline">$1</a>');
            const highlightedLine = shouldHighlight ? highlightText(processedLine, searchTerm) : processedLine;
            const sanitized = sanitizeHTMLPermissive(highlightedLine);
            return <p key={idx} className="text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          })}
        </div>
      );
    }
    
    let processedContent = processPatchReferences(changelog, entryId);
    const highlightedContent = shouldHighlight ? highlightText(processedContent, searchTerm) : processedContent;
    const sanitized = sanitizeHTMLPermissive(highlightedContent);
    return <div className="whitespace-pre-wrap text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} data-changelog-id={entryId} />;
  };

  useEffect(() => {
    if (!searchTerm) {
      setHighlightElements([]);
      setHighlightIndex(-1);
      return;
    }

    if (typeof window === 'undefined' || !document) return;

    setTimeout(() => {
      try {
        const allMarks = Array.from(document.querySelectorAll('mark')) as HTMLElement[];
        setHighlightElements(allMarks);
        
        if (allMarks.length > 0) {
          setHighlightIndex(0);
          allMarks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          allMarks[0].classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2', 'ring-offset-gray-800');
        } else {
          setHighlightIndex(-1);
        }
      } catch (e) {
        console.error("Error highlighting search results:", e);
      }
    }, 100);
  }, [searchTerm, changelogs]);

  useEffect(() => {
    if (typeof window === 'undefined' || !document) return;

    (window as any).openBugModal = (bugId: string) => {
      setSelectedBugId(bugId);
    };

    const handleClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement;
        const patchRef = target.closest('[data-bug-id]') as HTMLElement;
        if (patchRef) {
          const bugId = patchRef.getAttribute('data-bug-id');
          if (bugId) {
            setSelectedBugId(bugId);
          }
        }
      } catch (e) {
        console.error("Error handling click:", e);
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      delete (window as any).openBugModal;
    };
  }, []);

  const navigateHighlight = (direction: 'next' | 'prev') => {
    if (highlightElements.length === 0) return;
    
    let newIndex = highlightIndex;
    if (direction === 'next') {
      newIndex = (highlightIndex + 1) % highlightElements.length;
    } else {
      newIndex = highlightIndex <= 0 ? highlightElements.length - 1 : highlightIndex - 1;
    }
    
    setHighlightIndex(newIndex);
    highlightElements[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightElements.forEach((el, idx) => {
      if (idx === newIndex) {
        el.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2', 'ring-offset-gray-800');
      } else {
        el.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2', 'ring-offset-gray-800');
      }
    });
  };

  if (allChangelogs.length === 0) {
    return (
      <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Changelog</h1>
            <p className="text-gray-400">Version history and updates for Buildscape</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
            <FileCode className="mx-auto text-gray-500 mb-3" size={48} />
            <h3 className="text-gray-400 font-bold mb-1">No Changelogs Available</h3>
            <p className="text-gray-500 text-sm">Changelogs will appear here once they are created in the admin panel.</p>
          </div>
        </div>
      </div>
    );
  }

  if (changelogs.length === 0) {
    return (
      <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Changelog</h1>
            <p className="text-gray-400">Version history and updates for Buildscape</p>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search changelogs, patch notes, versions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-400" />
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Releases</option>
                  {allChangelogs.map(entry => (
                    <option key={entry.id} value={entry.modVersion}>
                      {entry.title || `Version ${entry.modVersion}`}
                    </option>
                  ))}
                </select>
              </div>
              
              <select
                value={selectedModVersion}
                onChange={(e) => setSelectedModVersion(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Mod Versions</option>
                {allModVersions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedMcVersion}
                onChange={(e) => setSelectedMcVersion(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All MC Versions</option>
                {allMcVersions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
            <FileCode className="mx-auto text-gray-500 mb-3" size={48} />
            <h3 className="text-gray-400 font-bold mb-1">No Results Found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your search or filters.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Changelog</h1>
          <p className="text-gray-400">Version history and updates for Buildscape</p>
        </div>

          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search changelogs, patch notes, versions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-400" />
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">All Releases</option>
                  {allChangelogs.map(entry => (
                    <option key={entry.id} value={entry.modVersion}>
                      {entry.title || `Version ${entry.modVersion}`}
                    </option>
                  ))}
                </select>
              </div>
              
              <select
                value={selectedModVersion}
                onChange={(e) => setSelectedModVersion(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Mod Versions</option>
                {allModVersions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedMcVersion}
                onChange={(e) => setSelectedMcVersion(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All MC Versions</option>
                {allMcVersions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          </div>

        <div className="space-y-8">
          {Array.isArray(changelogs) && changelogs.length > 0 ? changelogs.map((entry, index) => (
            <div key={entry.id || entry.modVersion || index} className="bg-[#1e1e1e] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">
                    {entry.title || (entry.isLatest || index === 0 ? 'Latest Version' : `Version ${entry.modVersion}`)}
                  </h2>
                  {isAdmin && (
                    <>
                      {(entry.visibility || 'public') === 'private' && (
                        <span className="px-3 py-1 bg-gray-700/50 text-gray-300 font-semibold rounded flex items-center gap-1.5">
                          <Lock size={14} />
                          Private
                        </span>
                      )}
                      {(entry.visibility || 'public') === 'public' && (
                        <span className="px-3 py-1 bg-blue-600/20 text-blue-400 font-semibold rounded flex items-center gap-1.5">
                          <Globe size={14} />
                          Public
                        </span>
                      )}
                      {(entry.visibility || 'public') === 'unlisted' && (
                        <span className="px-3 py-1 bg-purple-600/20 text-purple-400 font-semibold rounded flex items-center gap-1.5">
                          <EyeOff size={14} />
                          Unlisted
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                <div className="mb-4 text-gray-300">
                  <div className="flex items-center gap-3 flex-wrap text-sm mb-2">
                    {entry.isLatest || index === 0 ? (
                      <span 
                        className="px-3 py-1 bg-red-600/30 text-red-400 font-semibold rounded"
                        style={{
                          animation: 'blink-glow 2s ease-in-out infinite'
                        }}
                      >
                        Latest
                      </span>
                    ) : null}
                    {entry.type && (
                      <span className={`px-3 py-1 font-semibold rounded ${
                        entry.type === 'patch' 
                          ? 'bg-blue-600/20 text-blue-400' 
                          : 'bg-green-600/20 text-green-400'
                      }`}>
                        {entry.type === 'patch' ? 'Patch' : 'Release'}
                      </span>
                    )}
                    <span className="text-gray-400">
                      Mod Version: <span className="text-green-400 font-mono font-semibold">{entry.modVersion}</span>
                    </span>
                    {Array.isArray(entry.mcVersions) && entry.mcVersions.length > 0 && (
                      <>
                        {entry.mcVersions.map((version, vIdx) => (
                          <span
                            key={vIdx}
                            className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs font-mono rounded border border-gray-600"
                          >
                            {version}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                  {entry.downloadUrl ? (
                    <a
                      href={entry.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors text-sm font-mono"
                    >
                      {entry.fileName}
                      <Download size={14} />
                    </a>
                  ) : (
                    <div className="mt-2 text-gray-300 font-mono text-sm">{entry.fileName}</div>
                  )}
                </div>
                
                <div className="mb-4 text-gray-300">
                  <div className="prose prose-invert max-w-none">
                    <div className="bg-black/40 border border-gray-800 rounded-lg p-4 md:p-6">
                      {entry.changelog ? renderChangelog(entry.changelog, entry.changelogType || 'text', entry.id || '') : <p className="text-gray-500">No changelog content available.</p>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-gray-500 text-xs mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{new Date(entry.fileDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.visibility === 'unlisted' && !unlistedChangelogId && (
                      <button
                        onClick={() => {
                          const shareUrl = `${window.location.origin}${window.location.pathname}?changelog=${entry.id}`;
                          navigator.clipboard.writeText(shareUrl).then(() => {
                            onNotify('Share link copied to clipboard!', 'success');
                          }).catch(() => {
                            // Fallback for browsers that don't support clipboard API
                            const textArea = document.createElement('textarea');
                            textArea.value = shareUrl;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            onNotify('Share link copied to clipboard!', 'success');
                          });
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-purple-800 hover:bg-purple-700 border border-purple-700 text-xs font-semibold text-purple-200 hover:text-white transition-colors"
                        title="Copy share link"
                      >
                        <Share2 size={14} />
                        Share
                      </button>
                    )}
                    {isAdmin && onEditChangelog && (
                      <button
                        onClick={() => onEditChangelog(entry)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
              <FileCode className="mx-auto text-gray-500 mb-3" size={48} />
              <h3 className="text-gray-400 font-bold mb-1">No Changelogs Found</h3>
              <p className="text-gray-500 text-sm">No changelogs match your current filters.</p>
            </div>
          )}
        </div>
      </div>

      {searchTerm && highlightElements.length > 0 && (
        <div className="fixed right-6 bottom-6 z-50 flex flex-col gap-2">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 flex items-center gap-2">
            <button
              onClick={() => navigateHighlight('prev')}
              className="p-2 hover:bg-gray-700 rounded transition-colors text-white"
              title="Previous match"
            >
              <ChevronUp size={20} />
            </button>
            <span className="text-sm text-gray-300 px-2">
              {highlightIndex + 1} / {highlightElements.length}
            </span>
            <button
              onClick={() => navigateHighlight('next')}
              className="p-2 hover:bg-gray-700 rounded transition-colors text-white"
              title="Next match"
            >
              <ChevronDown size={20} />
            </button>
            <button
              onClick={() => {
                setSearchTerm('');
                setHighlightElements([]);
                setHighlightIndex(-1);
              }}
              className="p-2 hover:bg-gray-700 rounded transition-colors text-white ml-1"
              title="Clear search"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

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

