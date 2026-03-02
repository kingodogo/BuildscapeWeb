import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Info, BookOpen, Cog, Hammer, Zap, Shield, Users, Wrench, Globe, Package, Sparkles, Settings, Monitor, Box, Layers, Palette, FileText, Eye, Gauge, Lock, DollarSign, Server, Skull, Heart, Pickaxe, Gamepad2, TrendingUp, Mountain, MapPin, CircuitBoard, SquareStack, Sliders, Ghost, Rabbit, Map, Search, X, Share2, ThumbsUp } from "lucide-react";
import { WikiFeature, User } from "../types";
import { AppConfig } from "../types";
import { sanitizeHTMLPermissive } from "../utils/sanitize";
import { supabase } from "../lib/supabase";

interface WikiProps {
  config?: AppConfig;
  currentUser?: User | null;
  onUpdateAppUser?: (user: User) => void;
}

// No predefined features - all features are loaded from the database

const PRIMARY_CATEGORIES = [
  { id: "automation", label: "Automation", icon: CircuitBoard },
  { id: "building", label: "Building", icon: SquareStack },
  { id: "client", label: "Client", icon: Monitor },
  { id: "management", label: "Management", icon: Sliders },
  { id: "mobs", label: "Mobs", icon: Ghost },
  { id: "tools", label: "Tools", icon: Pickaxe },
  { id: "tweaks", label: "Tweaks", icon: Cog },
  { id: "world", label: "World", icon: Map }
];

type SubcategoryDef = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
};

const SUBCATEGORY_DEFS: Record<string, SubcategoryDef[]> = {
  automation: [
    { id: "redstone", label: "Redstone", icon: Zap },
    { id: "vanilla", label: "Vanilla", icon: Box },
    { id: "technical", label: "Technical", icon: Cog },
    { id: "addon", label: "Addon", icon: Package }
  ],
  building: [
    { id: "blocks", label: "Blocks", icon: Box },
    { id: "decoration", label: "Decoration", icon: Palette },
    { id: "utility", label: "Utility", icon: Wrench },
    { id: "blueprints", label: "Blueprints", icon: FileText }
  ],
  client: [
    { id: "visuals", label: "Visuals", icon: Eye },
    { id: "performance", label: "Performance", icon: Gauge },
    { id: "resources", label: "Resources", icon: Package }
  ],
  management: [
    { id: "permissions", label: "Permissions", icon: Lock },
    { id: "economy", label: "Economy", icon: DollarSign },
    { id: "server", label: "Server", icon: Server }
  ],
  mobs: [
    { id: "hostile", label: "Hostile", icon: Skull },
    { id: "passive", label: "Passive", icon: Heart },
    { id: "utility", label: "Utility", icon: Users }
  ],
  tools: [
    { id: "mining", label: "Mining", icon: Pickaxe },
    { id: "building", label: "Building", icon: Hammer },
    { id: "utility", label: "Utility", icon: Wrench }
  ],
  tweaks: [
    { id: "gameplay", label: "Gameplay", icon: Gamepad2 },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "qol", label: "Quality of Life", icon: Sparkles }
  ],
  world: [
    { id: "biomes", label: "Biomes", icon: Mountain },
    { id: "structures", label: "Structures", icon: MapPin },
    { id: "dimensions", label: "Dimensions", icon: Globe },
    { id: "editing", label: "Editing", icon: Wrench }
  ]
};

const MINECRAFT_VERSIONS = [
  "1.20.1",
  "1.20",
  "1.19.4",
  "1.19.2",
  "1.18.2",
  "1.17.1",
  "1.16.5"
];

