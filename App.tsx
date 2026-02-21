import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import BugList from "./components/BugList";
import BugForm from "./components/BugForm";
import Footer from "./components/Footer";
import AdminPanel from "./components/AdminPanel";
import Login from "./components/Login";
import Register from "./components/Register";
import ForgotPassword from "./components/ForgotPassword";
import SuggestionsForm from "./components/SuggestionsForm";
import SuggestionsList from "./components/SuggestionsList";
import Profile from "./components/Profile";
import Changelog from "./components/Changelog";
import Wiki from "./components/Wiki";
import Redeem from "./components/Redeem";
import { BugReport, User, AppConfig, Suggestion, ChangelogEntry } from "./types";
import { AuthService, AuthError } from "./services/auth";
import { StorageService, StorageError } from "./services/storage";
import { CurseForgeService, CurseForgeError } from "./services/curseforge";
import { supabase } from "./lib/supabase";
import { AlertCircle, CheckCircle, Cloud, Database, WifiOff, Lightbulb } from "lucide-react";

const sortVersions = (versions: string[]) => {
  return [...versions].sort((a, b) => {
    const cleanA = a.replace(/^v/, '').replace(/-.*/, ''); 
    const cleanB = b.replace(/^v/, '').replace(/-.*/, '');
    const partsA = cleanA.split('.').map(Number);
    const partsB = cleanB.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const valA = partsA[i] || 0;
        const valB = partsB[i] || 0;
        if (valA > valB) return -1;
        if (valA < valB) return 1;
    }
    return 0;
  });
};

const INITIAL_CONFIG: AppConfig = {
    mcVersions: sortVersions(["1.21.1", "1.18.2", "1.20.1", "1.19.2"]),
    modVersions: sortVersions(["2.0.1", "1.0.0", "1.4.2", "1.4.1"]),
    links: {
        curseforge: "https://www.curseforge.com/minecraft/mc-mods/buildscape",
        modrinth: "#",
        discord: "#",
        source: "#",
        kofi: "#" // Add your Ko-fi URL here (e.g., https://ko-fi.com/yourusername)
    },
    hero: {
        headline: "Buildscape",
        subheadline: "The Ultimate Get-away to Builder's Paradise",
        description: "The Builder's First Best Friend. Adds over 600 new blocks including Tiles, Mosaic Glass, functional Pillars, and custom foliage. Fully obtainable in Survival mode.",
        latestModVersion: "v2.0.1",
        latestMcVersions: "1.21.1 / 1.18.2"
    },
    database: { type: 'local', endpoint: '', apiKey: '' },
    socialHandles: {
        author: 'DGA',
        leadDev: 'kingodogo',
        authorLinks: {},
        leadDevLinks: {}
    }
};

