import React, { useState } from "react";
import { Suggestion, User } from "../types";
import { Sparkles, Tag, Plus, Link as LinkIcon, X, Check, Lightbulb } from "lucide-react";

interface SuggestionsFormProps {
  onSubmit: (suggestion: Suggestion) => void;
  onCancel: () => void;
  mcVersions: string[];
  modVersions: string[];
  onNotify: (msg: string, type: 'success' | 'error') => void;
  currentUser?: User | null;
}

const TRUSTED_DOMAINS = [
    'pastebin.com', 'gist.github.com', 'mclo.gs', 'hastebin.com', 'github.com', 'gitlab.com',
    'imgur.com', 'i.imgur.com', 'prnt.sc', 'ibb.co',
    'youtube.com', 'youtu.be', 'twitch.tv', 'streamable.com',
    'curseforge.com', 'modrinth.com', 'discord.com', 'discordapp.com'
];

export default function SuggestionsForm({ onSubmit, onCancel, mcVersions, modVersions, onNotify, currentUser }: SuggestionsFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    author: currentUser?.username || "",
    tags: ""
  });
  
  const [selectedCategory, setSelectedCategory] = useState<Suggestion['category']>('Feature');
  const [selectedPriority, setSelectedPriority] = useState<Suggestion['priority']>('Medium');
  const [selectedMcVersions, setSelectedMcVersions] = useState<string[]>([]);
  const [selectedModVersions, setSelectedModVersions] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const toggleMcVersion = (v: string) => {
    if (selectedMcVersions.includes(v)) {
      setSelectedMcVersions(prev => prev.filter(item => item !== v));
    } else {
      setSelectedMcVersions(prev => [...prev, v]);
    }
  };

  const toggleModVersion = (v: string) => {
    if (selectedModVersions.includes(v)) {
      setSelectedModVersions(prev => prev.filter(item => item !== v));
    } else {
      setSelectedModVersions(prev => [...prev, v]);
    }
  };

  const addLink = () => {
    if (!newLink) return;
    let url;
    try {
        url = new URL(newLink);
    } catch (_) {
        onNotify("Please enter a valid URL (e.g., https://...)", "error");
        return;
    }
    const isTrusted = TRUSTED_DOMAINS.some(domain => url.hostname.includes(domain));
    if (!isTrusted) {
        onNotify("Link not allowed. Only trusted domains (Pastebin, Imgur, YouTube, GitHub, etc.) are permitted.", "error");
        return;
    }
    if (links.includes(newLink)) {
        onNotify("Link already added.", "error");
        return;
    }
    setLinks([...links, newLink]);
    setNewLink("");
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const confirmSubmit = () => {
    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const newSuggestion: Suggestion = {
      id: crypto.randomUUID(),
      title: formData.title,
      description: formData.description,
      category: selectedCategory,
      priority: selectedPriority,
      status: 'Open',
      author: currentUser?.username || formData.author || 'Anonymous',
      timestamp: Date.now(),
      tags: tagsArray,
      links: links,
      comments: [],
      upvotes: 0,
      mcVersions: selectedMcVersions.length > 0 ? selectedMcVersions : undefined,
      modVersions: selectedModVersions.length > 0 ? selectedModVersions : undefined
    };
    onSubmit(newSuggestion);
    setShowConfirmModal(false);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto bg-[#1e1e1e] rounded-xl shadow-2xl border border-gray-800 p-6 md:p-8 mb-8">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-800">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="bg-[#00FFFF]/10 p-2 rounded-lg">
                        <Lightbulb className="text-[#00FFFF]" />
                    </div>
                    Submit Suggestion
                </h2>
                <span className="text-sm text-gray-500 hidden sm:block">Share your ideas!</span>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Suggestion Title <span className="text-red-400">*</span></label>
                    <input 
                        type="text" 
                        required 
                        className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF]/30 focus:border-[#00FFFF] outline-none transition-all" 
                        placeholder="e.g., Add new decorative blocks for medieval builds" 
                        value={formData.title} 
                        onChange={(e) => setFormData({...formData, title: e.target.value})} 
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Category <span className="text-red-400">*</span></label>
                        <div className="flex flex-wrap gap-2">
                            {(['Feature', 'Enhancement', 'Block', 'Item', 'Other'] as Suggestion['category'][]).map(cat => (
                                <button 
                                    type="button" 
                                    key={cat} 
                                    onClick={() => setSelectedCategory(cat)} 
                                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                                        selectedCategory === cat 
                                            ? 'bg-[#00fbff]/20 border-[#00fbff] text-[#00fbff]' 
                                            : 'bg-[#121212] border-gray-700 text-gray-400 hover:border-gray-500'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                        <div className="flex flex-wrap gap-2">
                            {(['Low', 'Medium', 'High'] as Suggestion['priority'][]).map(pri => (
                                <button 
                                    type="button" 
                                    key={pri} 
                                    onClick={() => setSelectedPriority(pri)} 
                                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                                        selectedPriority === pri 
                                            ? pri === 'High' 
                                                ? 'bg-red-900/10 border-red-500/30 text-red-300'
                                                : pri === 'Medium'
                                                ? 'bg-amber-900/10 border-amber-800/30 text-amber-400'
                                                : 'bg-green-600/20 border-green-500 text-green-400'
                                            : 'bg-[#121212] border-gray-700 text-gray-400 hover:border-gray-500'
                                    }`}
                                >
                                    {pri}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Minecraft Versions (Optional)</label>
                        <div className="flex flex-wrap gap-2">
                            {mcVersions.map(v => (
                                <button 
                                    type="button" 
                                    key={v} 
                                    onClick={() => toggleMcVersion(v)} 
                                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                                        selectedMcVersions.includes(v) 
                                            ? 'bg-[#00FFFF]/10 border-[#00FFFF]/30 text-[#00FFFF]' 
                                            : 'bg-[#121212] border-gray-700 text-gray-400 hover:border-gray-500'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Mod Versions (Optional)</label>
                        <div className="flex flex-wrap gap-2">
                            {modVersions.map(v => (
                                <button 
                                    type="button" 
                                    key={v} 
                                    onClick={() => toggleModVersion(v)} 
                                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                                        selectedModVersions.includes(v) 
                                            ? 'bg-[#00fbff]/10 border-[#00fbff]/30 text-[#00fbff]' 
                                            : 'bg-[#121212] border-gray-700 text-gray-400 hover:border-gray-500'
                                    }`}
                                >
                                    v{v}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name</label>
                    <input 
                        type="text" 
                        className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF]/30 focus:border-[#00FFFF] outline-none transition-all" 
                        placeholder="Your IGN or Discord username" 
                        value={formData.author} 
                        onChange={(e) => setFormData({...formData, author: e.target.value})} 
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Tags (Optional)</label>
                    <div className="relative">
                        <Tag className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
                        <input 
                            type="text" 
                            className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-9 pr-3 py-3 text-white focus:ring-2 focus:ring-[#00FFFF]/30 focus:border-[#00FFFF] outline-none transition-all" 
                            placeholder="e.g. decorative, blocks, building (comma separated)" 
                            value={formData.tags} 
                            onChange={(e) => setFormData({...formData, tags: e.target.value})} 
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">External Links (References, Examples, Mockups)</label>
                    <div className="flex gap-2 mb-2">
                        <input 
                            type="url" 
                            className="flex-1 bg-[#121212] border border-gray-700 rounded-lg p-2.5 text-white text-sm focus:border-[#00FFFF] outline-none transition-all" 
                            placeholder="https://imgur.com/..." 
                            value={newLink} 
                            onChange={(e) => setNewLink(e.target.value)} 
                        />
                        <button 
                            type="button" 
                            onClick={addLink} 
                            className="bg-gray-800 hover:bg-gray-700 text-white px-3 rounded-lg border border-gray-600"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">Supported: Pastebin, GitHub Gist, mclo.gs, Imgur, YouTube, Twitch, CurseForge, Modrinth.</p>
                    {links.length > 0 && (
                        <div className="space-y-2">
                            {links.map((link, index) => (
                                <div key={index} className="flex items-center justify-between bg-black/20 p-2 rounded border border-gray-800 animate-slideUp">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <LinkIcon size={14} className="text-gray-500 flex-shrink-0" />
                                        <span className="text-xs text-blue-400 truncate">{link}</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => removeLink(index)} 
                                        className="text-gray-500 hover:text-red-400"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Description <span className="text-red-400">*</span></label>
                    <textarea 
                        required 
                        rows={6} 
                        className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF]/30 focus:border-[#00FFFF] outline-none resize-none transition-all" 
                        placeholder="Describe your suggestion in detail. What would you like to see added or improved? How would it work? Why would it be useful?" 
                        value={formData.description} 
                        onChange={(e) => setFormData({...formData, description: e.target.value})} 
                    />
                </div>

                <div className="flex gap-4 pt-4 border-t border-gray-800">
                    <button 
                        type="submit" 
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 btn-shine"
                    >
                        <Sparkles size={18} />
                        Submit Suggestion
                    </button>
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="px-6 py-2.5 rounded-lg font-medium bg-transparent hover:bg-white/5 text-gray-400 hover:text-white transition-all border border-transparent hover:border-gray-700"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>

        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
              <h3 className="text-xl font-bold text-white mb-4">Confirm Submission</h3>
              <p className="text-gray-400 mb-6">Are you sure you want to submit this suggestion? Please ensure all details are correct.</p>
              <div className="flex gap-3 justify-end">
                <button 
                    onClick={() => setShowConfirmModal(false)} 
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors flex items-center gap-2"
                >
                    <X size={16} /> Cancel
                </button>
                <button 
                    onClick={confirmSubmit} 
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center gap-2 font-medium shadow-lg btn-shine"
                >
                    <Check size={16} /> Confirm
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