export default function Wiki({ config, currentUser, onUpdateAppUser }: WikiProps = {}) {
  const [features, setFeatures] = useState<WikiFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [selectedSubcategories, setSelectedSubcategories] = useState<Set<string>>(new Set());
  const [selectedMcVersions, setSelectedMcVersions] = useState<Set<string>>(new Set());
  const [selectedModVersions, setSelectedModVersions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showIconsOnly, setShowIconsOnly] = useState(false);
  const [subcategoryPage, setSubcategoryPage] = useState(0);
  const [mcVersionPage, setMcVersionPage] = useState(0);
  const [modVersionPage, setModVersionPage] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState<WikiFeature | null>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const parentContainerRef = useRef<HTMLDivElement>(null);
  const checkingRef = useRef(false);

  // Lock body scroll when modal is open and prevent scroll to top
  useEffect(() => {
    if (selectedFeature) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Lock body scroll and prevent scrolling
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      // Prevent any scroll events
      const preventScroll = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };
      
      window.addEventListener('scroll', preventScroll, { passive: false, capture: true });
      window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
      window.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
      
      return () => {
        // Remove event listeners
        window.removeEventListener('scroll', preventScroll, { capture: true });
        window.removeEventListener('wheel', preventScroll, { capture: true });
        window.removeEventListener('touchmove', preventScroll, { capture: true });
        
        // Restore body styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [selectedFeature]);

  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const response = await fetch('/api/wiki');
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            setFeatures(data.features);
            
            // Handle deep link
            if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              const featureIdFromUrl = params.get('feature');
              if (featureIdFromUrl) {
                const found = data.features.find((f: WikiFeature) => f.id === featureIdFromUrl);
                if (found) {
                  setSelectedFeature(found);
                }
              }
            }
          }
        }
        } catch (error) {
          console.error('Failed to load wiki features:', error);
        } finally {
        setLoading(false);
      }
    };
    loadFeatures();
  }, []);

  // Sync selected feature with URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (selectedFeature) {
        url.searchParams.set('feature', selectedFeature.id);
      } else {
        url.searchParams.delete('feature');
      }
      window.history.replaceState(null, '', url.toString().replace(/=$/, ''));
    }
  }, [selectedFeature]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedFeature, setCopiedFeature] = useState<string | null>(null);

  const handleShare = (featureId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set('feature', featureId);
    navigator.clipboard.writeText(url.toString());
    setCopiedFeature(featureId);
    setTimeout(() => setCopiedFeature(null), 2000);
  };

  const handleLike = async (featureId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Optimistic UI update
    const isCurrentlyLiked = currentUser?.likedFeatures?.includes(featureId);
    if (!currentUser) return;

    // Optimistically update likes in local state immediately
    const updatedFeatures = features.map(f => {
      if (f.id === featureId) {
        return {
          ...f,
          likes: !isCurrentlyLiked ? (f.likes || 0) + 1 : Math.max(0, (f.likes || 1) - 1)
        };
      }
      return f;
    });
    setFeatures(updatedFeatures);
    
    // Also update selectedFeature if it's the one being liked
    if (selectedFeature?.id === featureId) {
      setSelectedFeature(updatedFeatures.find(f => f.id === featureId) || null);
    }

    if (onUpdateAppUser) {
      const likedFeatures = currentUser.likedFeatures || [];
      const newLiked = !isCurrentlyLiked ? [...likedFeatures, featureId] : likedFeatures.filter(id => id !== featureId);
      onUpdateAppUser({ ...currentUser, likedFeatures: newLiked });
    }

    setActionLoading(`like-${featureId}`);
    try {
      await fetch('/.netlify/functions/wiki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ action: 'like', featureId })
      });
    } catch (err) {
      console.error('Failed to like feature:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFavorite = async (featureId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) return;
    
    // Optimistic UI update
    const isCurrentlyFav = currentUser?.favoriteFeatures?.includes(featureId);

    if (onUpdateAppUser) {
      const favFeatures = currentUser.favoriteFeatures || [];
      const newFavs = !isCurrentlyFav ? [...favFeatures, featureId] : favFeatures.filter(id => id !== featureId);
      onUpdateAppUser({ ...currentUser, favoriteFeatures: newFavs });
    }

    setActionLoading(`fav-${featureId}`);
    try {
      await fetch('/.netlify/functions/wiki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ action: 'favorite', featureId })
      });
    } catch (err) {
      console.error('Failed to fav feature:', err);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    const checkFit = () => {
      try {
        if (!navContainerRef.current || !parentContainerRef.current || checkingRef.current) return;
        
        checkingRef.current = true;
        
        const parent = parentContainerRef.current;
        const container = navContainerRef.current;
        if (!parent || !container) {
          checkingRef.current = false;
          return;
        }
        
        const parentWidth = parent.clientWidth;
        
        // Get all buttons to measure
        const buttons = Array.from(container.querySelectorAll('button')) as HTMLElement[];
        if (buttons.length === 0) {
          checkingRef.current = false;
          setTimeout(checkFit, 100);
          return;
        }
        
        // Check DOM to see if we're currently showing text or icons
        const firstButton = buttons[0];
        if (!firstButton) {
          checkingRef.current = false;
          return;
        }
        
        const textSpans = firstButton.querySelectorAll('span');
        const hasText = textSpans.length > 0 && Array.from(textSpans).some(span => {
          try {
            const style = window.getComputedStyle(span);
            return style.display !== 'none' && span.offsetParent !== null;
          } catch {
            return false;
          }
        });
        
        if (hasText) {
          // Currently showing text - check if it overflows
          try {
            const parentRect = parent.getBoundingClientRect();
            let overflows = false;
            
            // Check each button's position - most reliable method
            buttons.forEach(btn => {
              try {
                const btnRect = btn.getBoundingClientRect();
                if (btnRect.right > parentRect.right + 1) {
                  overflows = true;
                }
              } catch {
                // Ignore errors
              }
            });
            
            if (overflows) {
              setShowIconsOnly(true);
              checkingRef.current = false;
              return;
            }
          } catch {
            // Ignore errors
          }
        } else {
          // Currently showing icons - check if we can show text
          try {
            let iconWidth = 0;
            buttons.forEach(btn => {
              iconWidth += btn.offsetWidth || 0;
            });
            iconWidth += (buttons.length - 1) * 8;
            
            // Estimate text width: ~130px per button
            const estimatedTextWidth = buttons.length * 130 + (buttons.length - 1) * 8;
            
            // If parent is wide enough for text
            if (parentWidth >= estimatedTextWidth) {
              setShowIconsOnly(false);
            }
          } catch {
            // Ignore errors
          }
        }
        
        checkingRef.current = false;
      } catch (error) {
        console.error('Error in checkFit:', error);
        checkingRef.current = false;
      }
    };

    // Run check after a short delay to ensure DOM is ready
    const initialTimeout = setTimeout(checkFit, 100);
    const timeout1 = setTimeout(checkFit, 200);
    const timeout2 = setTimeout(checkFit, 500);
    
    // Watch parent container for size changes
    let resizeObserver: ResizeObserver | null = null;
    const setupObservers = () => {
      if (parentContainerRef.current && !resizeObserver) {
        try {
          resizeObserver = new ResizeObserver(() => {
            setTimeout(checkFit, 50);
          });
          resizeObserver.observe(parentContainerRef.current);
        } catch (error) {
          console.error('Error setting up ResizeObserver:', error);
        }
      }
      
      if (navContainerRef.current && !resizeObserver) {
        try {
          if (!resizeObserver) {
            resizeObserver = new ResizeObserver(() => {
              setTimeout(checkFit, 50);
            });
          }
          resizeObserver.observe(navContainerRef.current);
        } catch (error) {
          console.error('Error setting up ResizeObserver:', error);
        }
      }
    };
    
    // Setup observers after a delay
    const observerTimeout = setTimeout(setupObservers, 300);
    
    const handleResize = () => {
      setTimeout(checkFit, 50);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(observerTimeout);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      }
      checkingRef.current = false;
    };
  }, []); // Run only once on mount

  const filteredFeatures = useMemo(() => {
    return features.filter(feature => {
      // Handle migration from old format
      const oldFeature = feature as any;
      const featureCategories = feature.categories || (oldFeature.category ? [oldFeature.category] : []);
      const featureSubcategories = feature.subcategories || (oldFeature.subcategory ? [oldFeature.subcategory] : []);
      const featureMcVersions = feature.mcVersions || (oldFeature.version ? [oldFeature.version] : []);
      const featureModVersions = feature.modVersions || (oldFeature.modVersion ? [oldFeature.modVersion] : []);
      
      // Category filter (single selection)
      const isFavorite = currentUser?.favoriteFeatures?.includes(feature.id);
      const categoryMatch = selectedCategory === "all" || 
                           (selectedCategory === "favorites" ? isFavorite : featureCategories.includes(selectedCategory));
      
      // Subcategory filter
      const subcategoryMatch = selectedSubcategories.size === 0 || 
        featureSubcategories.some(subcat => selectedSubcategories.has(subcat));
      
      // Minecraft version filter
      const mcVersionMatch = selectedMcVersions.size === 0 || 
        featureMcVersions.some(v => selectedMcVersions.has(v)) ||
        featureMcVersions.some(v => {
          const versionStr = v.toString();
          return Array.from(selectedMcVersions).some(selected => 
            versionStr.includes(selected) || 
            (versionStr.endsWith('+') && parseFloat(versionStr.replace('+', '')) <= parseFloat(selected))
          );
        });
      
      // Mod version filter
      const modVersionMatch = selectedModVersions.size === 0 || 
        featureModVersions.length === 0 ||
        featureModVersions.some(v => selectedModVersions.has(v)) ||
        featureModVersions.some(v => {
          const versionStr = v.toString();
          return Array.from(selectedModVersions).some(selected => 
            versionStr.includes(selected) || 
            (versionStr.endsWith('+') && parseFloat(versionStr.replace('+', '')) <= parseFloat(selected))
          );
        });
      
      // Search filter
      const searchMatch = !searchTerm || 
        feature.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        feature.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (feature.details && feature.details.some(d => d.toLowerCase().includes(searchTerm.toLowerCase())));
      
      return categoryMatch && subcategoryMatch && mcVersionMatch && modVersionMatch && searchMatch;
    });
  }, [features, selectedCategory, selectedSubcategories, selectedMcVersions, selectedModVersions, searchTerm]);

  // Function to highlight search text in plain text
  const highlightText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Function to highlight text in HTML/Markdown content
  const highlightInContent = (content: string, searchTerm: string): string => {
    if (!searchTerm || !content) return content;
    
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    
    // Replace matches with highlighted version, preserving HTML tags
    return content.replace(regex, '<mark class="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">$1</mark>');
  };

  // Function to truncate content to fit in one line (approximately)
  const truncateContent = (content: string, maxLength: number = 250): { truncated: string; isTruncated: boolean } => {
    if (!content) return { truncated: '', isTruncated: false };
    // Remove HTML tags for length calculation
    const textContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (textContent.length <= maxLength) return { truncated: content, isTruncated: false };
    
    // Try to truncate at a word boundary
    const truncated = textContent.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = lastSpace > maxLength * 0.7 ? lastSpace : maxLength;
    
    // For HTML/Markdown, we need to be more careful
    // Simple approach: just truncate the text content
    const truncatedText = textContent.substring(0, cutPoint) + '...';
    return { truncated: truncatedText, isTruncated: true };
  };

  const renderDescription = (description: string, type?: 'text' | 'html' | 'markdown', isTruncated: boolean = false, highlightSearch: boolean = true) => {
    if (!description) return null;
    
    let processedDescription = description;
    if (isTruncated) {
      const { truncated } = truncateContent(description);
      processedDescription = truncated;
    }
    
    if (highlightSearch && searchTerm) {
      processedDescription = highlightInContent(processedDescription, searchTerm);
    }
    
    if (type === 'html') {
      return <div dangerouslySetInnerHTML={{ __html: sanitizeHTMLPermissive(processedDescription) }} className="prose prose-invert max-w-none" />;
    }
    
    if (type === 'markdown') {
      // Enhanced markdown rendering with proper bullet alignment
      const lines = processedDescription.split('\n');
      const elements: React.ReactNode[] = [];
      let inList = false;
      
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          if (inList) {
            elements.push(<br key={`br-${idx}`} />);
          }
          inList = false;
          return;
        }
        
        if (trimmed.startsWith('# ')) {
          inList = false;
          const content = trimmed.substring(2);
          elements.push(<h1 key={idx} className="text-2xl font-bold text-white mt-4 mb-2">{highlightSearch && searchTerm ? highlightText(content, searchTerm) : content}</h1>);
        } else if (trimmed.startsWith('## ')) {
          inList = false;
          const content = trimmed.substring(3);
          elements.push(<h2 key={idx} className="text-xl font-bold text-white mt-3 mb-2">{highlightSearch && searchTerm ? highlightText(content, searchTerm) : content}</h2>);
        } else if (trimmed.startsWith('### ')) {
          inList = false;
          const content = trimmed.substring(4);
          elements.push(<h3 key={idx} className="text-lg font-bold text-gray-300 mt-2 mb-1">{highlightSearch && searchTerm ? highlightText(content, searchTerm) : content}</h3>);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          if (!inList) {
            elements.push(<ul key={`ul-${idx}`} className="list-none pl-0 my-2" />);
            inList = true;
          }
          const lastUl = elements.length - 1;
          const content = trimmed.substring(2);
          const existingUl = elements[lastUl] as React.ReactElement;
          if (React.isValidElement(existingUl) && existingUl.props && 'children' in (existingUl.props as object)) {
            elements[lastUl] = (
              <ul key={`ul-${idx}`} className="list-none pl-0 my-2 space-y-1">
                {React.Children.toArray((existingUl.props as { children?: React.ReactNode }).children)}
                <li key={idx} className="flex items-start gap-2 text-gray-300">
                  <span className="text-green-500 mt-1 flex-shrink-0">•</span>
                  <span className="flex-1">{highlightSearch && searchTerm ? highlightText(content, searchTerm) : content}</span>
                </li>
              </ul>
            );
          } else {
            elements[lastUl] = (
              <ul key={`ul-${idx}`} className="list-none pl-0 my-2 space-y-1">
                <li key={idx} className="flex items-start gap-2 text-gray-300">
                  <span className="text-green-500 mt-1 flex-shrink-0">•</span>
                  <span className="flex-1">{highlightSearch && searchTerm ? highlightText(content, searchTerm) : content}</span>
                </li>
              </ul>
            );
          }
        } else {
          inList = false;
          elements.push(<p key={idx} className="text-gray-300 my-2">{highlightSearch && searchTerm ? highlightText(trimmed, searchTerm) : trimmed}</p>);
        }
      });
      
      return <div className="prose prose-invert max-w-none">{elements}</div>;
    }
    
    return <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{highlightSearch && searchTerm ? highlightText(description, searchTerm) : description}</p>;
  };

  return (
    <div className="min-h-screen bg-[#121212] text-gray-100">
      {/* Header Section */}
      <div className="bg-[#1a1a1a] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" ref={parentContainerRef}>
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-gray-600 text-xl">•</span>
            <h1 className="text-4xl md:text-5xl font-bold text-white">Features</h1>
            <span className="text-gray-600 text-xl">•</span>
          </div>

          {/* Primary Navigation Tabs - Responsive with auto-fit */}
          <div 
            ref={navContainerRef}
            className="flex gap-2 mb-4 overflow-x-auto whitespace-nowrap"
          >
            {/* All filter */}
            <button
              onClick={() => {
                setSelectedCategory(selectedCategory === "all" ? "all" : "all");
                setSelectedSubcategories(new Set());
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all ${
                showIconsOnly 
                  ? "p-2 min-w-[40px] max-w-[40px] flex-shrink-0" 
                  : "px-3 py-2 flex-shrink-0 whitespace-nowrap"
              } ${
                selectedCategory === "all"
                  ? "bg-gray-800 text-white border-2 border-green-500/50"
                  : "bg-[#1e1e1e] text-gray-300 hover:bg-gray-800 hover:text-white border-2 border-transparent"
              }`}
              title={`All (${features.length})`}
              style={{
                flexShrink: 0,
                minWidth: showIconsOnly ? '40px' : 'auto',
                maxWidth: showIconsOnly ? '40px' : 'none'
              }}
            >
              <Box size={showIconsOnly ? 18 : 16} className="flex-shrink-0" />
              {!showIconsOnly && (
                <>
                  <span className="whitespace-nowrap">All</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">({features.length})</span>
                </>
              )}
            </button>
            {PRIMARY_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const oldFeature = features[0] as any;
              const count = features.filter(f => {
                const cats = f.categories || (oldFeature?.category ? [oldFeature.category] : []);
                return cats.includes(category.id);
              }).length;
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(isSelected ? "all" : category.id);
                    setSelectedSubcategories(new Set());
                    setSubcategoryPage(0);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all ${
                    showIconsOnly 
                      ? "p-2 min-w-[40px] max-w-[40px] flex-shrink-0" 
                      : "px-3 py-2 flex-shrink-0 whitespace-nowrap"
                  } ${
                    isSelected
                      ? "bg-gray-800 text-white border-2 border-green-500/50"
                      : "bg-[#1e1e1e] text-gray-300 hover:bg-gray-800 hover:text-white border-2 border-transparent"
                  }`}
                  title={`${category.label} (${count})`}
                  style={{
                    flexShrink: 0,
                    minWidth: showIconsOnly ? '40px' : 'auto',
                    maxWidth: showIconsOnly ? '40px' : 'none'
                  }}
                >
                  <Icon size={showIconsOnly ? 18 : 16} className="flex-shrink-0" />
                  {!showIconsOnly && (
                    <>
                      <span className="whitespace-nowrap">{category.label}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">({count})</span>
                    </>
                  )}
                </button>
              );
            })}
            
            {/* Favorites Tab - Only shown if logged in */}
            {currentUser && (
              <button
                onClick={() => {
                  setSelectedCategory(selectedCategory === "favorites" ? "all" : "favorites");
                  setSelectedSubcategories(new Set());
                  setSubcategoryPage(0);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all ${
                  showIconsOnly 
                    ? "p-2 min-w-[40px] max-w-[40px] flex-shrink-0" 
                    : "px-3 py-2 flex-shrink-0 whitespace-nowrap"
                } ${
                  selectedCategory === "favorites"
                    ? "bg-red-900/40 text-red-100 border-2 border-red-500/50"
                    : "bg-[#1e1e1e] text-gray-300 hover:bg-red-900/20 hover:text-white border-2 border-transparent"
                }`}
                title={`Favorites (${currentUser.favoriteFeatures?.length || 0})`}
                style={{
                  flexShrink: 0,
                  minWidth: showIconsOnly ? '40px' : 'auto',
                  maxWidth: showIconsOnly ? '40px' : 'none'
                }}
              >
                <Heart size={showIconsOnly ? 18 : 16} className={`flex-shrink-0 ${selectedCategory === "favorites" ? "fill-red-500 text-red-500" : ""}`} />
                {!showIconsOnly && (
                  <>
                    <span className="whitespace-nowrap">Favorites</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">({currentUser.favoriteFeatures?.length || 0})</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search features..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#1e1e1e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Secondary Navigation and Version Selectors */}
          <div className="space-y-4">
            {/* Subcategories - First Line */}
            {(() => {
              // Get available subcategories based on selected category
              const availableSubcats: SubcategoryDef[] = [];
              if (selectedCategory === "all") {
                const allSubcats = Object.values(SUBCATEGORY_DEFS).flat();
                const seenIds = new Set<string>();
                allSubcats.forEach(s => {
                  if (!seenIds.has(s.id)) {
                    seenIds.add(s.id);
                    availableSubcats.push(s);
                  }
                });
              } else {
                availableSubcats.push(...(SUBCATEGORY_DEFS[selectedCategory] || []));
              }
              
              if (availableSubcats.length === 0) return null;
              
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Subcategories</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSubcategoryPage(Math.max(0, subcategoryPage - 1))}
                      disabled={subcategoryPage === 0}
                      className="px-2 py-1 bg-[#1e1e1e] text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 flex-shrink-0"
                    >
                      &lt;
                    </button>
                    <div className="flex-1 overflow-hidden relative">
                      <div 
                        className="flex gap-2 transition-transform duration-300 ease-in-out"
                        style={{ transform: `translateX(-${subcategoryPage * 100}%)` }}
                      >
                        {(() => {
                          const itemsPerPage = 6;
                          const totalPages = Math.ceil(availableSubcats.length / itemsPerPage);
                          return Array.from({ length: totalPages }).map((_, pageIdx) => {
                            const start = pageIdx * itemsPerPage;
                            const end = start + itemsPerPage;
                            const pageSubcats = availableSubcats.slice(start, end);
                            return (
                              <div key={pageIdx} className="flex gap-2 flex-shrink-0" style={{ width: '100%', minWidth: '100%' }}>
                                {pageSubcats.map((subcat) => {
                    const SubIcon = subcat.icon;
                                  const isSelected = selectedSubcategories.has(subcat.id);
                                  const oldFeature = features[0] as any;
                                  const subcatCount = features.filter(f => {
                                    const subcats = f.subcategories || (oldFeature?.subcategory ? [oldFeature.subcategory] : []);
                                    return subcats.includes(subcat.id);
                                  }).length;
                    
                    return (
                      <button
                        key={subcat.id}
                        onClick={() => {
                                        const newSet = new Set(selectedSubcategories);
                                        if (isSelected) {
                                          newSet.delete(subcat.id);
                                        } else {
                                          newSet.add(subcat.id);
                                        }
                                        setSelectedSubcategories(newSet);
                        }}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 whitespace-nowrap ${
                                        isSelected
                                          ? "bg-blue-600 text-white border-2 border-blue-500"
                                          : "bg-[#1e1e1e] text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 border-2 border-transparent"
                        }`}
                        title={subcat.label}
                      >
                                      <SubIcon size={14} className="flex-shrink-0" />
                        <span className="hidden sm:inline">{subcat.label}</span>
                        {subcatCount > 0 && (
                                        <span className={`text-xs ${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>
                            ({subcatCount})
                          </span>
                        )}
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
                      onClick={() => {
                        const itemsPerPage = 6;
                        const maxPage = Math.ceil(availableSubcats.length / itemsPerPage) - 1;
                        setSubcategoryPage(Math.min(maxPage, subcategoryPage + 1));
                      }}
                      disabled={(() => {
                        const itemsPerPage = 6;
                        const maxPage = Math.ceil(availableSubcats.length / itemsPerPage) - 1;
                        return subcategoryPage >= maxPage;
                      })()}
                      className="px-2 py-1 bg-[#1e1e1e] text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 flex-shrink-0"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Version Selectors - Second Line (MC and Mod Versions) */}
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-300 mb-2">Minecraft Versions</label>
            <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMcVersionPage(Math.max(0, mcVersionPage - 1))}
                    disabled={mcVersionPage === 0}
                    className="px-2 py-1 bg-[#1e1e1e] text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 flex-shrink-0"
                  >
                    &lt;
                  </button>
                  <div className="flex-1 overflow-hidden relative">
                    <div 
                      className="flex gap-2 transition-transform duration-300 ease-in-out"
                      style={{ transform: `translateX(-${mcVersionPage * 100}%)` }}
                    >
                      {(() => {
                        const allVersions = config?.mcVersions || MINECRAFT_VERSIONS;
                        const itemsPerPage = 5;
                        const totalPages = Math.ceil(allVersions.length / itemsPerPage);
                        return Array.from({ length: totalPages }).map((_, pageIdx) => {
                          const start = pageIdx * itemsPerPage;
                          const end = start + itemsPerPage;
                          const pageVersions = allVersions.slice(start, end);
                          return (
                            <div key={pageIdx} className="flex gap-2 flex-shrink-0" style={{ width: '100%', minWidth: '100%' }}>
                              {pageVersions.map((version) => {
                                const isSelected = selectedMcVersions.has(version);
                                return (
                                  <button
                                    key={version}
                                    onClick={() => {
                                      const newSet = new Set(selectedMcVersions);
                                      if (isSelected) {
                                        newSet.delete(version);
                                      } else {
                                        newSet.add(version);
                                      }
                                      setSelectedMcVersions(newSet);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 whitespace-nowrap ${
                                      isSelected
                                        ? 'bg-green-600 text-white border-2 border-green-500'
                                        : 'bg-[#1e1e1e] text-gray-300 hover:bg-gray-800 border-2 border-transparent'
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
                    onClick={() => {
                      const allVersions = config?.mcVersions || MINECRAFT_VERSIONS;
                      const itemsPerPage = 5;
                      const maxPage = Math.ceil(allVersions.length / itemsPerPage) - 1;
                      setMcVersionPage(Math.min(maxPage, mcVersionPage + 1));
                    }}
                    disabled={(() => {
                      const allVersions = config?.mcVersions || MINECRAFT_VERSIONS;
                      const itemsPerPage = 5;
                      const maxPage = Math.ceil(allVersions.length / itemsPerPage) - 1;
                      return mcVersionPage >= maxPage;
                    })()}
                    className="px-2 py-1 bg-[#1e1e1e] text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 flex-shrink-0"
                  >
                    &gt;
                  </button>
                </div>
              </div>
              
              {config?.modVersions && config.modVersions.length > 0 && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Mod Versions</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModVersionPage(Math.max(0, modVersionPage - 1))}
                      disabled={modVersionPage === 0}
                      className="px-2 py-1 bg-[#1e1e1e] text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 flex-shrink-0"
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
                                  const isSelected = selectedModVersions.has(version);
                                  return (
                                    <button
                                      key={version}
                                      onClick={() => {
                                        const newSet = new Set(selectedModVersions);
                                        if (isSelected) {
                                          newSet.delete(version);
                                        } else {
                                          newSet.add(version);
                                        }
                                        setSelectedModVersions(newSet);
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 whitespace-nowrap ${
                                        isSelected
                                          ? 'bg-blue-600 text-white border-2 border-blue-500'
                                          : 'bg-[#1e1e1e] text-gray-300 hover:bg-gray-800 border-2 border-transparent'
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
                      className="px-2 py-1 bg-[#1e1e1e] text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 flex-shrink-0"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">
            {selectedCategory === "all"
              ? `All Features (${filteredFeatures.length} ${filteredFeatures.length === 1 ? 'Feature' : 'Features'})`
              : `${PRIMARY_CATEGORIES.find(c => c.id === selectedCategory)?.label || selectedCategory} (${filteredFeatures.length} ${filteredFeatures.length === 1 ? 'Feature' : 'Features'})`
            }
          </h2>
        </div>

        {/* Features Grid */}
        {filteredFeatures.length > 0 ? (
          <div className="space-y-6">
            {filteredFeatures.map((feature) => {
              const { truncated: truncatedDesc, isTruncated: isDescTruncated } = truncateContent(feature.description || '', 250);
              const truncatedDetails = feature.details ? feature.details.slice(0, 3) : [];
              const hasMoreDetails = feature.details && feature.details.length > 3;
              
              return (
              <div
                key={feature.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedFeature(feature);
                }}
                className="bg-[#1e1e1e] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-green-500/10 cursor-pointer relative"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Media (Image/Video) */}
                  <div className="flex-shrink-0">
                    <div className="w-full lg:w-64 bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden">
                      {(() => {
                        const media = feature.media || (feature as any).image || (feature as any).video;
                        if (!media) {
                          return (
                            <div className="text-center text-gray-600 p-8">
                          <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                              <p className="text-xs">No Media</p>
                        </div>
                          );
                        }
                        
                        // Google Drive link handling
                        if (media.includes('drive.google.com')) {
                          const fileIdMatch = media.match(/\/d\/([a-zA-Z0-9_-]+)/);
                          if (fileIdMatch) {
                            const fileId = fileIdMatch[1];
                            const previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                            return (
                              <div>
                                <img 
                                  src={previewUrl} 
                                  alt={feature.title} 
                                  className="w-full h-auto object-contain max-h-96"
                                  style={{ aspectRatio: 'auto' }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      parent.innerHTML = '<div class="text-center text-gray-600 p-8"><a href="' + media + '" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 text-sm">Open in Google Drive</a></div>';
                                    }
                                  }}
                                />
                              </div>
                            );
                          }
                        }
                        
                        // YouTube detection
                        if (media.includes('youtube.com') || media.includes('youtu.be')) {
                          let embedUrl = '';
                          if (media.includes('youtube.com/watch')) {
                            embedUrl = media.replace('watch?v=', 'embed/').split('&')[0];
                          } else if (media.includes('youtu.be/')) {
                            const videoId = media.split('youtu.be/')[1].split('?')[0];
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
                              className="rounded-lg"
                            />
                          );
                        }
                        
                        // Vimeo detection
                        if (media.includes('vimeo.com')) {
                          const videoId = media.split('vimeo.com/')[1]?.split('?')[0] || media.split('vimeo.com/')[1];
                          return (
                            <iframe
                              width="100%"
                              height="270"
                              src={`https://player.vimeo.com/video/${videoId}`}
                              frameBorder="0"
                              allow="autoplay; fullscreen; picture-in-picture"
                              allowFullScreen
                              className="rounded-lg"
                            />
                          );
                        }
                        
                        // Video file detection
                        if (media.match(/\.(mp4|webm|ogg|mov)$/i) || media.includes('video')) {
                          return (
                            <video 
                              src={media} 
                              controls 
                              className="w-full h-auto max-h-96 object-contain"
                              style={{ aspectRatio: 'auto' }}
                            >
                              Your browser does not support the video tag.
                            </video>
                          );
                        }
                        
                        // Image (default)
                        return (
                          <img 
                            src={media} 
                            alt={feature.title} 
                            className="w-full h-auto object-contain max-h-96"
                            style={{ aspectRatio: 'auto' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="text-center text-gray-600 p-8"><svg class="mx-auto mb-2 opacity-50" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><p class="text-xs">Media not available</p></div>';
                              }
                            }}
                          />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">
                          • {searchTerm ? highlightText(feature.title, searchTerm) : feature.title} •
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {/* Categories */}
                          {(() => {
                            const oldFeature = feature as any;
                            const cats = feature.categories || (oldFeature.category ? [oldFeature.category] : []);
                            return cats.map((cat: string) => (
                              <span key={cat} className="inline-block px-2 py-1 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400 font-medium">
                                {PRIMARY_CATEGORIES.find(c => c.id === cat)?.label || cat}
                        </span>
                            ));
                          })()}
                          {/* Subcategories */}
                          {(() => {
                            const oldFeature = feature as any;
                            const subcats = feature.subcategories || (oldFeature.subcategory ? [oldFeature.subcategory] : []);
                            return subcats.map((subcat: string) => (
                              <span key={subcat} className="inline-block px-2 py-1 bg-blue-900/30 border border-blue-700/50 rounded text-xs text-blue-400 font-medium">
                                {subcat}
                              </span>
                            ));
                          })()}
                        </div>
                        <div className="flex gap-2 flex-wrap mb-2">
                          {/* MC Versions */}
                          {(() => {
                            const oldFeature = feature as any;
                            const versions = feature.mcVersions || (oldFeature.version ? [oldFeature.version] : []);
                            return versions.map((v: string) => (
                              <span key={v} className="inline-block px-2 py-1 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400 font-medium">
                                MC {v}
                              </span>
                            ));
                          })()}
                          {/* Mod Versions */}
                          {(() => {
                            const oldFeature = feature as any;
                            const versions = feature.modVersions || (oldFeature.modVersion ? [oldFeature.modVersion] : []);
                            return versions.map((v: string) => (
                              <span key={v} className="inline-block px-2 py-1 bg-blue-900/30 border border-blue-700/50 rounded text-xs text-blue-400 font-medium">
                                Mod {v}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="text-gray-300 mb-4 leading-relaxed">
                      {renderDescription(isDescTruncated ? truncatedDesc : feature.description, feature.descriptionType, isDescTruncated, true)}
                    </div>

                    {truncatedDetails.length > 0 && (
                      <ul className="space-y-2 relative">
                        {truncatedDetails.map((detail, index) => (
                          <li key={index} className="text-gray-400 text-sm flex items-start gap-2">
                            <span className="text-green-500 flex-shrink-0" style={{ marginTop: '0.125rem' }}>•</span>
                            <span className="flex-1">{searchTerm ? highlightText(detail, searchTerm) : detail}</span>
                          </li>
                        ))}
                        {hasMoreDetails && (
                          <li className="text-gray-500 text-xs italic flex items-center gap-2">
                            <span className="flex-shrink-0">...</span>
                            <span>+{feature.details!.length - 3} more details</span>
                          </li>
                        )}
                      </ul>
                    )}
                    
                    {/* Action Bar */}
                    <div className="mt-4 pt-4 border-t border-gray-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => handleLike(feature.id, e)}
                          disabled={actionLoading === `like-${feature.id}`}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            currentUser?.likedFeatures?.includes(feature.id)
                              ? 'bg-blue-900/40 text-blue-400 border border-blue-800/50 hover:bg-blue-900/60'
                              : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700 hover:text-white'
                          }`}
                          title={currentUser ? "Like this feature" : "Login to like this feature"}
                        >
                          <ThumbsUp size={14} className={currentUser?.likedFeatures?.includes(feature.id) ? "fill-blue-400" : ""} />
                          <span>{feature.likes || 0}</span>
                        </button>
                        
                        <button
                          onClick={(e) => handleFavorite(feature.id, e)}
                          disabled={actionLoading === `fav-${feature.id}` || !currentUser}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            !currentUser ? 'opacity-50 cursor-not-allowed bg-gray-800/50 text-gray-500' :
                            currentUser?.favoriteFeatures?.includes(feature.id)
                              ? 'bg-red-900/40 text-red-400 border border-red-800/50 hover:bg-red-900/60'
                              : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700 hover:text-white'
                          }`}
                          title={currentUser ? (currentUser?.favoriteFeatures?.includes(feature.id) ? "Remove from favorites" : "Add to favorites") : "Login to favorite"}
                        >
                          <Heart size={14} className={currentUser?.favoriteFeatures?.includes(feature.id) ? "fill-red-400" : ""} />
                          <span className="hidden sm:inline">Favorites</span>
                        </button>
                      </div>
                      
                      <button
                        onClick={(e) => handleShare(feature.id, e)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-transparent ${
                          copiedFeature === feature.id
                            ? 'bg-green-900/40 text-green-400 border-green-800/50'
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                        title="Copy link to feature"
                      >
                        <Share2 size={14} />
                        <span className="hidden sm:inline">{copiedFeature === feature.id ? "Copied!" : "Share"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen size={64} className="mx-auto mb-4 text-gray-600 opacity-50" />
            <p className="text-gray-400 text-lg">No features found in this category.</p>
          </div>
        )}
      </div>

      {/* Full Feature Details Modal */}
      {selectedFeature && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
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
              setSelectedFeature(null);
            }
          }}
        >
          <div 
            className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl max-w-5xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 'auto'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {searchTerm ? highlightText(selectedFeature.title, searchTerm) : selectedFeature.title}
              </h2>
              <button
                onClick={() => setSelectedFeature(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 mb-6">
              {/* Media */}
              <div className="flex-shrink-0">
                <div className="w-full lg:w-80 bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden">
                  {(() => {
                    const media = selectedFeature.media || (selectedFeature as any).image || (selectedFeature as any).video;
                    if (!media) {
                      return (
                        <div className="text-center text-gray-600 p-8">
                          <BookOpen size={48} className="mx-auto mb-2 opacity-50" />
                          <p className="text-xs">No Media</p>
    </div>
  );
}
                    
                    // Google Drive link handling
                    if (media.includes('drive.google.com')) {
                      const fileIdMatch = media.match(/\/d\/([a-zA-Z0-9_-]+)/);
                      if (fileIdMatch) {
                        const fileId = fileIdMatch[1];
                        const previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                        return (
                          <img 
                            src={previewUrl} 
                            alt={selectedFeature.title} 
                            className="w-full h-auto object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="text-center text-gray-600 p-8"><a href="' + media + '" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 text-sm">Open in Google Drive</a></div>';
                              }
                            }}
                          />
                        );
                      }
                    }
                    
                    // YouTube detection
                    if (media.includes('youtube.com') || media.includes('youtu.be')) {
                      let embedUrl = '';
                      if (media.includes('youtube.com/watch')) {
                        embedUrl = media.replace('watch?v=', 'embed/').split('&')[0];
                      } else if (media.includes('youtu.be/')) {
                        const videoId = media.split('youtu.be/')[1].split('?')[0];
                        embedUrl = `https://www.youtube.com/embed/${videoId}`;
                      }
                      return (
                        <iframe
                          width="100%"
                          height="400"
                          src={embedUrl}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded-lg"
                        />
                      );
                    }
                    
                    // Vimeo detection
                    if (media.includes('vimeo.com')) {
                      const videoId = media.split('vimeo.com/')[1]?.split('?')[0] || media.split('vimeo.com/')[1];
                      return (
                        <iframe
                          width="100%"
                          height="400"
                          src={`https://player.vimeo.com/video/${videoId}`}
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          className="rounded-lg"
                        />
                      );
                    }
                    
                    // Video file detection
                    if (media.match(/\.(mp4|webm|ogg|mov)$/i) || media.includes('video')) {
                      return (
                        <video 
                          src={media} 
                          controls 
                          className="w-full h-auto object-contain"
                        >
                          Your browser does not support the video tag.
                        </video>
                      );
                    }
                    
                    // Image (default)
                    return (
                      <img 
                        src={media} 
                        alt={selectedFeature.title} 
                        className="w-full h-auto object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="text-center text-gray-600 p-8"><svg class="mx-auto mb-2 opacity-50" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><p class="text-xs">Media not available</p></div>';
                          }
                        }}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Full Content */}
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Categories */}
                  {(() => {
                    const oldFeature = selectedFeature as any;
                    const cats = selectedFeature.categories || (oldFeature.category ? [oldFeature.category] : []);
                    return cats.map((cat: string) => (
                      <span key={cat} className="inline-block px-2 py-1 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400 font-medium">
                        {PRIMARY_CATEGORIES.find(c => c.id === cat)?.label || cat}
                      </span>
                    ));
                  })()}
                  {/* Subcategories */}
                  {(() => {
                    const oldFeature = selectedFeature as any;
                    const subcats = selectedFeature.subcategories || (oldFeature.subcategory ? [oldFeature.subcategory] : []);
                    return subcats.map((subcat: string) => (
                      <span key={subcat} className="inline-block px-2 py-1 bg-blue-900/30 border border-blue-700/50 rounded text-xs text-blue-400 font-medium">
                        {subcat}
                      </span>
                    ));
                  })()}
                </div>
                <div className="flex gap-2 flex-wrap mb-4">
                  {/* MC Versions */}
                  {(() => {
                    const oldFeature = selectedFeature as any;
                    const versions = selectedFeature.mcVersions || (oldFeature.version ? [oldFeature.version] : []);
                    return versions.map((v: string) => (
                      <span key={v} className="inline-block px-2 py-1 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-400 font-medium">
                        MC {v}
                      </span>
                    ));
                  })()}
                  {/* Mod Versions */}
                  {(() => {
                    const oldFeature = selectedFeature as any;
                    const versions = selectedFeature.modVersions || (oldFeature.modVersion ? [oldFeature.modVersion] : []);
                    return versions.map((v: string) => (
                      <span key={v} className="inline-block px-2 py-1 bg-blue-900/30 border border-blue-700/50 rounded text-xs text-blue-400 font-medium">
                        Mod {v}
                      </span>
                    ));
                  })()}
                </div>

                <div className="text-gray-300 mb-6 leading-relaxed">
                  {renderDescription(selectedFeature.description, selectedFeature.descriptionType, false, true)}
                </div>

                {selectedFeature.details && selectedFeature.details.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-white mb-3">Details</h4>
                    <ul className="space-y-2">
                      {selectedFeature.details.map((detail, index) => (
                        <li key={index} className="text-gray-400 text-sm flex items-start gap-2">
                          <span className="text-green-500 flex-shrink-0" style={{ marginTop: '0.125rem' }}>•</span>
                          <span className="flex-1">{searchTerm ? highlightText(detail, searchTerm) : detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Action Bar */}
                <div className="mt-6 pt-4 border-t border-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleLike(selectedFeature.id, e)}
                      disabled={actionLoading === `like-${selectedFeature.id}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        currentUser?.likedFeatures?.includes(selectedFeature.id)
                          ? 'bg-blue-900/40 text-blue-400 border border-blue-800/50 hover:bg-blue-900/60'
                          : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700 hover:text-white'
                      }`}
                      title={currentUser ? "Like this feature" : "Login to like this feature"}
                    >
                      <ThumbsUp size={14} className={currentUser?.likedFeatures?.includes(selectedFeature.id) ? "fill-blue-400" : ""} />
                      <span>{selectedFeature.likes || 0}</span>
                    </button>
                    
                    <button
                      onClick={(e) => handleFavorite(selectedFeature.id, e)}
                      disabled={actionLoading === `fav-${selectedFeature.id}` || !currentUser}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        !currentUser ? 'opacity-50 cursor-not-allowed bg-gray-800/50 text-gray-500' :
                        currentUser?.favoriteFeatures?.includes(selectedFeature.id)
                          ? 'bg-red-900/40 text-red-400 border border-red-800/50 hover:bg-red-900/60'
                          : 'bg-gray-800/50 text-gray-400 border border-transparent hover:bg-gray-700 hover:text-white'
                      }`}
                      title={currentUser ? (currentUser?.favoriteFeatures?.includes(selectedFeature.id) ? "Remove from favorites" : "Add to favorites") : "Login to favorite"}
                    >
                      <Heart size={14} className={currentUser?.favoriteFeatures?.includes(selectedFeature.id) ? "fill-red-400" : ""} />
                      <span className="hidden sm:inline">Favorites</span>
                    </button>
                  </div>
                  
                  <button
                    onClick={(e) => handleShare(selectedFeature.id, e)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-transparent ${
                      copiedFeature === selectedFeature.id
                        ? 'bg-green-900/40 text-green-400 border-green-800/50'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                    title="Copy link to feature"
                  >
                    <Share2 size={14} />
                    <span className="hidden sm:inline">{copiedFeature === selectedFeature.id ? "Copied!" : "Share"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