const INITIAL_BUGS: BugReport[] = [
    {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Pillar Config only works when updated Client Side',
        description: 'Server config changes for Pillars are not syncing correctly to clients. Players must edit local config to see changes.',
        stepsToReproduce: '1. Change pillar settings on dedicated server.\n2. Join with client.\n3. Observe old behavior.',
        versions: ['1.4.2'],
        mcVersions: ['1.20.1'],
        severity: 'High',
        author: 'DGA',
        timestamp: new Date('2025-12-06').getTime(),
        status: 'In Progress',
        comments: [],
        tags: ['config', 'multiplayer'],
        links: []
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Fix Rose vines Spreading',
        description: 'Rose vines are spreading unexpectedly or too aggressively across blocks they should not attach to.',
        stepsToReproduce: '1. Plant rose vines on a wall.\n2. Increase tick speed.\n3. Observe spread pattern.',
        versions: ['1.4.2'],
        mcVersions: ['1.20.1'],
        severity: 'Medium',
        author: 'DGA',
        timestamp: new Date('2025-12-07').getTime(),
        status: 'Resolved',
        comments: [],
        tags: ['foliage', 'growth'],
        links: []
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440003',
        title: 'Fix the Falling Spore Particles',
        description: 'Adjusted particle spawn rate to 35% to reduce lag and visual clutter.',
        stepsToReproduce: '1. Observe falling spore particles.\n2. Notice performance impact.\n3. Check particle spawn rate.',
        versions: ['1.4.2'],
        mcVersions: ['1.20.1'],
        severity: 'Low',
        author: 'kingodogo',
        timestamp: new Date('2025-12-06').getTime(),
        status: 'Resolved',
        comments: [],
        tags: ['particles', 'performance'],
        links: []
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440004',
        title: 'Pillar Color Overlay fix',
        description: 'Make it so the Pillar Color Overlay only appears when u hold the Dye.',
        stepsToReproduce: '1. Hold a dye item.\n2. Look at a pillar.\n3. Observe color overlay behavior.',
        versions: ['1.4.1'],
        mcVersions: ['1.20.1'],
        severity: 'Low',
        author: 'kingodogo',
        timestamp: new Date('2025-12-05').getTime(),
        status: 'Resolved',
        comments: [],
        tags: ['pillars', 'ui'],
        links: []
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440005',
        title: 'Icicle Item model fix',
        description: 'Fixed the item model display for Icicles in third person view.',
        stepsToReproduce: '1. Hold an icicle item.\n2. Switch to third person view.\n3. Observe item model display.',
        versions: ['1.4.1'],
        mcVersions: ['1.20.1'],
        severity: 'Low',
        author: 'kingodogo',
        timestamp: new Date('2025-12-04').getTime(),
        status: 'Resolved',
        comments: [],
        tags: ['models', 'items'],
        links: []
    },
    {
        id: '550e8400-e29b-41d4-a716-446655440006',
        title: 'Icicle Grow feature',
        description: 'Implemented growth logic for Icicles dripping water.',
        stepsToReproduce: '1. Place water source above icicle.\n2. Wait for water to drip.\n3. Observe icicle growth.',
        versions: ['1.4.1'],
        mcVersions: ['1.20.1'],
        severity: 'Low',
        author: 'kingodogo',
        timestamp: new Date('2025-12-04').getTime(),
        status: 'Resolved',
        comments: [],
        tags: ['features', 'icicles'],
        links: []
    }
];

// Map URL paths to view names
type ViewType = 'home' | 'report' | 'admin' | 'login' | 'register' | 'forgot-password' | 'suggestions' | 'suggestion-form' | 'profile' | 'changelog' | 'wiki' | 'redeem';

const pathToView: Record<string, ViewType> = {
  '/': 'home',
  '/home': 'home',
  '/report': 'report',
  '/admin': 'admin',
  '/login': 'login',
  '/register': 'register',
  '/forgot-password': 'forgot-password',
  '/suggestions': 'suggestions',
  '/suggestion-form': 'suggestion-form',
  '/profile': 'profile',
  '/changelog': 'changelog',
  '/wiki': 'wiki',
  '/redeem': 'redeem',
};

const viewToPath: Record<ViewType, string> = {
  'home': '/',
  'report': '/report',
  'admin': '/admin',
  'login': '/login',
  'register': '/register',
  'forgot-password': '/forgot-password',
  'suggestions': '/suggestions',
  'suggestion-form': '/suggestion-form',
  'profile': '/profile',
  'changelog': '/changelog',
  'wiki': '/wiki',
  'redeem': '/redeem',
};

