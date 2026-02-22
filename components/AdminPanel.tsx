import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { BugReport, User, AppConfig, UserRole, AppConfigLinks, AppConfigHero, DatabaseConfig, Suggestion, SocialHandles, IconConfig, Role, ChangelogEntry, KofiTier, KofiRewardItem, ManualReward, RedeemCode, WikiFeature } from "../types";
import { AuthService } from "../services/auth";
import { StorageService } from "../services/storage";
import { Users, Bug as BugIcon, Settings, Trash2, Edit, Save, Plus, X, ShieldCheck, RefreshCw, UserCheck, Lock, ChevronDown, Link as LinkIcon, Type, LogOut, CheckSquare, Square, Filter, ArrowUpDown, UserPlus, CheckCircle, AlertOctagon, Database, Upload, Download, Server, Cloud, CloudOff, RotateCcw, Lightbulb, Ban, Eye, Calendar, Maximize2, Minimize2, Crop, FileText, Bold, Italic, List, Heading1, Heading2, Heading3, Code, Image as ImageIcon, Share2, EyeOff, Globe, AlertCircle, Coffee, Crown, Gift, Gamepad2, GripVertical, ArrowUp, ArrowDown, BookOpen, Sparkles, Clock, History, Search } from "lucide-react";
import { CurseForgeService, CurseForgeError } from "../services/curseforge";
import { sanitizeHTMLPermissive } from "../utils/sanitize";
import BugDetailModal from "./BugDetailModal";

interface AdminPanelProps {
  currentUser: User;
  onLogout: () => void;
  reports: BugReport[];
  suggestions: Suggestion[];
  onUpdateReport: (r: BugReport) => void;
  onDeleteReport: (id: string) => void;
  onUpdateSuggestion: (s: Suggestion) => void;
  onDeleteSuggestion: (id: string) => void;
  config: AppConfig;
  onUpdateConfig: (c: AppConfig) => void;
  onRestoreData: (reports: BugReport[], suggestions: Suggestion[], config: AppConfig) => void;
  initialChangelogToEdit?: ChangelogEntry | null;
  onChangelogEditComplete?: () => void;
}

/**
 * Admin interface for managing bug reports, suggestions, users, site configuration, changelogs, Ko-fi tiers/rewards, redeem codes, wiki features, and database backup/restore workflows.
 *
 * @param currentUser - The authenticated user viewing the panel (used for role-based access and actions)
 * @param onLogout - Callback invoked when the user signs out
 * @param reports - List of bug reports displayed and managed in the panel
 * @param suggestions - List of suggestions displayed and managed in the panel
 * @param onUpdateReport - Callback to persist an updated BugReport
 * @param onDeleteReport - Callback to delete a BugReport by id
 * @param onUpdateSuggestion - Callback to persist an updated Suggestion
 * @param onDeleteSuggestion - Callback to delete a Suggestion by id
 * @param config - Current application configuration (hero, links, social handles, changelogs, kofi tiers, icons, etc.)
 * @param onUpdateConfig - Callback invoked with an updated AppConfig to persist configuration changes
 * @param onRestoreData - Callback invoked with restored reports, suggestions, and config when importing a backup
 * @param initialChangelogToEdit - Optional changelog entry to open immediately in the editor on mount
 * @param onChangelogEditComplete - Optional callback invoked after the initial changelog edit modal is opened
 * @returns The AdminPanel React element
 */
