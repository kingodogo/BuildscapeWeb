import React, { useState } from "react";
import { createPortal } from "react-dom";
import { BugReport, AIAnalysisResult, User } from "../types";
import { analyzeBugReport } from "../services/geminiService";
import { AlertTriangle, BrainCircuit, Sparkles, FileText, ArrowRightCircle, X, Check, Tag, Plus, Link as LinkIcon, Trash2 } from "lucide-react";

interface BugFormProps {
  onSubmit: (report: BugReport) => void;
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

export default function BugForm({ onSubmit, onCancel, mcVersions, modVersions, onNotify, currentUser }: BugFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    steps: "",
    expected: "",
    actual: "",
    author: currentUser?.username || "",
    tags: ""
  });
  
  const [selectedMcVersions, setSelectedMcVersions] = useState<string[]>([mcVersions[0] || "1.20.1"]);
  const [selectedModVersions, setSelectedModVersions] = useState<string[]>([modVersions[0] || "1.4.2"]);
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [hasEverAnalyzed, setHasEverAnalyzed] = useState(false);

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

  // Auto-run analysis when basic info is filled? 
  // User asked for "auto run when user submit", so let's focus on making that seamless.

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMcVersions.length === 0 || selectedModVersions.length === 0) {
      onNotify("Please select at least one Minecraft version and one Mod version.", "error");
      return;
    }

    // If no analysis yet, run it now
    if (!aiResult) {
        setAnalyzing(true);
        try {
            const result = await analyzeBugReport(
                formData.title, 
                formData.description, 
                formData.steps, 
                selectedMcVersions,
                formData.expected,
                formData.actual
            );
            setAiResult(result);
            setHasEverAnalyzed(true);
        } catch (error: any) {
            console.error("Analysis failed", error);
            onNotify(error.message || "AI analysis failed, but you can still submit.", "error");
        } finally {
            setAnalyzing(false);
        }
    }
    setShowConfirmModal(true);
  };

  const confirmSubmit = () => {
    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const newReport: BugReport = {
      id: crypto.randomUUID(),
      title: formData.title,
      description: formData.description,
      stepsToReproduce: formData.steps,
      expectedBehavior: formData.expected,
      actualBehavior: formData.actual,
      versions: selectedModVersions,
      mcVersions: selectedMcVersions,
      author: currentUser?.username || formData.author || 'Anonymous',
      severity: aiResult ? aiResult.severityAssessment : 'Medium',
      status: 'Open',
      timestamp: Date.now(),
      aiAnalysis: aiResult || undefined,
      tags: tagsArray,
      links: links,
      comments: []
    };
    onSubmit(newReport);
    setShowConfirmModal(false);
  };

  const handleAnalyze = async () => {
    if (!formData.title || formData.title.length < 5 || !formData.description || formData.description.length < 10) {
      onNotify("Please provide a title and detailed description (at least 10 chars) before running AI analysis.", "error");
      return;
    }
    setAnalyzing(true);
    try {
        const result = await analyzeBugReport(
            formData.title, 
            formData.description, 
            formData.steps, 
            selectedMcVersions,
            formData.expected,
            formData.actual
        );
        setAiResult(result);
        setHasEverAnalyzed(true);
        onNotify("AI Analysis complete!", "success");
    } catch (error: any) {
        onNotify(error.message || "AI service connection refused. Please try again.", "error");
    } finally {
        setAnalyzing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto bg-[#1e1e1e] rounded-xl shadow-2xl border border-gray-800 p-6 md:p-8 mb-8">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-800">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="bg-yellow-500/10 p-2 rounded-lg">
                        <AlertTriangle className="text-yellow-500" />
                    </div>
                    Submit Bug Report
                </h2>
                <span className="text-sm text-gray-500 hidden sm:block">Help us squash bugs!</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Issue Title <span className="text-red-400">*</span></label>
                        <input type="text" required disabled={analyzing} className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF] outline-none disabled:opacity-50" placeholder="e.g., Game crashes when breaking Icicle" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Minecraft Versions <span className="text-red-400">*</span></label>
                            <div className="flex flex-wrap gap-2">
                                {mcVersions.map(v => (
                                    <button type="button" key={v} disabled={analyzing} onClick={() => toggleMcVersion(v)} className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${selectedMcVersions.includes(v) ? 'bg-[#00FFFF]/20 border-[#00FFFF] text-[#00FFFF]' : 'bg-[#121212] border-gray-700 text-gray-400 hover:border-gray-500'} disabled:opacity-50`}>{v}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Mod Versions <span className="text-red-400">*</span></label>
                            <div className="flex flex-wrap gap-2">
                                {modVersions.map(v => (
                                    <button type="button" key={v} disabled={analyzing} onClick={() => toggleModVersion(v)} className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${selectedModVersions.includes(v) ? 'bg-[#00fbff]/20 border-[#00fbff] text-[#00fbff]' : 'bg-[#121212] border-gray-700 text-gray-400 hover:border-gray-500'} disabled:opacity-50`}>v{v}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Reporter Name</label>
                        <input type="text" disabled={analyzing} className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF] outline-none disabled:opacity-50" placeholder="Your IGN or Discord username" value={formData.author} onChange={(e) => setFormData({...formData, author: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Tags (Optional)</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-3 text-gray-500 w-4 h-4" />
                            <input type="text" disabled={analyzing} className="w-full bg-[#121212] border border-gray-700 rounded-lg pl-9 pr-3 py-3 text-white focus:ring-2 focus:ring-[#00FFFF] outline-none disabled:opacity-50" placeholder="e.g. textures, crash, mod-compat (comma separated)" value={formData.tags} onChange={(e) => setFormData({...formData, tags: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">External Links (Logs, Screenshots, Videos)</label>
                        <div className="flex gap-2 mb-2">
                            <input type="url" disabled={analyzing} className="flex-1 bg-[#121212] border border-gray-700 rounded-lg p-2.5 text-white text-sm focus:border-[#00FFFF] outline-none disabled:opacity-50" placeholder="https://pastebin.com/..." value={newLink} onChange={(e) => setNewLink(e.target.value)} />
                            <button type="button" disabled={analyzing} onClick={addLink} className="bg-gray-800 hover:bg-gray-700 text-white px-3 rounded-lg border border-gray-600 disabled:opacity-50"><Plus size={18} /></button>
                        </div>
                        <p className="text-[10px] text-gray-500 mb-3">Supported: Pastebin, GitHub Gist, mclo.gs, Imgur, YouTube, Twitch, CurseForge, Modrinth.</p>
                        {links.length > 0 && (
                            <div className="space-y-2">
                                {links.map((link, index) => (
                                    <div key={index} className="flex items-center justify-between bg-black/20 p-2 rounded border border-gray-800 animate-slideUp">
                                        <div className="flex items-center gap-2 overflow-hidden"><LinkIcon size={14} className="text-gray-500 flex-shrink-0" /><span className="text-xs text-blue-400 truncate">{link}</span></div>
                                        <button type="button" onClick={() => removeLink(index)} className="text-gray-500 hover:text-red-400"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Description <span className="text-red-400">*</span></label>
                        <textarea required rows={4} disabled={analyzing} className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF] outline-none resize-none disabled:opacity-50" placeholder="Please describe what happened in detail..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Steps to Reproduce</label>
                        <textarea rows={4} disabled={analyzing} className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF] outline-none resize-none font-mono text-sm disabled:opacity-50" placeholder={`1. Open inventory\n2. Select item...\n3. Place block...`} value={formData.steps} onChange={(e) => setFormData({...formData, steps: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Expected Behavior</label>
                            <textarea rows={3} disabled={analyzing} className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF] outline-none resize-none text-sm disabled:opacity-50" placeholder="What should have happened?" value={formData.expected} onChange={(e) => setFormData({...formData, expected: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Actual Behavior</label>
                            <textarea rows={3} disabled={analyzing} className="w-full bg-[#121212] border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-[#00FFFF] outline-none resize-none text-sm disabled:opacity-50" placeholder="What actually happened?" value={formData.actual} onChange={(e) => setFormData({...formData, actual: e.target.value})} />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-gray-800">
                        <button type="submit" disabled={analyzing} className="px-6 py-2.5 rounded-lg font-medium bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 btn-shine">
                            {analyzing && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
                            {analyzing ? 'Analyzing...' : 'Submit Report'}
                        </button>
                        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-lg font-medium bg-transparent hover:bg-white/5 text-gray-400 hover:text-white transition-all border border-transparent hover:border-gray-700">Cancel</button>
                    </div>
                </form>

                <div className="space-y-6">
                    <div className="bg-[#161616] p-6 rounded-xl border border-gray-700/50 shadow-inner">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2"><BrainCircuit className="text-purple-400" /> Report Analysis</h3>
                            <button type="button" onClick={handleAnalyze} disabled={analyzing} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 text-xs font-semibold px-3 py-1.5 rounded-md transition-all hover:shadow-md disabled:opacity-50">{analyzing ? 'Analyzing...' : 'Analyze Report'}</button>
                        </div>
                        {!aiResult && !analyzing && (
                            <div className="text-gray-500 text-sm text-center py-10 px-4 border-2 border-dashed border-gray-800 rounded-lg">
                                <Sparkles className="mx-auto mb-3 opacity-30 w-10 h-10" />
                                <p className="mb-2 font-medium text-gray-400">Automated Quality Check</p>
                                <p className="text-xs opacity-70">Your report will be automatically analyzed when you click Submit, or check it manually now.</p>
                            </div>
                        )}
                        {analyzing && <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00FFFF] mb-3"></div><p className="text-gray-400 text-sm font-medium animate-pulse">Analyzing report...</p></div>}
                        {aiResult && !analyzing && (
                            <div className="space-y-4 fade-in">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <div className={`text-sm font-bold px-3 py-1.5 rounded-md border shadow-sm ${aiResult.qualityScore >= 8 ? 'text-green-400 border-green-500/30 bg-green-500/10' : aiResult.qualityScore >= 5 ? 'text-yellow-400 border-yellow-800 bg-yellow-900/20' : 'text-red-400 border-red-800 bg-red-900/20'}`}>Quality Score: {aiResult.qualityScore}/10</div>
                                    <div className="text-sm font-bold px-3 py-1.5 rounded-md bg-gray-800 text-gray-200 border border-gray-700 shadow-sm">Severity: {aiResult.severityAssessment}</div>
                                </div>
                                <div className="bg-[#1f1f1f] p-4 rounded-lg border border-gray-700"><span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1.5">Analysis Summary</span><p className="text-gray-300 text-sm leading-relaxed">{aiResult.summary}</p></div>
                                <div><span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-2">Suggestions</span><ul className="space-y-2.5">{aiResult.suggestions.map((s, i) => (<li key={i} className="flex items-start gap-2 text-xs text-gray-400"><ArrowRightCircle size={14} className="flex-shrink-0 text-blue-500 mt-0.5" /><span>{s}</span></li>))}</ul></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {showConfirmModal && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
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
                setShowConfirmModal(false);
              }
            }}
          >
            <div 
              className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn"
              onClick={(e) => e.stopPropagation()}
              style={{ margin: 'auto' }}
            >
              <h3 className="text-xl font-bold text-white mb-4">Confirm Submission</h3>
              <p className="text-gray-400 mb-6">Are you sure you want to submit this bug report? Please ensure all details are correct.</p>
              {aiResult && aiResult.qualityScore < 5 && (<div className="bg-yellow-900/20 border border-yellow-800 text-yellow-300 p-3 rounded mb-6 text-sm flex gap-2 items-start"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><p>The Report Quality Score is low ({aiResult.qualityScore}/10). You might want to add more details.</p></div>)}
              <div className="flex gap-3 justify-end"><button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors flex items-center gap-2"><X size={16} /> Cancel</button><button onClick={confirmSubmit} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center gap-2 font-medium shadow-lg btn-shine"><Check size={16} /> Confirm</button></div>
            </div>
          </div>
        , document.body)}
    </div>
  );
}