const getInitialView = (): ViewType => {
  const path = window.location.pathname.toLowerCase();
  return pathToView[path] || 'home';
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>(getInitialView);
  
  // Type-safe navigation wrapper that also updates the URL
  const handleNavigate = (view: string) => {
    const validViews: Array<ViewType> = 
      ['home', 'report', 'admin', 'login', 'register', 'forgot-password', 'suggestions', 'suggestion-form', 'profile', 'changelog', 'wiki', 'redeem'];
    if (validViews.includes(view as any)) {
      const newView = view as ViewType;
      setCurrentView(newView);
      // Update URL without reload
      const newPath = viewToPath[newView];
      if (window.location.pathname !== newPath) {
        window.history.pushState({view: newView}, '', newPath);
      }
    }
  };
  
  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const path = window.location.pathname.toLowerCase();
      const view = pathToView[path] || 'home';
      setCurrentView(view);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [reports, setReports] = useState<BugReport[]>(INITIAL_BUGS); // Initialize with default data
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [changelogToEdit, setChangelogToEdit] = useState<ChangelogEntry | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dataSource, setDataSource] = useState<'cloud' | 'error'>('error'); // Start as error so it shows fallback
  const [isLoading, setIsLoading] = useState(false); // Start as false to show content immediately
  const [dbError, setDbError] = useState<string | null>(null);

  const handleNotify = (msg: string, type: 'success' | 'error' = 'success') => {
      setToast({ msg, type });
  };

  useEffect(() => {
    // Check for unlisted changelog URL parameter or Microsoft OAuth code
    const params = new URLSearchParams(window.location.search);
    const changelogId = params.get('changelog');
    const oauthCode = params.get('code');
    
    if (changelogId) {
      setCurrentView('changelog');
    } else if (oauthCode) {
      setCurrentView('profile');
      // If we are at root, make sure the user knows we are processing
      if (window.location.pathname === '/' || window.location.pathname === '/home') {
        handleNotify("Processing Microsoft Login...", "success");
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
        setIsLoading(true);
        setDbError(null);
        
        // Shorter timeout for faster failure detection
        const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
        const timeoutDuration = isProduction ? 5000 : 8000; // 5s production, 8s dev
        
        let requestCompleted = false;
        let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
            // Only set error if request hasn't completed yet
            if (!requestCompleted) {
                setIsLoading(false);
                setReports(INITIAL_BUGS);
                setSuggestions([]);
                setDataSource('error');
                setDbError("API server down. Contact admin.");
            }
        }, timeoutDuration);
        
        try {
            const data = await StorageService.loadAll();
            requestCompleted = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            
            // Clear any error messages on successful load
            setDbError(null);
            
            setReports(data.reports || []);
            
            setSuggestions(data.suggestions || []);
            
            if (data.reports.length === 0) {
                setReports(INITIAL_BUGS);
                // Do not attempt to auto-save initial bugs to server as it requires admin/owner permissions
                // The database should be seeded manually or via admin panel if needed
            }
            
            if (data.config) {
                 setConfig(prev => {
                    const updatedConfig = {
                        ...prev,
                        ...data.config,
                        mcVersions: sortVersions(data.config?.mcVersions || prev.mcVersions),
                        modVersions: sortVersions(data.config?.modVersions || prev.modVersions),
                        links: { ...prev.links, ...data.config?.links },
                        hero: { ...prev.hero, ...data.config?.hero },
                        database: { ...prev.database, ...data.config?.database }
                    };
                    
                    if (updatedConfig.autoSyncCurseForge) {
                        CurseForgeService.syncVersionsFromCurseForge(updatedConfig)
                            .then(syncedData => {
                                setConfig(prevConfig => ({
                                    ...prevConfig,
                                    mcVersions: syncedData.mcVersions,
                                    modVersions: syncedData.modVersions,
                                    hero: {
                                        ...prevConfig.hero,
                                        latestModVersion: syncedData.latestModVersion,
                                        latestMcVersions: syncedData.latestMcVersions
                                    }
                                }));
                            })
                            .catch(error => {
                                console.warn('Failed to auto-sync from CurseForge:', error);
                            });
                    }
                    
                    return updatedConfig;
                });
            }

            setDataSource('cloud');
            
            // Perform a live session refresh to check if the user still exists in Supabase
            const user = await AuthService.refreshSession();
            if (user) setCurrentUser(user);
        } catch (e: any) {
            requestCompleted = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            
            console.error("Failed to load data:", e);
            setDataSource('error');
            
            setReports(INITIAL_BUGS);
            setSuggestions([]);
            
            // Always show user-friendly message in production, detailed in development
            const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
            
            if (isProduction) {
                setDbError("API server down. Contact admin.");
            } else {
                // Development: show detailed error
                if (e instanceof StorageError) {
                    if (e.code === 'NOT_CONFIGURED') {
                        setDbError("Database services unavailable. Please check server configuration.");
                    } else if (e.code === 'NETWORK_ERROR') {
                        setDbError("Running in local mode. API routes require Netlify dev server. Use 'netlify dev' to test API locally.");
                    } else {
                        setDbError(e.message);
                    }
                } else {
                    setDbError("Failed to load data from server. Running in local mode with fallback data.");
                }
            }
            
            // Only show notification in development
            if (!isProduction && !(e instanceof StorageError && e.code === 'NETWORK_ERROR')) {
                handleNotify(
                    "Failed to connect to database. Changes will not be saved. Please check your setup.",
                    'error'
                );
            }
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            setIsLoading(false);
        }
    };
    init();
  }, []);

  // Listen for navigation events (e.g., from Login component)
  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      const view = event.detail;
      if (view === 'forgot-password') {
        handleNavigate('forgot-password');
      }
    };

    window.addEventListener('navigate', handleNavigationEvent as EventListener);
    return () => {
      window.removeEventListener('navigate', handleNavigationEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!config.curseforgeSyncInterval || config.curseforgeSyncInterval === 0) {
      return; // No periodic sync configured
    }

    const syncInterval = config.curseforgeSyncInterval * 60 * 60 * 1000; // Convert hours to milliseconds
    
    const performSync = async () => {
      try {
        const currentConfig = config;
        if (!currentConfig.curseforgeProjectSlug && !currentConfig.links?.curseforge) {
          return; // No project configured
        }
        
        const syncedData = await CurseForgeService.syncVersionsFromCurseForge(currentConfig);
        setConfig(prevConfig => ({
          ...prevConfig,
          mcVersions: syncedData.mcVersions,
          modVersions: syncedData.modVersions,
          hero: {
            ...prevConfig.hero,
            latestModVersion: syncedData.latestModVersion,
            latestMcVersions: syncedData.latestMcVersions
          }
        }));
        
        const allData = await StorageService.loadAll();
        await StorageService.saveAll(allData.reports, allData.suggestions, {
          ...currentConfig,
          mcVersions: syncedData.mcVersions,
          modVersions: syncedData.modVersions,
          hero: {
            ...currentConfig.hero,
            latestModVersion: syncedData.latestModVersion,
            latestMcVersions: syncedData.latestMcVersions
          }
        });
      } catch (error) {
      }
    };
    
    const initialTimeout = setTimeout(performSync, 5000);
    
    const intervalId = setInterval(performSync, syncInterval);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [config.curseforgeSyncInterval, config.curseforgeProjectSlug, config.links?.curseforge]);



  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Supabase auth state listener
  const lastNotifiedUserId = React.useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          try {
            const user = AuthService.getCurrentUser() || await AuthService.getCurrentUser();
            if (user) {
              const prevUserId = lastNotifiedUserId.current;
              setCurrentUser(user);
              
              // Only notify if we haven't welcomed this specific user ID in this browser session
              if (user.id !== prevUserId) {
                handleNotify(`Welcome back, ${user.username}`);
                lastNotifiedUserId.current = user.id;
              }
            }
          } catch (error) {
            console.error('Failed to get user profile after sign in:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          lastNotifiedUserId.current = null;
          handleNotify("Logged out");
        } else if (event === 'USER_UPDATED' && session) {
          try {
            const user = await AuthService.getCurrentUser();
            if (user) {
              setCurrentUser(user);
            }
          } catch (error) {
            console.error('Failed to get user profile after update:', error);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const addReport = async (report: BugReport) => {
    try {
      await StorageService.saveReport(report);
      setReports(prev => [report, ...prev]);
      handleNavigate('home');
      handleNotify("Bug Report Submitted Successfully!");
    } catch (e: any) {
      console.error("Failed to save report:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to submit report: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to submit report. Please try again.", 'error');
      }
    }
  };

  const updateReport = async (updatedReport: BugReport) => {
    try {
      await StorageService.saveReport(updatedReport);
      setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
      handleNotify("Report updated");
    } catch (e: any) {
      console.error("Failed to update report:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to update report: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to update report. Please try again.", 'error');
      }
    }
  };

  const deleteReport = async (id: string) => {
    try {
      await StorageService.deleteReport(id);
      setReports(prev => prev.filter(r => r.id !== id));
      handleNotify("Report deleted");
    } catch (e: any) {
      console.error("Failed to delete report:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to delete report: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to delete report. Please try again.", 'error');
      }
    }
  };

  const handleUpdateConfig = (newConfig: AppConfig) => {
      setConfig({
          ...newConfig,
          mcVersions: sortVersions(newConfig.mcVersions),
          modVersions: sortVersions(newConfig.modVersions)
      });
      handleNotify("Configuration updated");
  };

  const handleRestoreData = (restoredReports: BugReport[], restoredSuggestions: Suggestion[], restoredConfig: AppConfig) => {
      setReports(restoredReports);
      setSuggestions(restoredSuggestions);
      setConfig(restoredConfig);
      StorageService.saveAll(restoredReports, restoredSuggestions, restoredConfig);
      handleNotify("System restored and synced!");
  };

  const toggleStatus = (id: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'owner')) return; 
    setReports(prev => prev.map(bug => {
      if (bug.id === id) {
        let newStatus: BugReport['status'];
        if (bug.status === 'Open') newStatus = 'In Progress';
        else if (bug.status === 'In Progress') newStatus = 'Resolved';
        else newStatus = 'Open';

        const updatedBug = { ...bug, status: newStatus };
        // Set resolvedBy when marking as Resolved, clear it when reopening
        if (newStatus === 'Resolved') {
          updatedBug.resolvedBy = currentUser.username;
        } else if (newStatus === 'Open') {
          updatedBug.resolvedBy = undefined;
        }

        handleNotify(`Bug Marked as ${newStatus}`);
        return updatedBug;
      }
      return bug;
    }));
  };

  const handleAddComment = (bugId: string, text: string, images: string[] = []) => {
    if (!currentUser) return;
    setReports(prev => prev.map(bug => {
      if (bug.id === bugId) {
        const newComment = {
          id: crypto.randomUUID(),
          author: currentUser.username,
          role: currentUser.role,
          text,
          images,
          timestamp: Date.now()
        };
        return { ...bug, comments: [...(bug.comments || []), newComment] };
      }
      return bug;
    }));
  };

  const handleDeleteComment = (bugId: string, commentId: string) => {
     setReports(prev => prev.map(bug => {
        if (bug.id === bugId) {
           return { ...bug, comments: (bug.comments || []).filter(c => c.id !== commentId) };
        }
        return bug;
     }));
     handleNotify("Comment deleted");
  };

  const handleLogin = (user: User) => {
      if (!user || !user.id) {
          handleNotify("Login failed: Invalid user data", 'error');
          return;
      }
      setCurrentUser(user);
      handleNotify(`Welcome back, ${user.username}`);
      handleNavigate('home');
  };

  const handleLoginError = (error: AuthError) => {
      if (error.code === 'NOT_CONFIGURED') {
          handleNotify("Database not configured. Please set up MongoDB Atlas.", 'error');
      } else if (error.code === 'INVALID_CREDENTIALS') {
          handleNotify("Invalid username or password.", 'error');
      } else {
          handleNotify(`Login failed: ${error.message}`, 'error');
      }
  };

  const handleRegisterError = (error: AuthError) => {
      if (error.code === 'NOT_CONFIGURED') {
          handleNotify("Database not configured. Please set up MongoDB Atlas.", 'error');
      } else {
          handleNotify(`Registration failed: ${error.message}`, 'error');
      }
  };

  const handleLogout = () => {
      AuthService.logout();
      setCurrentUser(null);
      handleNavigate('home');
      handleNotify("Logged out");
  };

  const addSuggestion = async (suggestion: Suggestion) => {
    try {
      await StorageService.saveSuggestion(suggestion);
      setSuggestions(prev => [suggestion, ...prev]);
      handleNavigate('suggestions');
      handleNotify("Suggestion Submitted Successfully!");
    } catch (e: any) {
      console.error("Failed to save suggestion:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to submit suggestion: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to submit suggestion. Please try again.", 'error');
      }
    }
  };

  const updateSuggestion = async (updatedSuggestion: Suggestion) => {
    try {
      await StorageService.saveSuggestion(updatedSuggestion);
      setSuggestions(prev => prev.map(s => s.id === updatedSuggestion.id ? updatedSuggestion : s));
      handleNotify("Suggestion updated");
    } catch (e: any) {
      console.error("Failed to update suggestion:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to update suggestion: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to update suggestion. Please try again.", 'error');
      }
    }
  };

  const deleteSuggestion = async (id: string) => {
    try {
      await StorageService.deleteSuggestion(id);
      setSuggestions(prev => prev.filter(s => s.id !== id));
      handleNotify("Suggestion deleted");
    } catch (e: any) {
      console.error("Failed to delete suggestion:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to delete suggestion: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to delete suggestion. Please try again.", 'error');
      }
    }
  };

  const toggleSuggestionStatus = async (id: string) => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'owner')) return; 
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion) return;

    let newStatus: Suggestion['status'];
    if (suggestion.status === 'Open') newStatus = 'Under Review';
    else if (suggestion.status === 'Under Review') newStatus = 'Planned';
    else if (suggestion.status === 'Planned') newStatus = 'Implemented';
    else if (suggestion.status === 'Implemented') newStatus = 'Rejected';
    else newStatus = 'Open';

    const updatedSuggestion = { ...suggestion, status: newStatus };
    
    try {
      await StorageService.saveSuggestion(updatedSuggestion);
      setSuggestions(prev => prev.map(s => s.id === id ? updatedSuggestion : s));
      handleNotify(`Suggestion Marked as ${newStatus}`);
    } catch (e: any) {
      console.error("Failed to update suggestion status:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to update status: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to update status. Please try again.", 'error');
      }
    }
  };

  const handleAddSuggestionComment = async (suggestionId: string, text: string, images: string[] = []) => {
    if (!currentUser) return;
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const newComment = {
      id: crypto.randomUUID(),
      author: currentUser.username,
      role: currentUser.role,
      text,
      images,
      timestamp: Date.now()
    };
    
    const updatedSuggestion = { 
      ...suggestion, 
      comments: [...(suggestion.comments || []), newComment] 
    };

    try {
      await StorageService.saveSuggestion(updatedSuggestion);
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? updatedSuggestion : s));
    } catch (e: any) {
      console.error("Failed to save comment:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to add comment: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to add comment. Please try again.", 'error');
      }
    }
  };

  const handleDeleteSuggestionComment = async (suggestionId: string, commentId: string) => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const updatedSuggestion = { 
      ...suggestion, 
      comments: (suggestion.comments || []).filter(c => c.id !== commentId) 
    };

    try {
      await StorageService.saveSuggestion(updatedSuggestion);
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? updatedSuggestion : s));
      handleNotify("Comment deleted");
    } catch (e: any) {
      console.error("Failed to delete comment:", e);
      if (e instanceof StorageError) {
        handleNotify(`Failed to delete comment: ${e.message}`, 'error');
      } else {
        handleNotify("Failed to delete comment. Please try again.", 'error');
      }
    }
  };

  return (
    <div className="h-screen bg-[#121212] flex flex-col font-sans overflow-hidden">
      <Navbar onNavigate={handleNavigate} currentUser={currentUser} onLogout={handleLogout} links={config.links} navbarIcon={config.navbarIcon} />
      
      {currentView === 'admin' && currentUser && currentUser.role === 'owner' && (
          <div className={`fixed bottom-4 right-4 z-50 p-2.5 rounded-full shadow-lg border ${dataSource === 'cloud' ? 'bg-green-900/80 text-green-300 border-green-500/50' : 'bg-red-900/80 text-red-300 border-red-500/50'}`} title={dataSource === 'cloud' ? 'Cloud Storage' : 'Database Error'}>
              {dataSource === 'cloud' ? <Cloud size={20}/> : <WifiOff size={20}/>}
          </div>
      )}

      {dbError && (
          <div className="fixed top-16 left-0 right-0 z-40 bg-red-900/90 border-b border-red-700 px-4 py-3 text-red-200 text-sm">
              <div className="max-w-7xl mx-auto flex items-center gap-3">
                  <AlertCircle size={20} className="flex-shrink-0" />
                  <div className="flex-1">
                      {dbError}
                  </div>
              </div>
          </div>
      )}

      {isLoading && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
              <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl p-6 flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                  <p className="text-gray-300">Loading data from server...</p>
              </div>
          </div>
      )}

      <main className="flex-1 overflow-hidden relative">
        {currentView === 'home' && (
          <div className="h-full overflow-y-auto custom-scrollbar fade-in">
            <Hero 
                onReportClick={() => handleNavigate('report')} 
                onSuggestionsClick={() => handleNavigate('suggestion-form')}
                config={config.hero}
                links={config.links}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <BugList 
                reports={reports} 
                onToggleStatus={toggleStatus}
                onUpdateReport={updateReport}
                isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'owner'}
                mcVersions={config.mcVersions}
                modVersions={config.modVersions}
                currentUser={currentUser}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onNavigateLogin={() => handleNavigate('login')}
                onNotify={handleNotify}
              />
            </div>
            <Footer links={config.links} socialHandles={config.socialHandles} footerIcon={config.footerIcon} />
          </div>
        )}

        {currentView === 'report' && (
          <div className="h-full fade-in overflow-hidden">
             <BugForm 
                onSubmit={addReport} 
                onCancel={() => handleNavigate('home')} 
                mcVersions={config.mcVersions}
                modVersions={config.modVersions}
                onNotify={handleNotify}
                currentUser={currentUser}
             />
          </div>
        )}

        {currentView === 'login' && (
           <div className="h-full overflow-y-auto custom-scrollbar">
             <Login onLogin={handleLogin} onError={handleLoginError} onNavigateRegister={() => handleNavigate('register')} />
             <Footer links={config.links} socialHandles={config.socialHandles} footerIcon={config.footerIcon} />
           </div>
        )}

        {currentView === 'register' && (
           <div className="h-full overflow-y-auto custom-scrollbar">
             <Register onLogin={handleLogin} onError={handleRegisterError} onNavigateLogin={() => handleNavigate('login')} />
             <Footer links={config.links} socialHandles={config.socialHandles} footerIcon={config.footerIcon} />
           </div>
        )}

        {currentView === 'forgot-password' && (
           <div className="h-full overflow-y-auto custom-scrollbar">
             <ForgotPassword 
               onBack={() => handleNavigate('login')} 
               onSuccess={() => {
                 handleNotify("Password reset successfully! You can now login with your new password.", 'success');
                 handleNavigate('login');
               }}
               onError={(error) => handleNotify(`Password reset error: ${error.message}`, 'error')}
             />
             <Footer links={config.links} socialHandles={config.socialHandles} footerIcon={config.footerIcon} />
           </div>
        )}

        {currentView === 'profile' && currentUser && (
          <Profile 
            currentUser={currentUser}
            onUpdate={(updatedUser) => {
              setCurrentUser(updatedUser);
              handleNotify("Profile updated successfully!", "success");
            }}
            onCancel={() => handleNavigate('home')}
            onNotify={handleNotify}
            kofiUrl={config.links?.kofi}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'suggestions' && (
          <div className="h-full overflow-y-auto custom-scrollbar fade-in">
            <Hero 
                onReportClick={() => handleNavigate('report')} 
                onSuggestionsClick={() => handleNavigate('suggestion-form')}
                config={config.hero}
                links={config.links}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <SuggestionsList 
                suggestions={suggestions} 
                onToggleStatus={toggleSuggestionStatus} 
                isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'owner'} 
                mcVersions={config.mcVersions}
                modVersions={config.modVersions}
                currentUser={currentUser}
                onAddComment={handleAddSuggestionComment}
                onDeleteComment={handleDeleteSuggestionComment}
                onNavigateLogin={() => handleNavigate('login')}
                onNotify={handleNotify}
              />
            </div>
            <Footer links={config.links} socialHandles={config.socialHandles} footerIcon={config.footerIcon} />
          </div>
        )}

        {currentView === 'suggestion-form' && (
          <div className="h-full fade-in overflow-hidden">
             <SuggestionsForm 
                onSubmit={addSuggestion} 
                onCancel={() => handleNavigate('suggestions')} 
                mcVersions={config.mcVersions}
                modVersions={config.modVersions}
                onNotify={handleNotify}
                currentUser={currentUser}
             />
          </div>
        )}

        {currentView === 'admin' && currentUser && (
            <div className="h-full fade-in overflow-hidden">
                <AdminPanel 
                    currentUser={currentUser} 
                    onLogout={handleLogout}
                    reports={reports}
                    suggestions={suggestions}
                    onUpdateReport={updateReport}
                    onDeleteReport={deleteReport}
                    onUpdateSuggestion={updateSuggestion}
                    onDeleteSuggestion={deleteSuggestion}
                    config={config}
                    onUpdateConfig={handleUpdateConfig}
                    onRestoreData={handleRestoreData}
                    initialChangelogToEdit={changelogToEdit}
                    onChangelogEditComplete={() => setChangelogToEdit(null)}
                />
            </div>
        )}
        
        {currentView === 'admin' && !currentUser && (
             <div className="min-h-[60vh] flex items-center justify-center">
                 <div className="text-center">
                     <p className="text-gray-500 mb-4">Redirecting to login...</p>
                     <button onClick={() => handleNavigate('login')} className="bg-green-700 text-white px-4 py-2 rounded">Go to Login</button>
                 </div>
             </div>
        )}

        {currentView === 'changelog' && (
          <div className="h-full overflow-y-auto custom-scrollbar fade-in">
            <Changelog 
              config={config}
              reports={reports}
              currentUser={currentUser}
              isAdmin={currentUser?.role === 'admin' || currentUser?.role === 'owner'}
              onToggleStatus={toggleStatus}
              onUpdateReport={updateReport}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onNavigateLogin={() => handleNavigate('login')}
              onNotify={handleNotify}
              onEditChangelog={(changelog) => {
                setChangelogToEdit(changelog);
                handleNavigate('admin');
                setTimeout(() => {
                  const adminPanel = document.querySelector('[data-admin-panel]');
                  if (adminPanel) {
                    const changelogsTab = adminPanel.querySelector('[data-tab="changelogs"]') as HTMLElement;
                    if (changelogsTab) {
                      changelogsTab.click();
                    }
                  }
                }, 100);
              }}
              unlistedChangelogId={(() => {
                const params = new URLSearchParams(window.location.search);
                return params.get('changelog');
              })()}
            />
          </div>
        )}

        {currentView === 'wiki' && (
          <div className="h-full overflow-y-auto custom-scrollbar fade-in">
            <Wiki config={config} />
          </div>
        )}

        {currentView === 'redeem' && (
          <div className="h-full overflow-y-auto custom-scrollbar fade-in">
            <Redeem 
              currentUser={currentUser}
              onNavigateLogin={() => handleNavigate('login')}
              onNavigate={handleNavigate}
              onNotify={handleNotify}
            />
          </div>
        )}
      </main>

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
    </div>
  );
}