export default function AdminPanel({ currentUser, onLogout, reports, suggestions, onUpdateReport, onDeleteReport, onUpdateSuggestion, onDeleteSuggestion, config, onUpdateConfig, onRestoreData, initialChangelogToEdit, onChangelogEditComplete }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'bugs' | 'suggestions' | 'users' | 'config' | 'database' | 'changelogs' | 'kofi' | 'redeem-rewards' | 'wiki'>('bugs');

  const [bugSubTab, setBugSubTab] = useState<'active' | 'resolved'>('active');
  const [editingBug, setEditingBug] = useState<BugReport | null>(null);
  const [editStatus, setEditStatus] = useState<BugReport['status']>('Open');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('');
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ mcVersion: 'All', modVersion: 'All', severity: 'All', assigned: 'All' });
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'severity'>('newest');
  const [bulkAssignUser, setBulkAssignUser] = useState("");

  const [suggestionSubTab, setSuggestionSubTab] = useState<'active' | 'closed'>('active');

  const [userSubTab, setUserSubTab] = useState<'staff' | 'users' | 'roles'>('staff');
  const [roles, setRoles] = useState<Role[]>(config.roles || []);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
  const [editSuggestionStatus, setEditSuggestionStatus] = useState<Suggestion['status']>('Open');
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [suggestionSearchTerm, setSuggestionSearchTerm] = useState("");
  const [suggestionFilters, setSuggestionFilters] = useState({ mcVersion: 'All', modVersion: 'All', category: 'All', priority: 'All' });
  const [suggestionSortBy, setSuggestionSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingSuggestion, setRejectingSuggestion] = useState<Suggestion | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);

  const [configTab, setConfigTab] = useState<'home' | 'navbar' | 'links' | 'footer'>('home');

  const [users, setUsers] = useState<User[]>([]);
  const [refreshingUsers, setRefreshingUsers] = useState(false);

  const [configMcVer, setConfigMcVer] = useState("");
  const [configModVer, setConfigModVer] = useState("");

  const [heroConfig, setHeroConfig] = useState<AppConfigHero>(config.hero || { 
      headline: "", subheadline: "", description: "", latestModVersion: "", latestMcVersions: "", headlineColor: "", headlineGlowColor: "" 
  });
  const [linkConfig, setLinkConfig] = useState<AppConfigLinks>(config.links || { 
      curseforge: "", modrinth: "", discord: "", source: "", kofi: "" 
  });
  const [socialHandlesConfig, setSocialHandlesConfig] = useState<SocialHandles>(config.socialHandles || {
      author: 'DGA',
      leadDev: 'kingodogo',
      authorLinks: {},
      leadDevLinks: {}
  });
  
  // Track order of links for drag-and-drop
  const [authorLinksOrder, setAuthorLinksOrder] = useState<string[]>(() => {
    const links = config.socialHandles?.authorLinks || {};
    return Object.keys(links);
  });
  const [leadDevLinksOrder, setLeadDevLinksOrder] = useState<string[]>(() => {
    const links = config.socialHandles?.leadDevLinks || {};
    return Object.keys(links);
  });
  
  // Drag state
  const [draggedLink, setDraggedLink] = useState<{person: 'author' | 'leadDev', key: string} | null>(null);
  
  // Add link state
  const [showAddLinkInput, setShowAddLinkInput] = useState<{person: 'author' | 'leadDev' | null, url: string}>({person: null, url: ''});
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(config.database || { type: 'local', endpoint: '', apiKey: '' });

  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>(config.changelogs || []);
  const [editingChangelog, setEditingChangelog] = useState<ChangelogEntry | null>(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const changelogTextareaRef = useRef<HTMLTextAreaElement>(null);
  const jarDropdownRef = useRef<HTMLDivElement>(null);
  const [showBugAutocomplete, setShowBugAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
  const [newChangelog, setNewChangelog] = useState<Partial<ChangelogEntry>>({
    title: '',
    type: 'release',
    modVersion: '',
    fileName: '',
    mcVersions: [],
    changelog: '',
    changelogType: 'markdown',
    fileDate: new Date().toISOString().split('T')[0],
    downloadUrl: '',
    isLatest: false,
    linkedBugReports: [],
    visibility: 'private'
  });
  const [allowPatch, setAllowPatch] = useState(false);
  const [curseforgeProjectSlug, setCurseforgeProjectSlug] = useState<string>(config.curseforgeProjectSlug || '');
  const [autoSyncCurseForge, setAutoSyncCurseForge] = useState<boolean>(config.autoSyncCurseForge || false);
  const [curseforgeSyncInterval, setCurseforgeSyncInterval] = useState<number>(config.curseforgeSyncInterval || 0); // 0 = disabled, 6 = 6 hours, 12 = 12 hours
  const [isSyncingCurseForge, setIsSyncingCurseForge] = useState(false);
  const [navbarIconConfig, setNavbarIconConfig] = useState<IconConfig>(config.navbarIcon || {
    size: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    backgroundOpacity: 1,
    padding: 0,
    borderColor: 'transparent',
    borderWidth: 0
  });
  const [footerIconConfig, setFooterIconConfig] = useState<IconConfig>(config.footerIcon || {
    size: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    backgroundOpacity: 1,
    padding: 0,
    borderColor: 'transparent',
    borderWidth: 0
  });

  const [navbarOriginalImage, setNavbarOriginalImage] = useState<string>('');
  const [footerOriginalImage, setFooterOriginalImage] = useState<string>('');


  const [navbarPreviewZoom, setNavbarPreviewZoom] = useState(1);
  const [footerPreviewZoom, setFooterPreviewZoom] = useState(1);

  const [navbarDragActive, setNavbarDragActive] = useState(false);
  const [footerDragActive, setFooterDragActive] = useState(false);

  useEffect(() => {
    if (initialChangelogToEdit) {
      setActiveTab('changelogs');
      setTimeout(() => {
        setEditingChangelog(initialChangelogToEdit);
        setNewChangelog({ ...initialChangelogToEdit, visibility: initialChangelogToEdit.visibility || 'private' });
        setAllowPatch((initialChangelogToEdit.linkedBugReports || []).length > 0);
        setShowChangelogModal(true);
        if (onChangelogEditComplete) {
          onChangelogEditComplete();
        }
      }, 100);
    }
  }, [initialChangelogToEdit]);

  // State for jar file dropdown
  const [matchingJarFiles, setMatchingJarFiles] = useState<Array<{fileName: string, displayName: string, downloadUrl: string, gameVersions: string[], fileId: number}>>([]);
  const [showJarDropdown, setShowJarDropdown] = useState(false);

  // Auto-fetch jar files when mod version is entered manually
  useEffect(() => {
    const fetchMatchingJars = async () => {
      if (
        newChangelog.modVersion &&
        !newChangelog.fileName && // Only if jar name is not already set
        (config.curseforgeProjectSlug || config.links?.curseforge) &&
        showChangelogModal
      ) {
        const timeoutId = setTimeout(async () => {
          try {
            const projectSlug = config.curseforgeProjectSlug || CurseForgeService.extractProjectId(config.links?.curseforge || '');
            if (!projectSlug) return;

            const files = await CurseForgeService.getProjectFiles(projectSlug, config);
            if (!files || files.length === 0) return;

            const modVersion = newChangelog.modVersion.replace(/^v/i, '');
            
            // Find all files matching the mod version
            const matchingFiles = files.filter(file => {
              if (!file.isAvailable) return false;
              
              const fileName = file.fileName || file.displayName || '';
              const extractedVersion = CurseForgeService.extractModVersionFromFileName(fileName);

              return extractedVersion === modVersion ||
                fileName.toLowerCase().includes(modVersion.toLowerCase()) ||
                fileName.toLowerCase().includes(`v${modVersion}`.toLowerCase());
            });

            if (matchingFiles.length === 1) {
              // Auto-fill if only one match
              const file = matchingFiles[0];
              const projectSlugForUrl = config.curseforgeProjectSlug || 
                                       CurseForgeService.extractProjectSlug(config.links?.curseforge || '') ||
                                       projectSlug;
              
              let finalSlug = projectSlugForUrl;
              if (/^\d+$/.test(projectSlugForUrl)) {
                try {
                  const projectInfo = await CurseForgeService.getProjectInfo(projectSlugForUrl, config);
                  if (projectInfo && projectInfo.slug) {
                    finalSlug = projectInfo.slug;
                  }
                } catch (e) {
                  finalSlug = projectSlugForUrl;
                }
              }
              
              const downloadUrl = file.id ? CurseForgeService.buildDownloadUrl(finalSlug, file.id) : '';
              setNewChangelog(prev => ({ 
                ...prev, 
                fileName: file.fileName || file.displayName,
                downloadUrl: downloadUrl
              }));
              setMatchingJarFiles([]);
              setShowJarDropdown(false);
            } else if (matchingFiles.length > 1) {
              // Show dropdown if multiple matches
              const projectSlugForUrl = config.curseforgeProjectSlug || 
                                       CurseForgeService.extractProjectSlug(config.links?.curseforge || '') ||
                                       projectSlug;
              
              let finalSlug = projectSlugForUrl;
              if (/^\d+$/.test(projectSlugForUrl)) {
                try {
                  const projectInfo = await CurseForgeService.getProjectInfo(projectSlugForUrl, config);
                  if (projectInfo && projectInfo.slug) {
                    finalSlug = projectInfo.slug;
                  }
                } catch (e) {
                  finalSlug = projectSlugForUrl;
                }
              }
              
              setMatchingJarFiles(matchingFiles.map(f => ({
                fileName: f.fileName || f.displayName,
                displayName: f.displayName || f.fileName,
                downloadUrl: f.id ? CurseForgeService.buildDownloadUrl(finalSlug, f.id) : '',
                gameVersions: f.gameVersions || [],
                fileId: f.id
              })));
              setShowJarDropdown(true);
            } else {
              setMatchingJarFiles([]);
              setShowJarDropdown(false);
            }
          } catch (error) {
            console.log('Auto-fetch jar files failed:', error);
            setMatchingJarFiles([]);
            setShowJarDropdown(false);
          }
        }, 800); // 800ms delay

        return () => clearTimeout(timeoutId);
      } else {
        setMatchingJarFiles([]);
        setShowJarDropdown(false);
      }
    };

    fetchMatchingJars();
  }, [newChangelog.modVersion, config.curseforgeProjectSlug, config.links?.curseforge, showChangelogModal]);

  // Auto-fetch download URL when jar name and Minecraft versions are set
  useEffect(() => {
    const autoFetchDownloadUrl = async () => {
      // Only auto-fetch if:
      // 1. Jar name (fileName) is set
      // 2. Minecraft versions are selected
      // 3. Not currently fetching
      // 4. CurseForge is configured
      if (
        newChangelog.fileName &&
        newChangelog.mcVersions &&
        newChangelog.mcVersions.length > 0 &&
        !fetchingDownloadUrl &&
        (config.curseforgeProjectSlug || config.links?.curseforge) &&
        showChangelogModal
      ) {
        // Small delay to avoid fetching on every keystroke
        const timeoutId = setTimeout(async () => {
          try {
            setFetchingDownloadUrl(true);
            const projectSlug = config.curseforgeProjectSlug || CurseForgeService.extractProjectId(config.links?.curseforge || '');
            if (!projectSlug) return;

            const files = await CurseForgeService.getProjectFiles(projectSlug, config);
            if (!files || files.length === 0) return;

            const fileName = newChangelog.fileName;
            const mcVersions = newChangelog.mcVersions || [];

            // Find file matching jar name and Minecraft versions
            let matchingFile = files.find(file => {
              const fileFileName = file.fileName || file.displayName || '';
              
              // Check if file name matches (exact or partial)
              const nameMatches = fileFileName === fileName || 
                                 fileFileName.toLowerCase().includes(fileName.toLowerCase()) ||
                                 fileName.toLowerCase().includes(fileFileName.toLowerCase());
              
              if (!nameMatches) return false;

              // Check if any Minecraft version matches
              const fileMcVersions = file.gameVersions || [];
              const hasMatchingMcVersion = mcVersions.some(mcVer =>
                fileMcVersions.some(fileMcVer => {
                  const fileMcVerStr = typeof fileMcVer === 'string' ? fileMcVer : String(fileMcVer);
                  return fileMcVerStr.includes(mcVer) || mcVer.includes(fileMcVerStr);
                })
              );

              return hasMatchingMcVersion && file.isAvailable;
            });

            // If no exact match with MC version, try by jar name only
            if (!matchingFile) {
              matchingFile = files.find(file => {
                const fileFileName = file.fileName || file.displayName || '';
                return (fileFileName === fileName || 
                       fileFileName.toLowerCase().includes(fileName.toLowerCase()) ||
                       fileName.toLowerCase().includes(fileFileName.toLowerCase())) && 
                       file.isAvailable;
              });
            }

            if (matchingFile && matchingFile.id) {
              // Build CurseForge download URL using file ID
              let projectSlugForUrl = config.curseforgeProjectSlug || 
                                     CurseForgeService.extractProjectSlug(config.links?.curseforge || '');
              
              // If we don't have a slug, try to extract from projectSlug
              if (!projectSlugForUrl) {
                projectSlugForUrl = CurseForgeService.extractProjectSlug(projectSlug) || projectSlug;
              }
              
              // If projectSlug is numeric, try to get the actual slug
              let finalSlug = projectSlugForUrl;
              if (projectSlugForUrl && /^\d+$/.test(projectSlugForUrl)) {
                // Try to get slug from project info
                try {
                  const projectInfo = await CurseForgeService.getProjectInfo(projectSlugForUrl, config);
                  if (projectInfo && projectInfo.slug) {
                    finalSlug = projectInfo.slug;
                  } else {
                    // If we can't get slug, use the numeric ID directly in the URL
                    finalSlug = projectSlugForUrl;
                  }
                } catch (e) {
                  // If we can't get slug, use the numeric ID directly
                  finalSlug = projectSlugForUrl;
                }
              }
              
              if (finalSlug) {
                const downloadUrl = CurseForgeService.buildDownloadUrl(finalSlug, matchingFile.id);
                setNewChangelog(prev => ({ ...prev, downloadUrl: downloadUrl }));
              }
            }
          } catch (error) {
            // Silently fail for auto-fetch - user can manually fetch if needed
            console.log('Auto-fetch download URL failed:', error);
          } finally {
            setFetchingDownloadUrl(false);
          }
        }, 500); // 500ms delay

        return () => clearTimeout(timeoutId);
      }
    };

    autoFetchDownloadUrl();
  }, [newChangelog.fileName, newChangelog.mcVersions, config.curseforgeProjectSlug, config.links?.curseforge, showChangelogModal]);

  // Close jar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jarDropdownRef.current && !jarDropdownRef.current.contains(event.target as Node)) {
        setShowJarDropdown(false);
      }
    };

    if (showJarDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showJarDropdown]);

  const [navbarUploadProgress, setNavbarUploadProgress] = useState(0);
  const [navbarIsUploading, setNavbarIsUploading] = useState(false);
  const [footerUploadProgress, setFooterUploadProgress] = useState(0);

  // Ko-fi Management State
  const [kofiSubTab, setKofiSubTab] = useState<'tiers' | 'subscribers' | 'manual-rewards'>('tiers');
  const [kofiTiers, setKofiTiers] = useState<KofiTier[]>(config.kofiTiers || []);
  const [editingTier, setEditingTier] = useState<KofiTier | null>(null);
  const [editingTierForm, setEditingTierForm] = useState<Partial<KofiTier>>({
    name: '',
    koFiTierName: '',
    description: '',
    rewards: [],
    durationType: 'subscription',
    priority: 0,
    enabled: true
  });
  const [editingReward, setEditingReward] = useState<KofiRewardItem | null>(null);
  const [manualRewards, setManualRewards] = useState<ManualReward[]>([]);
  const [showTierModal, setShowTierModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [subscribedUsers, setSubscribedUsers] = useState<User[]>([]);
  const [loadingKofiUsers, setLoadingKofiUsers] = useState(false);
  const [selectedRewardUser, setSelectedRewardUser] = useState<string>('');
  const [rewardUserSearch, setRewardUserSearch] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [manualRewardReason, setManualRewardReason] = useState('');
  const [manualRewardItems, setManualRewardItems] = useState<KofiRewardItem[]>([]);

  // Redeem codes state
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [loadingRedeemCodes, setLoadingRedeemCodes] = useState(false);
  const [redeemCodeSubTab, setRedeemCodeSubTab] = useState<'active' | 'expired' | 'claims'>('active');
  const [editingRedeemCode, setEditingRedeemCode] = useState<RedeemCode | null>(null);
  const [codeRedemptions, setCodeRedemptions] = useState<any[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [redemptionSortBy, setRedemptionSortBy] = useState<'newest' | 'oldest' | 'code' | 'user'>('newest');
  const [redemptionDateFilter, setRedemptionDateFilter] = useState<{ start?: string; end?: string }>({});
  const [selectedCodeFilter, setSelectedCodeFilter] = useState<string>('all');
  const [codeSortBy, setCodeSortBy] = useState<'newest' | 'oldest' | 'code' | 'uses'>('newest');
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const [newRedeemCode, setNewRedeemCode] = useState<Partial<RedeemCode>>({
    code: '',
    description: '',
    rewards: [],
    maxUses: undefined,
    expiresAt: undefined,
    requiresMembership: undefined,
    enabled: true
  });

  // Wiki state
  const [wikiFeatures, setWikiFeatures] = useState<WikiFeature[]>([]);
  const [loadingWikiFeatures, setLoadingWikiFeatures] = useState(false);
  const [editingWikiFeature, setEditingWikiFeature] = useState<WikiFeature | null>(null);
  const [showWikiModal, setShowWikiModal] = useState(false);
  const [newWikiFeature, setNewWikiFeature] = useState<Partial<WikiFeature>>({
    title: '',
    mcVersions: [],
    modVersions: [],
    categories: [],
    subcategories: [],
    description: '',
    descriptionType: 'text',
    media: '',
    details: []
  });
  const [newDetail, setNewDetail] = useState('');
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReviewBackup, setAiReviewBackup] = useState<{title?: string; description?: string; details?: string[]} | null>(null);
  // Wiki filtering state
  const [wikiSearchTerm, setWikiSearchTerm] = useState('');
  const [wikiCategoryFilter, setWikiCategoryFilter] = useState<string>('all');
  const [wikiSubcategoryFilter, setWikiSubcategoryFilter] = useState<string>('all');
  const [wikiMcVersionFilter, setWikiMcVersionFilter] = useState<string>('all');
  const [wikiModVersionFilter, setWikiModVersionFilter] = useState<string>('all');
  const [wikiSortBy, setWikiSortBy] = useState<'newest' | 'oldest' | 'title' | 'category'>('newest');
  const [mcVersionPage, setMcVersionPage] = useState(0);
  const [modVersionPage, setModVersionPage] = useState(0);
  const [subcategoryPage, setSubcategoryPage] = useState(0);
  const wikiDescriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showImportTiersModal, setShowImportTiersModal] = useState(false);
  const [importTierNames, setImportTierNames] = useState('');
  const [footerIsUploading, setFooterIsUploading] = useState(false);
  const [fetchingVersion, setFetchingVersion] = useState(false);
  const [fetchingFileName, setFetchingFileName] = useState(false);
  const [fetchingDownloadUrl, setFetchingDownloadUrl] = useState(false);

  const [showNavbarCropEditor, setShowNavbarCropEditor] = useState(false);
  const [navbarCropScale, setNavbarCropScale] = useState(1);
  const [navbarCropPosition, setNavbarCropPosition] = useState({ x: 0, y: 0 });
  const navbarCanvasRef = useRef<HTMLCanvasElement>(null);
  const navbarImageRef = useRef<HTMLImageElement>(null);

  const [showFooterCropEditor, setShowFooterCropEditor] = useState(false);
  const [footerCropScale, setFooterCropScale] = useState(1);
  const [footerCropPosition, setFooterCropPosition] = useState({ x: 0, y: 0 });
  const footerCanvasRef = useRef<HTMLCanvasElement>(null);
  const footerImageRef = useRef<HTMLImageElement>(null);
  
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Memoize config values to prevent unnecessary re-renders
  const configHero = useMemo(() => config.hero, [config.hero]);
  const configLinks = useMemo(() => config.links, [config.links]);
  const configSocialHandles = useMemo(() => config.socialHandles, [config.socialHandles]);
  const configDatabase = useMemo(() => config.database, [config.database]);
  const configChangelogs = useMemo(() => config.changelogs, [config.changelogs]);
  const configKofiTiers = useMemo(() => config.kofiTiers, [config.kofiTiers]);

  // Use React.startTransition for non-urgent updates to prevent blocking
  useEffect(() => {
      // Use requestIdleCallback or setTimeout to batch updates
      const updateTimer = setTimeout(() => {
          if (configHero) setHeroConfig(configHero);
          if (configLinks) setLinkConfig({ curseforge: "", modrinth: "", discord: "", source: "", kofi: "", ...configLinks });
          if (configSocialHandles) {
              setSocialHandlesConfig(configSocialHandles);
              // Update order arrays
              if (configSocialHandles.authorLinks) {
                  setAuthorLinksOrder(Object.keys(configSocialHandles.authorLinks));
              }
              if (configSocialHandles.leadDevLinks) {
                  setLeadDevLinksOrder(Object.keys(configSocialHandles.leadDevLinks));
              }
          }
          setDbConfig(configDatabase || { type: 'local', endpoint: '', apiKey: '' });
          if (configChangelogs) setChangelogs(configChangelogs);
          if (configKofiTiers) setKofiTiers(configKofiTiers);
      }, 0);
      
      return () => clearTimeout(updateTimer);
  }, [configHero, configLinks, configSocialHandles, configDatabase, configChangelogs, configKofiTiers]);
  
  // Check DB status separately and debounced
  useEffect(() => {
      const timer = setTimeout(() => {
          checkDbStatus();
      }, 300);
      return () => clearTimeout(timer);
  }, [config]);

  const checkDbStatus = async () => {
      const isConnected = await StorageService.isCloudAvailable();
      setDbStatus(isConnected ? 'connected' : 'disconnected');
  };

  const loadUsers = async () => {
    setRefreshingUsers(true);
    try {
        const fetchedUsers = await AuthService.getAllUsers();
        setUsers(fetchedUsers);
    } catch (e: any) {
        console.error("Failed to load users", e);
        alert(`Failed to load users: ${e.message || 'Unknown error'}`);

        if (currentUser) {
          setUsers([currentUser]);
        }
    }
    setRefreshingUsers(false);
  };

  useEffect(() => { loadUsers(); }, [currentUser]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle click events on bug report references in changelog previews
  useEffect(() => {
    const handleBugReportClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const bugReportElement = target.closest('.bug-report-clickable');
      if (bugReportElement) {
        const bugId = bugReportElement.getAttribute('data-bug-id');
        if (bugId) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedBugId(bugId);
        }
      }
    };

    document.addEventListener('click', handleBugReportClick);
    return () => {
      document.removeEventListener('click', handleBugReportClick);
    };
  }, []);


  const handleRoleChange = async (userId: string, newRole: UserRole) => {
      if (newRole === 'owner' && !confirm("Warning: You are granting FULL SYSTEM ACCESS (Owner) to this user. Continue?")) return;
      try { 
          await AuthService.updateUserRole(userId, newRole); 
          loadUsers(); 
      } catch (e: any) { alert(e.message); }
  };

  const handleDeleteUser = async (id: string) => {
      if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
          try { await AuthService.deleteUser(id); loadUsers(); } catch (e: any) { alert(e.message); }
      }
  };

  const insertTextAtCursor = (before: string, after: string, newLine: boolean = false) => {
    const textarea = changelogTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    
    const prefix = newLine && start > 0 && text[start - 1] !== '\n' ? '\n' : '';
    const suffix = newLine && end < text.length && text[end] !== '\n' ? '\n' : '';
    
    const newText = text.substring(0, start) + prefix + before + selectedText + after + suffix + text.substring(end);
    const newCursorPos = start + prefix.length + before.length + selectedText.length + after.length + suffix.length;
    
    setNewChangelog({ ...newChangelog, changelog: newText });
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const processPatchReferences = (text: string): string => {
    return text.replace(/@([a-zA-Z0-9_-]+)/g, (match, patchId) => {
      const report = reports.find(r => r.id === patchId);
      if (!report) {
        return `<span class="text-gray-500 font-mono text-sm">@${patchId}</span>`;
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
      
      const escapeHtml = (str: string) => {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
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
          class="inline-block px-3 py-2 rounded-lg border cursor-pointer hover:opacity-90 transition-all bg-gray-800/50 border-gray-700 hover:border-blue-500 my-1 bug-report-clickable"
          data-bug-id="${patchId}"
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

  const renderChangelogPreview = (changelog: string, type: 'html' | 'markdown', maxLines: number = 4) => {
    if (type === 'html') {
      let processed = processPatchReferences(changelog);
      const lines = processed.split('\n').slice(0, maxLines);
      const truncated = lines.join('\n');
      const sanitized = sanitizeHTMLPermissive(truncated);
      return <div className="text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
    }
    
    const lines = changelog.split('\n');
    const previewLines = lines.slice(0, maxLines);
    const hasMore = lines.length > maxLines;
    
    return (
      <div className="text-sm text-gray-300 space-y-1">
        {previewLines.map((line, idx) => {
          if (line.startsWith('# ')) {
            const content = line.substring(2);
            let processedContent = processPatchReferences(content);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs">$1</code>');
            const sanitized = sanitizeHTMLPermissive(processedContent);
            return <h1 key={idx} className="text-lg font-bold text-white" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.startsWith('## ')) {
            const content = line.substring(3);
            let processedContent = processPatchReferences(content);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs">$1</code>');
            const sanitized = sanitizeHTMLPermissive(processedContent);
            return <h2 key={idx} className="text-base font-bold text-white" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.startsWith('### ')) {
            const content = line.substring(4);
            let processedContent = processPatchReferences(content);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs">$1</code>');
            const sanitized = sanitizeHTMLPermissive(processedContent);
            return <h3 key={idx} className="text-sm font-bold text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const contentWithoutMarkdown = line.replace(/^[-*]\s+/, '');
            let processedContent = processPatchReferences(contentWithoutMarkdown);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs">$1</code>');
            const sanitized = sanitizeHTMLPermissive(`• ${processedContent}`);
            return <div key={idx} className="ml-4 text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.trim() === '') {
            return <br key={idx} />;
          }
          let processedLine = processPatchReferences(line);
          processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
          processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs">$1</code>');
          processedLine = processedLine.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-green-400 hover:underline">$1</a>');
          const sanitized = sanitizeHTMLPermissive(processedLine);
          return <p key={idx} className="text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
        })}
        {hasMore && <span className="text-gray-500 text-xs">...</span>}
      </div>
    );
  };

  const renderMarkdownPreview = (markdown: string) => {
    let processed = markdown;
    processed = processPatchReferences(processed);
    const htmlTagRegex = /<[^>]+>/g;
    if (htmlTagRegex.test(processed)) {
      const sanitized = sanitizeHTMLPermissive(processed);
      return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
    }
    
    const lines = markdown.split('\n');
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          if (line.startsWith('# ')) {
            const content = line.substring(2);
            let processedContent = processPatchReferences(content);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
            const sanitized = sanitizeHTMLPermissive(processedContent);
            return <h1 key={idx} className="text-2xl font-bold text-white mt-4 mb-2" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.startsWith('## ')) {
            const content = line.substring(3);
            let processedContent = processPatchReferences(content);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
            const sanitized = sanitizeHTMLPermissive(processedContent);
            return <h2 key={idx} className="text-xl font-bold text-white mt-3 mb-2" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.startsWith('### ')) {
            const content = line.substring(4);
            let processedContent = processPatchReferences(content);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
            const sanitized = sanitizeHTMLPermissive(processedContent);
            return <h3 key={idx} className="text-lg font-bold text-gray-300 mt-2 mb-1" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const contentWithoutMarkdown = line.replace(/^[-*]\s+/, '');
            let processedContent = processPatchReferences(contentWithoutMarkdown);
            processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            processedContent = processedContent.replace(/\*(.+?)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
            const sanitized = sanitizeHTMLPermissive(processedContent);
            return <li key={idx} className="ml-4 text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
          }
          if (line.trim() === '') {
            return <br key={idx} />;
          }
          let processedLine = processPatchReferences(line);
          processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
          processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded">$1</code>');
          processedLine = processedLine.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-green-400 hover:underline">$1</a>');
          processedLine = processedLine.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded" />');
          const sanitized = sanitizeHTMLPermissive(processedLine);
          return <p key={idx} className="text-gray-300" dangerouslySetInnerHTML={{ __html: sanitized }} />;
        })}
      </div>
    );
  };

  const handleNavbarCropAndSave = () => {
      if (!navbarCanvasRef.current || !navbarImageRef.current || !navbarOriginalImage) return;
      
      const canvas = navbarCanvasRef.current;
      const img = navbarImageRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 128;
      canvas.height = 128;

      const container = img.parentElement;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const cropSize = Math.min(containerWidth, containerHeight) / navbarCropScale;
      const cropX = (containerWidth - cropSize) / 2 - navbarCropPosition.x;
      const cropY = (containerHeight - cropSize) / 2 - navbarCropPosition.y;

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const containerAspect = containerWidth / containerHeight;
      
      let displayedWidth, displayedHeight, offsetX, offsetY;
      
      if (imgAspect > containerAspect) {

          displayedHeight = containerHeight;
          displayedWidth = displayedHeight * imgAspect;
          offsetX = (containerWidth - displayedWidth) / 2;
          offsetY = 0;
      } else {

          displayedWidth = containerWidth;
          displayedHeight = displayedWidth / imgAspect;
          offsetX = 0;
          offsetY = (containerHeight - displayedHeight) / 2;
      }

      const sourceX = ((cropX - offsetX) / displayedWidth) * img.naturalWidth;
      const sourceY = ((cropY - offsetY) / displayedHeight) * img.naturalHeight;
      const sourceSize = (cropSize / displayedWidth) * img.naturalWidth;

      ctx.drawImage(
          img,
          Math.max(0, sourceX), Math.max(0, sourceY), 
          Math.min(sourceSize, img.naturalWidth - Math.max(0, sourceX)), 
          Math.min(sourceSize, img.naturalHeight - Math.max(0, sourceY)),
          0, 0, 128, 128
      );

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.75);
      setNavbarIconConfig({...navbarIconConfig, icon: croppedBase64});

      setShowNavbarCropEditor(false);
      setNavbarCropScale(1);
      setNavbarCropPosition({ x: 0, y: 0 });
  };

  const handleFooterCropAndSave = () => {
      if (!footerCanvasRef.current || !footerImageRef.current || !footerOriginalImage) return;
      
      const canvas = footerCanvasRef.current;
      const img = footerImageRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 128;
      canvas.height = 128;

      const container = img.parentElement;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const cropSize = Math.min(containerWidth, containerHeight) / footerCropScale;
      const cropX = (containerWidth - cropSize) / 2 - footerCropPosition.x;
      const cropY = (containerHeight - cropSize) / 2 - footerCropPosition.y;

      const imgAspect = img.naturalWidth / img.naturalHeight;
      const containerAspect = containerWidth / containerHeight;
      
      let displayedWidth, displayedHeight, offsetX, offsetY;
      
      if (imgAspect > containerAspect) {

          displayedHeight = containerHeight;
          displayedWidth = displayedHeight * imgAspect;
          offsetX = (containerWidth - displayedWidth) / 2;
          offsetY = 0;
      } else {

          displayedWidth = containerWidth;
          displayedHeight = displayedWidth / imgAspect;
          offsetX = 0;
          offsetY = (containerHeight - displayedHeight) / 2;
      }

      const sourceX = ((cropX - offsetX) / displayedWidth) * img.naturalWidth;
      const sourceY = ((cropY - offsetY) / displayedHeight) * img.naturalHeight;
      const sourceSize = (cropSize / displayedWidth) * img.naturalWidth;

      ctx.drawImage(
          img,
          Math.max(0, sourceX), Math.max(0, sourceY), 
          Math.min(sourceSize, img.naturalWidth - Math.max(0, sourceX)), 
          Math.min(sourceSize, img.naturalHeight - Math.max(0, sourceY)),
          0, 0, 128, 128
      );

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.75);
      setFooterIconConfig({...footerIconConfig, icon: croppedBase64});

      setShowFooterCropEditor(false);
      setFooterCropScale(1);
      setFooterCropPosition({ x: 0, y: 0 });
  };

  // Ko-fi Management Functions
  const saveKofiTiers = async (tiers: KofiTier[]) => {
      const updatedConfig = {
          ...config,
          kofiTiers: tiers
      };
      onUpdateConfig(updatedConfig);
  };

  const saveManualReward = async (reward: ManualReward) => {
      try {
          const data = await AuthService.fetchWithAuth('/api/kofi-rewards', {
              method: 'POST',
              body: JSON.stringify({ reward })
          });
      } catch (error: any) {
          console.error('Failed to save manual reward:', error);
          setToast({ msg: 'Failed to save manual reward', type: 'error' });
      }
  };

  const loadManualRewards = async () => {
      try {
          const data = await AuthService.fetchWithAuth('/api/kofi-rewards');
          setManualRewards(data.rewards || []);
      } catch (error: any) {
          console.error('Failed to load manual rewards:', error);
      }
  };

  // Load ALL admin data when component first mounts
  useEffect(() => {
      console.log('AdminPanel mounted - loading all initial data');
      // Always load redeem codes on mount (needed for all redeem-rewards tabs)
      loadRedeemCodes();
  }, []); // Empty dependency array = run only on mount

  // Load data when switching tabs or sub-tabs
  useEffect(() => {
      if (activeTab === 'kofi') {
          if (kofiSubTab === 'subscribers') {
              loadSubscribedUsers();
          } else if (kofiSubTab === 'manual-rewards') {
              loadManualRewards();
          }
      }
      
      if (activeTab === 'redeem-rewards') {
          // Reload redeem codes when switching to this tab
          loadRedeemCodes();
          if (redeemCodeSubTab === 'claims') {
              loadCodeRedemptions();
          }
      }
      
      if (activeTab === 'wiki') {
          loadWikiFeatures();
      }
  }, [activeTab, kofiSubTab, redeemCodeSubTab]);

  const loadRedeemCodes = async () => {
      setLoadingRedeemCodes(true);
      try {
          const data = await AuthService.fetchWithAuth('/api/admin/redeem-codes');
          setRedeemCodes(data.codes || []);
          console.log('Set redeem codes:', data.codes?.length || 0);
      } catch (error: any) {
          console.error('Failed to load redeem codes - exception:', error);
          setToast({ msg: `Failed to load redeem codes: ${error.message || 'Network error'}`, type: 'error' });
      } finally {
          setLoadingRedeemCodes(false);
      }
  };

  const loadCodeRedemptions = async () => {
      setLoadingRedemptions(true);
      try {
          const params = new URLSearchParams();
          if (selectedCodeFilter !== 'all') {
              params.append('codeId', selectedCodeFilter);
          }
          if (redemptionDateFilter.start) {
              params.append('startDate', new Date(redemptionDateFilter.start).getTime().toString());
          }
          if (redemptionDateFilter.end) {
              params.append('endDate', new Date(redemptionDateFilter.end + 'T23:59:59').getTime().toString());
          }

          const data = await AuthService.fetchWithAuth(`/api/admin/code-redemptions?${params.toString()}`);
          setCodeRedemptions(data.redemptions || []);
      } catch (error: any) {
          console.error('Failed to load code redemptions:', error);
          setToast({ msg: 'Failed to load code redemptions', type: 'error' });
      } finally {
          setLoadingRedemptions(false);
      }
  };

  const saveRedeemCode = async () => {
      if (!newRedeemCode.code || !newRedeemCode.rewards || newRedeemCode.rewards.length === 0) {
          setToast({ msg: 'Code and at least one reward are required', type: 'error' });
          return;
      }

      try {
          const url = editingRedeemCode 
              ? '/api/admin/redeem-codes'
              : '/api/admin/redeem-codes';
          const method = editingRedeemCode ? 'PUT' : 'POST';

          const body: any = {
              code: newRedeemCode.code,
              description: newRedeemCode.description || '',
              rewards: newRedeemCode.rewards,
              enabled: newRedeemCode.enabled !== undefined ? newRedeemCode.enabled : true,
              createdBy: currentUser.username
          };

          if (newRedeemCode.maxUses !== undefined && newRedeemCode.maxUses > 0) {
              body.maxUses = newRedeemCode.maxUses;
          }

          if (newRedeemCode.expiresAt) {
              body.expiresAt = newRedeemCode.expiresAt;
          }

          if (newRedeemCode.requiresMembership) {
              body.requiresMembership = newRedeemCode.requiresMembership;
          }

          if (editingRedeemCode) {
              body.id = editingRedeemCode.id;
          }

          const data = await AuthService.fetchWithAuth(url, {
              method: method,
              body: JSON.stringify(body)
          });

          setToast({ msg: editingRedeemCode ? 'Code updated successfully' : 'Code created successfully', type: 'success' });
          setShowRedeemCodeModal(false);
          setEditingRedeemCode(null);
          setNewRedeemCode({
              code: '',
              description: '',
              rewards: [],
              maxUses: undefined,
              expiresAt: undefined,
              requiresMembership: undefined,
              enabled: true
          });
          loadRedeemCodes();
      } catch (error: any) {
          console.error('Failed to save redeem code:', error);
          setToast({ msg: 'Failed to save redeem code', type: 'error' });
      }
  };

  const deleteRedeemCode = async (id: string) => {
      if (!confirm('Are you sure you want to delete this code? This action cannot be undone.')) {
          return;
      }

      try {
          await AuthService.fetchWithAuth(`/api/admin/redeem-codes?id=${id}`, {
              method: 'DELETE'
          });

          setToast({ msg: 'Code deleted successfully', type: 'success' });
          loadRedeemCodes();
      } catch (error: any) {
          console.error('Failed to delete redeem code:', error);
          setToast({ msg: 'Failed to delete redeem code', type: 'error' });
      }
  };

  const loadWikiFeatures = async () => {
      setLoadingWikiFeatures(true);
      try {
          const data = await AuthService.fetchWithAuth('/api/wiki');
          setWikiFeatures(data.features || []);
      } catch (error: any) {
          console.error('Failed to load wiki features:', error);
          setToast({ msg: 'Failed to load wiki features', type: 'error' });
      } finally {
          setLoadingWikiFeatures(false);
      }
  };

  const enhanceDescriptionLocally = (description: string, currentType: string): string => {
    if (!description) return description;
    if (currentType === 'html') return description;
    
    // Convert plain text to markdown with better formatting
    const lines = description.split('\n');
    const enhanced: string[] = [];
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (idx > 0 && enhanced[enhanced.length - 1] !== '') {
          enhanced.push('');
        }
        return;
      }
      
      // Detect bullet points
      if (trimmed.match(/^[-•*]\s+/)) {
        enhanced.push(trimmed);
      } else if (trimmed.match(/^\d+\.\s+/)) {
        enhanced.push(trimmed);
      } else {
        // Regular paragraph
        enhanced.push(trimmed);
      }
    });
    
    return enhanced.join('\n');
  };

  const handleMediaUpload = async (file: File) => {
    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    
    if (!validImageTypes.includes(file.type) && !validVideoTypes.includes(file.type)) {
      setToast({ msg: 'Please upload an image (JPEG, PNG, GIF, WebP, SVG) or video (MP4, WebM, OGG) file', type: 'error' });
      return;
    }

    // Check file size (32MB limit for ImgBB)
    const maxSize = 32 * 1024 * 1024; // 32MB
    if (file.size > maxSize) {
      setToast({ msg: 'File size must be less than 32MB', type: 'error' });
      return;
    }

    setUploadingMedia(true);
    setUploadProgress(0);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 50)); // First 50% for reading
        }
      };

      reader.onloadend = async () => {
        if (reader.result) {
          setUploadProgress(50);
          
          try {
            // Upload to cloud storage
            const data = await AuthService.fetchWithAuth('/api/upload', {
              method: 'POST',
              body: JSON.stringify({
                image: reader.result as string,
                name: file.name || 'wiki-media',
              }),
            });

            setUploadProgress(100);

            // Update media URL and preview
            setNewWikiFeature({ ...newWikiFeature, media: data.url });
            setMediaPreview(data.url);
            setToast({ msg: 'Media uploaded successfully!', type: 'success' });
          } catch (error: any) {
            console.error('Upload error:', error);
            setToast({ msg: error.message || 'Failed to upload media', type: 'error' });
          } finally {
            setUploadingMedia(false);
            setUploadProgress(0);
            if (mediaFileInputRef.current) {
              mediaFileInputRef.current.value = '';
            }
          }
        } else {
          setUploadingMedia(false);
          setUploadProgress(0);
        }
      };

      reader.onerror = () => {
        setUploadingMedia(false);
        setUploadProgress(0);
        setToast({ msg: 'Error reading file', type: 'error' });
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      setUploadingMedia(false);
      setUploadProgress(0);
      setToast({ msg: error.message || 'Failed to process file', type: 'error' });
    }
  };

  const saveWikiFeature = async () => {
      if (!newWikiFeature.title || !newWikiFeature.categories || newWikiFeature.categories.length === 0) {
          setToast({ msg: 'Title and at least one category are required', type: 'error' });
          return;
      }

      try {
          const url = '/api/wiki';
          const method = editingWikiFeature ? 'PUT' : 'POST';

          const featureData: WikiFeature = {
              id: editingWikiFeature?.id || generateUUID(),
              title: newWikiFeature.title,
              mcVersions: newWikiFeature.mcVersions || [],
              modVersions: newWikiFeature.modVersions || [],
              categories: newWikiFeature.categories || [],
              subcategories: newWikiFeature.subcategories || [],
              description: newWikiFeature.description || '',
              descriptionType: newWikiFeature.descriptionType || 'text',
              media: newWikiFeature.media || mediaPreview,
              details: newWikiFeature.details || [],
              createdBy: currentUser.username,
              createdAt: editingWikiFeature?.createdAt || Date.now(),
              updatedAt: Date.now()
          };

          const data = await AuthService.fetchWithAuth(url, {
              method: method,
              body: JSON.stringify({ feature: featureData })
          });

          setToast({ msg: editingWikiFeature ? 'Feature updated successfully' : 'Feature created successfully', type: 'success' });
          setShowWikiModal(false);
          setEditingWikiFeature(null);
          setNewWikiFeature({
              title: '',
              mcVersions: [],
              modVersions: [],
              categories: [],
              subcategories: [],
              description: '',
              descriptionType: 'markdown',
              media: '',
              details: []
          });
          setNewDetail('');
          setMediaPreview('');
          loadWikiFeatures();
      } catch (error: any) {
          console.error('Failed to save wiki feature:', error);
          setToast({ msg: 'Failed to save wiki feature', type: 'error' });
      }
  };

  const deleteWikiFeature = async (id: string) => {
      if (!confirm('Are you sure you want to delete this feature? This action cannot be undone.')) {
          return;
      }

      try {
          await AuthService.fetchWithAuth(`/api/wiki?id=${id}`, {
              method: 'DELETE'
          });

          setToast({ msg: 'Feature deleted successfully', type: 'success' });
          loadWikiFeatures();
      } catch (error: any) {
          console.error('Failed to delete wiki feature:', error);
          setToast({ msg: 'Failed to delete wiki feature', type: 'error' });
      }
  };

  function generateUUID(): string {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
      });
  }

  const loadSubscribedUsers = async () => {
      setLoadingKofiUsers(true);
      try {
          const allUsers = await AuthService.getAllUsers();
          const subscribed = allUsers.filter(user => user.kofiSubscription?.isActive === true);
          setSubscribedUsers(subscribed);
      } catch (error: any) {
          console.error('Failed to load subscribed users:', error);
          setToast({ msg: 'Failed to load subscribed users', type: 'error' });
      } finally {
          setLoadingKofiUsers(false);
      }
  };


  const saveGeneralConfig = () => {
      onUpdateConfig({ 
          ...config, 
          hero: heroConfig, 
          links: linkConfig, 
          database: dbConfig,
          socialHandles: {
              ...socialHandlesConfig,
              // Rebuild links objects in the correct order
              authorLinks: authorLinksOrder.reduce((acc, key) => {
                  const value = socialHandlesConfig.authorLinks?.[key];
                  if (value) acc[key] = value;
                  return acc;
              }, {} as Record<string, string>),
              leadDevLinks: leadDevLinksOrder.reduce((acc, key) => {
                  const value = socialHandlesConfig.leadDevLinks?.[key];
                  if (value) acc[key] = value;
                  return acc;
              }, {} as Record<string, string>)
          },
          navbarIcon: navbarIconConfig,
          footerIcon: footerIconConfig,
          roles: roles,
          curseforgeProjectSlug: curseforgeProjectSlug || undefined,
          autoSyncCurseForge: autoSyncCurseForge, // Keep for backward compatibility
          curseforgeSyncInterval: curseforgeSyncInterval,

          mcVersions: config.mcVersions, 
          modVersions: config.modVersions
      });
      alert("Configuration Saved!");
  };

  const handleSyncFromCurseForge = async () => {
      setIsSyncingCurseForge(true);
      try {
          const currentConfig = {
              ...config,
              curseforgeProjectSlug: curseforgeProjectSlug || CurseForgeService.extractProjectId(linkConfig.curseforge) || '',
          };

          const syncedData = await CurseForgeService.syncVersionsFromCurseForge(currentConfig);

          const updatedConfig = {
              ...config,
              mcVersions: syncedData.mcVersions,
              modVersions: syncedData.modVersions,
              hero: {
                  ...heroConfig,
                  latestModVersion: syncedData.latestModVersion,
                  latestMcVersions: syncedData.latestMcVersions
              },
              curseforgeProjectSlug: curseforgeProjectSlug || CurseForgeService.extractProjectId(linkConfig.curseforge) || '',
          };

          setHeroConfig(updatedConfig.hero);
          onUpdateConfig(updatedConfig);
          alert(`Successfully synced from CurseForge!\n\nLatest Mod Version: ${syncedData.latestModVersion}\nLatest MC Versions: ${syncedData.latestMcVersions}\nMinecraft Versions: ${syncedData.mcVersions.length} versions loaded\nMod Versions: ${syncedData.modVersions.length} versions loaded`);
      } catch (error: any) {
          console.error('Failed to sync from CurseForge:', error);
          if (error instanceof CurseForgeError) {
              alert(`Failed to sync from CurseForge: ${error.message}`);
          } else {
              alert(`Failed to sync from CurseForge: ${error.message || 'Unknown error'}`);
          }
      } finally {
          setIsSyncingCurseForge(false);
      }
  };

  const tabFilteredReports = useMemo(() => {
    if (bugSubTab === 'active') {
      return reports.filter(r => r.status !== 'Resolved');
    } else {
      return reports.filter(r => r.status === 'Resolved');
    }
  }, [reports, bugSubTab]);

  const filteredReports = useMemo(() => {
      return tabFilteredReports.filter(bug => {
          const matchesSearch = (bug.title + bug.description + bug.author).toLowerCase().includes(searchTerm.toLowerCase());
          const matchesMcVersion = filters.mcVersion === 'All' || bug.mcVersions.includes(filters.mcVersion);
          const matchesModVersion = filters.modVersion === 'All' || bug.versions.includes(filters.modVersion);
          const matchesSeverity = filters.severity === 'All' || bug.severity === filters.severity;
          const matchesAssigned = filters.assigned === 'All' || 
                                  (filters.assigned === 'Unassigned' ? !bug.assignedTo : bug.assignedTo === filters.assigned);
          return matchesSearch && matchesMcVersion && matchesModVersion && matchesSeverity && matchesAssigned;
      }).sort((a, b) => {
          if (sortBy === 'newest') return b.timestamp - a.timestamp;
          if (sortBy === 'oldest') return a.timestamp - b.timestamp;
          if (sortBy === 'severity') {
              const order = { 'Critical': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
              return order[b.severity] - order[a.severity];
          }
          return 0;
      });
  }, [tabFilteredReports, searchTerm, filters, sortBy]);

  const toggleSelectAll = () => { if (selectedIds.size === filteredReports.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredReports.map(r => r.id))); };
  const toggleSelect = (id: string) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
  const handleBulkResolve = () => { if (!confirm(`Mark ${selectedIds.size} reports as Resolved?`)) return; reports.forEach(bug => { if (selectedIds.has(bug.id)) onUpdateReport({ ...bug, status: 'Resolved', resolvedBy: currentUser.username }); }); setSelectedIds(new Set()); };
  const handleBulkDelete = () => { if (!confirm(`Permanently delete ${selectedIds.size} reports?`)) return; reports.forEach(bug => { if (selectedIds.has(bug.id)) onDeleteReport(bug.id); }); setSelectedIds(new Set()); };
  const handleBulkAssign = () => { if (!bulkAssignUser) return alert("Select user."); if (!confirm(`Assign ${selectedIds.size} reports?`)) return; reports.forEach(bug => { if (selectedIds.has(bug.id)) onUpdateReport({ ...bug, assignedTo: bulkAssignUser }); }); setSelectedIds(new Set()); setBulkAssignUser(""); };
  
  const handleEditBug = (bug: BugReport) => {
    setEditingBug(bug);
    setEditStatus(bug.status);
    setEditAssignedTo(bug.assignedTo || '');
  };
  
  const handleSaveBugEdit = () => {
    if (!editingBug) return;
    const updatedBug = {
      ...editingBug,
      status: editStatus,
      assignedTo: editAssignedTo || undefined
    };
    onUpdateReport(updatedBug);
    setEditingBug(null);
    setEditStatus('Open');
    setEditAssignedTo('');
  };
  
  const handleQuickAction = (bug: BugReport, action: 'resolve' | 'reopen' | 'open') => {
    let newStatus: BugReport['status'];
    if (action === 'resolve') newStatus = 'Resolved';
    else if (action === 'reopen') newStatus = 'Open';
    else newStatus = 'Open';
    
    const updatedBug = { ...bug, status: newStatus };
    // Set resolvedBy when marking as Resolved, clear it when reopening
    if (newStatus === 'Resolved') {
      updatedBug.resolvedBy = currentUser.username;
    } else if (newStatus === 'Open') {
      updatedBug.resolvedBy = undefined;
    }
    
    onUpdateReport(updatedBug);
  };

  const tabFilteredSuggestions = useMemo(() => {
    if (suggestionSubTab === 'active') {
      return suggestions.filter(s => s.status !== 'Implemented' && s.status !== 'Rejected');
    } else {
      return suggestions.filter(s => s.status === 'Implemented' || s.status === 'Rejected');
    }
  }, [suggestions, suggestionSubTab]);

  const filteredSuggestions = useMemo(() => {
    return tabFilteredSuggestions.filter(suggestion => {
      const matchesSearch = (suggestion.title + suggestion.description + suggestion.author).toLowerCase().includes(suggestionSearchTerm.toLowerCase());
      const matchesMcVersion = suggestionFilters.mcVersion === 'All' || (suggestion.mcVersions && suggestion.mcVersions.includes(suggestionFilters.mcVersion));
      const matchesModVersion = suggestionFilters.modVersion === 'All' || (suggestion.modVersions && suggestion.modVersions.includes(suggestionFilters.modVersion));
      const matchesCategory = suggestionFilters.category === 'All' || suggestion.category === suggestionFilters.category;
      const matchesPriority = suggestionFilters.priority === 'All' || suggestion.priority === suggestionFilters.priority;
      return matchesSearch && matchesMcVersion && matchesModVersion && matchesCategory && matchesPriority;
    }).sort((a, b) => {
      if (suggestionSortBy === 'newest') return b.timestamp - a.timestamp;
      if (suggestionSortBy === 'oldest') return a.timestamp - b.timestamp;
      if (suggestionSortBy === 'priority') {
        const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
      }
      return 0;
    });
  }, [tabFilteredSuggestions, suggestionSearchTerm, suggestionFilters, suggestionSortBy]);

  const toggleSelectAllSuggestions = () => {
    if (selectedSuggestionIds.size === filteredSuggestions.length) setSelectedSuggestionIds(new Set());
    else setSelectedSuggestionIds(new Set(filteredSuggestions.map(s => s.id)));
  };
  
  const toggleSelectSuggestion = (id: string) => {
    const newSet = new Set(selectedSuggestionIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSuggestionIds(newSet);
  };
  
  const handleBulkImplement = () => {
    if (!onUpdateSuggestion) return;
    if (!confirm(`Mark ${selectedSuggestionIds.size} suggestions as Implemented?`)) return;
    suggestions.forEach(suggestion => {
      if (selectedSuggestionIds.has(suggestion.id)) {
        onUpdateSuggestion({ ...suggestion, status: 'Implemented' });
      }
    });
    setSelectedSuggestionIds(new Set());
  };
  
  const handleBulkDeleteSuggestions = () => {
    if (!onDeleteSuggestion) return;
    if (!confirm(`Permanently delete ${selectedSuggestionIds.size} suggestions?`)) return;
    suggestions.forEach(suggestion => {
      if (selectedSuggestionIds.has(suggestion.id)) {
        onDeleteSuggestion(suggestion.id);
      }
    });
    setSelectedSuggestionIds(new Set());
  };
  
  const handleEditSuggestion = (suggestion: Suggestion) => {
    setEditingSuggestion(suggestion);
    setEditSuggestionStatus(suggestion.status);
  };
  
  const handleSaveSuggestionEdit = () => {
    if (!editingSuggestion || !onUpdateSuggestion) return;
    const updatedSuggestion = {
      ...editingSuggestion,
      status: editSuggestionStatus
    };
    onUpdateSuggestion(updatedSuggestion);
    setEditingSuggestion(null);
    setEditSuggestionStatus('Open');
  };
  
  const handleQuickSuggestionAction = (suggestion: Suggestion, action: 'implement' | 'reopen' | 'reject') => {
    if (!onUpdateSuggestion) return;
    
    if (action === 'reject') {
      setRejectingSuggestion(suggestion);
      setRejectionReason("");
      setShowRejectModal(true);
      return;
    }
    
    let newStatus: Suggestion['status'];
    if (action === 'implement') newStatus = 'Implemented';
    else if (action === 'reopen') newStatus = 'Open';
    else newStatus = 'Open';
    
    onUpdateSuggestion({ ...suggestion, status: newStatus });
  };

  const handleConfirmReject = () => {
    if (rejectingSuggestion && onUpdateSuggestion) {
      onUpdateSuggestion({ 
        ...rejectingSuggestion, 
        status: 'Rejected',
        rejectionReason: rejectionReason.trim() || undefined
      });
      setShowRejectModal(false);
      setRejectingSuggestion(null);
      setRejectionReason("");
    }
  };
  
  const prepareBackupData = async () => {

    if (users.length === 0) {
      await loadUsers();
    }

    const backupData = {
      timestamp: Date.now(),
      version: '1.0',
      reports: reports,
      suggestions: suggestions,
      config: config,
      users: users,
      metadata: {
        totalReports: reports.length,
        totalSuggestions: suggestions.length,
        totalUsers: users.length,
        exportedBy: currentUser.username,
        exportDate: new Date().toISOString()
      }
    };
    
    return backupData;
  };

  const handleSyncToCloud = async (cloudService: string) => { 
    if (dbStatus !== 'connected') { 
      alert("Database not connected. Please check your MongoDB configuration."); 
      return; 
    } 
    
    try {

      const backupData = await prepareBackupData();
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `buildscape_backup_${new Date().toISOString().split('T')[0]}.json`;

      switch (cloudService) {
        case 'Dropbox':
          await uploadToDropbox(blob, fileName);
          break;
        case 'Google Cloud':
        case 'AWS S3':
        case 'Microsoft Azure':

          await openCloudUploadInterface(cloudService, blob, fileName);
          break;
        case 'OneDrive':
          await uploadToOneDrive(blob, fileName);
          break;
        case 'MongoDB Atlas':

          downloadBackupFile(blob, fileName);
          alert(`Data is already synced to MongoDB Atlas!\n\nBackup file "${fileName}" has been downloaded as an additional safety copy.`);
          break;
        default:

          downloadBackupFile(blob, fileName);
          alert(`Backup file "${fileName}" has been downloaded. Please upload it manually to ${cloudService}.`);
      }
      
      setShowCloudSyncModal(false);
    } catch (err: any) {
      alert(`Failed to upload backup: ${err.message || 'Unknown error'}`);
    }
  };

  const downloadBackupFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uploadToDropbox = async (blob: Blob, fileName: string) => {
    return new Promise<void>((resolve, reject) => {

      const file = new File([blob], fileName, { type: 'application/json' });

      if (typeof (window as any).Dropbox !== 'undefined') {
        (window as any).Dropbox.save({
          files: [file],
          success: () => {
            alert(`Successfully uploaded "${fileName}" to Dropbox!`);
            resolve();
          },
          progress: (progress: number) => {
            console.log(`Upload progress: ${progress}%`);
          },
          cancel: () => {
            reject(new Error('Upload cancelled'));
          },
          error: (error: any) => {
            reject(new Error(`Dropbox upload failed: ${error}`));
          }
        });
      } else {

        downloadBackupFile(blob, fileName);
        window.open('https://www.dropbox.com/home', '_blank');
        alert(`Backup file "${fileName}" has been downloaded.\n\nDropbox upload interface has been opened. Please drag and drop the file to upload.`);
        resolve();
      }
    });
  };

  const uploadToOneDrive = async (blob: Blob, fileName: string) => {

    downloadBackupFile(blob, fileName);
    window.open('https://onedrive.live.com/?id=root&cid=root&qt=sharedby', '_blank');
    alert(`Backup file "${fileName}" has been downloaded.\n\nOneDrive upload interface has been opened. Please upload the file.`);
  };

  const openCloudUploadInterface = async (cloudService: string, blob: Blob, fileName: string) => {

    downloadBackupFile(blob, fileName);

    const urls: { [key: string]: string } = {
      'Google Cloud': 'https://console.cloud.google.com/storage/browser',
      'AWS S3': 'https://s3.console.aws.amazon.com/s3/buckets',
      'Microsoft Azure': 'https://portal.azure.com/#blade/HubsExtension/BrowseResourceBlade/resourceType/Microsoft.Storage%2FStorageAccounts'
    };
    
    const url = urls[cloudService];
    if (url) {
      window.open(url, '_blank');
      alert(`Backup file "${fileName}" has been downloaded.\n\n${cloudService} console has been opened. Please upload the file to your storage.`);
    } else {
      alert(`Backup file "${fileName}" has been downloaded.\n\nPlease upload it manually to ${cloudService}.`);
    }
  };
  
  const handleExportData = () => { 
    loadUsers().then(() => { 
      const data = { timestamp: Date.now(), reports, config, users }; 
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); 
      const url = URL.createObjectURL(blob); 
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `buildscape_backup_${new Date().toISOString().split('T')[0]}.json`; 
      document.body.appendChild(a); 
      a.click(); 
      document.body.removeChild(a); 
      URL.revokeObjectURL(url); 
    }); 
  };
  
  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = async (ev) => { 
      try { 
        const data = JSON.parse(ev.target?.result as string); 
        if (!confirm(`Restore data from backup? This will overwrite current data.`)) {
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        onRestoreData(data.reports || [], data.suggestions || [], data.config || config);


        if (data.users && data.users.length > 0) {
          console.warn("User data found in backup. Users are stored in MongoDB and cannot be restored from backup. Please manage users through the admin panel.");
        }

        await loadUsers();
        alert("Data restored successfully!");
      } catch (err: any) { 
        alert("Failed to restore: " + err.message); 
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }; 
    reader.readAsText(file); 
  };

  if (currentUser.role === 'user' || currentUser.role === 'pending') return <div className="text-white text-center mt-20">Access Restricted</div>;

  return (
    <div className="h-full flex flex-col py-4 md:py-8">
        <div className="w-full flex flex-col md:flex-row gap-4 md:gap-8 fade-in flex-1 min-h-0 px-2 sm:px-4">
        
        <div className="w-full md:w-64 flex-shrink-0">
            <div className="bg-[#1e1e1e] rounded-xl border border-gray-800 p-3 md:p-5 sticky top-24 shadow-lg md:h-[calc(100vh-8rem)] md:overflow-y-auto md:max-h-[calc(100vh-8rem)] w-full md:w-64">
                
                <div className="hidden md:flex items-center gap-3 mb-8 px-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner overflow-hidden ${currentUser.role === 'owner' ? 'bg-amber-600' : 'bg-blue-600'}`}>
                        {currentUser.profileIcon && currentUser.profileIcon.trim() && currentUser.profileIcon !== 'null' ? (
                            <img 
                                src={currentUser.profileIcon} 
                                alt={currentUser.username}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                        const initial = parent.querySelector('.sidebar-initial') as HTMLElement;
                                        if (initial) initial.style.display = 'flex';
                                    }
                                }}
                            />
                        ) : null}
                        <span className={`${currentUser.profileIcon && currentUser.profileIcon.trim() && currentUser.profileIcon !== 'null' ? 'hidden sidebar-initial' : ''}`}>
                        {currentUser.username[0].toUpperCase()}
                        </span>
                    </div>
                    <div className="overflow-hidden"><div className="text-white font-bold truncate text-sm">{currentUser.username}</div><div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{currentUser.role}</div></div>
                </div>
                
                <div className="flex md:flex-col flex-row gap-1 md:gap-1 md:space-y-0">
                    <button onClick={() => setActiveTab('bugs')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'bugs' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Issues"><BugIcon size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Issues</span></button>
                    <button onClick={() => setActiveTab('suggestions')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'suggestions' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Suggestions"><Lightbulb size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Suggestions</span></button>
                    <button onClick={() => setActiveTab('changelogs')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'changelogs' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Changelogs"><FileText size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Changelogs</span></button>
                    <button onClick={() => setActiveTab('kofi')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'kofi' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Ko-fi Management"><Coffee size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Ko-fi</span></button>
                    <button onClick={() => setActiveTab('redeem-rewards')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'redeem-rewards' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Redeem Rewards"><Gift size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Redeem Rewards</span></button>
                    <button onClick={() => setActiveTab('wiki')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'wiki' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Wiki Management"><BookOpen size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Wiki</span></button>
                    <button onClick={() => setActiveTab('config')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'config' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Configuration"><Settings size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Configuration</span></button>
                    {(currentUser.role === 'admin' || currentUser.role === 'owner') && (
                        <>
                            <button onClick={() => setActiveTab('users')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'users' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Users"><Users size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Users</span></button>
                            <button onClick={() => setActiveTab('database')} className={`flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 md:py-2.5 rounded-lg text-sm font-medium transition-all flex-1 md:flex-none md:w-full ${activeTab === 'database' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`} title="Database"><Database size={20} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Database</span></button>
                        </>
                    )}
                </div>
                
                <div className="hidden md:block mt-8 pt-6 border-t border-gray-700">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/20">
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </div>
        </div>

        
        <div className="flex-1 min-w-0 flex flex-col min-h-0 w-full md:w-[calc(100%-18rem)] max-w-full overflow-hidden">
            <div className="w-full min-w-0 flex flex-col h-full min-h-0">
            
            {activeTab === 'bugs' && (
                <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                    
                    <div className="flex gap-2 border-b border-gray-800 flex-shrink-0 pb-2 mb-4 w-full">
                        <button
                            onClick={() => setBugSubTab('active')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                bugSubTab === 'active'
                                    ? 'text-white border-green-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Active Issues"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <BugIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden md:inline">Active Issues</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setBugSubTab('resolved')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                bugSubTab === 'resolved'
                                    ? 'text-white border-green-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Resolved Issues"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden md:inline">Resolved Issues</span>
                            </div>
                        </button>
                    </div>

                    
                    <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl p-4 shadow-sm space-y-4 flex-shrink-0 mb-2">
                        <div className="flex flex-col md:flex-row gap-4 justify-between">
                            <input className="w-full md:w-auto flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            <div className="flex gap-2 flex-wrap">
                                <select className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8" value={filters.mcVersion} onChange={e => setFilters({...filters, mcVersion: e.target.value})}>
                                    <option value="All">All MC Ver</option>
                                    {config.mcVersions.map(v => <option key={v} value={v}>MC {v}</option>)}
                                </select>
                                <select className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8" value={filters.modVersion} onChange={e => setFilters({...filters, modVersion: e.target.value})}>
                                    <option value="All">All Mod Ver</option>
                                    {config.modVersions.map(v => <option key={v} value={v}>v{v}</option>)}
                                </select>
                                <select className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8" value={filters.severity} onChange={e => setFilters({...filters, severity: e.target.value})}><option value="All">Severity</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
                                <button onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')} className="bg-gray-800 hover:bg-gray-700 px-3 py-2.5 h-10 rounded-lg text-sm text-gray-300 transition-colors flex items-center justify-center"><ArrowUpDown size={14}/></button>
                            </div>
                        </div>
                        {selectedIds.size > 0 && <div className="flex items-center justify-between bg-blue-900/20 p-2 rounded"><span className="text-sm text-blue-200">{selectedIds.size} selected</span><div className="flex gap-2"><button onClick={handleBulkResolve} className="bg-green-700 text-white px-3 py-1 text-xs rounded">Resolve</button><button onClick={handleBulkDelete} className="bg-red-700 text-white px-3 py-1 text-xs rounded">Delete</button></div></div>}
                    </div>

                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-2 w-full max-w-full">
                      {filteredReports.map(bug => (
                        <div key={bug.id} className="flex items-center gap-4 bg-[#1e1e1e] border border-gray-800 p-4 rounded-lg">
                          <button onClick={() => toggleSelect(bug.id)}>
                            {selectedIds.has(bug.id) ? <CheckSquare className="text-blue-500" size={18}/> : <Square size={18} className="text-gray-600"/>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">{bug.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              <div className="flex flex-wrap items-center gap-y-1">
                                <span className="mr-2">•</span>
                                <span className={`px-2 py-0.5 rounded ${bug.status === 'Resolved' ? 'bg-green-900/20 text-green-400' : bug.status === 'In Progress' ? 'bg-blue-900/20 text-blue-400' : 'bg-gray-800 text-gray-300'}`}>{bug.status}</span>
                                <span className="mx-2">•</span>
                                <span className={`px-2 py-0.5 rounded ${
                                  bug.severity === 'Critical' ? 'bg-red-900/20 text-red-400' :
                                  bug.severity === 'High' ? 'bg-orange-900/20 text-orange-400' :
                                  bug.severity === 'Medium' ? 'bg-yellow-900/20 text-yellow-400' :
                                  'bg-green-900/20 text-green-400'
                                }`}>{bug.severity}</span>
                                {bug.assignedTo && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span className="text-blue-400">Assigned: {bug.assignedTo}</span>
                                  </>
                                )}
                                {bug.status === 'Resolved' && bug.resolvedBy && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span className="text-green-400">Resolved by: {bug.resolvedBy}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-y-1 mt-1">
                                <span className="mr-2">•</span>
                                <span>MC {bug.mcVersions.join(', ')}</span>
                                <span className="mx-2">•</span>
                                <span>v{bug.versions.join(', ')}</span>
                                <span className="mx-2">•</span>
                                <span>{new Date(bug.timestamp).toLocaleDateString()}</span>
                                {bug.comments && bug.comments.length > 0 && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span className="text-gray-400">{bug.comments.length} comments</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            
                            {bug.status !== 'Resolved' && (
                              <button 
                                onClick={() => handleQuickAction(bug, 'resolve')}
                                className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition-colors"
                                title="Mark as Resolved"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            {bug.status === 'Resolved' && (
                              <button 
                                onClick={() => handleQuickAction(bug, 'reopen')}
                                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors"
                                title="Reopen"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleEditBug(bug)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                              title="Edit Status & Assignment"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => onDeleteReport(bug.id)} 
                              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>
                      ))}
                      {filteredReports.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <BugIcon size={48} className="mx-auto mb-4 opacity-50" />
                          <p>No issues found matching criteria.</p>
                        </div>
                      )}
                    </div>
                    </div>
                </div>
            )}

            
            {activeTab === 'suggestions' && (
                <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                    
                    <div className="flex gap-2 border-b border-gray-800 flex-shrink-0 pb-2 mb-4 w-full">
                        <button
                            onClick={() => setSuggestionSubTab('active')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                suggestionSubTab === 'active'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Active Suggestions"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <Lightbulb className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden md:inline">Active Suggestions</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setSuggestionSubTab('closed')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                suggestionSubTab === 'closed'
                                    ? 'text-white border-green-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Approved/Closed"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden md:inline">Approved/Closed</span>
                            </div>
                        </button>
                    </div>

                    
                    <div className="bg-[#1e1e1e] border border-gray-800 rounded-xl p-4 shadow-sm space-y-4 flex-shrink-0 mb-2">
                        <div className="flex flex-col md:flex-row gap-4 justify-between">
                            <input 
                                className="w-full md:w-auto flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors hover:border-gray-600" 
                                placeholder="Search suggestions..." 
                                value={suggestionSearchTerm} 
                                onChange={e => setSuggestionSearchTerm(e.target.value)} 
                            />
                            <div className="flex gap-2 flex-wrap">
                                <select value={suggestionFilters.mcVersion} onChange={e => setSuggestionFilters({...suggestionFilters, mcVersion: e.target.value})} className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8">
                                    <option value="All">All MC Ver</option>
                                    {config.mcVersions.map(v => <option key={v} value={v}>MC {v}</option>)}
                                </select>
                                <select value={suggestionFilters.modVersion} onChange={e => setSuggestionFilters({...suggestionFilters, modVersion: e.target.value})} className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8">
                                    <option value="All">All Mod Ver</option>
                                    {config.modVersions.map(v => <option key={v} value={v}>v{v}</option>)}
                                </select>
                                <select value={suggestionFilters.category} onChange={e => setSuggestionFilters({...suggestionFilters, category: e.target.value})} className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8">
                                    <option value="All">All Categories</option>
                                    <option value="Feature">Feature</option>
                                    <option value="Enhancement">Enhancement</option>
                                    <option value="Block">Block</option>
                                    <option value="Item">Item</option>
                                    <option value="Other">Other</option>
                                </select>
                                <select value={suggestionFilters.priority} onChange={e => setSuggestionFilters({...suggestionFilters, priority: e.target.value})} className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8">
                                    <option value="All">All Priority</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                                <select value={suggestionSortBy} onChange={e => setSuggestionSortBy(e.target.value as 'newest' | 'oldest' | 'priority')} className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2.5 h-10 text-sm text-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8">
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="priority">Priority</option>
                                </select>
                            </div>
                        </div>
                        {selectedSuggestionIds.size > 0 && (
                            <div className="flex items-center justify-between bg-blue-900/20 p-2 rounded">
                                <span className="text-sm text-blue-200">{selectedSuggestionIds.size} selected</span>
                                <div className="flex gap-2">
                                    <button onClick={handleBulkImplement} className="bg-green-700 text-white px-3 py-1 text-xs rounded">Mark Implemented</button>
                                    <button onClick={handleBulkDeleteSuggestions} className="bg-red-700 text-white px-3 py-1 text-xs rounded">Delete</button>
                                </div>
                            </div>
                        )}
                    </div>

                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="space-y-2 w-full max-w-full">
                      {filteredSuggestions.map(suggestion => (
                        <div key={suggestion.id} className="flex items-center gap-4 bg-[#1e1e1e] border border-gray-800 p-4 rounded-lg">
                          <button onClick={() => toggleSelectSuggestion(suggestion.id)}>
                            {selectedSuggestionIds.has(suggestion.id) ? <CheckSquare className="text-blue-500" size={18}/> : <Square size={18} className="text-gray-600"/>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">{suggestion.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              <span className={`px-2 py-0.5 rounded ${
                                suggestion.status === 'Implemented' ? 'bg-green-900/20 text-green-400' :
                                suggestion.status === 'Rejected' ? 'bg-red-900/20 text-red-400' :
                                suggestion.status === 'Planned' ? 'bg-blue-900/20 text-blue-400' :
                                suggestion.status === 'Under Review' ? 'bg-yellow-900/20 text-yellow-400' :
                                'bg-gray-800 text-gray-300'
                              }`}>{suggestion.status}</span>
                              <span className="mx-2">•</span>
                              <span className={`px-2 py-0.5 rounded ${
                                suggestion.category === 'Feature' ? 'bg-purple-900/20 text-purple-300' :
                                suggestion.category === 'Enhancement' ? 'bg-blue-900/20 text-blue-300' :
                                suggestion.category === 'Block' ? 'bg-green-900/20 text-green-300' :
                                suggestion.category === 'Item' ? 'bg-yellow-900/20 text-yellow-300' :
                                'bg-gray-800 text-gray-300'
                              }`}>{suggestion.category}</span>
                              <span className="mx-2">•</span>
                              <span className={`px-2 py-0.5 rounded ${
                                suggestion.priority === 'High' ? 'bg-red-900/20 text-red-400' :
                                suggestion.priority === 'Medium' ? 'bg-yellow-900/20 text-yellow-400' :
                                'bg-green-900/20 text-green-400'
                              }`}>{suggestion.priority}</span>
                              {suggestion.mcVersions && suggestion.mcVersions.length > 0 && <><span className="mx-2">•</span><span>MC {suggestion.mcVersions.join(', ')}</span></>}
                              {suggestion.modVersions && suggestion.modVersions.length > 0 && <><span className="mx-2">•</span><span>v{suggestion.modVersions.join(', ')}</span></>}
                              <span className="mx-2">•</span>
                              <span>{new Date(suggestion.timestamp).toLocaleDateString()}</span>
                              <span className="mx-2">•</span>
                              <span>by {suggestion.author}</span>
                              {suggestion.upvotes !== undefined && suggestion.upvotes > 0 && <><span className="mx-2">•</span><span className="text-blue-400">{suggestion.upvotes} upvotes</span></>}
                              {suggestion.comments && suggestion.comments.length > 0 && <><span className="mx-2">•</span><span className="text-gray-400">{suggestion.comments.length} comments</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            
                            {suggestion.status !== 'Implemented' && suggestion.status !== 'Rejected' && (
                              <button 
                                onClick={() => handleQuickSuggestionAction(suggestion, 'implement')}
                                className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition-colors"
                                title="Mark as Implemented"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            {suggestion.status === 'Implemented' && (
                              <button 
                                onClick={() => handleQuickSuggestionAction(suggestion, 'reopen')}
                                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors"
                                title="Reopen"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                            {suggestion.status !== 'Rejected' && (
                              <button 
                                onClick={() => handleQuickSuggestionAction(suggestion, 'reject')}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                title="Reject"
                              >
                                <Ban size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleEditSuggestion(suggestion)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                              title="Edit Status"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => onDeleteSuggestion(suggestion.id)} 
                              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-900/20 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>
                      ))}
                      {filteredSuggestions.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <Lightbulb size={48} className="mx-auto mb-4 opacity-50" />
                          <p>No suggestions found matching criteria.</p>
                        </div>
                      )}
                    </div>
                    </div>
                </div>
            )}

            
            {activeTab === 'users' && (currentUser.role === 'admin' || currentUser.role === 'owner') && (
                 <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                    
                    <div className="flex gap-2 border-b border-gray-800 flex-shrink-0 pb-2 mb-4 w-full">
                        <button
                            onClick={() => setUserSubTab('staff')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                userSubTab === 'staff'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Staff"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <i className="fa fa-user-secret" aria-hidden="true"></i>
                                <span className="hidden md:inline">Staff</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setUserSubTab('users')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                userSubTab === 'users'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Users"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <i className="fa fa-users" aria-hidden="true"></i>
                                <span className="hidden md:inline">Users</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setUserSubTab('roles')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                userSubTab === 'roles'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Roles"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden md:inline">Roles</span>
                            </div>
                        </button>
                    </div>

                    
                    <div className="flex-shrink-0 mb-2"></div>

                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        
                        {userSubTab === 'staff' && (
                            <div className="animate-fadeIn w-full min-w-0">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                                    <h2 className="text-xl sm:text-2xl font-bold text-white">Staff Management</h2>
                                    <button onClick={loadUsers} className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-white"><RefreshCw size={14} className={refreshingUsers ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span></button>
                    </div>
                                <div className="bg-[#1e1e1e] border border-gray-800 rounded-lg overflow-hidden shadow-inner w-full overflow-x-auto">
                                    <table className="w-full text-left text-sm min-w-[600px]">
                            <thead className="bg-[#1a1a1a] text-gray-400 font-bold uppercase text-xs">
                                            <tr><th className="px-2 sm:px-4 md:px-6 py-3 md:py-4">User</th><th className="px-2 sm:px-4 md:px-6 py-3 md:py-4">Role</th><th className="px-2 sm:px-4 md:px-6 py-3 md:py-4 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                            {users.filter(u => u.role === 'admin' || u.role === 'owner').map(u => (
                                    <tr key={u.id} className="hover:bg-gray-800/30">
                                                    <td className="px-2 sm:px-4 md:px-6 py-3 md:py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
                                                                {u.profileIcon && u.profileIcon.trim() && u.profileIcon !== 'null' ? (
                                                                    <img 
                                                                        src={u.profileIcon} 
                                                                        alt={u.username}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            const parent = e.currentTarget.parentElement;
                                                                            if (parent) {
                                                                                const initial = parent.querySelector('.user-initial') as HTMLElement;
                                                                                if (initial) initial.style.display = 'flex';
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div className={`w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-xs ${u.profileIcon && u.profileIcon.trim() && u.profileIcon !== 'null' ? 'hidden user-initial' : ''}`}>
                                                                    {u.username[0].toUpperCase()}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-200">{u.username}</div>
                                                                <div className="text-xs text-gray-500">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 md:px-6 py-3 md:py-4">
                                            
                                            <select 
                                                value={u.role} 
                                                onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                                                disabled={u.id === currentUser.id} // Cannot demote self easily
                                                            className="bg-[#1a1a1a] border border-gray-700 rounded-lg text-xs px-3 py-2 text-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-600 transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.5rem_center] bg-no-repeat pr-8"
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                                <option value="owner">Owner</option>
                                                <option value="pending">Pending</option>
                                                            {roles.map(role => (
                                                                <option key={role.id} value={role.name}>{role.name}</option>
                                                            ))}
                                            </select>
                                        </td>
                                                    <td className="px-2 sm:px-4 md:px-6 py-3 md:py-4 text-right">
                                            {u.id !== currentUser.id && <button onClick={() => handleDeleteUser(u.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={16}/></button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </div>
                        )}

                        
                        {userSubTab === 'users' && (
                            <div className="animate-fadeIn w-full min-w-0">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                                    <h2 className="text-xl sm:text-2xl font-bold text-white">All Users</h2>
                                    <button onClick={loadUsers} className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-white"><RefreshCw size={14} className={refreshingUsers ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span></button>
                                </div>
                                <div className="bg-[#1e1e1e] border border-gray-800 rounded-lg overflow-hidden shadow-inner w-full overflow-x-auto">
                                    <table className="w-full text-left text-sm min-w-[600px]">
                                        <thead className="bg-[#1a1a1a] text-gray-400 font-bold uppercase text-xs">
                                            <tr><th className="px-2 sm:px-4 md:px-6 py-3 md:py-4">User</th><th className="px-2 sm:px-4 md:px-6 py-3 md:py-4">Role</th><th className="px-2 sm:px-4 md:px-6 py-3 md:py-4 text-right">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {users.filter(u => u.role !== 'admin' && u.role !== 'owner').map(u => (
                                                <tr key={u.id} className="hover:bg-gray-800/30">
                                                    <td className="px-2 sm:px-4 md:px-6 py-3 md:py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
                                                                {u.profileIcon && u.profileIcon.trim() && u.profileIcon !== 'null' ? (
                                                                    <img 
                                                                        src={u.profileIcon} 
                                                                        alt={u.username}
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            const parent = e.currentTarget.parentElement;
                                                                            if (parent) {
                                                                                const initial = parent.querySelector('.user-initial') as HTMLElement;
                                                                                if (initial) initial.style.display = 'flex';
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div className={`w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-xs ${u.profileIcon && u.profileIcon.trim() && u.profileIcon !== 'null' ? 'hidden user-initial' : ''}`}>
                                                                    {u.username[0].toUpperCase()}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-200">{u.username}</div>
                                                                <div className="text-xs text-gray-500">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <select 
                                                            value={u.role} 
                                                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                                                            className="bg-[#1a1a1a] border border-gray-700 rounded-lg text-xs px-3 py-2 text-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-600 transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.5rem_center] bg-no-repeat pr-8"
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="admin">Admin</option>
                                                            <option value="pending">Pending</option>
                                                            {roles.map(role => (
                                                                <option key={role.id} value={role.name}>{role.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 sm:px-4 md:px-6 py-3 md:py-4 text-right">
                                                        <button onClick={() => handleDeleteUser(u.id)} className="text-gray-500 hover:text-red-500"><Trash2 size={16}/></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        
                        {userSubTab === 'roles' && (
                            <div className="animate-fadeIn w-full min-w-0">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                                    <h2 className="text-xl sm:text-2xl font-bold text-white">Role Management</h2>
                                    <button 
                                        onClick={() => {
                                            const newRole: Role = {
                                                id: crypto.randomUUID(),
                                                name: '',
                                                permissions: {},
                                                color: '#6366f1'
                                            };
                                            setEditingRole(newRole);
                                        }}
                                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm w-full sm:w-auto justify-center"
                                    >
                                        <Plus size={14} className="sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Create Role</span>
                                        <span className="sm:hidden">Create</span>
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    {roles.map(role => (
                                        <div key={role.id} className="bg-[#1e1e1e] border border-gray-800 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div 
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white"
                                                        style={{ backgroundColor: role.color || '#6366f1' }}
                                                    >
                                                        {role.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-white font-bold">{role.name}</h3>
                                                        <p className="text-xs text-gray-500">{Object.values(role.permissions).filter(Boolean).length} permissions</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setEditingRole(role)}
                                                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                                                        title="Edit Role"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const updatedRoles = roles.filter(r => r.id !== role.id);
                                                            setRoles(updatedRoles);
                                                            onUpdateConfig({...config, roles: updatedRoles});
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                                                        title="Delete Role"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {roles.length === 0 && (
                                        <div className="text-center py-12 text-gray-500 bg-[#1e1e1e] border border-gray-800 rounded-lg">
                                            <ShieldCheck size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>No custom roles created yet.</p>
                                            <p className="text-sm mt-2">Click "Create Role" to add a new role with custom permissions.</p>
                                        </div>
                                    )}
                                </div>

                                
                                {editingRole && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                                        <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                                            <div className="p-6">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                        <ShieldCheck size={20} />
                                                        {editingRole.name ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
                                                    </h3>
                                                    <button
                                                        onClick={() => {
                                                            setEditingRole(null);
                                                        }}
                                                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>

                                                <div className="space-y-6">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">Role Name</label>
                                                        <input
                                                            type="text"
                                                            value={editingRole.name}
                                                            onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                                                            placeholder="e.g., Moderator, Developer"
                                                            className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">Role Color</label>
                                                        <input
                                                            type="color"
                                                            value={editingRole.color || '#6366f1'}
                                                            onChange={(e) => setEditingRole({...editingRole, color: e.target.value})}
                                                            className="w-full h-12 rounded-lg cursor-pointer"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-4">Permissions</label>
                                                        <div className="space-y-3">
                                                            {[
                                                                { key: 'canViewAdminPanel', label: 'View Admin Panel' },
                                                                { key: 'canManageBugs', label: 'Manage Bug Reports' },
                                                                { key: 'canManageSuggestions', label: 'Manage Suggestions' },
                                                                { key: 'canAssignStaff', label: 'Assign Staff to Reports' },
                                                                { key: 'canDeleteReports', label: 'Delete Reports' },
                                                                { key: 'canDeleteSuggestions', label: 'Delete Suggestions' },
                                                                { key: 'canManageUsers', label: 'Manage Users' },
                                                                { key: 'canManageRoles', label: 'Manage Roles' },
                                                                { key: 'canManageConfig', label: 'Manage Configuration' },
                                                            ].map(perm => (
                                                                <label key={perm.key} className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg hover:bg-[#252525] transition-colors cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editingRole.permissions[perm.key as keyof typeof editingRole.permissions] || false}
                                                                        onChange={(e) => setEditingRole({
                                                                            ...editingRole,
                                                                            permissions: {
                                                                                ...editingRole.permissions,
                                                                                [perm.key]: e.target.checked
                                                                            }
                                                                        })}
                                                                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                                                    />
                                                                    <span className="text-sm text-gray-300">{perm.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3 pt-4 border-t border-gray-800">
                                                        <button
                                                            onClick={() => {
                                                                setEditingRole(null);
                                                            }}
                                                            className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (!editingRole.name.trim()) {
                                                                    alert('Please enter a role name');
                                                                    return;
                                                                }
                                                                const existingIndex = roles.findIndex(r => r.id === editingRole.id);
                                                                let updatedRoles;
                                                                if (existingIndex >= 0) {
                                                                    updatedRoles = [...roles];
                                                                    updatedRoles[existingIndex] = editingRole;
                                                                } else {
                                                                    updatedRoles = [...roles, editingRole];
                                                                }
                                                                setRoles(updatedRoles);
                                                                onUpdateConfig({...config, roles: updatedRoles});
                                                                setEditingRole(null);
                                                            }}
                                                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <Save size={16} />
                                                            Save Role
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 </div>
            )}

            {activeTab === 'changelogs' && (
              <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                <div className="flex items-center justify-between mb-6 flex-shrink-0">
                  <h2 className="text-2xl font-bold text-white">Changelog Management</h2>
                  <button
                    onClick={() => {
                      setNewChangelog({
                        title: '',
                        type: 'release',
                        modVersion: '',
                        fileName: '',
                        mcVersions: [],
                        changelog: '',
                        changelogType: 'markdown',
                        fileDate: new Date().toISOString().split('T')[0],
                        downloadUrl: '',
                        isLatest: false,
                        linkedBugReports: []
                      });
                      setEditingChangelog(null);
                      setAllowPatch(false);
                      setShowChangelogModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Plus size={18} />
                    Add Changelog
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {changelogs.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                      <FileText className="mx-auto text-gray-500 mb-3" size={48} />
                      <h3 className="text-gray-400 font-bold mb-1">No Changelogs</h3>
                      <p className="text-gray-500 text-sm mb-4">Get started by creating your first changelog entry</p>
                      <button
                        onClick={() => {
                          setNewChangelog({
                            title: '',
                            type: 'release',
                            modVersion: '',
                            fileName: '',
                            mcVersions: [],
                            changelog: '',
                            changelogType: 'markdown',
                            fileDate: new Date().toISOString().split('T')[0],
                            downloadUrl: '',
                            isLatest: false,
                            linkedBugReports: []
                          });
                          setEditingChangelog(null);
                          setAllowPatch(false);
                          setShowChangelogModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Create Changelog
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {changelogs
                        .sort((a, b) => {
                          if (a.isLatest) return -1;
                          if (b.isLatest) return 1;
                          const aParts = a.modVersion.split('.').map(Number);
                          const bParts = b.modVersion.split('.').map(Number);
                          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                            const aVal = aParts[i] || 0;
                            const bVal = bParts[i] || 0;
                            if (aVal > bVal) return -1;
                            if (aVal < bVal) return 1;
                          }
                          return 0;
                        })
                        .map((changelog) => (
                          <div key={changelog.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-bold text-white">
                                    {changelog.isLatest ? 'Latest Version' : `Version ${changelog.modVersion}`}
                                  </h3>
                                  {changelog.isLatest && (
                                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded">Latest</span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400 space-y-1">
                                  <div>
                                    <span className="text-gray-500">→</span> {changelog.mcVersions.length > 0 ? changelog.mcVersions.join(', ') : 'No MC versions'}
                                    <span className="text-gray-500"> →</span> <span className="text-green-400 font-mono">{changelog.modVersion}</span>
                                    <span className="text-gray-500"> →</span> <span className="text-gray-300 font-mono">{changelog.fileName}</span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Date: {new Date(changelog.fileDate).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="mt-3" ref={(el) => {
                                  if (el) {
                                    // Attach click handlers to bug report references
                                    const bugReportElements = el.querySelectorAll('.bug-report-clickable');
                                    bugReportElements.forEach((elem) => {
                                      const bugId = elem.getAttribute('data-bug-id');
                                      if (bugId && !elem.hasAttribute('data-handler-attached')) {
                                        elem.setAttribute('data-handler-attached', 'true');
                                        elem.addEventListener('click', (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedBugId(bugId);
                                        });
                                      }
                                    });
                                  }
                                }}>
                                  {renderChangelogPreview(changelog.changelog, changelog.changelogType, 4)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {changelog.visibility === 'unlisted' && (
                                  <button
                                    onClick={() => {
                                      const shareUrl = `${window.location.origin}${window.location.pathname}?changelog=${changelog.id}`;
                                      navigator.clipboard.writeText(shareUrl).then(() => {
                                        setToast({ msg: 'Copied link to share', type: 'success' });
                                      }).catch(() => {
                                        // Fallback for browsers that don't support clipboard API
                                        const textArea = document.createElement('textarea');
                                        textArea.value = shareUrl;
                                        document.body.appendChild(textArea);
                                        textArea.select();
                                        document.execCommand('copy');
                                        document.body.removeChild(textArea);
                                        setToast({ msg: 'Copied link to share', type: 'success' });
                                      });
                                    }}
                                    className="p-2 text-purple-400 hover:bg-purple-900/20 rounded-lg transition-colors"
                                    title="Copy share link"
                                  >
                                    <Share2 size={18} />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingChangelog(changelog);
                                    setNewChangelog({ ...changelog, visibility: changelog.visibility || 'private' });
                                    setAllowPatch((changelog.linkedBugReports || []).length > 0);
                                    setShowChangelogModal(true);
                                  }}
                                  className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm('Are you sure you want to delete this changelog?')) return;
                                    const updated = changelogs.filter(c => c.id !== changelog.id);
                                    setChangelogs(updated);
                                    const updatedConfig = { ...config, changelogs: updated };
                                    onUpdateConfig(updatedConfig);
                                    try {
                                      await StorageService.saveAll(reports, suggestions, updatedConfig);
                                    } catch (e: any) {
                                      console.error("Failed to save changelogs:", e);
                                    }
                                  }}
                                  className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            
            {activeTab === 'database' && (currentUser.role === 'admin' || currentUser.role === 'owner') && (
                <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                    
                    <div className="flex gap-2 border-b border-gray-800 flex-shrink-0 pb-2 mb-4 w-full">
                        <button
                            className="px-4 py-2 font-semibold text-sm transition-all border-b-2 text-white border-blue-500 flex-shrink-0"
                            title="Database & Backups"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <Database className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden md:inline">Database & Backups</span>
                            </div>
                        </button>
                    </div>

                    
                    <div className="flex-shrink-0 mb-2"></div>

                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    <div className="animate-fadeIn space-y-8 w-full min-w-0">
                    <div className="bg-[#1e1e1e] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <button onClick={() => setShowCloudSyncModal(true)} disabled={dbStatus !== 'connected'} className="bg-blue-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-blue-700 w-full sm:w-auto"><Upload size={16}/> Sync Data</button>
                            <button onClick={handleExportData} className="bg-gray-800 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold flex items-center justify-center gap-2 text-sm sm:text-base transition-colors hover:bg-gray-700 w-full sm:w-auto"><Download size={16}/> Download backup</button>
                            <div className="relative w-full sm:w-auto">
                                <input type="file" ref={fileInputRef} onChange={handleImportData} className="hidden" accept=".json" />
                                <button onClick={() => fileInputRef.current?.click()} className="bg-gray-800 text-gray-300 border border-gray-700 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold flex items-center justify-center gap-2 text-sm sm:text-base transition-colors hover:text-white hover:bg-gray-700 w-full sm:w-auto"><Upload size={16} /> restore</button>
                            </div>
                        </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'kofi' && (
              <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                <div className="flex items-center justify-between mb-6 flex-shrink-0">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Coffee size={24} />
                    Ko-fi Management
                  </h2>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-2 border-b border-gray-800 flex-shrink-0 pb-2 mb-4">
                  <button
                    onClick={() => setKofiSubTab('tiers')}
                    className={`px-3 sm:px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
                      kofiSubTab === 'tiers'
                        ? 'text-white border-blue-500'
                        : 'text-gray-400 border-transparent hover:text-gray-300'
                    }`}
                    title="Tiers"
                  >
                    <div className="flex items-center gap-2">
                      <Crown size={16} />
                      <span className="hidden sm:inline">Tiers</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setKofiSubTab('subscribers')}
                    className={`px-3 sm:px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
                      kofiSubTab === 'subscribers'
                        ? 'text-white border-blue-500'
                        : 'text-gray-400 border-transparent hover:text-gray-300'
                    }`}
                    title="Subscribers"
                  >
                    <div className="flex items-center gap-2">
                      <Users size={16} />
                      <span className="hidden sm:inline">Subscribers</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setKofiSubTab('manual-rewards')}
                    className={`px-3 sm:px-4 py-2 font-semibold text-sm transition-all border-b-2 ${
                      kofiSubTab === 'manual-rewards'
                        ? 'text-white border-blue-500'
                        : 'text-gray-400 border-transparent hover:text-gray-300'
                    }`}
                    title="Manual Rewards"
                  >
                    <div className="flex items-center gap-2">
                      <Gift size={16} />
                      <span className="hidden sm:inline">Manual Rewards</span>
                    </div>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {/* Tiers Tab */}
                  {kofiSubTab === 'tiers' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <p className="text-gray-400 text-sm">Manage subscription tiers and their rewards</p>
                        <button
                          onClick={() => {
                            const newTier: KofiTier = {
                              id: Date.now().toString(),
                              name: '',
                              koFiTierName: '',
                              description: '',
                              rewards: [],
                              durationType: 'subscription',
                              priority: 0,
                              enabled: true,
                              createdAt: Date.now(),
                              updatedAt: Date.now()
                            };
                            setEditingTier(newTier);
                            setEditingTierForm({
                              name: '',
                              koFiTierName: '',
                              description: '',
                              rewards: [],
                              durationType: 'subscription',
                              priority: 0,
                              enabled: true
                            });
                            setShowTierModal(true);
                          }}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm sm:text-base"
                        >
                          <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                          <span className="hidden sm:inline">Add Tier</span>
                          <span className="sm:hidden">Add</span>
                        </button>
                      </div>

                      {kofiTiers.length === 0 ? (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                          <Crown className="mx-auto text-gray-500 mb-3" size={48} />
                          <h3 className="text-gray-400 font-bold mb-1">No Tiers Configured</h3>
                          <p className="text-gray-500 text-sm mb-4">Create tiers to define rewards for different subscription levels</p>
                          <button
                            onClick={() => {
                              setEditingTier({
                                id: Date.now().toString(),
                                name: '',
                                koFiTierName: '',
                                description: '',
                                rewards: [],
                                durationType: 'subscription',
                                priority: 0,
                                enabled: true,
                                createdAt: Date.now(),
                                updatedAt: Date.now()
                              });
                              setShowTierModal(true);
                            }}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm sm:text-base"
                          >
                            <span className="hidden sm:inline">Create First Tier</span>
                            <span className="sm:hidden">Create Tier</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {kofiTiers
                            .sort((a, b) => b.priority - a.priority)
                            .map((tier) => (
                              <div key={tier.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                                      {!tier.enabled && (
                                        <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs font-semibold rounded">Disabled</span>
                                      )}
                                      <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-semibold rounded">
                                        Priority: {tier.priority}
                                      </span>
                                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                        tier.durationType === 'permanent'
                                          ? 'bg-green-600/20 text-green-400'
                                          : 'bg-yellow-600/20 text-yellow-400'
                                      }`}>
                                        {tier.durationType === 'permanent' ? 'Permanent' : 'With Subscription'}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-2">
                                      Ko-fi Tier: <span className="font-mono text-gray-300">{tier.koFiTierName || 'Not set'}</span>
                                    </p>
                                    {tier.description && (
                                      <p className="text-sm text-gray-500 mb-3">{tier.description}</p>
                                    )}
                                    <div className="mt-3">
                                      <p className="text-xs text-gray-500 uppercase font-bold mb-2">Rewards ({tier.rewards.length})</p>
                                      {tier.rewards.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">No rewards configured</p>
                                      ) : (
                                        <div className="space-y-1">
                                          {tier.rewards.map((reward, idx) => (
                                            <div key={idx} className="text-sm text-gray-300 bg-gray-900/50 rounded p-2">
                                              <span className="font-medium">{reward.displayName}</span>
                                              {reward.description && (
                                                <span className="text-gray-500 ml-2">- {reward.description}</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    <button
                                      onClick={() => {
                                        setEditingTier(tier);
                                        setEditingTierForm({
                                          name: tier.name,
                                          koFiTierName: tier.koFiTierName,
                                          description: tier.description,
                                          rewards: tier.rewards,
                                          durationType: tier.durationType,
                                          priority: tier.priority,
                                          enabled: tier.enabled
                                        });
                                        setShowTierModal(true);
                                      }}
                                      className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                      title="Edit"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!confirm(`Delete tier "${tier.name}"?`)) return;
                                        const updated = kofiTiers.filter(t => t.id !== tier.id);
                                        setKofiTiers(updated);
                                        await saveKofiTiers(updated);
                                      }}
                                      className="p-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Users Tab */}
                  {kofiSubTab === 'subscribers' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-gray-400 text-sm">View users with active Ko-fi subscriptions</p>
                        <button
                          onClick={loadSubscribedUsers}
                          disabled={loadingKofiUsers}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={18} className={loadingKofiUsers ? 'animate-spin' : ''} />
                          Refresh
                        </button>
                      </div>

                      {subscribedUsers.length === 0 ? (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                          <Users className="mx-auto text-gray-500 mb-3" size={48} />
                          <h3 className="text-gray-400 font-bold mb-1">No Subscribers Found</h3>
                          <p className="text-gray-500 text-sm">Click Refresh to load subscribed users</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b border-gray-700">
                                <th className="text-left p-3 text-sm font-semibold text-gray-400">Username</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-400">Ko-fi Username</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-400">Tier</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-400">Minecraft</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-400">Status</th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-400">Last Payment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subscribedUsers.map((user) => (
                                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                                  <td className="p-3 text-sm text-white">{user.username}</td>
                                  <td className="p-3 text-sm text-gray-300 font-mono">{user.kofiUsername || 'N/A'}</td>
                                  <td className="p-3 text-sm text-amber-400">{user.kofiSubscription?.tierName || 'None'}</td>
                                  <td className="p-3 text-sm">
                                    {user.minecraftUuid ? (
                                      <div className="flex items-center gap-2 text-green-400">
                                        <CheckCircle size={16} />
                                        <span>{user.minecraftUsername || 'Linked'}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-red-400">
                                        <X size={16} />
                                        <span>Not Linked</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-sm">
                                    {user.kofiSubscription?.isActive ? (
                                      <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded">Active</span>
                                    ) : (
                                      <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs font-semibold rounded">Inactive</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-sm text-gray-400">
                                    {user.kofiSubscription?.lastPaymentDate
                                      ? new Date(user.kofiSubscription.lastPaymentDate).toLocaleDateString()
                                      : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual Rewards Tab */}
                  {kofiSubTab === 'manual-rewards' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <p className="text-gray-400 text-sm">Grant rewards to specific players manually</p>
                        <button
                          onClick={() => {
                            setShowRewardModal(true);
                          }}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm sm:text-base"
                        >
                          <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                          <span className="hidden sm:inline">Grant Reward</span>
                          <span className="sm:hidden">Grant</span>
                        </button>
                      </div>

                      {manualRewards.length === 0 ? (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                          <Gift className="mx-auto text-gray-500 mb-3" size={48} />
                          <h3 className="text-gray-400 font-bold mb-1">No Manual Rewards</h3>
                          <p className="text-gray-500 text-sm mb-4">Grant rewards to players even without subscriptions</p>
                          <button
                            onClick={() => setShowRewardModal(true)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm sm:text-base"
                          >
                            <span className="hidden sm:inline">Grant First Reward</span>
                            <span className="sm:hidden">Grant Reward</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {manualRewards.map((reward) => (
                            <div key={reward.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-white">Manual Reward</h3>
                                    {reward.granted ? (
                                      <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs font-semibold rounded">Granted</span>
                                    ) : (
                                      <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs font-semibold rounded">Pending</span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-400 mb-2">
                                    User: <span className="font-mono text-gray-300">{reward.userId}</span>
                                  </p>
                                  <p className="text-sm text-gray-400 mb-2">
                                    Reason: <span className="text-gray-300">{reward.reason}</span>
                                  </p>
                                  <p className="text-sm text-gray-400 mb-2">
                                    Granted by: <span className="text-gray-300">{reward.grantedBy}</span>
                                  </p>
                                  <div className="mt-3">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Rewards ({reward.rewards.length})</p>
                                    <div className="space-y-1">
                                      {reward.rewards.map((r, idx) => (
                                        <div key={idx} className="text-sm text-gray-300 bg-gray-900/50 rounded p-2">
                                          {r.displayName}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  {!reward.granted && (
                                    <button
                                      onClick={async () => {
                                        // Mark as granted logic here
                                      }}
                                      className="p-2 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
                                      title="Mark as Granted"
                                    >
                                      <CheckCircle size={16} />
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      if (!confirm('Delete this manual reward?')) return;
                                      const updated = manualRewards.filter(r => r.id !== reward.id);
                                      setManualRewards(updated);
                                    }}
                                    className="p-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'redeem-rewards' && (
              <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                <div className="flex items-center justify-between mb-6 flex-shrink-0">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Gift size={24} />
                    Redeem Rewards Management
                  </h2>
                  <button
                    onClick={() => {
                      setEditingRedeemCode(null);
                      setNewRedeemCode({
                        code: '',
                        description: '',
                        rewards: [],
                        maxUses: undefined,
                        expiresAt: undefined,
                        requiresMembership: undefined,
                        enabled: true
                      });
                      setShowRedeemCodeModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Plus size={18} />
                    Create Code
                  </button>
                </div>

                {/* Sub-tabs for Active/Expired/Claims */}
                <div className="flex gap-1 mb-6 border-b-2 border-gray-700">
                  <button
                    onClick={() => setRedeemCodeSubTab('active')}
                    className={`px-6 py-3 font-semibold text-base transition-all border-b-2 flex items-center gap-2 ${
                      redeemCodeSubTab === 'active'
                        ? 'text-white border-b-green-500 bg-gray-800/50'
                        : 'text-gray-400 border-b-transparent hover:text-gray-300 hover:bg-gray-800/30'
                    }`}
                  >
                    <CheckCircle size={18} />
                    Active
                    {(() => {
                      const activeCount = redeemCodes.filter(c => !c.expiresAt || c.expiresAt >= Date.now()).length;
                      return activeCount > 0 ? ` (${activeCount})` : '';
                    })()}
                  </button>
                  <button
                    onClick={() => setRedeemCodeSubTab('expired')}
                    className={`px-6 py-3 font-semibold text-base transition-all border-b-2 flex items-center gap-2 ${
                      redeemCodeSubTab === 'expired'
                        ? 'text-white border-b-red-500 bg-gray-800/50'
                        : 'text-gray-400 border-b-transparent hover:text-gray-300 hover:bg-gray-800/30'
                    }`}
                  >
                    <Clock size={18} />
                    Expired
                    {(() => {
                      const expiredCount = redeemCodes.filter(c => c.expiresAt && c.expiresAt < Date.now()).length;
                      return expiredCount > 0 ? ` (${expiredCount})` : '';
                    })()}
                  </button>
                  <button
                    onClick={() => {
                      setRedeemCodeSubTab('claims');
                      loadCodeRedemptions();
                    }}
                    className={`px-6 py-3 font-semibold text-base transition-all border-b-2 flex items-center gap-2 ${
                      redeemCodeSubTab === 'claims'
                        ? 'text-white border-b-blue-500 bg-gray-800/50'
                        : 'text-gray-400 border-b-transparent hover:text-gray-300 hover:bg-gray-800/30'
                    }`}
                  >
                    <History size={18} />
                    Claims
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {redeemCodeSubTab === 'claims' ? (
                    <>
                      {/* Claims Tab Content */}
                      <div className="mb-4 space-y-3">
                        {/* Filter Row 1: Code + Start Date + End Date + Apply */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-300 whitespace-nowrap">Code:</label>
                            <select
                              value={selectedCodeFilter}
                              onChange={(e) => setSelectedCodeFilter(e.target.value)}
                              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
                            >
                              <option value="all">All Codes</option>
                              {redeemCodes.map(code => (
                                <option key={code.id} value={code.id}>{code.code}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-300 whitespace-nowrap">From:</label>
                            <input
                              type="date"
                              value={redemptionDateFilter.start || ''}
                              onChange={(e) => setRedemptionDateFilter({ ...redemptionDateFilter, start: e.target.value })}
                              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-300 whitespace-nowrap">To:</label>
                            <input
                              type="date"
                              value={redemptionDateFilter.end || ''}
                              onChange={(e) => setRedemptionDateFilter({ ...redemptionDateFilter, end: e.target.value })}
                              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <button
                            onClick={loadCodeRedemptions}
                            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors whitespace-nowrap"
                          >
                            Apply Filters
                          </button>
                        </div>
                        {/* Filter Row 2: Sort (aligned left) */}
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-300 whitespace-nowrap">Sort by:</label>
                          <select
                            value={redemptionSortBy}
                            onChange={(e) => setRedemptionSortBy(e.target.value as any)}
                            className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="code">Code (A-Z)</option>
                            <option value="user">User (A-Z)</option>
                          </select>
                        </div>
                      </div>
                      {loadingRedemptions ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : codeRedemptions.length === 0 ? (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                          <History className="mx-auto text-gray-500 mb-3" size={48} />
                          <h3 className="text-gray-400 font-bold mb-1">No Claims Found</h3>
                          <p className="text-gray-500 text-sm">No code redemptions match your filters.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {[...codeRedemptions].sort((a, b) => {
                            switch (redemptionSortBy) {
                              case 'oldest':
                                return a.redeemedAt - b.redeemedAt;
                              case 'code':
                                return a.code.localeCompare(b.code);
                              case 'user':
                                return (a.username || '').localeCompare(b.username || '');
                              default:
                                return b.redeemedAt - a.redeemedAt;
                            }
                          }).map((redemption) => (
                            <div key={redemption.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="font-mono text-lg font-bold text-white">{redemption.code}</span>
                                    <span className="text-sm text-gray-400">by</span>
                                    <span className="font-semibold text-white">{redemption.username || 'Unknown'}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-1">
                                    <div>Redeemed: {new Date(redemption.redeemedAt).toLocaleString()}</div>
                                    {redemption.minecraftUsername && (
                                      <div>Minecraft: {redemption.minecraftUsername}</div>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {redemption.rewards?.map((reward: any, idx: number) => (
                                        <span key={idx} className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-700">
                                          {reward.displayName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Are you sure you want to revoke this redemption?\n\nThis will remove the rewards from ${redemption.username || 'this user'} and allow them to reclaim the code (if not expired).`)) {
                                        return;
                                      }
                                      try {
                                        const response = await fetch(`/api/admin/code-redemptions?redemptionId=${redemption.id}`, {
                                          method: 'DELETE'
                                        });
                                        if (response.ok) {
                                          // Refresh the redemptions list
                                          loadCodeRedemptions();
                                          // Also refresh the codes to update usedCount
                                          loadRedeemCodes();
                                          setToast({ msg: 'Redemption revoked successfully', type: 'success' });
                                        } else {
                                          const data = await response.json();
                                          setToast({ msg: data.error || 'Failed to revoke redemption', type: 'error' });
                                        }
                                      } catch (err: any) {
                                        setToast({ msg: 'Failed to revoke redemption: ' + err.message, type: 'error' });
                                      }
                                    }}
                                    className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Revoke redemption - removes reward and allows user to reclaim"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : loadingRedeemCodes ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (() => {
                    let filteredCodes = redeemCodeSubTab === 'expired'
                      ? redeemCodes.filter(c => c.expiresAt && c.expiresAt < Date.now())
                      : redeemCodes.filter(c => !c.expiresAt || c.expiresAt >= Date.now());
                    
                    // Apply sorting
                    filteredCodes = [...filteredCodes].sort((a, b) => {
                      switch (codeSortBy) {
                        case 'oldest':
                          return a.createdAt - b.createdAt;
                        case 'code':
                          return a.code.localeCompare(b.code);
                        case 'uses':
                          return b.usedCount - a.usedCount;
                        default:
                          return b.createdAt - a.createdAt;
                      }
                    });
                    
                    if (filteredCodes.length === 0) {
                      return (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                          <Gift className="mx-auto text-gray-500 mb-3" size={48} />
                          <h3 className="text-gray-400 font-bold mb-1">
                            {redeemCodeSubTab === 'expired' ? 'No Expired Codes' : 'No Active Codes'}
                          </h3>
                          <p className="text-gray-500 text-sm mb-4">
                            {redeemCodeSubTab === 'expired'
                              ? 'No codes have expired yet'
                              : 'Create redeem codes to allow users to claim rewards'}
                          </p>
                          {redeemCodeSubTab === 'active' && (
                            <button
                              onClick={() => {
                                setEditingRedeemCode(null);
                                setNewRedeemCode({
                                  code: '',
                                  description: '',
                                  rewards: [],
                                  maxUses: undefined,
                                  expiresAt: undefined,
                                  requiresMembership: undefined,
                                  enabled: true
                                });
                                setShowRedeemCodeModal(true);
                              }}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            >
                              Create First Code
                            </button>
                          )}
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                          <h3 className="text-lg font-semibold text-white">
                            {redeemCodeSubTab === 'expired' ? 'Expired Codes' : 'Active Codes'}
                          </h3>
                          <div className="flex items-center gap-2 min-w-0">
                            <label className="text-sm text-gray-300 whitespace-nowrap">Sort by:</label>
                            <select
                              value={codeSortBy}
                              onChange={(e) => setCodeSortBy(e.target.value as any)}
                              className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-0 flex-shrink"
                            >
                              <option value="newest">Newest First</option>
                              <option value="oldest">Oldest First</option>
                              <option value="code">Code (A-Z)</option>
                              <option value="uses">Most Used</option>
                            </select>
                          </div>
                        </div>
                        {filteredCodes.map((code) => (
                        <div key={code.id} className={`bg-gray-800/50 border rounded-lg p-4 ${
                          code.expiresAt && code.expiresAt < Date.now()
                            ? 'border-red-700/50 bg-red-900/10'
                            : 'border-gray-700'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-mono text-lg font-bold text-white">{code.code}</span>
                                {code.expiresAt && code.expiresAt < Date.now() ? (
                                  <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs font-semibold rounded border border-red-700">Expired</span>
                                ) : code.enabled ? (
                                  <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs font-semibold rounded border border-green-700">Active</span>
                                ) : (
                                  <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs font-semibold rounded border border-gray-600">Disabled</span>
                                )}
                              </div>
                              {code.description && (
                                <p className="text-gray-400 text-sm mb-2">{code.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mb-2">
                                {code.rewards.map((reward, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded border border-blue-700">
                                    {reward.displayName}
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                <span>Uses: {code.usedCount}{code.maxUses ? ` / ${code.maxUses}` : ' / ∞'}</span>
                                {code.expiresAt && (
                                  <span>Expires: {new Date(code.expiresAt).toLocaleString()}</span>
                                )}
                                {code.requiresMembership && (
                                  <span className="text-amber-400">Requires Membership</span>
                                )}
                                <span>Created: {new Date(code.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => {
                                  setEditingRedeemCode(code);
                                  setNewRedeemCode({
                                    code: code.code,
                                    description: code.description,
                                    rewards: code.rewards,
                                    maxUses: code.maxUses,
                                    expiresAt: code.expiresAt,
                                    requiresMembership: code.requiresMembership,
                                    enabled: code.enabled
                                  });
                                  setShowRedeemCodeModal(true);
                                }}
                                className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => deleteRedeemCode(code.id)}
                                className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'wiki' && (
              <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                {/* Header Row with Title and Create Button */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <BookOpen size={24} />
                    Wiki Management
                  </h2>
                  <button
                        onClick={() => {
                          setEditingWikiFeature(null);
                          setNewWikiFeature({
                            title: '',
                            mcVersions: [],
                            modVersions: [],
                            categories: [],
                            subcategories: [],
                            description: '',
                            descriptionType: 'markdown',
                            media: '',
                            details: []
                          });
                          setNewDetail('');
                          setMediaPreview('');
                          setShowWikiModal(true);
                        }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Plus size={18} />
                    Create Feature
                  </button>
                </div>

                {/* Filter Row 1: Search + Category + Subcategory + Clear */}
                <div className="mb-3 flex-shrink-0 flex flex-wrap items-end gap-3">
                  {/* Search */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-400 mb-1">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={wikiSearchTerm}
                        onChange={(e) => setWikiSearchTerm(e.target.value)}
                        placeholder="Search features..."
                        className="w-full pl-9 pr-8 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      {wikiSearchTerm && (
                        <button
                          onClick={() => setWikiSearchTerm('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="min-w-[140px]">
                    <label className="block text-xs text-gray-400 mb-1">Category</label>
                    <select
                      value={wikiCategoryFilter}
                      onChange={(e) => {
                        setWikiCategoryFilter(e.target.value);
                        setWikiSubcategoryFilter('all');
                      }}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="automation">Automation</option>
                      <option value="building">Building</option>
                      <option value="client">Client</option>
                      <option value="management">Management</option>
                      <option value="mobs">Mobs</option>
                      <option value="tools">Tools</option>
                      <option value="tweaks">Tweaks</option>
                      <option value="world">World</option>
                    </select>
                  </div>

                  {/* Subcategory Filter */}
                  <div className="min-w-[150px]">
                    <label className="block text-xs text-gray-400 mb-1">Subcategory</label>
                    <select
                      value={wikiSubcategoryFilter}
                      onChange={(e) => setWikiSubcategoryFilter(e.target.value)}
                      disabled={wikiCategoryFilter === 'all'}
                      className={`w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${wikiCategoryFilter === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="all">{wikiCategoryFilter === 'all' ? 'Select category first' : 'All Subcategories'}</option>
                      {wikiCategoryFilter === 'automation' && (
                        <>
                          <option value="redstone">Redstone</option>
                          <option value="vanilla">Vanilla</option>
                          <option value="technical">Technical</option>
                          <option value="addon">Addon</option>
                        </>
                      )}
                      {wikiCategoryFilter === 'building' && (
                        <>
                          <option value="blocks">Blocks</option>
                          <option value="decoration">Decoration</option>
                          <option value="utility">Utility</option>
                          <option value="blueprints">Blueprints</option>
                        </>
                      )}
                      {wikiCategoryFilter === 'client' && (
                        <>
                          <option value="visuals">Visuals</option>
                          <option value="performance">Performance</option>
                          <option value="resources">Resources</option>
                        </>
                      )}
                      {wikiCategoryFilter === 'management' && (
                        <>
                          <option value="permissions">Permissions</option>
                          <option value="economy">Economy</option>
                          <option value="server">Server</option>
                        </>
                      )}
                      {wikiCategoryFilter === 'mobs' && (
                        <>
                          <option value="hostile">Hostile</option>
                          <option value="passive">Passive</option>
                          <option value="utility">Utility</option>
                        </>
                      )}
                      {wikiCategoryFilter === 'tools' && (
                        <>
                          <option value="mining">Mining</option>
                          <option value="building">Building</option>
                          <option value="utility">Utility</option>
                        </>
                      )}
                      {wikiCategoryFilter === 'tweaks' && (
                        <>
                          <option value="gameplay">Gameplay</option>
                          <option value="performance">Performance</option>
                          <option value="qol">Quality of Life</option>
                        </>
                      )}
                      {wikiCategoryFilter === 'world' && (
                        <>
                          <option value="biomes">Biomes</option>
                          <option value="structures">Structures</option>
                          <option value="dimensions">Dimensions</option>
                          <option value="editing">Editing</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  {(wikiSearchTerm || wikiCategoryFilter !== 'all' || wikiSubcategoryFilter !== 'all' || wikiMcVersionFilter !== 'all' || wikiModVersionFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setWikiSearchTerm('');
                        setWikiCategoryFilter('all');
                        setWikiSubcategoryFilter('all');
                        setWikiMcVersionFilter('all');
                        setWikiModVersionFilter('all');
                      }}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors whitespace-nowrap"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Filter Row 2: MC Version + Mod Version + Sort */}
                <div className="mb-4 flex-shrink-0 flex flex-wrap items-center gap-3">
                  {/* MC Version Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-300 whitespace-nowrap">MC Version:</label>
                    <select
                      value={wikiMcVersionFilter}
                      onChange={(e) => setWikiMcVersionFilter(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All</option>
                      {config.mcVersions.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mod Version Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-300 whitespace-nowrap">Mod Version:</label>
                    <select
                      value={wikiModVersionFilter}
                      onChange={(e) => setWikiModVersionFilter(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="all">All</option>
                      {config.modVersions.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By */}
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-sm text-gray-300 whitespace-nowrap">Sort by:</label>
                    <select
                      value={wikiSortBy}
                      onChange={(e) => setWikiSortBy(e.target.value as any)}
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="title">Title (A-Z)</option>
                      <option value="category">Category</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {loadingWikiFeatures ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : wikiFeatures.length === 0 ? (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                      <BookOpen className="mx-auto text-gray-500 mb-3" size={48} />
                      <h3 className="text-gray-400 font-bold mb-1">No Wiki Features</h3>
                      <p className="text-gray-500 text-sm mb-4">Create wiki features to display on the wiki page</p>
                      <button
                        onClick={() => {
                          setEditingWikiFeature(null);
                          setNewWikiFeature({
                            title: '',
                            mcVersions: [],
                            modVersions: [],
                            categories: [],
                            subcategories: [],
                            description: '',
                            descriptionType: 'markdown',
                            media: '',
                            details: []
                          });
                          setNewDetail('');
                          setMediaPreview('');
                          setShowWikiModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        Create First Feature
                      </button>
                    </div>
                  ) : (() => {
                    // Apply filters to wiki features
                    let filteredWikiFeatures = wikiFeatures.filter(feature => {
                      const oldFeature = feature as any;
                      const featureCategories = feature.categories || (oldFeature.category ? [oldFeature.category] : []);
                      const featureSubcategories = feature.subcategories || (oldFeature.subcategory ? [oldFeature.subcategory] : []);
                      const featureMcVersions = feature.mcVersions || (oldFeature.version ? [oldFeature.version] : []);
                      const featureModVersions = feature.modVersions || (oldFeature.modVersion ? [oldFeature.modVersion] : []);

                      // Search filter
                      const searchMatch = !wikiSearchTerm || 
                        feature.title.toLowerCase().includes(wikiSearchTerm.toLowerCase()) ||
                        feature.description.toLowerCase().includes(wikiSearchTerm.toLowerCase()) ||
                        (feature.details && feature.details.some(d => d.toLowerCase().includes(wikiSearchTerm.toLowerCase())));

                      // Category filter
                      const categoryMatch = wikiCategoryFilter === 'all' || featureCategories.includes(wikiCategoryFilter);

                      // Subcategory filter
                      const subcategoryMatch = wikiSubcategoryFilter === 'all' || featureSubcategories.includes(wikiSubcategoryFilter);

                      // MC Version filter
                      const mcVersionMatch = wikiMcVersionFilter === 'all' || featureMcVersions.includes(wikiMcVersionFilter);

                      // Mod Version filter
                      const modVersionMatch = wikiModVersionFilter === 'all' || featureModVersions.includes(wikiModVersionFilter);

                      return searchMatch && categoryMatch && subcategoryMatch && mcVersionMatch && modVersionMatch;
                    });

                    // Apply sorting
                    filteredWikiFeatures = [...filteredWikiFeatures].sort((a, b) => {
                      const oldA = a as any;
                      const oldB = b as any;
                      switch (wikiSortBy) {
                        case 'oldest':
                          return (a.createdAt || 0) - (b.createdAt || 0);
                        case 'title':
                          return a.title.localeCompare(b.title);
                        case 'category':
                          const catA = (a.categories || (oldA.category ? [oldA.category] : []))[0] || '';
                          const catB = (b.categories || (oldB.category ? [oldB.category] : []))[0] || '';
                          return catA.localeCompare(catB);
                        default: // newest
                          return (b.createdAt || 0) - (a.createdAt || 0);
                      }
                    });

                    if (filteredWikiFeatures.length === 0) {
                      return (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
                          <Search className="mx-auto text-gray-500 mb-3" size={48} />
                          <h3 className="text-gray-400 font-bold mb-1">No Matching Features</h3>
                          <p className="text-gray-500 text-sm mb-4">No features match your current filters. Try adjusting your search or filters.</p>
                          <button
                            onClick={() => {
                              setWikiSearchTerm('');
                              setWikiCategoryFilter('all');
                              setWikiSubcategoryFilter('all');
                              setWikiMcVersionFilter('all');
                              setWikiModVersionFilter('all');
                            }}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                          >
                            Clear All Filters
                          </button>
                        </div>
                      );
                    }

                    return (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-400 mb-2">
                        Showing {filteredWikiFeatures.length} of {wikiFeatures.length} features
                      </div>
                      {filteredWikiFeatures.map((feature) => (
                        <div key={feature.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                                {(feature.categories || (feature as any).category ? [(feature as any).category].filter(Boolean) : []).map((cat: string) => (
                                  <span key={cat} className="px-2 py-1 bg-green-900/30 text-green-400 text-xs font-semibold rounded border border-green-700">
                                    {cat}
                                  </span>
                                ))}
                                {(feature.subcategories || ((feature as any).subcategory ? [(feature as any).subcategory] : [])).map((subcat: string) => (
                                  <span key={subcat} className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs font-semibold rounded border border-blue-700">
                                    {subcat}
                                  </span>
                                ))}
                              </div>
                              <p className="text-gray-400 text-sm mb-2 line-clamp-2">{feature.description}</p>
                              <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                <span>MC: {(feature.mcVersions || ((feature as any).version ? [(feature as any).version] : [])).join(', ') || 'N/A'}</span>
                                {(feature.modVersions || ((feature as any).modVersion ? [(feature as any).modVersion] : [])).length > 0 && (
                                  <span>Mod: {feature.modVersions?.join(', ') || (feature as any).modVersion}</span>
                                )}
                                {feature.details && feature.details.length > 0 && (
                                  <span>{feature.details.length} detail{feature.details.length !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => {
                                  setEditingWikiFeature(feature);
                                  // Handle migration from old format to new format
                                  const oldFeature = feature as any;
                                  setNewWikiFeature({
                                    title: feature.title,
                                    mcVersions: feature.mcVersions || (oldFeature.version ? [oldFeature.version] : []),
                                    modVersions: feature.modVersions || (oldFeature.modVersion ? [oldFeature.modVersion] : []),
                                    categories: feature.categories || (oldFeature.category ? [oldFeature.category] : []),
                                    subcategories: feature.subcategories || (oldFeature.subcategory ? [oldFeature.subcategory] : []),
                                    description: feature.description,
                                    descriptionType: feature.descriptionType || 'text',
                                    media: feature.media || (oldFeature.image || oldFeature.video),
                                    details: feature.details || []
                                  });
                                  setNewDetail('');
                                  setMediaPreview(feature.media || (feature as any).image || (feature as any).video || '');
                                  setShowWikiModal(true);
                                }}
                                className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => deleteWikiFeature(feature.id)}
                                className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {activeTab === 'config' && (
                <div className="flex flex-col h-full min-h-0 w-full min-w-0">
                     
                     <div className="flex gap-2 border-b border-gray-800 flex-shrink-0 pb-2 mb-4 w-full">
                        <button
                            onClick={() => setConfigTab('home')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                configTab === 'home'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Home"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <i className="fa fa-home" aria-hidden="true"></i>
                                <span className="hidden md:inline">Home</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setConfigTab('navbar')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                configTab === 'navbar'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Navbar"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <i className="fa fa-bars" aria-hidden="true"></i>
                                <span className="hidden md:inline">Navbar</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setConfigTab('links')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                configTab === 'links'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Links/Social"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <LinkIcon size={16} className="flex-shrink-0" />
                                <span className="hidden md:inline">Links/Social</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setConfigTab('footer')}
                            className={`px-4 py-2 font-semibold text-sm transition-all border-b-2 flex-shrink-0 ${
                                configTab === 'footer'
                                    ? 'text-white border-blue-500'
                                    : 'text-gray-400 border-transparent hover:text-gray-300'
                            }`}
                            title="Footer"
                        >
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <i className="fa fa-window-minimize" aria-hidden="true"></i>
                                <span className="hidden md:inline">Footer</span>
                            </div>
                        </button>
                     </div>

                     
                     <div className="flex-shrink-0 mb-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-white">System Configuration</h2>
                        <button onClick={saveGeneralConfig} className="bg-green-700 hover:bg-green-600 text-white px-3 sm:px-4 py-2 rounded font-bold flex items-center gap-2 text-xs sm:text-sm shadow-lg shadow-green-900/20 transition-all w-full sm:w-auto justify-center"><Save size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Save All Changes</span><span className="sm:hidden">Save</span></button>
                        </div>
                     </div>

                     
                     <div className="flex-1 overflow-y-auto custom-scrollbar pr-2" style={{ willChange: 'scroll-position' }}>
                     <div className="w-full min-w-0 max-w-full" style={{ contentVisibility: 'auto' }}>
                     
                     {configTab === 'home' && (
                     <div className="space-y-6 w-full min-w-0" style={{ contentVisibility: 'auto' }}>
                     <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                         <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><i className="fa fa-home" aria-hidden="true"></i> Home Page Content</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Headline</label>
                                 <input 
                                     value={heroConfig.headline} 
                                     onChange={(e) => setHeroConfig({...heroConfig, headline: e.target.value})} 
                                     className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Subheadline</label>
                                 <input 
                                     value={heroConfig.subheadline} 
                                     onChange={(e) => setHeroConfig({...heroConfig, subheadline: e.target.value})} 
                                     className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                 />
                             </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs text-gray-500 mb-1">Headline Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        value={(() => {
                                            const color = heroConfig.headlineColor || '';
                                            const hexMatch = color.match(/#[0-9a-fA-F]{6}/);
                                            return hexMatch ? hexMatch[0] : '#34d399';
                                        })()} 
                                        onChange={(e) => setHeroConfig({...heroConfig, headlineColor: e.target.value})} 
                                        className="w-12 h-10 bg-black/30 border border-gray-700 rounded cursor-pointer flex-shrink-0" 
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="#34d399 or linear-gradient(to right, #34d399, #059669)" 
                                        value={heroConfig.headlineColor || ''} 
                                        onChange={(e) => setHeroConfig({...heroConfig, headlineColor: e.target.value})} 
                                        className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">Hex color (e.g., #34d399) or CSS gradient</p>
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs text-gray-500 mb-1">Headline Glow Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        value={(() => {
                                            const color = heroConfig.headlineGlowColor || '';
                                            const hexMatch = color.match(/#[0-9a-fA-F]{6}/);
                                            return hexMatch ? hexMatch[0] : '#34d399';
                                        })()} 
                                        onChange={(e) => setHeroConfig({...heroConfig, headlineGlowColor: e.target.value})} 
                                        className="w-12 h-10 bg-black/30 border border-gray-700 rounded cursor-pointer flex-shrink-0" 
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="#34d399 or rgb(52, 211, 153)" 
                                        value={heroConfig.headlineGlowColor || ''} 
                                        onChange={(e) => setHeroConfig({...heroConfig, headlineGlowColor: e.target.value})} 
                                        className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">Hex color (e.g., #34d399) or CSS gradient</p>
                            </div>
                             <div className="md:col-span-2">
                                 <label className="block text-xs text-gray-500 mb-1">Description</label>
                                 <textarea 
                                     value={heroConfig.description} 
                                     onChange={(e) => setHeroConfig({...heroConfig, description: e.target.value})} 
                                     className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                     rows={3} 
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Latest Mod Version</label>
                                 <input 
                                     value={heroConfig.latestModVersion} 
                                     onChange={(e) => setHeroConfig({...heroConfig, latestModVersion: e.target.value})} 
                                     className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                 />
                         </div>
                             <div>
                                 <label className="block text-xs text-gray-500 mb-1">Latest MC Versions</label>
                                 <input 
                                     value={heroConfig.latestMcVersions} 
                                     onChange={(e) => setHeroConfig({...heroConfig, latestMcVersions: e.target.value})} 
                                     className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                 />
                     </div>
                         </div>
                     </div>
                     
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full min-w-0">
                         <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                             <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Minecraft Versions</h3>
                             <div className="flex gap-2 mb-4"><input placeholder="e.g. 1.21" value={configMcVer} onChange={e => setConfigMcVer(e.target.value)} className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" /><button onClick={() => { if(configMcVer) { onUpdateConfig({...config, mcVersions: [configMcVer, ...config.mcVersions]}); setConfigMcVer(""); }}} className="bg-blue-600 text-white px-3 py-2 rounded"><Plus size={18}/></button></div>
                             <div className="flex flex-wrap gap-2">{config.mcVersions.map(v => <span key={v} className="px-3 py-1.5 bg-gray-800 rounded text-sm text-gray-300 border border-gray-700 flex items-center gap-2 group">{v}<button onClick={() => onUpdateConfig({...config, mcVersions: config.mcVersions.filter(x => x !== v)})} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={14}/></button></span>)}</div>
                         </div>
                         <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                             <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Mod Versions</h3>
                             <div className="flex gap-2 mb-4"><input placeholder="e.g. 1.6.0" value={configModVer} onChange={e => setConfigModVer(e.target.value)} className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" /><button onClick={() => { if(configModVer) { onUpdateConfig({...config, modVersions: [configModVer, ...config.modVersions]}); setConfigModVer(""); }}} className="bg-blue-600 text-white px-3 py-2 rounded"><Plus size={18}/></button></div>
                             <div className="flex flex-wrap gap-2">{config.modVersions.map(v => <span key={v} className="px-3 py-1.5 bg-gray-800 rounded text-sm text-gray-300 border border-gray-700 flex items-center gap-2 group">{v}<button onClick={() => onUpdateConfig({...config, modVersions: config.modVersions.filter(x => x !== v)})} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={14}/></button></span>)}</div>
                         </div>
                     </div>
                     </div>
                     )}

                     
                     {configTab === 'navbar' && (
                     <div className="space-y-6 animate-fadeIn w-full min-w-0" style={{ contentVisibility: 'auto' }}>
                     <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                         <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><Settings size={16} /> Navbar Icon Configuration</h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             
                             <div className="flex flex-col">
                                 <label className="block text-xs text-gray-500 mb-2">Website Icon</label>
                                 <div className="relative mb-4">
                                     {navbarIconConfig.icon ? (
                                         <img 
                                             src={navbarIconConfig.icon} 
                                             alt="Navbar Icon" 
                                             className="border-2 border-gray-700"
                                             style={{
                                                 width: `${navbarIconConfig.size || 40}px`,
                                                 height: `${navbarIconConfig.size || 40}px`,
                                                 borderRadius: `${navbarIconConfig.borderRadius || 8}px`,
                                                 backgroundColor: navbarIconConfig.backgroundColor === 'transparent' ? 'transparent' : navbarIconConfig.backgroundColor || 'transparent',
                                                 opacity: navbarIconConfig.backgroundOpacity || 1,
                                                 padding: `${navbarIconConfig.padding || 0}px`,
                                                 border: `${navbarIconConfig.borderWidth || 0}px solid ${navbarIconConfig.borderColor === 'transparent' ? 'transparent' : navbarIconConfig.borderColor || 'transparent'}`,
                                                 objectFit: 'contain'
                                             }}
                                         />
                                     ) : (
                                         <div 
                                             className="border-2 border-dashed border-gray-700 flex items-center justify-center bg-gray-900/50"
                                             style={{
                                                 width: `${navbarIconConfig.size || 40}px`,
                                                 height: `${navbarIconConfig.size || 40}px`,
                                                 borderRadius: `${navbarIconConfig.borderRadius || 8}px`
                                             }}
                                         >
                                             <Upload size={20} className="text-gray-500" />
                                         </div>
                                     )}
                                 </div>
                                 
                                 
                                 <div className="mt-auto hidden md:block">
                                     <div 
                                         className={`bg-green-900/20 border-2 rounded-lg px-3 py-2 transition-colors ${
                                             navbarDragActive 
                                                 ? 'border-green-500 bg-green-900/40' 
                                                 : 'border-green-500/30'
                                         }`}
                                         onDragEnter={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             setNavbarDragActive(true);
                                         }}
                                         onDragLeave={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();

                                             if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                 setNavbarDragActive(false);
                                             }
                                         }}
                                         onDragOver={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                         }}
                                         onDrop={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             setNavbarDragActive(false);
                                             
                                             const file = e.dataTransfer.files?.[0];
                                             if (file && file.type.startsWith('image/')) {
                                                 setNavbarIsUploading(true);
                                                 setNavbarUploadProgress(0);
                                                 
                                                 const reader = new FileReader();
                                                 reader.onprogress = (event) => {
                                                     if (event.lengthComputable) {
                                                         const progress = Math.round((event.loaded / event.total) * 100);
                                                         setNavbarUploadProgress(progress);
                                                     }
                                                 };
                                                 reader.onloadend = () => {
                                                     if (reader.result) {
                                                         const base64 = reader.result as string;

                                                         setNavbarOriginalImage(base64);

                                                         setNavbarIconConfig({...navbarIconConfig, icon: base64});
                                                         setNavbarUploadProgress(100);
                                                         setTimeout(() => {
                                                             setNavbarIsUploading(false);
                                                             setNavbarUploadProgress(0);
                                                         }, 300);
                                                     } else {
                                                         setNavbarIsUploading(false);
                                                         setNavbarUploadProgress(0);
                                                     }
                                                 };
                                                 reader.onerror = () => {
                                                     setNavbarIsUploading(false);
                                                     setNavbarUploadProgress(0);
                                                 };
                                                 reader.readAsDataURL(file);
                                             }
                                         }}
                                     >
                                         <input
                                             type="file"
                                             accept="image/*"
                                             onChange={(e) => {
                                                 const file = e.target.files?.[0];
                                                 if (file && file.type.startsWith('image/')) {
                                                     setNavbarIsUploading(true);
                                                     setNavbarUploadProgress(0);
                                                     
                                                     const reader = new FileReader();
                                                     reader.onprogress = (event) => {
                                                         if (event.lengthComputable) {
                                                             const progress = Math.round((event.loaded / event.total) * 100);
                                                             setNavbarUploadProgress(progress);
                                                         }
                                                     };
                                                     reader.onloadend = () => {
                                                         if (reader.result) {
                                                             const base64 = reader.result as string;

                                                             setNavbarOriginalImage(base64);

                                                             setNavbarIconConfig({...navbarIconConfig, icon: base64});
                                                             setNavbarUploadProgress(100);
                                                             setTimeout(() => {
                                                                 setNavbarIsUploading(false);
                                                                 setNavbarUploadProgress(0);
                                                             }, 300);
                                                         } else {
                                                             setNavbarIsUploading(false);
                                                             setNavbarUploadProgress(0);
                                                         }
                                                     };
                                                     reader.onerror = () => {
                                                         setNavbarIsUploading(false);
                                                         setNavbarUploadProgress(0);
                                                     };
                                                     reader.readAsDataURL(file);
                                                 }
                                                 if (e.target) e.target.value = '';
                                             }}
                                             className="hidden"
                                             id="navbar-icon-upload"
                                         />
                                         <div className="flex flex-col gap-2 mb-1">
                                             <button
                                                 onClick={() => document.getElementById('navbar-icon-upload')?.click()}
                                                 className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                 title={navbarIconConfig.icon ? 'Change Icon' : 'Upload Icon'}
                                             >
                                                 <Upload size={14} />
                                                 <span className="hidden sm:inline">{navbarIconConfig.icon ? 'Change Icon' : 'Upload Icon'}</span>
                                             </button>
                                             {navbarIconConfig.icon && (
                                                 <button
                                                     onClick={() => {

                                                         const imageToCrop = navbarOriginalImage || navbarIconConfig.icon;
                                                         if (imageToCrop) {

                                                             if (!navbarOriginalImage && navbarIconConfig.icon) {
                                                                 setNavbarOriginalImage(navbarIconConfig.icon);
                                                             }
                                                             setShowNavbarCropEditor(true);
                                                             setNavbarCropScale(1);
                                                             setNavbarCropPosition({ x: 0, y: 0 });
                                                         }
                                                     }}
                                                     className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                     title="Crop"
                                                 >
                                                     <Crop size={14} />
                                                     <span className="hidden sm:inline">Crop</span>
                                                 </button>
                                             )}
                                         </div>
                                         <p className="text-[10px] text-gray-500 leading-tight">
                                             {navbarDragActive ? 'Drop image here' : 'Recommended: Square image (e.g., 128x128px)'}
                                         </p>
                                     </div>
                                 </div>
                             </div>

                             
                             <div>
                                 
                                 {navbarIsUploading && (
                                     <div className="mb-3">
                                         <div className="flex items-center justify-between mb-1">
                                             <span className="text-xs text-gray-400">Uploading icon...</span>
                                             <span className="text-xs text-gray-400">{navbarUploadProgress}%</span>
                                         </div>
                                         <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                             <div 
                                                 className="bg-green-500 h-full transition-all duration-300 ease-out"
                                                 style={{ width: `${navbarUploadProgress}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                 )}
                                 
                                 <div className="md:hidden mb-2">
                                     <div className="flex flex-row gap-1.5">
                                         <input
                                             type="file"
                                             accept="image/*"
                                             onChange={(e) => {
                                                 const file = e.target.files?.[0];
                                                 if (file && file.type.startsWith('image/')) {
                                                     setNavbarIsUploading(true);
                                                     setNavbarUploadProgress(0);
                                                     
                                                     const reader = new FileReader();
                                                     reader.onprogress = (event) => {
                                                         if (event.lengthComputable) {
                                                             const progress = Math.round((event.loaded / event.total) * 100);
                                                             setNavbarUploadProgress(progress);
                                                         }
                                                     };
                                                     reader.onloadend = () => {
                                                         if (reader.result) {
                                                             const base64 = reader.result as string;
                                                             setNavbarOriginalImage(base64);
                                                             setNavbarIconConfig({...navbarIconConfig, icon: base64});
                                                             setNavbarUploadProgress(100);
                                                             setTimeout(() => {
                                                                 setNavbarIsUploading(false);
                                                                 setNavbarUploadProgress(0);
                                                             }, 300);
                                                         } else {
                                                             setNavbarIsUploading(false);
                                                             setNavbarUploadProgress(0);
                                                         }
                                                     };
                                                     reader.onerror = () => {
                                                         setNavbarIsUploading(false);
                                                         setNavbarUploadProgress(0);
                                                     };
                                                     reader.readAsDataURL(file);
                                                 }
                                                 if (e.target) e.target.value = '';
                                             }}
                                             className="hidden"
                                             id="navbar-icon-upload-mobile"
                                         />
                                         <button
                                             onClick={() => document.getElementById('navbar-icon-upload-mobile')?.click()}
                                             className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center justify-center text-xs"
                                             title={navbarIconConfig.icon ? 'Change Icon' : 'Upload Icon'}
                                         >
                                             <Upload size={12} />
                                         </button>
                                         {navbarIconConfig.icon && (
                                             <>
                                                 <button
                                                     onClick={() => {
                                                         const imageToCrop = navbarOriginalImage || navbarIconConfig.icon;
                                                         if (imageToCrop) {
                                                             if (!navbarOriginalImage && navbarIconConfig.icon) {
                                                                 setNavbarOriginalImage(navbarIconConfig.icon);
                                                             }
                                                             setShowNavbarCropEditor(true);
                                                             setNavbarCropScale(1);
                                                             setNavbarCropPosition({ x: 0, y: 0 });
                                                         }
                                                     }}
                                                     className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs"
                                                     title="Crop"
                                                 >
                                                     <Crop size={12} />
                                                 </button>
                                                 <button
                                                     onClick={() => {
                                                         setNavbarIconConfig({...navbarIconConfig, icon: undefined});
                                                         setNavbarOriginalImage('');
                                                     }}
                                                     className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs"
                                                     title="Remove Icon"
                                                 >
                                                     <Trash2 size={12} />
                                                 </button>
                                                 <button
                                                     onClick={() => {
                                                         setNavbarIconConfig({
                                                             ...navbarIconConfig,
                                                             size: 40,
                                                             borderRadius: 8,
                                                             backgroundColor: 'transparent',
                                                             backgroundOpacity: 1,
                                                             padding: 0,
                                                             borderColor: 'transparent',
                                                             borderWidth: 0
                                                         });
                                                         setNavbarPreviewZoom(1);
                                                     }}
                                                     className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs"
                                                     title="Reset All Settings"
                                                 >
                                                     <RotateCcw size={12} />
                                                 </button>
                                             </>
                                         )}
                                     </div>
                                 </div>
                                 <div className="flex items-center justify-between mb-2">
                                     <label className="block text-xs text-gray-500">Preview</label>
                                     {navbarIconConfig.icon && (
                                         <div className="hidden md:flex flex-row gap-2">
                                             <button
                                                 onClick={() => {
                                                     setNavbarIconConfig({...navbarIconConfig, icon: undefined});
                                                     setNavbarOriginalImage('');
                                                 }}
                                                 className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                 title="Remove Icon"
                                             >
                                                 <Trash2 size={14} />
                                                 <span className="hidden sm:inline">Remove</span>
                                             </button>
                                             <button
                                                 onClick={() => {
                                                     setNavbarIconConfig({
                                                         ...navbarIconConfig,
                                                         size: 40,
                                                         borderRadius: 8,
                                                         backgroundColor: 'transparent',
                                                         backgroundOpacity: 1,
                                                         padding: 0,
                                                         borderColor: 'transparent',
                                                         borderWidth: 0
                                                     });
                                                     setNavbarPreviewZoom(1);
                                                 }}
                                                 className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                 title="Reset All Settings"
                                             >
                                                 <RotateCcw size={14} />
                                                 <span className="hidden sm:inline">Reset All</span>
                                             </button>
                                         </div>
                                     )}
                                 </div>
                                 <div className="bg-gray-900/50 border-2 border-gray-700 rounded-lg p-8 flex items-center justify-center flex-1" style={{ minHeight: '200px', width: '100%' }}>
                                     {navbarIconConfig.icon ? (
                                         <div 
                                             style={{
                                                 width: '100%',
                                                 height: '100%',
                                                 display: 'flex',
                                                 alignItems: 'center',
                                                 justifyContent: 'center',
                                                 maxWidth: '100%',
                                                 maxHeight: '100%'
                                             }}
                                         >
                                             <img 
                                                 src={navbarIconConfig.icon} 
                                                 alt="Preview" 
                                                 style={{
                                                     maxWidth: '100%',
                                                     maxHeight: '100%',
                                                     width: 'auto',
                                                     height: 'auto',
                                                     borderRadius: `${navbarIconConfig.borderRadius || 8}px`,
                                                     backgroundColor: navbarIconConfig.backgroundColor === 'transparent' ? 'transparent' : navbarIconConfig.backgroundColor || 'transparent',
                                                     opacity: navbarIconConfig.backgroundOpacity || 1,
                                                     padding: `${navbarIconConfig.padding || 0}px`,
                                                     border: `${navbarIconConfig.borderWidth || 0}px solid ${navbarIconConfig.borderColor === 'transparent' ? 'transparent' : navbarIconConfig.borderColor || 'transparent'}`,
                                                     objectFit: 'contain',
                                                     transition: 'all 0.2s ease'
                                                 }}
                                             />
                                         </div>
                                     ) : (
                                         <div className="text-gray-500 text-sm">Upload an icon to see preview</div>
                                     )}
                                 </div>
                             </div>
                         </div>

                         
                         <div className="space-y-3 border-t border-gray-800 pt-4 mt-6">
                             
                             <div>
                                 <div className="flex items-center justify-between mb-2">
                                     <label className="block text-xs text-gray-500">Size: {navbarIconConfig.size || 40}px</label>
                                     <div className="flex gap-2">
                                         <button
                                             onClick={() => {
                                                 const newSize = Math.max(20, (navbarIconConfig.size || 40) - 1);
                                                 setNavbarIconConfig({...navbarIconConfig, size: newSize});

                                                 const baseSize = 40;
                                                 const inverseSize = 2 * baseSize - newSize;
                                                 const newZoom = inverseSize / newSize;
                                                 setNavbarPreviewZoom(newZoom);
                                             }}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                             title="Decrease Size"
                                         >
                                             <Minimize2 size={12} />
                                         </button>
                                         <button
                                             onClick={() => {
                                                 const newSize = Math.min(200, (navbarIconConfig.size || 40) + 1);
                                                 setNavbarIconConfig({...navbarIconConfig, size: newSize});

                                                 const baseSize = 40;
                                                 const inverseSize = 2 * baseSize - newSize;
                                                 const newZoom = inverseSize / newSize;
                                                 setNavbarPreviewZoom(newZoom);
                                             }}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                             title="Increase Size"
                                         >
                                             <Maximize2 size={12} />
                                         </button>
                                         <button
                                             onClick={() => {
                                                 setNavbarIconConfig({...navbarIconConfig, size: 40});
                                                 setNavbarPreviewZoom(1);
                                             }}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                 </div>
                                 <input
                                     type="range"
                                     min="20"
                                     max="200"
                                     value={navbarIconConfig.size || 40}
                                     onChange={(e) => {
                                         const newSize = parseInt(e.target.value) || 40;
                                         setNavbarIconConfig({...navbarIconConfig, size: newSize});

                                         const baseSize = 40;
                                         const inverseSize = 2 * baseSize - newSize;
                                         const newZoom = inverseSize / newSize;
                                         setNavbarPreviewZoom(newZoom);
                                     }}
                                     className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                 />
                             </div>
                             
                             
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Roundness: {navbarIconConfig.borderRadius || 8}px</label>
                                         <button
                                             onClick={() => setNavbarIconConfig({...navbarIconConfig, borderRadius: 8})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="50"
                                         value={navbarIconConfig.borderRadius || 8}
                                         onChange={(e) => setNavbarIconConfig({...navbarIconConfig, borderRadius: parseInt(e.target.value) || 0})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Opacity: {Math.round((navbarIconConfig.backgroundOpacity || 1) * 100)}%</label>
                                         <button
                                             onClick={() => setNavbarIconConfig({...navbarIconConfig, backgroundOpacity: 1})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="1"
                                         step="0.01"
                                         value={navbarIconConfig.backgroundOpacity || 1}
                                         onChange={(e) => setNavbarIconConfig({...navbarIconConfig, backgroundOpacity: parseFloat(e.target.value) || 1})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                             </div>
                             
                             
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Padding: {navbarIconConfig.padding || 0}px</label>
                                         <button
                                             onClick={() => setNavbarIconConfig({...navbarIconConfig, padding: 0})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="20"
                                         value={navbarIconConfig.padding || 0}
                                         onChange={(e) => setNavbarIconConfig({...navbarIconConfig, padding: parseInt(e.target.value) || 0})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Border Width: {navbarIconConfig.borderWidth || 0}px</label>
                                         <button
                                             onClick={() => setNavbarIconConfig({...navbarIconConfig, borderWidth: 0})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="10"
                                         value={navbarIconConfig.borderWidth || 0}
                                         onChange={(e) => setNavbarIconConfig({...navbarIconConfig, borderWidth: parseInt(e.target.value) || 0})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                             </div>
                             
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-2">Background Color</label>
                                     <div className="flex gap-2 items-center">
                                         <input 
                                             type="color" 
                                             value={(() => {
                                                 const color = navbarIconConfig.backgroundColor || 'transparent';
                                                 const hexMatch = color.match(/#[0-9a-fA-F]{6}/);
                                                 return hexMatch ? hexMatch[0] : '#000000';
                                             })()} 
                                             onChange={(e) => setNavbarIconConfig({...navbarIconConfig, backgroundColor: e.target.value})} 
                                             className="w-12 h-10 bg-black/30 border border-gray-700 rounded cursor-pointer flex-shrink-0" 
                                         />
                                         <input
                                             type="text"
                                             placeholder="transparent or #hex"
                                             value={navbarIconConfig.backgroundColor || 'transparent'}
                                             onChange={(e) => setNavbarIconConfig({...navbarIconConfig, backgroundColor: e.target.value || 'transparent'})}
                                             className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                         />
                                     </div>
                                     <p className="text-[10px] text-gray-500 mt-1">Hex color (e.g., #000000) or transparent</p>
                                 </div>
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-2">Border Color</label>
                                     <div className="flex gap-2 items-center">
                                         <input 
                                             type="color" 
                                             value={(() => {
                                                 const color = navbarIconConfig.borderColor || 'transparent';
                                                 const hexMatch = color.match(/#[0-9a-fA-F]{6}/);
                                                 return hexMatch ? hexMatch[0] : '#ffffff';
                                             })()} 
                                             onChange={(e) => setNavbarIconConfig({...navbarIconConfig, borderColor: e.target.value})} 
                                             className="w-12 h-10 bg-black/30 border border-gray-700 rounded cursor-pointer flex-shrink-0" 
                                         />
                                         <input
                                             type="text"
                                             placeholder="transparent or #hex"
                                             value={navbarIconConfig.borderColor || 'transparent'}
                                             onChange={(e) => setNavbarIconConfig({...navbarIconConfig, borderColor: e.target.value || 'transparent'})}
                                             className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                         />
                                     </div>
                                     <p className="text-[10px] text-gray-500 mt-1">Hex color (e.g., #ffffff) or transparent</p>
                                 </div>
                             </div>
                         </div>
                     </div>
                     </div>
                     )}

                     
                     {configTab === 'links' && (
                     <div className="space-y-6 animate-fadeIn w-full min-w-0" style={{ contentVisibility: 'auto' }}>
                    <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                         <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><LinkIcon size={16} /> External Links</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div><label className="block text-xs text-gray-500 mb-1">CurseForge</label><input value={linkConfig.curseforge || ""} onChange={(e) => setLinkConfig({...linkConfig, curseforge: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" /></div>
                             <div><label className="block text-xs text-gray-500 mb-1">Modrinth</label><input value={linkConfig.modrinth || ""} onChange={(e) => setLinkConfig({...linkConfig, modrinth: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" /></div>
                             <div><label className="block text-xs text-gray-500 mb-1">Discord</label><input value={linkConfig.discord || ""} onChange={(e) => setLinkConfig({...linkConfig, discord: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" /></div>
                             <div><label className="block text-xs text-gray-500 mb-1">Source Code</label><input value={linkConfig.source || ""} onChange={(e) => setLinkConfig({...linkConfig, source: e.target.value})} className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" /></div>
                             <div><label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><Coffee size={12} /> Ko-fi</label><input value={linkConfig.kofi || ""} onChange={(e) => setLinkConfig({...linkConfig, kofi: e.target.value})} placeholder="https://ko-fi.com/yourusername" className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" /></div>
                         </div>
                     </div>

                    
                    <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <i className="fab fa-curseforge text-orange-500" aria-hidden="true"></i>
                            CurseForge Sync
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">
                                    Project ID
                                </label>
                                <input 
                                    type="text"
                                    value={curseforgeProjectSlug || CurseForgeService.extractProjectId(linkConfig.curseforge) || ''} 
                                    onChange={(e) => setCurseforgeProjectSlug(e.target.value)} 
                                    placeholder="1377354"
                                    className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-colors hover:border-gray-600" 
                                />
                                <p className="text-[10px] text-gray-600 mt-1">
                                    Auto-detected from CurseForge URL. Enter manually if needed.
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-2">
                                    Auto-sync Interval
                                </label>
                                <select
                                    value={curseforgeSyncInterval}
                                    onChange={(e) => setCurseforgeSyncInterval(parseInt(e.target.value))}
                                    className="w-full bg-[#1a1a1a] border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 h-10 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-colors hover:border-gray-600 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')] bg-[length:12px_8px] bg-[right_0.75rem_center] bg-no-repeat pr-8"
                                >
                                    <option value={0}>Disabled</option>
                                    <option value={6}>Every 6 hours</option>
                                    <option value={12}>Every 12 hours</option>
                                </select>
                            </div>
                            <div>
                                <button
                                    onClick={handleSyncFromCurseForge}
                                    disabled={isSyncingCurseForge}
                                    className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSyncingCurseForge ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={16} />
                                            Sync Now
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                     <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                         <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><UserCheck size={16} /> Social Handles</h3>
                         <div className="space-y-6">
                             
                             <div className="border border-gray-800 rounded-lg p-4">
                                 <h4 className="text-sm font-semibold text-gray-300 mb-4">Author</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                     <div>
                                         <label className="block text-xs text-gray-500 mb-1">Author Name</label>
                                         <input 
                                             value={socialHandlesConfig.author || ''} 
                                             onChange={(e) => setSocialHandlesConfig({...socialHandlesConfig, author: e.target.value})} 
                                             className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                         />
                                     </div>
                                 </div>
                                 <div className="space-y-3">
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Social Links</label>
                                         {showAddLinkInput.person !== 'author' ? (
                                             <button
                                                 type="button"
                                                 onClick={(e) => {
                                                     e.preventDefault();
                                                     e.stopPropagation();
                                                     setShowAddLinkInput({person: 'author', url: ''});
                                                 }}
                                                 className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-700/50 hover:border-blue-600 transition-colors cursor-pointer"
                                             >
                                                 + Add Custom Link
                                             </button>
                                         ) : (
                                             <div className="flex gap-2 items-center">
                                                 <input
                                                     type="url"
                                                     placeholder="https://twitch.tv/username"
                                                     value={showAddLinkInput.url}
                                                     onChange={(e) => setShowAddLinkInput({...showAddLinkInput, url: e.target.value})}
                                                     onKeyDown={(e) => {
                                                         if (e.key === 'Enter') {
                                                             e.preventDefault();
                                                             const linkUrl = showAddLinkInput.url.trim();
                                                             if (linkUrl) {
                                                                 // Auto-detect platform from URL
                                                                 const url = linkUrl.toLowerCase();
                                                                 let detectedKey = '';
                                                                 if (url.includes('twitch.tv') || url.includes('twitch.com')) {
                                                                     detectedKey = 'twitch';
                                                                 } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                                                                     detectedKey = 'youtube';
                                                                 } else if (url.includes('instagram.com')) {
                                                                     detectedKey = 'instagram';
                                                                 } else if (url.includes('linkedin.com')) {
                                                                     detectedKey = 'linkedin';
                                                                 } else if (url.includes('facebook.com')) {
                                                                     detectedKey = 'facebook';
                                                                 } else if (url.includes('twitter.com') || url.includes('x.com')) {
                                                                     detectedKey = 'twitter';
                                                                 } else if (url.includes('github.com')) {
                                                                     detectedKey = 'github';
                                                                 } else if (url.includes('@') || url.includes('mailto:')) {
                                                                     detectedKey = 'email';
                                                                 } else {
                                                                     try {
                                                                         const urlObj = new URL(linkUrl);
                                                                         detectedKey = urlObj.hostname.replace('www.', '').split('.')[0];
                                                                     } catch {
                                                                         detectedKey = 'website';
                                                                     }
                                                                 }
                                                                 
                                                                 const normalizedKey = detectedKey || 'website';
                                                                 const currentLinks = socialHandlesConfig.authorLinks || {};
                                                                 
                                                                 setSocialHandlesConfig({
                                                                     ...socialHandlesConfig,
                                                                     authorLinks: {
                                                                         ...currentLinks,
                                                                         [normalizedKey]: linkUrl
                                                                     }
                                                                 });
                                                                 
                                                                 if (!authorLinksOrder.includes(normalizedKey)) {
                                                                     setAuthorLinksOrder([...authorLinksOrder, normalizedKey]);
                                                                 }
                                                                 
                                                                 setShowAddLinkInput({person: null, url: ''});
                                                             }
                                                         } else if (e.key === 'Escape') {
                                                             setShowAddLinkInput({person: null, url: ''});
                                                         }
                                                     }}
                                                     className="text-xs bg-black/30 border border-gray-700 rounded px-2 py-1 text-white w-48"
                                                     autoFocus
                                                 />
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         const linkUrl = showAddLinkInput.url.trim();
                                                         if (linkUrl) {
                                                             const url = linkUrl.toLowerCase();
                                                             let detectedKey = '';
                                                             if (url.includes('twitch.tv') || url.includes('twitch.com')) {
                                                                 detectedKey = 'twitch';
                                                             } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                                                                 detectedKey = 'youtube';
                                                             } else if (url.includes('instagram.com')) {
                                                                 detectedKey = 'instagram';
                                                             } else if (url.includes('linkedin.com')) {
                                                                 detectedKey = 'linkedin';
                                                             } else if (url.includes('facebook.com')) {
                                                                 detectedKey = 'facebook';
                                                             } else if (url.includes('twitter.com') || url.includes('x.com')) {
                                                                 detectedKey = 'twitter';
                                                             } else if (url.includes('github.com')) {
                                                                 detectedKey = 'github';
                                                             } else if (url.includes('@') || url.includes('mailto:')) {
                                                                 detectedKey = 'email';
                                                             } else {
                                                                 try {
                                                                     const urlObj = new URL(linkUrl);
                                                                     detectedKey = urlObj.hostname.replace('www.', '').split('.')[0];
                                                                 } catch {
                                                                     detectedKey = 'website';
                                                                 }
                                                             }
                                                             
                                                             const normalizedKey = detectedKey || 'website';
                                                             const currentLinks = socialHandlesConfig.authorLinks || {};
                                                             
                                                             setSocialHandlesConfig({
                                                                 ...socialHandlesConfig,
                                                                 authorLinks: {
                                                                     ...currentLinks,
                                                                     [normalizedKey]: linkUrl
                                                                 }
                                                             });
                                                             
                                                             if (!authorLinksOrder.includes(normalizedKey)) {
                                                                 setAuthorLinksOrder([...authorLinksOrder, normalizedKey]);
                                                             }
                                                             
                                                             setShowAddLinkInput({person: null, url: ''});
                                                         }
                                                     }}
                                                     className="text-xs text-green-400 hover:text-green-300 px-2 py-1"
                                                     title="Add"
                                                 >
                                                     ✓
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         setShowAddLinkInput({person: null, url: ''});
                                                     }}
                                                     className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                                                     title="Cancel"
                                                 >
                                                     ✕
                                                 </button>
                                             </div>
                                         )}
                                     </div>
                                     {authorLinksOrder.map((key, index) => {
                                         const value = socialHandlesConfig.authorLinks?.[key] || '';
                                         if (!value && !socialHandlesConfig.authorLinks?.[key]) return null;
                                         
                                         return (
                                             <div 
                                                 key={key} 
                                                 className="flex gap-2 items-center group"
                                                 draggable
                                                 onDragStart={(e) => {
                                                     setDraggedLink({person: 'author', key});
                                                     e.dataTransfer.effectAllowed = 'move';
                                                 }}
                                                 onDragOver={(e) => {
                                                     e.preventDefault();
                                                     e.dataTransfer.dropEffect = 'move';
                                                 }}
                                                 onDrop={(e) => {
                                                     e.preventDefault();
                                                     if (draggedLink && draggedLink.person === 'author' && draggedLink.key !== key) {
                                                         const newOrder = [...authorLinksOrder];
                                                         const draggedIndex = newOrder.indexOf(draggedLink.key);
                                                         const targetIndex = newOrder.indexOf(key);
                                                         newOrder.splice(draggedIndex, 1);
                                                         newOrder.splice(targetIndex, 0, draggedLink.key);
                                                         setAuthorLinksOrder(newOrder);
                                                     }
                                                     setDraggedLink(null);
                                                 }}
                                                 onDragEnd={() => setDraggedLink(null)}
                                             >
                                                 <label className="w-24 text-xs text-gray-500 flex items-center capitalize">{key}:</label>
                                                 <input 
                                                     type={key === 'email' || key.includes('mail') ? 'email' : 'url'}
                                                     placeholder={key === 'email' || key.includes('mail') ? 'email@example.com' : `https://${key}.com/username`}
                                                     value={value || ''} 
                                                     onChange={(e) => setSocialHandlesConfig({
                                                         ...socialHandlesConfig, 
                                                         authorLinks: {...socialHandlesConfig.authorLinks, [key]: e.target.value}
                                                     })} 
                                                     className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                                 />
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         e.stopPropagation();
                                                         if (index > 0) {
                                                             const newOrder = [...authorLinksOrder];
                                                             [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                                                             setAuthorLinksOrder(newOrder);
                                                         }
                                                     }}
                                                     className="text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                     title="Move up"
                                                     disabled={index === 0}
                                                 >
                                                     <ArrowUp size={14} />
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         e.stopPropagation();
                                                         if (index < authorLinksOrder.length - 1) {
                                                             const newOrder = [...authorLinksOrder];
                                                             [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                             setAuthorLinksOrder(newOrder);
                                                         }
                                                     }}
                                                     className="text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                     title="Move down"
                                                     disabled={index === authorLinksOrder.length - 1}
                                                 >
                                                     <ArrowDown size={14} />
                                                 </button>
                                                 <button
                                                     type="button"
                                                     className="text-gray-600 hover:text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                                                     title="Drag to reorder"
                                                 >
                                                     <GripVertical size={16} />
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={() => {
                                                         const newLinks = {...socialHandlesConfig.authorLinks};
                                                         delete newLinks[key];
                                                         setSocialHandlesConfig({
                                                             ...socialHandlesConfig,
                                                             authorLinks: newLinks
                                                         });
                                                         setAuthorLinksOrder(authorLinksOrder.filter(k => k !== key));
                                                     }}
                                                     className="text-red-400 hover:text-red-300 p-1"
                                                     title="Remove link"
                                                 >
                                                     <X size={16} />
                                                 </button>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>

                             
                             <div className="border border-gray-800 rounded-lg p-4">
                                 <h4 className="text-sm font-semibold text-gray-300 mb-4">Lead Developer</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                     <div>
                                         <label className="block text-xs text-gray-500 mb-1">Lead Dev Name</label>
                                         <input 
                                             value={socialHandlesConfig.leadDev || ''} 
                                             onChange={(e) => setSocialHandlesConfig({...socialHandlesConfig, leadDev: e.target.value})} 
                                             className="w-full bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                         />
                                     </div>
                                 </div>
                                 <div className="space-y-3">
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Social Links</label>
                                         {showAddLinkInput.person !== 'leadDev' ? (
                                             <button
                                                 type="button"
                                                 onClick={(e) => {
                                                     e.preventDefault();
                                                     e.stopPropagation();
                                                     setShowAddLinkInput({person: 'leadDev', url: ''});
                                                 }}
                                                 className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded border border-blue-700/50 hover:border-blue-600 transition-colors cursor-pointer"
                                             >
                                                 + Add Custom Link
                                             </button>
                                         ) : (
                                             <div className="flex gap-2 items-center">
                                                 <input
                                                     type="url"
                                                     placeholder="https://twitch.tv/username"
                                                     value={showAddLinkInput.url}
                                                     onChange={(e) => setShowAddLinkInput({...showAddLinkInput, url: e.target.value})}
                                                     onKeyDown={(e) => {
                                                         if (e.key === 'Enter') {
                                                             e.preventDefault();
                                                             const linkUrl = showAddLinkInput.url.trim();
                                                             if (linkUrl) {
                                                                 const url = linkUrl.toLowerCase();
                                                                 let detectedKey = '';
                                                                 if (url.includes('twitch.tv') || url.includes('twitch.com')) {
                                                                     detectedKey = 'twitch';
                                                                 } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                                                                     detectedKey = 'youtube';
                                                                 } else if (url.includes('instagram.com')) {
                                                                     detectedKey = 'instagram';
                                                                 } else if (url.includes('linkedin.com')) {
                                                                     detectedKey = 'linkedin';
                                                                 } else if (url.includes('facebook.com')) {
                                                                     detectedKey = 'facebook';
                                                                 } else if (url.includes('twitter.com') || url.includes('x.com')) {
                                                                     detectedKey = 'twitter';
                                                                 } else if (url.includes('github.com')) {
                                                                     detectedKey = 'github';
                                                                 } else if (url.includes('@') || url.includes('mailto:')) {
                                                                     detectedKey = 'email';
                                                                 } else {
                                                                     try {
                                                                         const urlObj = new URL(linkUrl);
                                                                         detectedKey = urlObj.hostname.replace('www.', '').split('.')[0];
                                                                     } catch {
                                                                         detectedKey = 'website';
                                                                     }
                                                                 }
                                                                 
                                                                 const normalizedKey = detectedKey || 'website';
                                                                 const currentLinks = socialHandlesConfig.leadDevLinks || {};
                                                                 
                                                                 setSocialHandlesConfig({
                                                                     ...socialHandlesConfig,
                                                                     leadDevLinks: {
                                                                         ...currentLinks,
                                                                         [normalizedKey]: linkUrl
                                                                     }
                                                                 });
                                                                 
                                                                 if (!leadDevLinksOrder.includes(normalizedKey)) {
                                                                     setLeadDevLinksOrder([...leadDevLinksOrder, normalizedKey]);
                                                                 }
                                                                 
                                                                 setShowAddLinkInput({person: null, url: ''});
                                                             }
                                                         } else if (e.key === 'Escape') {
                                                             setShowAddLinkInput({person: null, url: ''});
                                                         }
                                                     }}
                                                     className="text-xs bg-black/30 border border-gray-700 rounded px-2 py-1 text-white w-48"
                                                     autoFocus
                                                 />
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         const linkUrl = showAddLinkInput.url.trim();
                                                         if (linkUrl) {
                                                             const url = linkUrl.toLowerCase();
                                                             let detectedKey = '';
                                                             if (url.includes('twitch.tv') || url.includes('twitch.com')) {
                                                                 detectedKey = 'twitch';
                                                             } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                                                                 detectedKey = 'youtube';
                                                             } else if (url.includes('instagram.com')) {
                                                                 detectedKey = 'instagram';
                                                             } else if (url.includes('linkedin.com')) {
                                                                 detectedKey = 'linkedin';
                                                             } else if (url.includes('facebook.com')) {
                                                                 detectedKey = 'facebook';
                                                             } else if (url.includes('twitter.com') || url.includes('x.com')) {
                                                                 detectedKey = 'twitter';
                                                             } else if (url.includes('github.com')) {
                                                                 detectedKey = 'github';
                                                             } else if (url.includes('@') || url.includes('mailto:')) {
                                                                 detectedKey = 'email';
                                                             } else {
                                                                 try {
                                                                     const urlObj = new URL(linkUrl);
                                                                     detectedKey = urlObj.hostname.replace('www.', '').split('.')[0];
                                                                 } catch {
                                                                     detectedKey = 'website';
                                                                 }
                                                             }
                                                             
                                                             const normalizedKey = detectedKey || 'website';
                                                             const currentLinks = socialHandlesConfig.leadDevLinks || {};
                                                             
                                                             setSocialHandlesConfig({
                                                                 ...socialHandlesConfig,
                                                                 leadDevLinks: {
                                                                     ...currentLinks,
                                                                     [normalizedKey]: linkUrl
                                                                 }
                                                             });
                                                             
                                                             if (!leadDevLinksOrder.includes(normalizedKey)) {
                                                                 setLeadDevLinksOrder([...leadDevLinksOrder, normalizedKey]);
                                                             }
                                                             
                                                             setShowAddLinkInput({person: null, url: ''});
                                                         }
                                                     }}
                                                     className="text-xs text-green-400 hover:text-green-300 px-2 py-1"
                                                     title="Add"
                                                 >
                                                     ✓
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         setShowAddLinkInput({person: null, url: ''});
                                                     }}
                                                     className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                                                     title="Cancel"
                                                 >
                                                     ✕
                                                 </button>
                                             </div>
                                         )}
                                     </div>
                                     {leadDevLinksOrder.map((key, index) => {
                                         const value = socialHandlesConfig.leadDevLinks?.[key] || '';
                                         if (!value && !socialHandlesConfig.leadDevLinks?.[key]) return null;
                                         
                                         return (
                                             <div 
                                                 key={key} 
                                                 className="flex gap-2 items-center group"
                                                 draggable
                                                 onDragStart={(e) => {
                                                     setDraggedLink({person: 'leadDev', key});
                                                     e.dataTransfer.effectAllowed = 'move';
                                                 }}
                                                 onDragOver={(e) => {
                                                     e.preventDefault();
                                                     e.dataTransfer.dropEffect = 'move';
                                                 }}
                                                 onDrop={(e) => {
                                                     e.preventDefault();
                                                     if (draggedLink && draggedLink.person === 'leadDev' && draggedLink.key !== key) {
                                                         const newOrder = [...leadDevLinksOrder];
                                                         const draggedIndex = newOrder.indexOf(draggedLink.key);
                                                         const targetIndex = newOrder.indexOf(key);
                                                         newOrder.splice(draggedIndex, 1);
                                                         newOrder.splice(targetIndex, 0, draggedLink.key);
                                                         setLeadDevLinksOrder(newOrder);
                                                     }
                                                     setDraggedLink(null);
                                                 }}
                                                 onDragEnd={() => setDraggedLink(null)}
                                             >
                                                 <label className="w-24 text-xs text-gray-500 flex items-center capitalize">{key}:</label>
                                                 <input 
                                                     type={key === 'email' || key.includes('mail') ? 'email' : 'url'}
                                                     placeholder={key === 'email' || key.includes('mail') ? 'email@example.com' : `https://${key}.com/username`}
                                                     value={value || ''} 
                                                     onChange={(e) => setSocialHandlesConfig({
                                                         ...socialHandlesConfig, 
                                                         leadDevLinks: {...socialHandlesConfig.leadDevLinks, [key]: e.target.value}
                                                     })} 
                                                     className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm" 
                                                 />
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         e.stopPropagation();
                                                         if (index > 0) {
                                                             const newOrder = [...leadDevLinksOrder];
                                                             [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                                                             setLeadDevLinksOrder(newOrder);
                                                         }
                                                     }}
                                                     className="text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                     title="Move up"
                                                     disabled={index === 0}
                                                 >
                                                     <ArrowUp size={14} />
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={(e) => {
                                                         e.preventDefault();
                                                         e.stopPropagation();
                                                         if (index < leadDevLinksOrder.length - 1) {
                                                             const newOrder = [...leadDevLinksOrder];
                                                             [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                                             setLeadDevLinksOrder(newOrder);
                                                         }
                                                     }}
                                                     className="text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                     title="Move down"
                                                     disabled={index === leadDevLinksOrder.length - 1}
                                                 >
                                                     <ArrowDown size={14} />
                                                 </button>
                                                 <button
                                                     type="button"
                                                     className="text-gray-600 hover:text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                                                     title="Drag to reorder"
                                                 >
                                                     <GripVertical size={16} />
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={() => {
                                                         const newLinks = {...socialHandlesConfig.leadDevLinks};
                                                         delete newLinks[key];
                                                         setSocialHandlesConfig({
                                                             ...socialHandlesConfig,
                                                             leadDevLinks: newLinks
                                                         });
                                                         setLeadDevLinksOrder(leadDevLinksOrder.filter(k => k !== key));
                                                     }}
                                                     className="text-red-400 hover:text-red-300 p-1"
                                                     title="Remove link"
                                                 >
                                                     <X size={16} />
                                                 </button>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         </div>
                     </div>
                     </div>
                     )}

                     
                     {configTab === 'footer' && (
                     <div className="space-y-6 animate-fadeIn w-full min-w-0" style={{ contentVisibility: 'auto' }}>
                     <div className="bg-[#121212] p-3 sm:p-4 md:p-6 rounded-lg border border-gray-800 w-full min-w-0 box-border">
                         <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><UserCheck size={16} /> Footer Icon Configuration</h3>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             
                             <div className="flex flex-col">
                                 <label className="block text-xs text-gray-500 mb-2">Website Icon</label>
                                 <div className="relative mb-4">
                                     {footerIconConfig.icon ? (
                                         <img 
                                             src={footerIconConfig.icon} 
                                             alt="Footer Icon" 
                                             className="border-2 border-gray-700"
                                             style={{
                                                 width: `${footerIconConfig.size || 40}px`,
                                                 height: `${footerIconConfig.size || 40}px`,
                                                 borderRadius: `${footerIconConfig.borderRadius || 8}px`,
                                                 backgroundColor: footerIconConfig.backgroundColor === 'transparent' ? 'transparent' : footerIconConfig.backgroundColor || 'transparent',
                                                 opacity: footerIconConfig.backgroundOpacity || 1,
                                                 padding: `${footerIconConfig.padding || 0}px`,
                                                 border: `${footerIconConfig.borderWidth || 0}px solid ${footerIconConfig.borderColor === 'transparent' ? 'transparent' : footerIconConfig.borderColor || 'transparent'}`,
                                                 objectFit: 'contain'
                                             }}
                                         />
                                     ) : (
                                         <div 
                                             className="border-2 border-dashed border-gray-700 flex items-center justify-center bg-gray-900/50"
                                             style={{
                                                 width: `${footerIconConfig.size || 40}px`,
                                                 height: `${footerIconConfig.size || 40}px`,
                                                 borderRadius: `${footerIconConfig.borderRadius || 8}px`
                                             }}
                                         >
                                             <Upload size={20} className="text-gray-500" />
                         </div>
                                     )}
                     </div>
                                 
                                 
                                 <div className="mt-auto hidden md:block">
                                     <div 
                                         className={`bg-green-900/20 border-2 rounded-lg px-3 py-2 transition-colors ${
                                             footerDragActive 
                                                 ? 'border-green-500 bg-green-900/40' 
                                                 : 'border-green-500/30'
                                         }`}
                                         onDragEnter={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             setFooterDragActive(true);
                                         }}
                                         onDragLeave={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();

                                             if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                 setFooterDragActive(false);
                                             }
                                         }}
                                         onDragOver={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                         }}
                                         onDrop={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             setFooterDragActive(false);
                                             
                                             const file = e.dataTransfer.files?.[0];
                                             if (file && file.type.startsWith('image/')) {
                                                 const reader = new FileReader();
                                                 reader.onloadend = () => {
                                                     if (reader.result) {
                                                         const base64 = reader.result as string;

                                                         setFooterOriginalImage(base64);
                                                         setFooterIconConfig({...footerIconConfig, icon: base64});
                                                     }
                                                 };
                                                 reader.readAsDataURL(file);
                                             }
                                         }}
                                     >
                                         <input
                                             type="file"
                                             accept="image/*"
                                             onChange={(e) => {
                                                 const file = e.target.files?.[0];
                                                 if (file && file.type.startsWith('image/')) {
                                                     setFooterIsUploading(true);
                                                     setFooterUploadProgress(0);
                                                     
                                                     const reader = new FileReader();
                                                     reader.onprogress = (event) => {
                                                         if (event.lengthComputable) {
                                                             const progress = Math.round((event.loaded / event.total) * 100);
                                                             setFooterUploadProgress(progress);
                                                         }
                                                     };
                                                     reader.onloadend = () => {
                                                         if (reader.result) {
                                                             const base64 = reader.result as string;

                                                             setFooterOriginalImage(base64);
                                                             setFooterIconConfig({...footerIconConfig, icon: base64});
                                                             setFooterUploadProgress(100);
                                                             setTimeout(() => {
                                                                 setFooterIsUploading(false);
                                                                 setFooterUploadProgress(0);
                                                             }, 300);
                                                         } else {
                                                             setFooterIsUploading(false);
                                                             setFooterUploadProgress(0);
                                                         }
                                                     };
                                                     reader.onerror = () => {
                                                         setFooterIsUploading(false);
                                                         setFooterUploadProgress(0);
                                                     };
                                                     reader.readAsDataURL(file);
                                                 }
                                                 if (e.target) e.target.value = '';
                                             }}
                                             className="hidden"
                                             id="footer-icon-upload"
                                         />
                                         <div className="flex flex-col gap-2 mb-1">
                                             <button
                                                 onClick={() => document.getElementById('footer-icon-upload')?.click()}
                                                 className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                 title={footerIconConfig.icon ? 'Change Icon' : 'Upload Icon'}
                                             >
                                                 <Upload size={14} />
                                                 <span className="hidden sm:inline">{footerIconConfig.icon ? 'Change Icon' : 'Upload Icon'}</span>
                                             </button>
                                             {footerIconConfig.icon && (
                                                 <button
                                                     onClick={() => {

                                                         const imageToCrop = footerOriginalImage || footerIconConfig.icon;
                                                         if (imageToCrop) {

                                                             if (!footerOriginalImage && footerIconConfig.icon) {
                                                                 setFooterOriginalImage(footerIconConfig.icon);
                                                             }
                                                             setShowFooterCropEditor(true);
                                                             setFooterCropScale(1);
                                                             setFooterCropPosition({ x: 0, y: 0 });
                                                         }
                                                     }}
                                                     className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                     title="Crop"
                                                 >
                                                     <Crop size={14} />
                                                     <span className="hidden sm:inline">Crop</span>
                                                 </button>
                     )}
                     </div>
                                         <p className="text-[10px] text-gray-500 leading-tight">
                                             {footerDragActive ? 'Drop image here' : 'Recommended: Square image (e.g., 128x128px)'}
                                         </p>
                                     </div>
                                 </div>
                             </div>

                             
                             <div className="flex flex-col">
                                 <div className="flex items-center justify-between mb-2">
                                     <label className="block text-xs text-gray-500">Preview</label>
                                     {footerIconConfig.icon && (
                                         <div className="hidden md:flex flex-row gap-2">
                                             <button
                                                 onClick={() => {
                                                     setFooterIconConfig({...footerIconConfig, icon: undefined});
                                                     setFooterOriginalImage('');
                                                 }}
                                                 className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                 title="Remove Icon"
                                             >
                                                 <Trash2 size={14} />
                                                 <span className="hidden sm:inline">Remove</span>
                                             </button>
                                             <button
                                                 onClick={() => {
                                                     setFooterIconConfig({
                                                         ...footerIconConfig,
                                                         size: 40,
                                                         borderRadius: 8,
                                                         backgroundColor: 'transparent',
                                                         backgroundOpacity: 1,
                                                         padding: 0,
                                                         borderColor: 'transparent',
                                                         borderWidth: 0
                                                     });
                                                     setFooterPreviewZoom(1);
                                                 }}
                                                 className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                                                 title="Reset All Settings"
                                             >
                                                 <RotateCcw size={14} />
                                                 <span className="hidden sm:inline">Reset All</span>
                                             </button>
                </div>
            )}
        </div>
                                 
                                 {footerIsUploading && (
                                     <div className="mb-3">
                                         <div className="flex items-center justify-between mb-1">
                                             <span className="text-xs text-gray-400">Uploading icon...</span>
                                             <span className="text-xs text-gray-400">{footerUploadProgress}%</span>
                                         </div>
                                         <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                             <div 
                                                 className="bg-green-500 h-full transition-all duration-300 ease-out"
                                                 style={{ width: `${footerUploadProgress}%` }}
                                             ></div>
                                         </div>
                                     </div>
                                 )}
                                 
                                 <div className="md:hidden mb-2">
                                     <div className="flex flex-row gap-1.5">
                                         <input
                                             type="file"
                                             accept="image/*"
                                             onChange={(e) => {
                                                 const file = e.target.files?.[0];
                                                 if (file && file.type.startsWith('image/')) {
                                                     setFooterIsUploading(true);
                                                     setFooterUploadProgress(0);
                                                     
                                                     const reader = new FileReader();
                                                     reader.onprogress = (event) => {
                                                         if (event.lengthComputable) {
                                                             const progress = Math.round((event.loaded / event.total) * 100);
                                                             setFooterUploadProgress(progress);
                                                         }
                                                     };
                                                     reader.onloadend = () => {
                                                         if (reader.result) {
                                                             const base64 = reader.result as string;
                                                             setFooterOriginalImage(base64);
                                                             setFooterIconConfig({...footerIconConfig, icon: base64});
                                                             setFooterUploadProgress(100);
                                                             setTimeout(() => {
                                                                 setFooterIsUploading(false);
                                                                 setFooterUploadProgress(0);
                                                             }, 300);
                                                         } else {
                                                             setFooterIsUploading(false);
                                                             setFooterUploadProgress(0);
                                                         }
                                                     };
                                                     reader.onerror = () => {
                                                         setFooterIsUploading(false);
                                                         setFooterUploadProgress(0);
                                                     };
                                                     reader.readAsDataURL(file);
                                                 }
                                                 if (e.target) e.target.value = '';
                                             }}
                                             className="hidden"
                                             id="footer-icon-upload-mobile"
                                         />
                                         <button
                                             onClick={() => document.getElementById('footer-icon-upload-mobile')?.click()}
                                             className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors flex items-center justify-center text-xs"
                                             title={footerIconConfig.icon ? 'Change Icon' : 'Upload Icon'}
                                         >
                                             <Upload size={12} />
                                         </button>
                                         {footerIconConfig.icon && (
                                             <>
                                                 <button
                                                     onClick={() => {
                                                         const imageToCrop = footerOriginalImage || footerIconConfig.icon;
                                                         if (imageToCrop) {
                                                             if (!footerOriginalImage && footerIconConfig.icon) {
                                                                 setFooterOriginalImage(footerIconConfig.icon);
                                                             }
                                                             setShowFooterCropEditor(true);
                                                             setFooterCropScale(1);
                                                             setFooterCropPosition({ x: 0, y: 0 });
                                                         }
                                                     }}
                                                     className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs"
                                                     title="Crop"
                                                 >
                                                     <Crop size={12} />
                                                 </button>
                                                 <button
                                                     onClick={() => {
                                                         setFooterIconConfig({...footerIconConfig, icon: undefined});
                                                         setFooterOriginalImage('');
                                                     }}
                                                     className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs"
                                                     title="Remove Icon"
                                                 >
                                                     <Trash2 size={12} />
                                                 </button>
                                                 <button
                                                     onClick={() => {
                                                         setFooterIconConfig({
                                                             ...footerIconConfig,
                                                             size: 40,
                                                             borderRadius: 8,
                                                             backgroundColor: 'transparent',
                                                             backgroundOpacity: 1,
                                                             padding: 0,
                                                             borderColor: 'transparent',
                                                             borderWidth: 0
                                                         });
                                                         setFooterPreviewZoom(1);
                                                     }}
                                                     className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center justify-center text-xs"
                                                     title="Reset All Settings"
                                                 >
                                                     <RotateCcw size={12} />
                                                 </button>
                                             </>
                                         )}
                                     </div>
                                 </div>
                                 <div className="bg-gray-900/50 border-2 border-gray-700 rounded-lg p-8 flex items-center justify-center flex-1" style={{ minHeight: '200px', width: '100%' }}>
                                     {footerIconConfig.icon ? (
                                         <div 
                                             style={{
                                                 width: '100%',
                                                 height: '100%',
                                                 display: 'flex',
                                                 alignItems: 'center',
                                                 justifyContent: 'center',
                                                 maxWidth: '100%',
                                                 maxHeight: '100%'
                                             }}
                                         >
                                             <img 
                                                 src={footerIconConfig.icon} 
                                                 alt="Preview" 
                                                 style={{
                                                     maxWidth: '100%',
                                                     maxHeight: '100%',
                                                     width: 'auto',
                                                     height: 'auto',
                                                     borderRadius: `${footerIconConfig.borderRadius || 8}px`,
                                                     backgroundColor: footerIconConfig.backgroundColor === 'transparent' ? 'transparent' : footerIconConfig.backgroundColor || 'transparent',
                                                     opacity: footerIconConfig.backgroundOpacity || 1,
                                                     padding: `${footerIconConfig.padding || 0}px`,
                                                     border: `${footerIconConfig.borderWidth || 0}px solid ${footerIconConfig.borderColor === 'transparent' ? 'transparent' : footerIconConfig.borderColor || 'transparent'}`,
                                                     objectFit: 'contain',
                                                     transition: 'all 0.2s ease'
                                                 }}
                                             />
                                         </div>
                                     ) : (
                                         <div className="text-gray-500 text-sm">Upload an icon to see preview</div>
                                     )}
                                 </div>
                             </div>
                         </div>

                         
                         <div className="space-y-3 border-t border-gray-800 pt-4 mt-6">
                             
                             <div>
                                 <div className="flex items-center justify-between mb-2">
                                     <label className="block text-xs text-gray-500">Size: {footerIconConfig.size || 40}px</label>
                                     <div className="flex gap-2">
                                         <button
                                             onClick={() => {
                                                 const newSize = Math.max(20, (footerIconConfig.size || 40) - 1);
                                                 setFooterIconConfig({...footerIconConfig, size: newSize});

                                                 const baseSize = 40;
                                                 const inverseSize = 2 * baseSize - newSize;
                                                 const newZoom = inverseSize / newSize;
                                                 setFooterPreviewZoom(newZoom);
                                             }}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                             title="Decrease Size"
                                         >
                                             <Minimize2 size={12} />
                                         </button>
                                         <button
                                             onClick={() => {
                                                 const newSize = Math.min(200, (footerIconConfig.size || 40) + 1);
                                                 setFooterIconConfig({...footerIconConfig, size: newSize});

                                                 const baseSize = 40;
                                                 const inverseSize = 2 * baseSize - newSize;
                                                 const newZoom = inverseSize / newSize;
                                                 setFooterPreviewZoom(newZoom);
                                             }}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                             title="Increase Size"
                                         >
                                             <Maximize2 size={12} />
                                         </button>
                                         <button
                                             onClick={() => {
                                                 setFooterIconConfig({...footerIconConfig, size: 40});
                                                 setFooterPreviewZoom(1);
                                             }}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                 </div>
                                 <input
                                     type="range"
                                     min="20"
                                     max="200"
                                     value={footerIconConfig.size || 40}
                                     onChange={(e) => {
                                         const newSize = parseInt(e.target.value) || 40;
                                         setFooterIconConfig({...footerIconConfig, size: newSize});

                                         const baseSize = 40;
                                         const inverseSize = 2 * baseSize - newSize;
                                         const newZoom = inverseSize / newSize;
                                         setFooterPreviewZoom(newZoom);
                                     }}
                                     className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                 />
                             </div>
                             
                             
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Roundness: {footerIconConfig.borderRadius || 8}px</label>
                                         <button
                                             onClick={() => setFooterIconConfig({...footerIconConfig, borderRadius: 8})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="50"
                                         value={footerIconConfig.borderRadius || 8}
                                         onChange={(e) => setFooterIconConfig({...footerIconConfig, borderRadius: parseInt(e.target.value) || 0})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Opacity: {Math.round((footerIconConfig.backgroundOpacity || 1) * 100)}%</label>
                                         <button
                                             onClick={() => setFooterIconConfig({...footerIconConfig, backgroundOpacity: 1})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="1"
                                         step="0.01"
                                         value={footerIconConfig.backgroundOpacity || 1}
                                         onChange={(e) => setFooterIconConfig({...footerIconConfig, backgroundOpacity: parseFloat(e.target.value) || 1})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                             </div>
                             
                             
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Padding: {footerIconConfig.padding || 0}px</label>
                                         <button
                                             onClick={() => setFooterIconConfig({...footerIconConfig, padding: 0})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="20"
                                         value={footerIconConfig.padding || 0}
                                         onChange={(e) => setFooterIconConfig({...footerIconConfig, padding: parseInt(e.target.value) || 0})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                                 <div>
                                     <div className="flex items-center justify-between mb-2">
                                         <label className="block text-xs text-gray-500">Border Width: {footerIconConfig.borderWidth || 0}px</label>
                                         <button
                                             onClick={() => setFooterIconConfig({...footerIconConfig, borderWidth: 0})}
                                             className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                         >
                                             Reset
                                         </button>
                                     </div>
                                     <input
                                         type="range"
                                         min="0"
                                         max="10"
                                         value={footerIconConfig.borderWidth || 0}
                                         onChange={(e) => setFooterIconConfig({...footerIconConfig, borderWidth: parseInt(e.target.value) || 0})}
                                         className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                     style={{ accentColor: '#22c55e' }}
                                     />
                                 </div>
                             </div>
                             
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-2">Background Color</label>
                                     <div className="flex gap-2 items-center">
                                         <input 
                                             type="color" 
                                             value={(() => {
                                                 const color = footerIconConfig.backgroundColor || 'transparent';
                                                 const hexMatch = color.match(/#[0-9a-fA-F]{6}/);
                                                 return hexMatch ? hexMatch[0] : '#000000';
                                             })()} 
                                             onChange={(e) => setFooterIconConfig({...footerIconConfig, backgroundColor: e.target.value})} 
                                             className="w-12 h-10 bg-black/30 border border-gray-700 rounded cursor-pointer flex-shrink-0" 
                                         />
                                         <input
                                             type="text"
                                             placeholder="transparent or #hex"
                                             value={footerIconConfig.backgroundColor || 'transparent'}
                                             onChange={(e) => setFooterIconConfig({...footerIconConfig, backgroundColor: e.target.value || 'transparent'})}
                                             className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                         />
                                     </div>
                                     <p className="text-[10px] text-gray-500 mt-1">Hex color (e.g., #000000) or transparent</p>
                                 </div>
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-2">Border Color</label>
                                     <div className="flex gap-2 items-center">
                                         <input 
                                             type="color" 
                                             value={(() => {
                                                 const color = footerIconConfig.borderColor || 'transparent';
                                                 const hexMatch = color.match(/#[0-9a-fA-F]{6}/);
                                                 return hexMatch ? hexMatch[0] : '#ffffff';
                                             })()} 
                                             onChange={(e) => setFooterIconConfig({...footerIconConfig, borderColor: e.target.value})} 
                                             className="w-12 h-10 bg-black/30 border border-gray-700 rounded cursor-pointer flex-shrink-0" 
                                         />
                                         <input
                                             type="text"
                                             placeholder="transparent or #hex"
                                             value={footerIconConfig.borderColor || 'transparent'}
                                             onChange={(e) => setFooterIconConfig({...footerIconConfig, borderColor: e.target.value || 'transparent'})}
                                             className="flex-1 bg-black/30 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                         />
                                     </div>
                                     <p className="text-[10px] text-gray-500 mt-1">Hex color (e.g., #ffffff) or transparent</p>
                                 </div>
                             </div>
                         </div>
                     </div>
                     </div>
                     )}
                     </div>
                     </div>
                </div>
            )}
            </div>
        </div>
        </div>

      
      {showRejectModal && rejectingSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Ban size={20} className="text-red-400" />
                Reject Suggestion
              </h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingSuggestion(null);
                  setRejectionReason("");
                }}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-300 font-medium mb-2">{rejectingSuggestion.title}</p>
              <p className="text-xs text-gray-500">{rejectingSuggestion.description.substring(0, 100)}...</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Rejection Reason (Optional)</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a reason for rejecting this suggestion..."
                className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingSuggestion(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors font-medium flex items-center gap-2"
              >
                <Ban size={16} />
                Reject Suggestion
              </button>
            </div>
          </div>
        </div>
      )}

      
      {editingBug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit size={20} />
                Edit Issue
              </h3>
              <button 
                onClick={() => {
                  setEditingBug(null);
                  setEditStatus('Open');
                  setEditAssignedTo('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-300 font-medium mb-2">{editingBug.title}</p>
              <p className="text-xs text-gray-500">{editingBug.description.substring(0, 100)}...</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as BugReport['status'])}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Assign To</label>
                <select
                  value={editAssignedTo}
                  onChange={(e) => setEditAssignedTo(e.target.value)}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.username}>
                      {user.username} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => {
                  setEditingBug(null);
                  setEditStatus('Open');
                  setEditAssignedTo('');
                }}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBugEdit}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors font-medium flex items-center gap-2"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      
      {showNavbarCropEditor && navbarOriginalImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Crop size={20} />
                  Crop Navbar Icon
                </h2>
                <button
                  onClick={() => {
                    setShowNavbarCropEditor(false);
                    setNavbarCropScale(1);
                    setNavbarCropPosition({ x: 0, y: 0 });
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                
                <div className="relative bg-black rounded-lg overflow-hidden border border-gray-700" style={{ aspectRatio: '1/1', maxHeight: '400px' }}>
                  <img
                    ref={navbarImageRef}
                    src={navbarOriginalImage}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    style={{
                      transform: `scale(${navbarCropScale}) translate(${navbarCropPosition.x}px, ${navbarCropPosition.y}px)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.1s ease-out'
                    }}
                    onLoad={(e) => {
                      navbarImageRef.current = e.currentTarget;
                    }}
                  />
                  
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/50" style={{
                      clipPath: `inset(${(100 - 100 / navbarCropScale) / 2}% ${(100 - 100 / navbarCropScale) / 2}% ${(100 - 100 / navbarCropScale) / 2}% ${(100 - 100 / navbarCropScale) / 2}%)`
                    }}></div>
                    <div className="absolute inset-0 border-2 border-white" style={{
                      top: `${(100 - 100 / navbarCropScale) / 2}%`,
                      left: `${(100 - 100 / navbarCropScale) / 2}%`,
                      width: `${100 / navbarCropScale}%`,
                      height: `${100 / navbarCropScale}%`
                    }}></div>
                  </div>
                </div>

                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Zoom: {Math.round(navbarCropScale * 100)}%
                      </label>
                      <button
                        onClick={() => setNavbarCropScale(1)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                      >
                        Reset Zoom
                      </button>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.01"
                      value={navbarCropScale}
                      onChange={(e) => setNavbarCropScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-300">Position X</label>
                        <button
                          onClick={() => setNavbarCropPosition(prev => ({ ...prev, x: 0 }))}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                        >
                          Reset Horizontal
                        </button>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={navbarCropPosition.x}
                        onChange={(e) => setNavbarCropPosition(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-300">Position Y</label>
                        <button
                          onClick={() => setNavbarCropPosition(prev => ({ ...prev, y: 0 }))}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                        >
                          Reset Vertical
                        </button>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={navbarCropPosition.y}
                        onChange={(e) => setNavbarCropPosition(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => {
                        setShowNavbarCropEditor(false);
                        setNavbarCropScale(1);
                        setNavbarCropPosition({ x: 0, y: 0 });
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNavbarCropAndSave}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      Apply & Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {showFooterCropEditor && footerOriginalImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Crop size={20} />
                  Crop Footer Icon
                </h2>
                <button
                  onClick={() => {
                    setShowFooterCropEditor(false);
                    setFooterCropScale(1);
                    setFooterCropPosition({ x: 0, y: 0 });
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                
                <div className="relative bg-black rounded-lg overflow-hidden border border-gray-700" style={{ aspectRatio: '1/1', maxHeight: '400px' }}>
                  <img
                    ref={footerImageRef}
                    src={footerOriginalImage}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    style={{
                      transform: `scale(${footerCropScale}) translate(${footerCropPosition.x}px, ${footerCropPosition.y}px)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.1s ease-out'
                    }}
                    onLoad={(e) => {
                      footerImageRef.current = e.currentTarget;
                    }}
                  />
                  
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/50" style={{
                      clipPath: `inset(${(100 - 100 / footerCropScale) / 2}% ${(100 - 100 / footerCropScale) / 2}% ${(100 - 100 / footerCropScale) / 2}% ${(100 - 100 / footerCropScale) / 2}%)`
                    }}></div>
                    <div className="absolute inset-0 border-2 border-white" style={{
                      top: `${(100 - 100 / footerCropScale) / 2}%`,
                      left: `${(100 - 100 / footerCropScale) / 2}%`,
                      width: `${100 / footerCropScale}%`,
                      height: `${100 / footerCropScale}%`
                    }}></div>
                  </div>
                </div>

                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Zoom: {Math.round(footerCropScale * 100)}%
                      </label>
                      <button
                        onClick={() => setFooterCropScale(1)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                      >
                        Reset Zoom
                      </button>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.01"
                      value={footerCropScale}
                      onChange={(e) => setFooterCropScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-300">Position X</label>
                        <button
                          onClick={() => setFooterCropPosition(prev => ({ ...prev, x: 0 }))}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                        >
                          Reset Horizontal
                        </button>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={footerCropPosition.x}
                        onChange={(e) => setFooterCropPosition(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-300">Position Y</label>
                        <button
                          onClick={() => setFooterCropPosition(prev => ({ ...prev, y: 0 }))}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                        >
                          Reset Vertical
                        </button>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="5"
                        value={footerCropPosition.y}
                        onChange={(e) => setFooterCropPosition(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => {
                        setShowFooterCropEditor(false);
                        setFooterCropScale(1);
                        setFooterCropPosition({ x: 0, y: 0 });
                      }}
                      className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFooterCropAndSave}
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      Apply & Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {showCloudSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload size={20} className="text-blue-400" />
                Sync Data to Cloud
              </h3>
              <button
                onClick={() => setShowCloudSyncModal(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-6">Choose a cloud service to sync your data:</p>
            <div className="space-y-3">
              <button
                onClick={() => handleSyncToCloud('Google Cloud')}
                className="w-full px-4 py-3 rounded-lg bg-white hover:bg-gray-100 text-gray-900 font-medium transition-colors flex items-center justify-center gap-3"
              >
                <i className="fab fa-google text-xl"></i>
                <span>Google Cloud</span>
              </button>
              <button
                onClick={() => handleSyncToCloud('AWS S3')}
                className="w-full px-4 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors flex items-center justify-center gap-3"
              >
                <i className="fab fa-aws text-xl"></i>
                <span>AWS S3</span>
              </button>
              <button
                onClick={() => handleSyncToCloud('Microsoft Azure')}
                className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center justify-center gap-3"
              >
                <i className="fab fa-microsoft text-xl"></i>
                <span>Microsoft Azure</span>
              </button>
              <button
                onClick={() => handleSyncToCloud('Dropbox')}
                className="w-full px-4 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors flex items-center justify-center gap-3"
              >
                <i className="fab fa-dropbox text-xl"></i>
                <span>Dropbox</span>
              </button>
              <button
                onClick={() => handleSyncToCloud('OneDrive')}
                className="w-full px-4 py-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium transition-colors flex items-center justify-center gap-3"
              >
                <i className="fab fa-microsoft text-xl"></i>
                <span>OneDrive</span>
              </button>
              <button
                onClick={() => handleSyncToCloud('MongoDB Atlas')}
                className="w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center justify-center gap-3"
              >
                <i className="fas fa-database text-xl"></i>
                <span>MongoDB Atlas</span>
              </button>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowCloudSyncModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangelogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 my-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingChangelog ? 'Edit Changelog' : 'Create Changelog'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = newChangelog.visibility || 'private';
                    let next: 'private' | 'public' | 'unlisted';
                    if (current === 'private') {
                      next = 'public';
                    } else if (current === 'public') {
                      next = 'unlisted';
                    } else {
                      next = 'private';
                    }
                    setNewChangelog({ ...newChangelog, visibility: next });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    (newChangelog.visibility || 'private') === 'private'
                      ? 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                      : (newChangelog.visibility || 'private') === 'public'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                  title={
                    (newChangelog.visibility || 'private') === 'private' 
                      ? 'Only visible to admins in the changelog page'
                      : (newChangelog.visibility || 'private') === 'public'
                      ? 'Visible to everyone in the changelog page'
                      : 'Only accessible via direct link (shareable)'
                  }
                >
                  {(newChangelog.visibility || 'private') === 'private' ? (
                    <>
                      <Lock size={16} />
                      <span className="hidden sm:inline">Private</span>
                    </>
                  ) : (newChangelog.visibility || 'private') === 'public' ? (
                    <>
                      <Globe size={16} />
                      <span className="hidden sm:inline">Public</span>
                    </>
                  ) : (
                    <>
                      <EyeOff size={16} />
                      <span className="hidden sm:inline">Unlisted</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowChangelogModal(false);
                    setEditingChangelog(null);
                    setShowPreview(false);
                    setAllowPatch(false);
                    setNewChangelog({
                      title: '',
                      type: 'release',
                      modVersion: '',
                      fileName: '',
                      mcVersions: [],
                      changelog: '',
                      changelogType: 'markdown',
                      fileDate: new Date().toISOString().split('T')[0],
                      downloadUrl: '',
                      isLatest: false,
                      linkedBugReports: [],
                      visibility: 'private'
                    });
                  }}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={newChangelog.title || ''}
                  onChange={(e) => setNewChangelog({ ...newChangelog, title: e.target.value })}
                  placeholder="e.g., Latest Version or Version 2.0.1"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">This will be displayed as the heading for this changelog entry</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">Mod Version *</label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!config.curseforgeProjectSlug && !config.links?.curseforge) {
                          alert('Please configure CurseForge project slug or URL in the Config tab first.');
                          return;
                        }
                        
                        setFetchingVersion(true);
                        try {
                          const projectSlug = config.curseforgeProjectSlug || CurseForgeService.extractProjectId(config.links?.curseforge || '');
                          if (!projectSlug) {
                            throw new Error('Could not extract project slug from CurseForge URL. Please set it manually in Config.');
                          }
                          
                          const latestFile = await CurseForgeService.getLatestRelease(projectSlug, config);
                          if (!latestFile) {
                            throw new Error('No release files found on CurseForge.');
                          }
                          
                          const fileName = latestFile.fileName || latestFile.displayName || '';
                          const extractedVersion = CurseForgeService.extractModVersionFromFileName(fileName);
                          
                          // Build download URL
                          const projectSlugForUrl = config.curseforgeProjectSlug || 
                                                   CurseForgeService.extractProjectSlug(config.links?.curseforge || '') ||
                                                   projectSlug;
                          
                          let finalSlug = projectSlugForUrl;
                          if (/^\d+$/.test(projectSlugForUrl)) {
                            try {
                              const projectInfo = await CurseForgeService.getProjectInfo(projectSlugForUrl, config);
                              if (projectInfo && projectInfo.slug) {
                                finalSlug = projectInfo.slug;
                              }
                            } catch (e) {
                              finalSlug = projectSlugForUrl;
                            }
                          }
                          
                          const downloadUrl = latestFile.id ? CurseForgeService.buildDownloadUrl(finalSlug, latestFile.id) : '';
                          
                          if (extractedVersion) {
                            setNewChangelog({ 
                              ...newChangelog, 
                              modVersion: extractedVersion,
                              fileName: fileName, // Also set the jar name
                              downloadUrl: downloadUrl // Set download URL
                            });
                          } else {
                            const versionMatch = latestFile.displayName?.match(/v?(\d+\.\d+\.\d+)/i) || 
                                                latestFile.fileName?.match(/v?(\d+\.\d+\.\d+)/i);
                            if (versionMatch) {
                              setNewChangelog({ 
                                ...newChangelog, 
                                modVersion: versionMatch[1],
                                fileName: fileName, // Also set the jar name
                                downloadUrl: downloadUrl // Set download URL
                              });
                            } else {
                              throw new Error('Could not extract version from file name.');
                            }
                          }
                        } catch (error: any) {
                          alert(`Failed to fetch version from CurseForge: ${error.message || 'Unknown error'}`);
                        } finally {
                          setFetchingVersion(false);
                        }
                      }}
                      disabled={fetchingVersion}
                      className="px-3 py-0.5 bg-transparent border border-white text-white hover:bg-white/10 rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium disabled:border-gray-600 disabled:text-gray-500"
                      title="Fetch latest version from CurseForge"
                    >
                      {fetchingVersion ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <span>Fetch</span>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={newChangelog.modVersion || ''}
                      onChange={(e) => {
                        setNewChangelog({ ...newChangelog, modVersion: e.target.value });
                        setShowJarDropdown(false); // Close dropdown when typing
                      }}
                      placeholder="e.g., 2.0.1"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    {showJarDropdown && matchingJarFiles.length > 0 && (
                      <div ref={jarDropdownRef} className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {matchingJarFiles.map((file, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setNewChangelog(prev => ({ 
                                ...prev, 
                                fileName: file.fileName,
                                downloadUrl: file.downloadUrl
                              }));
                              setShowJarDropdown(false);
                              setMatchingJarFiles([]);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 border-b border-gray-700 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{file.displayName}</div>
                            {file.gameVersions.length > 0 && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                MC: {file.gameVersions.slice(0, 3).join(', ')}{file.gameVersions.length > 3 ? '...' : ''}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">File Name *</label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!config.curseforgeProjectSlug && !config.links?.curseforge) {
                          alert('Please configure CurseForge project slug or URL in the Config tab first.');
                          return;
                        }
                        
                        setFetchingFileName(true);
                        try {
                          const projectSlug = config.curseforgeProjectSlug || CurseForgeService.extractProjectId(config.links?.curseforge || '');
                          if (!projectSlug) {
                            throw new Error('Could not extract project slug from CurseForge URL. Please set it manually in Config.');
                          }
                          
                          const latestFile = await CurseForgeService.getLatestRelease(projectSlug, config);
                          if (!latestFile) {
                            throw new Error('No release files found on CurseForge.');
                          }
                          
                          const fileName = latestFile.fileName || latestFile.displayName || '';
                          if (fileName) {
                            setNewChangelog({ ...newChangelog, fileName: fileName });
                          } else {
                            throw new Error('File name not found in latest release.');
                          }
                        } catch (error: any) {
                          alert(`Failed to fetch file name from CurseForge: ${error.message || 'Unknown error'}`);
                        } finally {
                          setFetchingFileName(false);
                        }
                      }}
                      disabled={fetchingFileName}
                      className="px-3 py-0.5 bg-transparent border border-white text-white hover:bg-white/10 rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium disabled:border-gray-600 disabled:text-gray-500"
                      title="Fetch latest file name from CurseForge"
                    >
                      {fetchingFileName ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <span>Fetch</span>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newChangelog.fileName || ''}
                    onChange={(e) => setNewChangelog({ ...newChangelog, fileName: e.target.value })}
                    placeholder="e.g., buildscape-2.0.1.jar"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Release Date *</label>
                  <input
                    type="date"
                    value={newChangelog.fileDate || ''}
                    onChange={(e) => setNewChangelog({ ...newChangelog, fileDate: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Download URL (Optional)</label>
                  <input
                    type="url"
                    value={newChangelog.downloadUrl || ''}
                    onChange={(e) => setNewChangelog({ ...newChangelog, downloadUrl: e.target.value })}
                    placeholder="https://... (auto-filled when jar name and MC version are set)"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Minecraft Versions *</label>
                  <div className="flex flex-wrap gap-2">
                    {config.mcVersions.map((version) => (
                      <button
                        key={version}
                        type="button"
                        onClick={() => {
                          const current = newChangelog.mcVersions || [];
                          if (current.includes(version)) {
                            setNewChangelog({ ...newChangelog, mcVersions: current.filter(v => v !== version) });
                          } else {
                            setNewChangelog({ ...newChangelog, mcVersions: [...current, version] });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          (newChangelog.mcVersions || []).includes(version)
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                        }`}
                      >
                        {version}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type *</label>
                  <select
                    value={newChangelog.type || 'release'}
                    onChange={(e) => setNewChangelog({ ...newChangelog, type: e.target.value as 'patch' | 'release' })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="release">Release</option>
                    <option value="patch">Patch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Allow Patch?</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newValue = !allowPatch;
                      setAllowPatch(newValue);
                      if (!newValue) {
                        setNewChangelog({ ...newChangelog, linkedBugReports: [] });
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      allowPatch
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {allowPatch ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Changelog Formatting</label>
                  <select
                    value={newChangelog.changelogType || 'markdown'}
                    onChange={(e) => setNewChangelog({ ...newChangelog, changelogType: e.target.value as 'html' | 'markdown' })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">Changelog Content *</label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                  >
                    <Eye size={14} />
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
                
                {newChangelog.changelogType === 'markdown' && (
                  <div className="flex flex-wrap gap-1 p-2 bg-gray-800 border border-gray-700 rounded-t-lg border-b-0">
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('**', '**')}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bold"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('*', '*')}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Italic"
                    >
                      <Italic size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('# ', '', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 1"
                    >
                      <Heading1 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('## ', '', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 2"
                    >
                      <Heading2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('### ', '', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 3"
                    >
                      <Heading3 size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('- ', '', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bullet List"
                    >
                      <List size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('`', '`')}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Inline Code"
                    >
                      <Code size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('```\n', '\n```', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Code Block"
                    >
                      <Code size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt('Enter URL:');
                        const text = prompt('Enter link text:', url || '');
                        if (url && text) {
                          insertTextAtCursor(`[${text}](${url})`, '');
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Link"
                    >
                      <LinkIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt('Enter image URL:');
                        const alt = prompt('Enter alt text:', '');
                        if (url) {
                          insertTextAtCursor(`![${alt || ''}](${url})`, '');
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Image"
                    >
                      <ImageIcon size={16} />
                    </button>
                  </div>
                )}
                
                {newChangelog.changelogType === 'html' && (
                  <div className="flex flex-wrap gap-1 p-2 bg-gray-800 border border-gray-700 rounded-t-lg border-b-0">
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('<strong>', '</strong>')}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bold"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('<em>', '</em>')}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Italic"
                    >
                      <Italic size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('<h1>', '</h1>', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 1"
                    >
                      <Heading1 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('<h2>', '</h2>', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 2"
                    >
                      <Heading2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('<h3>', '</h3>', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 3"
                    >
                      <Heading3 size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('<ul>\n<li>', '</li>\n</ul>', true)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bullet List"
                    >
                      <List size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt('Enter URL:');
                        const text = prompt('Enter link text:', url || '');
                        if (url && text) {
                          insertTextAtCursor(`<a href="${url}">${text}</a>`, '');
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Link"
                    >
                      <LinkIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = prompt('Enter image URL:');
                        const alt = prompt('Enter alt text:', '');
                        if (url) {
                          insertTextAtCursor(`<img src="${url}" alt="${alt || ''}" />`, '');
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Image"
                    >
                      <ImageIcon size={16} />
                    </button>
                  </div>
                )}
                
                <div className="relative">
                  <textarea
                    ref={changelogTextareaRef}
                    value={newChangelog.changelog || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewChangelog({ ...newChangelog, changelog: value });
                      
                      if ((allowPatch || newChangelog.type === 'patch') && changelogTextareaRef.current) {
                        const cursorPos = changelogTextareaRef.current.selectionStart;
                        const textBeforeCursor = value.substring(0, cursorPos);
                        const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
                        
                        if (match) {
                          const query = match[1];
                          setAutocompleteQuery(query);
                          const rect = changelogTextareaRef.current.getBoundingClientRect();
                          const textBeforeMatch = textBeforeCursor.substring(0, match.index);
                          const lines = textBeforeMatch.split('\n');
                          const lineNumber = lines.length - 1;
                          const lineText = lines[lineNumber];
                          
                          const tempDiv = document.createElement('div');
                          tempDiv.style.position = 'absolute';
                          tempDiv.style.visibility = 'hidden';
                          tempDiv.style.whiteSpace = 'pre-wrap';
                          tempDiv.style.font = window.getComputedStyle(changelogTextareaRef.current).font;
                          tempDiv.style.padding = window.getComputedStyle(changelogTextareaRef.current).padding;
                          tempDiv.textContent = lineText;
                          document.body.appendChild(tempDiv);
                          
                          const left = rect.left + tempDiv.offsetWidth;
                          const top = rect.top + (lineNumber + 1) * parseFloat(window.getComputedStyle(changelogTextareaRef.current).lineHeight || '20');
                          
                          document.body.removeChild(tempDiv);
                          
                          setAutocompletePosition({ top, left });
                          setShowBugAutocomplete(true);
                          setSelectedAutocompleteIndex(0);
                        } else {
                          setShowBugAutocomplete(false);
                        }
                      } else {
                        setShowBugAutocomplete(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (showBugAutocomplete && (allowPatch || newChangelog.type === 'patch')) {
                        const linkedBugReportIds = new Set(changelogs.filter(c => c.id !== editingChangelog?.id).flatMap(c => c.linkedBugReports || []));
                        const availableReports = reports.filter(r => !linkedBugReportIds.has(r.id));
                        const filtered = availableReports.filter(r => 
                          r.id.toLowerCase().includes(autocompleteQuery.toLowerCase()) || 
                          r.title.toLowerCase().includes(autocompleteQuery.toLowerCase())
                        );
                        
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedAutocompleteIndex(prev => (prev + 1) % filtered.length);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedAutocompleteIndex(prev => (prev - 1 + filtered.length) % filtered.length);
                        } else if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault();
                          if (filtered[selectedAutocompleteIndex]) {
                            const report = filtered[selectedAutocompleteIndex];
                            const textarea = changelogTextareaRef.current;
                            if (textarea) {
                              const cursorPos = textarea.selectionStart;
                              const text = textarea.value;
                              const textBeforeCursor = text.substring(0, cursorPos);
                              const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
                              if (match) {
                                const start = cursorPos - match[0].length;
                                const newText = text.substring(0, start) + `@${report.id}` + text.substring(cursorPos);
                                setNewChangelog({ ...newChangelog, changelog: newText });
                                setShowBugAutocomplete(false);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start + report.id.length + 1, start + report.id.length + 1);
                                }, 0);
                              }
                            }
                          }
                        } else if (e.key === 'Escape') {
                          setShowBugAutocomplete(false);
                        }
                      }
                    }}
                    placeholder="Enter changelog content here..."
                    rows={showPreview ? 8 : 15}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-b-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm resize-y"
                  />
                  
                  {showBugAutocomplete && (allowPatch || newChangelog.type === 'patch') && (
                    <div 
                      className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                      style={{ 
                        top: `${autocompletePosition.top}px`, 
                        left: `${autocompletePosition.left}px`,
                        minWidth: '300px'
                      }}
                    >
                      {(() => {
                        const linkedBugReportIds = new Set(changelogs.filter(c => c.id !== editingChangelog?.id).flatMap(c => c.linkedBugReports || []));
                        const availableReports = reports.filter(r => !linkedBugReportIds.has(r.id));
                        const filtered = availableReports.filter(r => 
                          r.id.toLowerCase().includes(autocompleteQuery.toLowerCase()) || 
                          r.title.toLowerCase().includes(autocompleteQuery.toLowerCase())
                        );
                        
                        if (filtered.length === 0) {
                          return <div className="p-2 text-sm text-gray-400">No matching bug reports</div>;
                        }
                        
                        return filtered.map((report, idx) => (
                          <div
                            key={report.id}
                            className={`p-2 cursor-pointer hover:bg-gray-700 ${
                              idx === selectedAutocompleteIndex ? 'bg-gray-700' : ''
                            }`}
                            onClick={() => {
                              const textarea = changelogTextareaRef.current;
                              if (textarea) {
                                const cursorPos = textarea.selectionStart;
                                const text = textarea.value;
                                const textBeforeCursor = text.substring(0, cursorPos);
                                const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
                                if (match) {
                                  const start = cursorPos - match[0].length;
                                  const newText = text.substring(0, start) + `@${report.id}` + text.substring(cursorPos);
                                  setNewChangelog({ ...newChangelog, changelog: newText });
                                  setShowBugAutocomplete(false);
                                  setTimeout(() => {
                                    textarea.focus();
                                    textarea.setSelectionRange(start + report.id.length + 1, start + report.id.length + 1);
                                  }, 0);
                                }
                              }
                            }}
                          >
                            <div className="text-sm text-white font-medium">{report.title}</div>
                            <div className="text-xs text-gray-400">ID: {report.id}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
                {newChangelog.changelogType === 'html' && (
                  <p className="text-xs text-gray-500 mt-1">Supports HTML formatting</p>
                )}
                
                {showPreview && newChangelog.changelog && (
                  <div className="mt-4 p-4 bg-black/40 border border-gray-800 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2 font-semibold">Preview:</div>
                    <div className="prose prose-invert max-w-none">
                      {newChangelog.changelogType === 'html' ? (
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHTMLPermissive(processPatchReferences(newChangelog.changelog)) }} />
                      ) : (
                        renderMarkdownPreview(newChangelog.changelog)
                      )}
                    </div>
                  </div>
                )}
              </div>

              {allowPatch && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Linked Bug Reports</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-lg p-3 bg-gray-800/50">
                    {(() => {
                      const linkedBugReportIds = new Set(changelogs.filter(c => c.id !== editingChangelog?.id).flatMap(c => c.linkedBugReports || []));
                      const availableReports = reports.filter(r => !linkedBugReportIds.has(r.id));
                      
                      if (availableReports.length === 0) {
                        return <p className="text-sm text-gray-500">No available bug reports. All reports are already linked to patch notes.</p>;
                      }
                      
                      return (
                        <div className="space-y-2">
                          {availableReports.map(report => (
                            <label key={report.id} className="flex items-start gap-2 p-2 hover:bg-gray-700/50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(newChangelog.linkedBugReports || []).includes(report.id)}
                                onChange={(e) => {
                                  const current = newChangelog.linkedBugReports || [];
                                  if (e.target.checked) {
                                    setNewChangelog({ ...newChangelog, linkedBugReports: [...current, report.id] });
                                  } else {
                                    setNewChangelog({ ...newChangelog, linkedBugReports: current.filter(id => id !== report.id) });
                                  }
                                }}
                                className="mt-1 w-4 h-4 text-green-600 bg-gray-800 border-gray-700 rounded focus:ring-green-500"
                              />
                              <div className="flex-1">
                                <div className="text-sm text-white font-medium">{report.title}</div>
                                <div className="text-xs text-gray-400">ID: {report.id}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Select bug reports that are fixed in this changelog</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isLatest"
                  checked={newChangelog.isLatest || false}
                  onChange={(e) => setNewChangelog({ ...newChangelog, isLatest: e.target.checked })}
                  className="w-4 h-4 text-green-600 bg-gray-800 border-gray-700 rounded focus:ring-green-500"
                />
                <label htmlFor="isLatest" className="text-sm text-gray-300">
                  Mark as latest version
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowChangelogModal(false);
                  setEditingChangelog(null);
                }}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    if (!newChangelog.title || !newChangelog.modVersion || !newChangelog.fileName || !newChangelog.changelog || !newChangelog.fileDate || !newChangelog.mcVersions?.length) {
                      alert('Please fill in all required fields');
                      return;
                    }

                    const newId = editingChangelog?.id || Date.now().toString();
                    // Ensure visibility is set correctly
                    const changelogToSave = {
                      ...newChangelog,
                      id: newId,
                      visibility: newChangelog.visibility || 'private' // Ensure visibility defaults to private
                    } as ChangelogEntry;
                    
                    const updated: ChangelogEntry[] = editingChangelog
                      ? changelogs.map(c => c.id === editingChangelog.id ? changelogToSave : c)
                      : [...changelogs, changelogToSave];

                    if (newChangelog.isLatest) {
                      updated.forEach(c => {
                        if (c.id !== newId) {
                          c.isLatest = false;
                        }
                      });
                    }

                    setChangelogs(updated);
                    const updatedConfig = { ...config, changelogs: updated };
                    onUpdateConfig(updatedConfig);
                    
                    try {
                      await StorageService.saveAll(reports, suggestions, updatedConfig);
                    } catch (e: any) {
                      console.error("Failed to save changelogs:", e);
                      alert('Failed to save changelog. Please try again.');
                      return;
                    }
                    
                    // Reset form
                    setNewChangelog({
                      title: '',
                      type: 'release',
                      modVersion: '',
                      fileName: '',
                      changelog: '',
                      fileDate: new Date().toISOString().split('T')[0],
                      downloadUrl: '',
                      mcVersions: [],
                      changelogType: 'markdown',
                      isLatest: false,
                      linkedBugReports: [],
                      visibility: 'private' // Explicitly set to private
                    });
                    setShowChangelogModal(false);
                    setEditingChangelog(null);
                    setShowPreview(false);
                  } catch (error: any) {
                    console.error("Error creating changelog:", error);
                    alert(`Error: ${error.message || 'Failed to create changelog. Please try again.'}`);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
              >
                {editingChangelog ? 'Save Changes' : 'Create Changelog'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tier Editor Modal */}
      {showTierModal && editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setShowTierModal(false)}>
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Crown size={20} />{kofiTiers.find(t => t.id === editingTier.id) ? 'Edit Tier' : 'Create Tier'}</h3>
              <button onClick={() => { setShowTierModal(false); setEditingTier(null); setEditingReward(null); }} className="p-1 text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Tier Name *</label><input type="text" value={editingTierForm.name || ''} onChange={(e) => setEditingTierForm({...editingTierForm, name: e.target.value})} placeholder="e.g., Bronze, Silver, Gold" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Ko-fi Tier Name *</label><input type="text" value={editingTierForm.koFiTierName || ''} onChange={(e) => setEditingTierForm({...editingTierForm, koFiTierName: e.target.value})} placeholder="Exact name from Ko-fi" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500" /><p className="text-xs text-gray-500 mt-1">Must match exactly as shown in Ko-fi</p></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Description</label><textarea value={editingTierForm.description || ''} onChange={(e) => setEditingTierForm({...editingTierForm, description: e.target.value})} placeholder="Describe this tier..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500" rows={3} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Priority</label><input type="number" value={editingTierForm.priority || 0} onChange={(e) => setEditingTierForm({...editingTierForm, priority: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500" /><p className="text-xs text-gray-500 mt-1">Higher = more important</p></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Duration Type</label><select value={editingTierForm.durationType || 'subscription'} onChange={(e) => setEditingTierForm({...editingTierForm, durationType: e.target.value as 'permanent' | 'subscription'})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"><option value="subscription">With Subscription</option><option value="permanent">Permanent</option></select></div>
                <div className="flex items-end"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editingTierForm.enabled !== false} onChange={(e) => setEditingTierForm({...editingTierForm, enabled: e.target.checked})} className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-green-600 focus:ring-green-500" /><span className="text-sm text-gray-300">Enabled</span></label></div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-4"><h4 className="text-lg font-semibold text-white">Rewards</h4><button onClick={() => { const newReward: KofiRewardItem = {id: Date.now().toString(), type: 'item', displayName: '', itemId: '', itemCount: 1}; setEditingTierForm({...editingTierForm, rewards: [...(editingTierForm.rewards || []), newReward]}); setEditingReward(newReward); }} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"><Plus size={16} />Add Reward</button></div>
                <div className="space-y-2">
                  {(editingTierForm.rewards || []).map((reward, idx) => (
                    <div key={reward.id || idx} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={reward.displayName}
                              onChange={(e) => {
                                const updated = [...(editingTierForm.rewards || [])];
                                updated[idx] = {...reward, displayName: e.target.value};
                                setEditingTierForm({...editingTierForm, rewards: updated});
                              }}
                              placeholder="Display Name *"
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                            <select
                              value={reward.type}
                              onChange={(e) => {
                                const updated = [...(editingTierForm.rewards || [])];
                                updated[idx] = {...reward, type: e.target.value as any};
                                setEditingTierForm({...editingTierForm, rewards: updated});
                              }}
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                              <option value="item">Item</option>
                              <option value="command">Command</option>
                              <option value="permission">Permission</option>
                              <option value="custom">Custom</option>
                              <option value="downloadable">Downloadable</option>
                              <option value="cosmetic">Cosmetic</option>
                            </select>
                          </div>
                          {reward.type === 'item' && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={reward.itemId || ''}
                                onChange={(e) => {
                                  const updated = [...(editingTierForm.rewards || [])];
                                  updated[idx] = {...reward, itemId: e.target.value};
                                  setEditingTierForm({...editingTierForm, rewards: updated});
                                }}
                                placeholder="Item ID (e.g., minecraft:diamond)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <input
                                type="number"
                                value={reward.itemCount || 1}
                                onChange={(e) => {
                                  const updated = [...(editingTierForm.rewards || [])];
                                  updated[idx] = {...reward, itemCount: parseInt(e.target.value) || 1};
                                  setEditingTierForm({...editingTierForm, rewards: updated});
                                }}
                                placeholder="Count"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            </div>
                          )}
                          {reward.type === 'command' && (
                            <input
                              type="text"
                              value={reward.command || ''}
                              onChange={(e) => {
                                const updated = [...(editingTierForm.rewards || [])];
                                updated[idx] = {...reward, command: e.target.value};
                                setEditingTierForm({...editingTierForm, rewards: updated});
                              }}
                              placeholder="Command (use {player} for player name)"
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          )}
                          {reward.type === 'permission' && (
                            <input
                              type="text"
                              value={reward.permission || ''}
                              onChange={(e) => {
                                const updated = [...(editingTierForm.rewards || [])];
                                updated[idx] = {...reward, permission: e.target.value};
                                setEditingTierForm({...editingTierForm, rewards: updated});
                              }}
                              placeholder="Permission node"
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          )}
                          {reward.type === 'custom' && (
                            <textarea
                              value={reward.customData || ''}
                              onChange={(e) => {
                                const updated = [...(editingTierForm.rewards || [])];
                                updated[idx] = {...reward, customData: e.target.value};
                                setEditingTierForm({...editingTierForm, rewards: updated});
                              }}
                              placeholder="Custom JSON data"
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                              rows={2}
                            />
                          )}
                          {reward.type === 'downloadable' && (
                            <input
                              type="url"
                              value={reward.downloadUrl || ''}
                              onChange={(e) => {
                                const updated = [...(editingTierForm.rewards || [])];
                                updated[idx] = {...reward, downloadUrl: e.target.value};
                                setEditingTierForm({...editingTierForm, rewards: updated});
                              }}
                              placeholder="Download URL (e.g., https://example.com/file.zip)"
                              className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                          )}
                          {reward.type === 'cosmetic' && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={reward.cosmeticData?.itemId || ''}
                                onChange={(e) => {
                                  const updated = [...(editingTierForm.rewards || [])];
                                  updated[idx] = {
                                    ...reward,
                                    cosmeticData: {
                                      ...reward.cosmeticData,
                                      itemId: e.target.value
                                    }
                                  };
                                  setEditingTierForm({...editingTierForm, rewards: updated});
                                }}
                                placeholder="Item ID (e.g., buildscape:hammer)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <input
                                type="text"
                                value={reward.cosmeticData?.skinId || ''}
                                onChange={(e) => {
                                  const updated = [...(editingTierForm.rewards || [])];
                                  updated[idx] = {
                                    ...reward,
                                    cosmeticData: {
                                      ...reward.cosmeticData,
                                      skinId: e.target.value
                                    }
                                  };
                                  setEditingTierForm({...editingTierForm, rewards: updated});
                                }}
                                placeholder="Skin ID (optional)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <input
                                type="url"
                                value={reward.cosmeticData?.textureUrl || ''}
                                onChange={(e) => {
                                  const updated = [...(editingTierForm.rewards || [])];
                                  updated[idx] = {
                                    ...reward,
                                    cosmeticData: {
                                      ...reward.cosmeticData,
                                      textureUrl: e.target.value
                                    }
                                  };
                                  setEditingTierForm({...editingTierForm, rewards: updated});
                                }}
                                placeholder="Texture URL (optional)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <textarea
                                value={reward.cosmeticData?.modelData || ''}
                                onChange={(e) => {
                                  const updated = [...(editingTierForm.rewards || [])];
                                  updated[idx] = {
                                    ...reward,
                                    cosmeticData: {
                                      ...reward.cosmeticData,
                                      modelData: e.target.value
                                    }
                                  };
                                  setEditingTierForm({...editingTierForm, rewards: updated});
                                }}
                                placeholder="Custom Model Data (JSON, optional)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                                rows={2}
                              />
                            </div>
                          )}
                          <input
                            type="text"
                            value={reward.description || ''}
                            onChange={(e) => {
                              const updated = [...(editingTierForm.rewards || [])];
                              updated[idx] = {...reward, description: e.target.value};
                              setEditingTierForm({...editingTierForm, rewards: updated});
                            }}
                            placeholder="Description (optional)"
                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const updated = (editingTierForm.rewards || []).filter((_, i) => i !== idx);
                            setEditingTierForm({...editingTierForm, rewards: updated});
                          }}
                          className="p-1.5 text-red-400 hover:text-red-300"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!editingTierForm.rewards || editingTierForm.rewards.length === 0) && (
                    <p className="text-sm text-gray-500 text-center py-4">No rewards added yet. Click "Add Reward" to add one.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end mt-6 pt-4 border-t border-gray-700">
              <button onClick={() => { setShowTierModal(false); setEditingTier(null); setEditingReward(null); }} className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm sm:text-base">Cancel</button>
              <button onClick={async () => { if (!editingTierForm.name || !editingTierForm.koFiTierName) { alert('Tier Name and Ko-fi Tier Name are required'); return; } const updatedTier: KofiTier = {...editingTier, ...editingTierForm, updatedAt: Date.now(), createdAt: editingTier.createdAt || Date.now()} as KofiTier; const updated = editingTier.id && kofiTiers.find(t => t.id === editingTier.id) ? kofiTiers.map(t => t.id === editingTier.id ? updatedTier : t) : [...kofiTiers, updatedTier]; setKofiTiers(updated); await saveKofiTiers(updated); setShowTierModal(false); setEditingTier(null); setEditingReward(null); setToast({msg: 'Tier saved successfully', type: 'success'}); }} className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2"><Save size={14} className="sm:w-4 sm:h-4" /><span>Save Tier</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Reward Modal */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setShowRewardModal(false)}>
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Gift size={20} />Grant Manual Reward</h3><button onClick={() => { setShowRewardModal(false); setSelectedRewardUser(''); setRewardUserSearch(''); setManualRewardReason(''); setManualRewardItems([]); }} className="p-1 text-gray-400 hover:text-white"><X size={20} /></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">Select User *</label><input type="text" value={rewardUserSearch} onChange={(e) => { setRewardUserSearch(e.target.value); }} onFocus={async () => { try { const users = await AuthService.getAllUsers(); setAvailableUsers(users); } catch (error) { console.error('Failed to load users:', error); } }} placeholder="Search for user..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500" />{rewardUserSearch && (<div className="mt-2 max-h-40 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg">{availableUsers.filter(u => u.username.toLowerCase().includes(rewardUserSearch.toLowerCase())).slice(0, 10).map(user => (<button key={user.id} onClick={() => { setSelectedRewardUser(user.id); setRewardUserSearch(user.username); }} className="w-full text-left px-3 py-2 hover:bg-gray-800 text-white text-sm border-b border-gray-800 last:border-0">{user.username} {user.minecraftUsername && `(${user.minecraftUsername})`}</button>))}</div>)}</div>
              {selectedRewardUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Reason *</label>
                    <textarea
                      value={manualRewardReason}
                      onChange={(e) => setManualRewardReason(e.target.value)}
                      placeholder="Reason for granting this reward..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows={3}
                    />
                  </div>
                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white">Rewards to Grant</h4>
                      <button
                        onClick={() => {
                          const newReward: KofiRewardItem = {
                            id: Date.now().toString(),
                            type: 'item',
                            displayName: '',
                            itemId: '',
                            itemCount: 1
                          };
                          setManualRewardItems([...manualRewardItems, newReward]);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                      >
                        <Plus size={16} />
                        Add Reward
                      </button>
                    </div>
                    <div className="space-y-2">
                      {manualRewardItems.map((reward, idx) => (
                        <div key={reward.id || idx} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={reward.displayName}
                                  onChange={(e) => {
                                    const updated = [...manualRewardItems];
                                    updated[idx] = {...reward, displayName: e.target.value};
                                    setManualRewardItems(updated);
                                  }}
                                  placeholder="Display Name *"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                <select
                                  value={reward.type}
                                  onChange={(e) => {
                                    const updated = [...manualRewardItems];
                                    updated[idx] = {...reward, type: e.target.value as any};
                                    setManualRewardItems(updated);
                                  }}
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                  <option value="item">Item</option>
                                  <option value="command">Command</option>
                                  <option value="permission">Permission</option>
                                  <option value="custom">Custom</option>
                                </select>
                              </div>
                              {reward.type === 'item' && (
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={reward.itemId || ''}
                                    onChange={(e) => {
                                      const updated = [...manualRewardItems];
                                      updated[idx] = {...reward, itemId: e.target.value};
                                      setManualRewardItems(updated);
                                    }}
                                    placeholder="Item ID"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                  />
                                  <input
                                    type="number"
                                    value={reward.itemCount || 1}
                                    onChange={(e) => {
                                      const updated = [...manualRewardItems];
                                      updated[idx] = {...reward, itemCount: parseInt(e.target.value) || 1};
                                      setManualRewardItems(updated);
                                    }}
                                    placeholder="Count"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                  />
                                </div>
                              )}
                              {reward.type === 'command' && (
                                <input
                                  type="text"
                                  value={reward.command || ''}
                                  onChange={(e) => {
                                    const updated = [...manualRewardItems];
                                    updated[idx] = {...reward, command: e.target.value};
                                    setManualRewardItems(updated);
                                  }}
                                  placeholder="Command (use {player} for player name)"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                              )}
                              {reward.type === 'permission' && (
                                <input
                                  type="text"
                                  value={reward.permission || ''}
                                  onChange={(e) => {
                                    const updated = [...manualRewardItems];
                                    updated[idx] = {...reward, permission: e.target.value};
                                    setManualRewardItems(updated);
                                  }}
                                  placeholder="Permission node"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                              )}
                              {reward.type === 'custom' && (
                                <textarea
                                  value={reward.customData || ''}
                                  onChange={(e) => {
                                    const updated = [...manualRewardItems];
                                    updated[idx] = {...reward, customData: e.target.value};
                                    setManualRewardItems(updated);
                                  }}
                                  placeholder="Custom JSON data"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                                  rows={2}
                                />
                              )}
                              {reward.type === 'downloadable' && (
                                <input
                                  type="url"
                                  value={reward.downloadUrl || ''}
                                  onChange={(e) => {
                                    const updated = [...manualRewardItems];
                                    updated[idx] = {...reward, downloadUrl: e.target.value};
                                    setManualRewardItems(updated);
                                  }}
                                  placeholder="Download URL (e.g., https://example.com/file.zip)"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                              )}
                              {reward.type === 'cosmetic' && (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={reward.cosmeticData?.itemId || ''}
                                    onChange={(e) => {
                                      const updated = [...manualRewardItems];
                                      updated[idx] = {
                                        ...reward,
                                        cosmeticData: {
                                          ...reward.cosmeticData,
                                          itemId: e.target.value
                                        }
                                      };
                                      setManualRewardItems(updated);
                                    }}
                                    placeholder="Item ID (e.g., buildscape:hammer)"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                  />
                                  <input
                                    type="text"
                                    value={reward.cosmeticData?.skinId || ''}
                                    onChange={(e) => {
                                      const updated = [...manualRewardItems];
                                      updated[idx] = {
                                        ...reward,
                                        cosmeticData: {
                                          ...reward.cosmeticData,
                                          skinId: e.target.value
                                        }
                                      };
                                      setManualRewardItems(updated);
                                    }}
                                    placeholder="Skin ID (optional)"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                  />
                                  <input
                                    type="url"
                                    value={reward.cosmeticData?.textureUrl || ''}
                                    onChange={(e) => {
                                      const updated = [...manualRewardItems];
                                      updated[idx] = {
                                        ...reward,
                                        cosmeticData: {
                                          ...reward.cosmeticData,
                                          textureUrl: e.target.value
                                        }
                                      };
                                      setManualRewardItems(updated);
                                    }}
                                    placeholder="Texture URL (optional)"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                  />
                                  <textarea
                                    value={reward.cosmeticData?.modelData || ''}
                                    onChange={(e) => {
                                      const updated = [...manualRewardItems];
                                      updated[idx] = {
                                        ...reward,
                                        cosmeticData: {
                                          ...reward.cosmeticData,
                                          modelData: e.target.value
                                        }
                                      };
                                      setManualRewardItems(updated);
                                    }}
                                    placeholder="Custom Model Data (JSON, optional)"
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                const updated = manualRewardItems.filter((_, i) => i !== idx);
                                setManualRewardItems(updated);
                              }}
                              className="p-1.5 text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => {
                        setShowRewardModal(false);
                        setSelectedRewardUser('');
                        setRewardUserSearch('');
                        setManualRewardReason('');
                        setManualRewardItems([]);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedRewardUser || !manualRewardReason || manualRewardItems.length === 0) {
                          alert('Please fill in all required fields');
                          return;
                        }
                        const newReward: ManualReward = {
                          id: Date.now().toString(),
                          userId: selectedRewardUser,
                          rewards: manualRewardItems,
                          reason: manualRewardReason,
                          grantedBy: currentUser.username,
                          grantedAt: Date.now(),
                          granted: false
                        };
                        const updated = [...manualRewards, newReward];
                        setManualRewards(updated);
                        await saveManualReward(newReward);
                        setShowRewardModal(false);
                        setSelectedRewardUser('');
                        setRewardUserSearch('');
                        setManualRewardReason('');
                        setManualRewardItems([]);
                        setToast({msg: 'Manual reward granted', type: 'success'});
                      }}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto"
                    >
                      <Gift size={14} className="sm:w-4 sm:h-4" />
                      <span>Grant Reward</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Tiers from Ko-fi Modal */}
      {showImportTiersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setShowImportTiersModal(false)}>
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <RefreshCw size={20} />
                Import Tiers from Ko-fi
              </h3>
              <button
                onClick={() => {
                  setShowImportTiersModal(false);
                  setImportTierNames('');
                }}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-2">
                  <strong>Note:</strong> Ko-fi doesn't provide an API to fetch tiers automatically. 
                  Please enter the tier names exactly as they appear on your Ko-fi membership page.
                </p>
                <p className="text-xs text-blue-400">
                  Enter one tier name per line, or separate them with commas. The system will create tier entries for each name.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tier Names from Ko-fi *
                </label>
                <textarea
                  value={importTierNames}
                  onChange={(e) => setImportTierNames(e.target.value)}
                  placeholder="Enter tier names, one per line or comma-separated:&#10;Bronze Supporter&#10;Silver Supporter&#10;Gold Supporter"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={8}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Each tier will be created with default settings. You can edit them after import to add rewards and configure details.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    setShowImportTiersModal(false);
                    setImportTierNames('');
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!importTierNames.trim()) {
                      alert('Please enter at least one tier name');
                      return;
                    }

                    // Parse tier names (split by newline or comma)
                    const tierNames = importTierNames
                      .split(/[\n,]/)
                      .map(name => name.trim())
                      .filter(name => name.length > 0);

                    if (tierNames.length === 0) {
                      alert('No valid tier names found');
                      return;
                    }

                    // Check for duplicates
                    const existingNames = new Set(kofiTiers.map(t => t.koFiTierName.toLowerCase()));
                    const duplicates = tierNames.filter(name => existingNames.has(name.toLowerCase()));

                    if (duplicates.length > 0) {
                      if (!confirm(`Some tiers already exist: ${duplicates.join(', ')}\n\nSkip duplicates and create new ones?`)) {
                        return;
                      }
                    }

                    // Create new tiers
                    const newTiers: KofiTier[] = [];
                    let priority = kofiTiers.length > 0 
                      ? Math.max(...kofiTiers.map(t => t.priority || 0), 0) + 1 
                      : 1;

                    for (const tierName of tierNames) {
                      // Skip if already exists
                      if (existingNames.has(tierName.toLowerCase())) {
                        continue;
                      }

                      const newTier: KofiTier = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        name: tierName, // Use Ko-fi name as display name initially
                        koFiTierName: tierName, // Exact match for webhook
                        description: '',
                        rewards: [],
                        durationType: 'subscription',
                        priority: priority++,
                        enabled: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                      };
                      newTiers.push(newTier);
                    }

                    if (newTiers.length === 0) {
                      alert('All tiers already exist');
                      setShowImportTiersModal(false);
                      setImportTierNames('');
                      return;
                    }

                    // Add to existing tiers
                    const updated = [...kofiTiers, ...newTiers];
                    setKofiTiers(updated);
                    await saveKofiTiers(updated);

                    setToast({
                      msg: `Successfully imported ${newTiers.length} tier(s)`,
                      type: 'success'
                    });
                    setShowImportTiersModal(false);
                    setImportTierNames('');
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <RefreshCw size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Import </span>
                  {importTierNames ? importTierNames.split(/[\n,]/).filter(n => n.trim()).length : 0} Tier(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <canvas ref={navbarCanvasRef} className="hidden" />
      <canvas ref={footerCanvasRef} className="hidden" />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] toast-enter pointer-events-none">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
            toast.type === 'success' ? 'bg-[#1e1e1e] border-green-900 text-green-400' : 'bg-[#1e1e1e] border-red-900 text-red-400'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Bug Detail Modal for changelog bug reports */}
      {selectedBugId && (() => {
        const selectedBug = reports.find(r => r.id === selectedBugId);
        return selectedBug ? (
          <BugDetailModal
            bug={selectedBug}
            isOpen={!!selectedBugId}
            onClose={() => setSelectedBugId(null)}
            currentUser={currentUser}
            isAdmin={true}
            onToggleStatus={(id) => {
              const bug = reports.find(r => r.id === id);
              if (bug) {
                const newStatus = (bug.status === 'Resolved' ? 'Open' : 'Resolved') as BugReport['status'];
                const updated = { ...bug, status: newStatus };
                // Set resolvedBy when marking as Resolved, clear it when reopening
                if (newStatus === 'Resolved') {
                  updated.resolvedBy = currentUser.username;
                } else if (newStatus === 'Open') {
                  updated.resolvedBy = undefined;
                }
                onUpdateReport(updated);
              }
            }}
            onUpdateReport={onUpdateReport}
            onAddComment={(bugId, text, images) => {
              const bug = reports.find(r => r.id === bugId);
              if (bug) {
                const newComment = {
                  id: Date.now().toString(),
                  author: currentUser.username,
                  text,
                  images: images || [],
                  timestamp: Date.now(),
                  role: currentUser.role || 'user' as UserRole
                };
                const updated = {
                  ...bug,
                  comments: [...(bug.comments || []), newComment]
                };
                onUpdateReport(updated);
              }
            }}
            onDeleteComment={(bugId, commentId) => {
              const bug = reports.find(r => r.id === bugId);
              if (bug && bug.comments) {
                const updated = {
                  ...bug,
                  comments: bug.comments.filter(c => c.id !== commentId)
                };
                onUpdateReport(updated);
              }
            }}
            onNavigateLogin={() => {}}
            onNotify={(msg, type) => setToast({ msg, type: type || 'success' })}
          />
        ) : null;
      })()}

      {/* Redeem Code Modal */}
      {showRedeemCodeModal && typeof document !== 'undefined' && createPortal(
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
          onClick={(e) => e.target === e.currentTarget && setShowRedeemCodeModal(false)}
        >
          <div 
            className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-3xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Gift size={20} />
                {editingRedeemCode ? 'Edit Redeem Code' : 'Create Redeem Code'}
              </h3>
              <button
                onClick={() => {
                  setShowRedeemCodeModal(false);
                  setEditingRedeemCode(null);
                  setNewRedeemCode({
                    code: '',
                    description: '',
                    rewards: [],
                    maxUses: undefined,
                    expiresAt: undefined,
                    requiresMembership: undefined,
                    enabled: true
                  });
                }}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Code *</label>
                <input
                  type="text"
                  value={newRedeemCode.code || ''}
                  onChange={(e) => setNewRedeemCode({ ...newRedeemCode, code: e.target.value.toUpperCase() })}
                  placeholder="KINGO-DROPED-CODE"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={newRedeemCode.description || ''}
                  onChange={(e) => setNewRedeemCode({ ...newRedeemCode, description: e.target.value })}
                  placeholder="Description of what this code gives"
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rewards *</label>
                <div className="space-y-2">
                  {newRedeemCode.rewards && newRedeemCode.rewards.length > 0 ? (
                    newRedeemCode.rewards.map((reward, idx) => (
                      <div key={idx} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={reward.displayName}
                                onChange={(e) => {
                                  const updated = [...(newRedeemCode.rewards || [])];
                                  updated[idx] = { ...reward, displayName: e.target.value };
                                  setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                }}
                                placeholder="Display Name *"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <select
                                value={reward.type}
                                onChange={(e) => {
                                  const updated = [...(newRedeemCode.rewards || [])];
                                  updated[idx] = { ...reward, type: e.target.value as any };
                                  setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                }}
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              >
                                <option value="item">Item</option>
                                <option value="command">Command</option>
                                <option value="permission">Permission</option>
                                <option value="custom">Custom</option>
                                <option value="downloadable">Downloadable</option>
                                <option value="cosmetic">Cosmetic</option>
                              </select>
                            </div>
                            {reward.type === 'item' && (
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={reward.itemId || ''}
                                  onChange={(e) => {
                                    const updated = [...(newRedeemCode.rewards || [])];
                                    updated[idx] = { ...reward, itemId: e.target.value };
                                    setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                  }}
                                  placeholder="Item ID (e.g., minecraft:diamond)"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                <input
                                  type="number"
                                  value={reward.itemCount || 1}
                                  onChange={(e) => {
                                    const updated = [...(newRedeemCode.rewards || [])];
                                    updated[idx] = { ...reward, itemCount: parseInt(e.target.value) || 1 };
                                    setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                  }}
                                  placeholder="Count"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                              </div>
                            )}
                            {reward.type === 'command' && (
                              <input
                                type="text"
                                value={reward.command || ''}
                                onChange={(e) => {
                                  const updated = [...(newRedeemCode.rewards || [])];
                                  updated[idx] = { ...reward, command: e.target.value };
                                  setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                }}
                                placeholder="Command (use {player} for player name)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            )}
                            {reward.type === 'permission' && (
                              <input
                                type="text"
                                value={reward.permission || ''}
                                onChange={(e) => {
                                  const updated = [...(newRedeemCode.rewards || [])];
                                  updated[idx] = { ...reward, permission: e.target.value };
                                  setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                }}
                                placeholder="Permission node"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            )}
                            {reward.type === 'custom' && (
                              <textarea
                                value={reward.customData || ''}
                                onChange={(e) => {
                                  const updated = [...(newRedeemCode.rewards || [])];
                                  updated[idx] = { ...reward, customData: e.target.value };
                                  setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                }}
                                placeholder='Custom JSON data (e.g., {"downloadUrl": "https://..."})'
                                rows={3}
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            )}
                            {reward.type === 'downloadable' && (
                              <input
                                type="url"
                                value={reward.downloadUrl || ''}
                                onChange={(e) => {
                                  const updated = [...(newRedeemCode.rewards || [])];
                                  updated[idx] = { ...reward, downloadUrl: e.target.value };
                                  setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                }}
                                placeholder="Download URL (e.g., https://example.com/file.zip)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            )}
                            {reward.type === 'cosmetic' && (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={reward.cosmeticData?.itemId || ''}
                                  onChange={(e) => {
                                    const updated = [...(newRedeemCode.rewards || [])];
                                    updated[idx] = {
                                      ...reward,
                                      cosmeticData: {
                                        ...reward.cosmeticData,
                                        itemId: e.target.value
                                      }
                                    };
                                    setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                  }}
                                  placeholder="Item ID (e.g., buildscape:hammer)"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                <input
                                  type="text"
                                  value={reward.cosmeticData?.skinId || ''}
                                  onChange={(e) => {
                                    const updated = [...(newRedeemCode.rewards || [])];
                                    updated[idx] = {
                                      ...reward,
                                      cosmeticData: {
                                        ...reward.cosmeticData,
                                        skinId: e.target.value
                                      }
                                    };
                                    setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                  }}
                                  placeholder="Skin ID (optional)"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                <input
                                  type="url"
                                  value={reward.cosmeticData?.textureUrl || ''}
                                  onChange={(e) => {
                                    const updated = [...(newRedeemCode.rewards || [])];
                                    updated[idx] = {
                                      ...reward,
                                      cosmeticData: {
                                        ...reward.cosmeticData,
                                        textureUrl: e.target.value
                                      }
                                    };
                                    setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                  }}
                                  placeholder="Texture URL (optional)"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                <textarea
                                  value={reward.cosmeticData?.modelData || ''}
                                  onChange={(e) => {
                                    const updated = [...(newRedeemCode.rewards || [])];
                                    updated[idx] = {
                                      ...reward,
                                      cosmeticData: {
                                        ...reward.cosmeticData,
                                        modelData: e.target.value
                                      }
                                    };
                                    setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                  }}
                                  placeholder="Custom Model Data (JSON, optional)"
                                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                                  rows={2}
                                />
                              </div>
                            )}
                            {reward.description !== undefined && (
                              <input
                                type="text"
                                value={reward.description || ''}
                                onChange={(e) => {
                                  const updated = [...(newRedeemCode.rewards || [])];
                                  updated[idx] = { ...reward, description: e.target.value };
                                  setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                                }}
                                placeholder="Description (optional)"
                                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const updated = (newRedeemCode.rewards || []).filter((_, i) => i !== idx);
                              setNewRedeemCode({ ...newRedeemCode, rewards: updated });
                            }}
                            className="p-1.5 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No rewards added yet</p>
                  )}
                  <button
                    onClick={() => {
                      const newReward: KofiRewardItem = {
                        id: Date.now().toString(),
                        type: 'item',
                        displayName: '',
                        itemId: '',
                        itemCount: 1
                      };
                      setNewRedeemCode({
                        ...newRedeemCode,
                        rewards: [...(newRedeemCode.rewards || []), newReward]
                      });
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
                  >
                    <Plus size={16} />
                    Add Reward
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max Uses</label>
                  <input
                    type="number"
                    value={newRedeemCode.maxUses || ''}
                    onChange={(e) => setNewRedeemCode({ ...newRedeemCode, maxUses: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Unlimited if empty"
                    min="1"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Code Expiration Date</label>
                  <p className="text-xs text-gray-500 mb-2">When the code can no longer be claimed. Leave empty for no expiration. <span className="text-green-400 font-medium">Rewards are permanent once claimed.</span></p>
                  <input
                    type="datetime-local"
                    value={(() => {
                      if (!newRedeemCode.expiresAt) return '';
                      const date = new Date(newRedeemCode.expiresAt);
                      // Format as YYYY-MM-DDTHH:mm for datetime-local input (local time, not UTC)
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const hours = String(date.getHours()).padStart(2, '0');
                      const minutes = String(date.getMinutes()).padStart(2, '0');
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    })()}
                    onChange={(e) => {
                      if (e.target.value) {
                        // Parse the datetime-local value as local time
                        const localDate = new Date(e.target.value);
                        setNewRedeemCode({ ...newRedeemCode, expiresAt: localDate.getTime() });
                      } else {
                        setNewRedeemCode({ ...newRedeemCode, expiresAt: undefined });
                      }
                    }}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Requires Membership</label>
                <input
                  type="text"
                  value={newRedeemCode.requiresMembership || ''}
                  onChange={(e) => setNewRedeemCode({ ...newRedeemCode, requiresMembership: e.target.value || undefined })}
                  placeholder="Tier name (leave empty if no requirement)"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newRedeemCode.enabled !== false}
                  onChange={(e) => setNewRedeemCode({ ...newRedeemCode, enabled: e.target.checked })}
                  className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                />
                <label className="text-sm text-gray-300">Code is enabled</label>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    setShowRedeemCodeModal(false);
                    setEditingRedeemCode(null);
                    setNewRedeemCode({
                      code: '',
                      description: '',
                      rewards: [],
                      maxUses: undefined,
                      expiresAt: undefined,
                      requiresMembership: undefined,
                      enabled: true
                    });
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRedeemCode}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {editingRedeemCode ? 'Update Code' : 'Create Code'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Wiki Feature Modal */}
      {showWikiModal && typeof document !== 'undefined' && createPortal(
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
          onClick={(e) => e.target === e.currentTarget && setShowWikiModal(false)}
        >
          <div 
            className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen size={20} />
                {editingWikiFeature ? 'Edit Wiki Feature' : 'Create Wiki Feature'}
              </h3>
              <button
                onClick={() => {
                  setShowWikiModal(false);
                  setEditingWikiFeature(null);
                  setNewWikiFeature({
                    title: '',
                    mcVersions: [],
                    modVersions: [],
                    categories: [],
                    subcategories: [],
                    description: '',
                    descriptionType: 'markdown',
                    media: '',
                    details: []
                  });
                  setNewDetail('');
                  setMediaPreview('');
                }}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                <input
                  type="text"
                  value={newWikiFeature.title || ''}
                  onChange={(e) => setNewWikiFeature({ ...newWikiFeature, title: e.target.value })}
                  placeholder="Feature Title"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Categories *</label>
                <div className="flex flex-wrap gap-2">
                  {['automation', 'building', 'client', 'management', 'mobs', 'tools', 'tweaks', 'world'].map((cat) => {
                    const isSelected = (newWikiFeature.categories || []).includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const current = newWikiFeature.categories || [];
                          if (isSelected) {
                            setNewWikiFeature({ ...newWikiFeature, categories: current.filter(c => c !== cat), subcategories: [] });
                            setSubcategoryPage(0);
                          } else {
                            setNewWikiFeature({ ...newWikiFeature, categories: [...current, cat] });
                            setSubcategoryPage(0);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-green-600 text-white border-2 border-green-500'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-transparent'
                        }`}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const selectedCategories = newWikiFeature.categories || [];
                if (selectedCategories.length === 0) return null;
                
                const allSubcats: Record<string, { id: string; label: string }[]> = {
                  automation: [
                    { id: 'redstone', label: 'Redstone' },
                    { id: 'vanilla', label: 'Vanilla' },
                    { id: 'technical', label: 'Technical' },
                    { id: 'addon', label: 'Addon' }
                  ],
                  building: [
                    { id: 'blocks', label: 'Blocks' },
                    { id: 'decoration', label: 'Decoration' },
                    { id: 'utility', label: 'Utility' },
                    { id: 'blueprints', label: 'Blueprints' }
                  ],
                  client: [
                    { id: 'visuals', label: 'Visuals' },
                    { id: 'performance', label: 'Performance' },
                    { id: 'resources', label: 'Resources' }
                  ],
                  management: [
                    { id: 'permissions', label: 'Permissions' },
                    { id: 'economy', label: 'Economy' },
                    { id: 'server', label: 'Server' }
                  ],
                  mobs: [
                    { id: 'hostile', label: 'Hostile' },
                    { id: 'passive', label: 'Passive' },
                    { id: 'utility', label: 'Utility' }
                  ],
                  tools: [
                    { id: 'mining', label: 'Mining' },
                    { id: 'building', label: 'Building' },
                    { id: 'utility', label: 'Utility' }
                  ],
                  tweaks: [
                    { id: 'gameplay', label: 'Gameplay' },
                    { id: 'performance', label: 'Performance' },
                    { id: 'qol', label: 'Quality of Life' }
                  ],
                  world: [
                    { id: 'biomes', label: 'Biomes' },
                    { id: 'structures', label: 'Structures' },
                    { id: 'dimensions', label: 'Dimensions' },
                    { id: 'editing', label: 'Editing' }
                  ]
                };
                
                const availableSubcats = selectedCategories.flatMap(cat => allSubcats[cat] || []);
                const uniqueSubcats = Array.from(new Map(availableSubcats.map(s => [s.id, s])).values());
                
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Subcategories (optional)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSubcategoryPage(Math.max(0, subcategoryPage - 1))}
                        disabled={subcategoryPage === 0}
                        className="px-2 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 flex-shrink-0"
                      >
                        &lt;
                      </button>
                      <div className="flex-1 overflow-hidden relative">
                        <div 
                          className="flex gap-2 transition-transform duration-300 ease-in-out"
                          style={{ 
                            transform: `translateX(-${subcategoryPage * 100}%)`,
                            width: `${Math.ceil(uniqueSubcats.length / 6) * 100}%`
                          }}
                        >
                          {(() => {
                            const itemsPerPage = 6;
                            const totalPages = Math.ceil(uniqueSubcats.length / itemsPerPage);
                            return Array.from({ length: totalPages }).map((_, pageIdx) => {
                              const start = pageIdx * itemsPerPage;
                              const end = start + itemsPerPage;
                              const pageSubcats = uniqueSubcats.slice(start, end);
                              return (
                                <div key={pageIdx} className="flex gap-2 flex-shrink-0" style={{ width: '100%', minWidth: '100%' }}>
                                  {pageSubcats.map((subcat) => {
                                    const isSelected = (newWikiFeature.subcategories || []).includes(subcat.id);
                                    return (
                                      <button
                                        key={subcat.id}
                                        type="button"
                                        onClick={() => {
                                          const current = newWikiFeature.subcategories || [];
                                          if (isSelected) {
                                            setNewWikiFeature({ ...newWikiFeature, subcategories: current.filter(s => s !== subcat.id) });
                                          } else {
                                            setNewWikiFeature({ ...newWikiFeature, subcategories: [...current, subcat.id] });
                                          }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                                          isSelected
                                            ? 'bg-blue-600 text-white border-2 border-blue-500'
                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-transparent'
                                        }`}
                                      >
                                        {subcat.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const itemsPerPage = 6;
                          const maxPage = Math.ceil(uniqueSubcats.length / itemsPerPage) - 1;
                          setSubcategoryPage(Math.min(maxPage, subcategoryPage + 1));
                        }}
                        disabled={(() => {
                          const itemsPerPage = 6;
                          const maxPage = Math.ceil(uniqueSubcats.length / itemsPerPage) - 1;
                          return subcategoryPage >= maxPage;
                        })()}
                        className="px-2 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 flex-shrink-0"
                      >
                        &gt;
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Minecraft Versions</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMcVersionPage(Math.max(0, mcVersionPage - 1))}
                        disabled={mcVersionPage === 0}
                        className="px-2 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 flex-shrink-0"
                      >
                        &lt;
                      </button>
                      <div className="flex-1 overflow-hidden relative">
                        <div 
                          className="flex gap-2 transition-transform duration-300 ease-in-out"
                          style={{ transform: `translateX(-${mcVersionPage * 100}%)` }}
                        >
                          {(() => {
                            const allVersions = config.mcVersions || ['1.20.1', '1.20', '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5'];
                            const itemsPerPage = 5;
                            const totalPages = Math.ceil(allVersions.length / itemsPerPage);
                            return Array.from({ length: totalPages }).map((_, pageIdx) => {
                              const start = pageIdx * itemsPerPage;
                              const end = start + itemsPerPage;
                              const pageVersions = allVersions.slice(start, end);
                              return (
                                <div key={pageIdx} className="flex gap-2 flex-shrink-0" style={{ width: '100%', minWidth: '100%' }}>
                                  {pageVersions.map((version) => {
                                    const isSelected = (newWikiFeature.mcVersions || []).includes(version);
                                    return (
                                      <button
                                        key={version}
                                        type="button"
                                        onClick={() => {
                                          const current = newWikiFeature.mcVersions || [];
                                          if (isSelected) {
                                            setNewWikiFeature({ ...newWikiFeature, mcVersions: current.filter(v => v !== version) });
                                          } else {
                                            setNewWikiFeature({ ...newWikiFeature, mcVersions: [...current, version] });
                                          }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                                          isSelected
                                            ? 'bg-green-600 text-white border-2 border-green-500'
                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-transparent'
                                        }`}
                                      >
                                        {version}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allVersions = config.mcVersions || ['1.20.1', '1.20', '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5'];
                          const itemsPerPage = 5;
                          const maxPage = Math.ceil(allVersions.length / itemsPerPage) - 1;
                          setMcVersionPage(Math.min(maxPage, mcVersionPage + 1));
                        }}
                        disabled={(() => {
                          const allVersions = config.mcVersions || ['1.20.1', '1.20', '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5'];
                          const itemsPerPage = 5;
                          const maxPage = Math.ceil(allVersions.length / itemsPerPage) - 1;
                          return mcVersionPage >= maxPage;
                        })()}
                        className="px-2 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 flex-shrink-0"
                      >
                        &gt;
                      </button>
                    </div>
                  </div>
                  
                  {config.modVersions && config.modVersions.length > 0 && (
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Mod Versions (optional)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setModVersionPage(Math.max(0, modVersionPage - 1))}
                          disabled={modVersionPage === 0}
                          className="px-2 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 flex-shrink-0"
                        >
                          &lt;
                        </button>
                        <div className="flex-1 overflow-hidden relative">
                          <div 
                            className="flex gap-2 transition-transform duration-300 ease-in-out"
                            style={{ transform: `translateX(-${modVersionPage * 100}%)` }}
                          >
                            {(() => {
                              const itemsPerPage = 5;
                              const totalPages = Math.ceil(config.modVersions.length / itemsPerPage);
                              return Array.from({ length: totalPages }).map((_, pageIdx) => {
                                const start = pageIdx * itemsPerPage;
                                const end = start + itemsPerPage;
                                const pageVersions = config.modVersions.slice(start, end);
                                return (
                                  <div key={pageIdx} className="flex gap-2 flex-shrink-0" style={{ width: '100%', minWidth: '100%' }}>
                                    {pageVersions.map((version) => {
                                      const isSelected = (newWikiFeature.modVersions || []).includes(version);
                                      return (
                                        <button
                                          key={version}
                                          type="button"
                                          onClick={() => {
                                            const current = newWikiFeature.modVersions || [];
                                            if (isSelected) {
                                              setNewWikiFeature({ ...newWikiFeature, modVersions: current.filter(v => v !== version) });
                                            } else {
                                              setNewWikiFeature({ ...newWikiFeature, modVersions: [...current, version] });
                                            }
                                          }}
                                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                                            isSelected
                                              ? 'bg-blue-600 text-white border-2 border-blue-500'
                                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-transparent'
                                          }`}
                                        >
                                          {version}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const itemsPerPage = 5;
                            const maxPage = Math.ceil(config.modVersions.length / itemsPerPage) - 1;
                            setModVersionPage(Math.min(maxPage, modVersionPage + 1));
                          }}
                          disabled={(() => {
                            const itemsPerPage = 5;
                            const maxPage = Math.ceil(config.modVersions.length / itemsPerPage) - 1;
                            return modVersionPage >= maxPage;
                          })()}
                          className="px-2 py-1 bg-gray-800 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 flex-shrink-0"
                        >
                          &gt;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description Format</label>
                <select
                  value={newWikiFeature.descriptionType || 'markdown'}
                  onChange={(e) => setNewWikiFeature({ ...newWikiFeature, descriptionType: e.target.value as 'html' | 'markdown' })}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300">Description *</label>
                  <div className="flex gap-2">
                    {aiReviewBackup && (
                      <button
                        type="button"
                        onClick={() => {
                          if (aiReviewBackup) {
                            setNewWikiFeature({
                              ...newWikiFeature,
                              title: aiReviewBackup.title || newWikiFeature.title,
                              description: aiReviewBackup.description || newWikiFeature.description,
                              details: aiReviewBackup.details || newWikiFeature.details
                            });
                            setAiReviewBackup(null);
                            setToast({ msg: 'AI review changes undone', type: 'success' });
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-orange-400 hover:text-white bg-orange-900/20 hover:bg-orange-900/40 rounded transition-colors"
                        title="Undo AI Review"
                      >
                        <RotateCcw size={14} />
                        Undo AI
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newWikiFeature.title || !newWikiFeature.description) {
                          setToast({ msg: 'Title and description are required for AI review', type: 'error' });
                          return;
                        }
                        // Save backup before AI review
                        setAiReviewBackup({
                          title: newWikiFeature.title,
                          description: newWikiFeature.description,
                          details: newWikiFeature.details ? [...newWikiFeature.details] : []
                        });
                        setAiReviewing(true);
                        try {
                          // Call AI API to enhance description
                          const response = await fetch('/api/ai/enhance-wiki', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: newWikiFeature.title,
                              description: newWikiFeature.description,
                              descriptionType: newWikiFeature.descriptionType || 'markdown',
                              categories: newWikiFeature.categories || [],
                              subcategories: newWikiFeature.subcategories || [],
                              mcVersions: newWikiFeature.mcVersions || [],
                              modVersions: newWikiFeature.modVersions || [],
                              details: newWikiFeature.details || []
                            })
                          });
                          if (response.ok) {
                            const data = await response.json();
                            setNewWikiFeature({
                              ...newWikiFeature,
                              title: data.enhancedTitle || newWikiFeature.title,
                              description: data.enhancedDescription || newWikiFeature.description,
                              descriptionType: data.suggestedType || newWikiFeature.descriptionType || 'markdown',
                              details: data.enhancedDetails || newWikiFeature.details
                            });
                            setToast({ msg: 'Content enhanced with AI! Use Undo to revert.', type: 'success' });
                          } else {
                            setToast({ msg: 'AI enhancement failed. Using local enhancement.', type: 'error' });
                            // Fallback: simple local enhancement
                            const enhanced = enhanceDescriptionLocally(newWikiFeature.description || '', newWikiFeature.descriptionType || 'markdown');
                            const enhancedTitle = newWikiFeature.title?.charAt(0).toUpperCase() + newWikiFeature.title?.slice(1) || newWikiFeature.title;
                            setNewWikiFeature({ 
                              ...newWikiFeature, 
                              title: enhancedTitle,
                              description: enhanced, 
                              descriptionType: 'markdown',
                              details: newWikiFeature.details && newWikiFeature.details.length > 0 
                                ? newWikiFeature.details 
                                : [newWikiFeature.description?.split('.')[0] || ''].filter(Boolean)
                            });
                          }
                        } catch (error) {
                          console.error('AI review error:', error);
                          // Fallback: simple local enhancement
                          const enhanced = enhanceDescriptionLocally(newWikiFeature.description || '', newWikiFeature.descriptionType || 'markdown');
                          const enhancedTitle = newWikiFeature.title?.charAt(0).toUpperCase() + newWikiFeature.title?.slice(1) || newWikiFeature.title;
                          setNewWikiFeature({ 
                            ...newWikiFeature, 
                            title: enhancedTitle,
                            description: enhanced, 
                            descriptionType: 'markdown',
                            details: newWikiFeature.details && newWikiFeature.details.length > 0 
                              ? newWikiFeature.details 
                              : [newWikiFeature.description?.split('.')[0] || ''].filter(Boolean)
                          });
                          setToast({ msg: 'Applied local formatting improvements', type: 'success' });
                        } finally {
                          setAiReviewing(false);
                        }
                      }}
                      disabled={aiReviewing}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-white bg-blue-900/20 hover:bg-blue-900/40 rounded transition-colors disabled:opacity-50"
                      title="AI Review: Enhance title, description, and add detail points"
                    >
                      {aiReviewing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          Reviewing...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          AI Review
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDescriptionPreview(!showDescriptionPreview)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      <Eye size={14} />
                      {showDescriptionPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                  </div>
                </div>
                {newWikiFeature.descriptionType === 'html' && (
                  <div className="mb-2 flex items-center gap-1 p-2 bg-gray-800/50 rounded-t-lg border-b border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const newText = text.substring(0, start) + `<strong>${selectedText}</strong>` + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + 8, start + 8 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bold"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const newText = text.substring(0, start) + `<em>${selectedText}</em>` + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + 3, start + 3 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Italic"
                    >
                      <Italic size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `<h1>${selectedText}</h1>` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 4, start + prefix.length + 4 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 1"
                    >
                      <Heading1 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `<h2>${selectedText}</h2>` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 4, start + prefix.length + 4 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 2"
                    >
                      <Heading2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `<h3>${selectedText}</h3>` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 4, start + prefix.length + 4 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 3"
                    >
                      <Heading3 size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `<ul>\n<li>${selectedText}</li>\n</ul>` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 7, start + prefix.length + 7 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bullet List"
                    >
                      <List size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const url = prompt('Enter URL:');
                        const text = prompt('Enter link text:', url || '');
                        if (url && text) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const textareaValue = textarea.value;
                          const newText = textareaValue.substring(0, start) + `<a href="${url}">${text}</a>` + textareaValue.substring(end);
                          setNewWikiFeature({ ...newWikiFeature, description: newText });
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + url.length + text.length + 15, start + url.length + text.length + 15);
                          }, 0);
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Link"
                    >
                      <LinkIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const url = prompt('Enter image URL:');
                        const alt = prompt('Enter alt text:', '');
                        if (url) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const textareaValue = textarea.value;
                          const prefix = start > 0 && textareaValue[start - 1] !== '\n' ? '\n' : '';
                          const suffix = end < textareaValue.length && textareaValue[end] !== '\n' ? '\n' : '';
                          const newText = textareaValue.substring(0, start) + prefix + `<img src="${url}" alt="${alt || ''}" />` + suffix + textareaValue.substring(end);
                          setNewWikiFeature({ ...newWikiFeature, description: newText });
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + prefix.length + url.length + alt.length + 20, start + prefix.length + url.length + alt.length + 20);
                          }, 0);
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Image"
                    >
                      <ImageIcon size={16} />
                    </button>
                  </div>
                )}
                {newWikiFeature.descriptionType === 'markdown' && (
                  <div className="mb-2 flex items-center gap-1 p-2 bg-gray-800/50 rounded-t-lg border-b border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + 2, start + 2 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bold"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + 1, start + 1 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Italic"
                    >
                      <Italic size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `# ${selectedText}` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 2, start + prefix.length + 2 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 1"
                    >
                      <Heading1 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `## ${selectedText}` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 3, start + prefix.length + 3 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 2"
                    >
                      <Heading2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `### ${selectedText}` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 4, start + prefix.length + 4 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Heading 3"
                    >
                      <Heading3 size={16} />
                    </button>
                    <div className="w-px h-6 bg-gray-700 mx-1" />
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const text = textarea.value;
                        const selectedText = text.substring(start, end);
                        const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
                        const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
                        const newText = text.substring(0, start) + prefix + `- ${selectedText}` + suffix + text.substring(end);
                        setNewWikiFeature({ ...newWikiFeature, description: newText });
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + prefix.length + 2, start + prefix.length + 2 + selectedText.length);
                        }, 0);
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Bullet List"
                    >
                      <List size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const url = prompt('Enter URL:');
                        const text = prompt('Enter link text:', url || '');
                        if (url && text) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const textareaValue = textarea.value;
                          const newText = textareaValue.substring(0, start) + `[${text}](${url})` + textareaValue.substring(end);
                          setNewWikiFeature({ ...newWikiFeature, description: newText });
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + text.length + url.length + 4, start + text.length + url.length + 4);
                          }, 0);
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Link"
                    >
                      <LinkIcon size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = wikiDescriptionTextareaRef.current;
                        if (!textarea) return;
                        const url = prompt('Enter image URL:');
                        const alt = prompt('Enter alt text:', '');
                        if (url) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const textareaValue = textarea.value;
                          const prefix = start > 0 && textareaValue[start - 1] !== '\n' ? '\n' : '';
                          const suffix = end < textareaValue.length && textareaValue[end] !== '\n' ? '\n' : '';
                          const newText = textareaValue.substring(0, start) + prefix + `![${alt || ''}](${url})` + suffix + textareaValue.substring(end);
                          setNewWikiFeature({ ...newWikiFeature, description: newText });
                          setTimeout(() => {
                            textarea.focus();
                            textarea.setSelectionRange(start + prefix.length + alt.length + url.length + 5, start + prefix.length + alt.length + url.length + 5);
                          }, 0);
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Image"
                    >
                      <ImageIcon size={16} />
                    </button>
                  </div>
                )}
                {showDescriptionPreview ? (
                  <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 min-h-[100px]">
                    {newWikiFeature.descriptionType === 'html' ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHTMLPermissive(newWikiFeature.description || '') }} className="prose prose-invert max-w-none" />
                    ) : (
                      <div className="prose prose-invert max-w-none">
                        {(() => {
                          // Simple markdown rendering for preview
                          const lines = (newWikiFeature.description || '').split('\n');
                          return lines.map((line, idx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return <br key={idx} />;
                            if (trimmed.startsWith('# ')) {
                              return <h1 key={idx} className="text-2xl font-bold text-white mt-4 mb-2">{trimmed.substring(2)}</h1>;
                            } else if (trimmed.startsWith('## ')) {
                              return <h2 key={idx} className="text-xl font-bold text-white mt-3 mb-2">{trimmed.substring(3)}</h2>;
                            } else if (trimmed.startsWith('### ')) {
                              return <h3 key={idx} className="text-lg font-bold text-gray-300 mt-2 mb-1">{trimmed.substring(4)}</h3>;
                            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                              return (
                                <div key={idx} className="flex items-start gap-2 text-gray-300 my-1">
                                  <span className="text-green-500 flex-shrink-0" style={{ marginTop: '0.125rem' }}>•</span>
                                  <span className="flex-1">{trimmed.substring(2)}</span>
                                </div>
                              );
                            } else {
                              return <p key={idx} className="text-gray-300 my-2">{trimmed}</p>;
                            }
                          });
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    ref={wikiDescriptionTextareaRef}
                    value={newWikiFeature.description || ''}
                    onChange={(e) => setNewWikiFeature({ ...newWikiFeature, description: e.target.value })}
                    placeholder="Feature description"
                    rows={6}
                    className={`w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm ${newWikiFeature.descriptionType === 'html' || newWikiFeature.descriptionType === 'markdown' ? 'rounded-t-none' : ''}`}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Media (optional) - Upload Image or Video</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      ref={mediaFileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,video/ogg,video/quicktime"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleMediaUpload(file);
                        }
                      }}
                      disabled={uploadingMedia}
                      className="hidden"
                      id="media-upload-input"
                    />
                    <label
                      htmlFor="media-upload-input"
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white cursor-pointer hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        uploadingMedia ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingMedia ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Uploading... {uploadProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          <span>Choose File to Upload</span>
                        </>
                      )}
                    </label>
                    {newWikiFeature.media && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewWikiFeature({ ...newWikiFeature, media: '' });
                          setMediaPreview('');
                          if (mediaFileInputRef.current) {
                            mediaFileInputRef.current.value = '';
                          }
                        }}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        title="Remove Media"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                  {newWikiFeature.media && (
                    <div className="text-xs text-gray-400">
                      Media URL: <span className="text-blue-400 break-all">{newWikiFeature.media}</span>
                    </div>
                  )}
                  <input
                    type="text"
                    value={newWikiFeature.media || ''}
                    onChange={(e) => {
                      const url = e.target.value || '';
                      setNewWikiFeature({ ...newWikiFeature, media: url || undefined });
                      setMediaPreview(url);
                    }}
                    placeholder="Or paste image/video URL (YouTube, Vimeo, Google Drive, etc.)"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  {mediaPreview ? (
                    <div className="mt-2">
                      {(() => {
                        // Google Drive link handling
                        if (mediaPreview.includes('drive.google.com')) {
                          // Convert Google Drive sharing link to embeddable format
                          const fileIdMatch = mediaPreview.match(/\/d\/([a-zA-Z0-9_-]+)/);
                          if (fileIdMatch) {
                            const fileId = fileIdMatch[1];
                            // For images, use direct preview
                            const previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                            return (
                              <div>
                                <img 
                                  src={previewUrl} 
                                  alt="Google Drive Preview" 
                                  className="max-w-full h-48 object-contain rounded-lg border border-gray-600" 
                                  onError={() => {
                                    // If preview fails, show download link
                                    return;
                                  }}
                                />
                                <p className="text-xs text-gray-400 mt-1">Google Drive file preview (make sure file is set to "Anyone with the link can view")</p>
                              </div>
                            );
                          }
                          return (
                            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-center">
                              <p className="text-gray-400 text-sm">Google Drive link detected. Make sure the file is set to "Anyone with the link can view".</p>
                              <a href={mediaPreview} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
                                Open in Google Drive
                              </a>
                            </div>
                          );
                        }
                        
                        // Image detection
                        if (mediaPreview.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || mediaPreview.includes('image') || mediaPreview.includes('imgur.com') || mediaPreview.includes('i.imgur.com')) {
                          return (
                            <img 
                              src={mediaPreview} 
                              alt="Preview" 
                              className="max-w-full h-48 object-contain rounded-lg border border-gray-600" 
                              onError={() => {
                                setToast({ msg: 'Failed to load image preview. URL may be invalid or require authentication.', type: 'error' });
                              }} 
                            />
                          );
                        }
                        
                        // YouTube detection
                        if (mediaPreview.includes('youtube.com') || mediaPreview.includes('youtu.be')) {
                          let embedUrl = '';
                          if (mediaPreview.includes('youtube.com/watch')) {
                            embedUrl = mediaPreview.replace('watch?v=', 'embed/').split('&')[0];
                          } else if (mediaPreview.includes('youtu.be/')) {
                            const videoId = mediaPreview.split('youtu.be/')[1].split('?')[0];
                            embedUrl = `https://www.youtube.com/embed/${videoId}`;
                          }
                          return (
                            <iframe
                              width="100%"
                              height="270"
                              src={embedUrl}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="rounded-lg border border-gray-600"
                            />
                          );
                        }
                        
                        // Vimeo detection
                        if (mediaPreview.includes('vimeo.com')) {
                          const videoId = mediaPreview.split('vimeo.com/')[1]?.split('?')[0] || mediaPreview.split('vimeo.com/')[1];
                          return (
                            <iframe
                              width="100%"
                              height="270"
                              src={`https://player.vimeo.com/video/${videoId}`}
                              frameBorder="0"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              className="rounded-lg border border-gray-600"
                            />
                          );
                        }
                        
                        // Video file detection
                        if (mediaPreview.match(/\.(mp4|webm|ogg|mov)$/i) || mediaPreview.includes('video')) {
                          return (
                            <video 
                              src={mediaPreview} 
                              controls 
                              className="max-w-full h-48 object-contain rounded-lg border border-gray-600"
                              onError={() => {
                                setToast({ msg: 'Failed to load video preview. URL may be invalid or require authentication.', type: 'error' });
                              }}
                            />
                          );
                        }
                        
                        // Unknown format - show link
                        return (
                          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-center">
                            <p className="text-gray-400 text-sm mb-2">Preview not available for this URL format.</p>
                            <a href={mediaPreview} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                              Open URL
                            </a>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                  <p className="text-xs text-gray-500">
                    Upload images (JPEG, PNG, GIF, WebP, SVG) or videos (MP4, WebM, OGG) up to 32MB, or paste a URL (YouTube, Vimeo, Google Drive, etc.)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Details</label>
                <div className="space-y-2 mb-2">
                  {newWikiFeature.details && newWikiFeature.details.length > 0 ? (
                    newWikiFeature.details.map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                        <span className="flex-1 text-gray-300 text-sm">{detail}</span>
                        <button
                          onClick={() => {
                            const updated = (newWikiFeature.details || []).filter((_, i) => i !== idx);
                            setNewWikiFeature({ ...newWikiFeature, details: updated });
                          }}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No details added yet</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDetail}
                    onChange={(e) => setNewDetail(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newDetail.trim()) {
                        setNewWikiFeature({
                          ...newWikiFeature,
                          details: [...(newWikiFeature.details || []), newDetail.trim()]
                        });
                        setNewDetail('');
                      }
                    }}
                    placeholder="Add detail point (press Enter)"
                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={() => {
                      if (newDetail.trim()) {
                        setNewWikiFeature({
                          ...newWikiFeature,
                          details: [...(newWikiFeature.details || []), newDetail.trim()]
                        });
                        setNewDetail('');
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    setShowWikiModal(false);
                    setEditingWikiFeature(null);
                    setNewWikiFeature({
                      title: '',
                      mcVersions: [],
                      modVersions: [],
                      categories: [],
                      subcategories: [],
                      description: '',
                      descriptionType: 'markdown',
                      media: '',
                      details: []
                    });
                    setNewDetail('');
                    setMediaPreview('');
                    setShowDescriptionPreview(false);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveWikiFeature}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  {editingWikiFeature ? 'Update Feature' : 'Create Feature'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}