import React from "react";
import { Hammer, ExternalLink, LogOut, LayoutDashboard, LogIn, UserPlus, User as UserIcon, Lightbulb, Home, Bug, MessageCircle, FileText, BookOpen, Gift } from "lucide-react";
import { User, AppConfigLinks, IconConfig } from "../types";

interface NavbarProps {
  onNavigate: (view: 'home' | 'report' | 'admin' | 'login' | 'register' | 'suggestions' | 'suggestion-form' | 'profile' | 'changelog' | 'wiki' | 'redeem') => void;
  currentUser: User | null;
  onLogout: () => void;
  links: AppConfigLinks;
  navbarIcon?: IconConfig;
}

export default function Navbar({ onNavigate, currentUser, onLogout, links, navbarIcon }: NavbarProps) {
  return (
    <nav className="bg-[#1a1a1a]/90 border-b border-gray-800 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 min-w-0">
          <div className="flex items-center min-w-0 flex-1">
            <div 
              className="flex-shrink-0 text-minecraft-accent font-bold text-xl flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => onNavigate('home')}
            >
              {navbarIcon?.icon ? (
                <img 
                  src={navbarIcon.icon}
                  alt="Website Icon"
                  style={{
                    width: `${navbarIcon.size || 40}px`,
                    height: `${navbarIcon.size || 40}px`,
                    borderRadius: `${navbarIcon.borderRadius || 8}px`,
                    backgroundColor: navbarIcon.backgroundColor === 'transparent' ? 'transparent' : navbarIcon.backgroundColor || 'transparent',
                    opacity: navbarIcon.backgroundOpacity || 1,
                    padding: `${navbarIcon.padding || 0}px`,
                    border: `${navbarIcon.borderWidth || 0}px solid ${navbarIcon.borderColor === 'transparent' ? 'transparent' : navbarIcon.borderColor || 'transparent'}`,
                    objectFit: 'contain'
                  }}
                  className="shadow-lg"
                />
              ) : (
                <div className="bg-gradient-to-br from-[#00FFFF] to-[#00fbff]/60 p-1.5 rounded-lg text-black shadow-lg shadow-[#00FFFF]/20">
                  <Hammer size={20} />
                </div>
              )}
              <span className="tracking-tight text-white hidden sm:inline">Buildscape Tracker</span>
            </div>
            <div className="flex items-center ml-4 sm:ml-10 min-w-0 flex-shrink">
              <div className="flex items-center space-x-1 overflow-x-auto">
                
                <button 
                  onClick={() => onNavigate('home')} 
                  className="text-gray-300 hover:bg-gray-800 hover:text-white px-2 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                  title="Home"
                >
                  <Home size={16} />
                  <span className="hidden xl:inline">Home</span>
                </button>
                
                <button 
                  onClick={() => onNavigate('wiki')} 
                  className="text-gray-300 hover:bg-gray-800 hover:text-white px-2 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                  title="Wiki"
                >
                  <BookOpen size={16} />
                  <span className="hidden xl:inline">Wiki</span>
                </button>
                
                <button 
                  onClick={() => onNavigate('suggestions')} 
                  className="text-gray-300 hover:bg-gray-800 hover:text-white px-2 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                  title="Suggestions"
                >
                  <Lightbulb size={16} />
                  <span className="hidden xl:inline">Suggestions</span>
                </button>
                
                <button 
                  onClick={() => onNavigate('changelog')} 
                  className="text-gray-300 hover:bg-gray-800 hover:text-white px-2 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                  title="Changelog"
                >
                  <FileText size={16} />
                  <span className="hidden xl:inline">Changelog</span>
                </button>
                
                <button 
                  onClick={() => onNavigate('redeem')} 
                  className="text-gray-300 hover:bg-gray-800 hover:text-white px-2 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                  title="Redeem Code"
                >
                  <Gift size={16} />
                  <span className="hidden xl:inline">Redeem</span>
                </button>
                
                <a 
                  href={links.discord || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-300 hover:bg-gray-800 hover:text-white px-2 py-2 rounded-md text-sm font-medium flex items-center gap-1 transition-colors flex-shrink-0"
                  title="Discord"
                >
                  <i className="fa-brands fa-discord text-base"></i>
                  <span className="hidden xl:inline">Discord</span>
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-2">
            <div className="flex items-center">
               {currentUser ? (
                 <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => onNavigate('profile')}
                        className="flex items-center gap-1.5 sm:gap-2 text-sm text-gray-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                        title={`View Profile - ${currentUser.username}`}
                    >
                        {currentUser.profileIcon && currentUser.profileIcon.trim() ? (
                          <img 
                            src={currentUser.profileIcon} 
                            alt={currentUser.username}
                            className="w-5 h-5 rounded-full object-cover border border-gray-600 flex-shrink-0"
                            onError={(e) => {

                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const icon = parent.querySelector('.fallback-icon') as HTMLElement;
                                if (icon) icon.style.display = 'block';
                              }
                            }}
                          />
                        ) : null}
                        <UserIcon 
                          size={14} 
                          className={`text-gray-500 flex-shrink-0 ${currentUser.profileIcon && currentUser.profileIcon.trim() ? 'hidden fallback-icon' : ''}`}
                        />
                        <span className="font-medium hidden md:inline truncate max-w-[100px]">{currentUser.username}</span>
                    </button>

                    <div className="h-4 w-px bg-gray-700 hidden xl:block flex-shrink-0"></div>

                    {(currentUser.role === 'admin' || currentUser.role === 'owner') && (
                        <button 
                            onClick={() => onNavigate('admin')}
                            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded text-xs font-semibold bg-purple-900/30 border border-purple-800 text-purple-300 hover:bg-purple-900/50 transition-all flex-shrink-0"
                            title="Admin Panel"
                        >
                            <LayoutDashboard size={14} className="sm:w-3 sm:h-3" />
                            <span className="hidden xl:inline">Admin Panel</span>
                        </button>
                    )}
                    <button 
                        onClick={onLogout}
                        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
                        title="Logout"
                    >
                        <LogOut size={16} />
                    </button>
                 </div>
               ) : (
                <div className="flex gap-2">
                    <button 
                        onClick={() => onNavigate('login')}
                        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-all flex-shrink-0"
                        title="Sign In"
                    >
                        <LogIn size={14} className="sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">Sign In</span>
                    </button>
                    <button 
                        onClick={() => onNavigate('register')}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#00FFFF]/10 border border-[#00FFFF]/30 text-[#00FFFF] hover:bg-[#00FFFF]/20 hover:text-[#00fbff] transition-all flex-shrink-0"
                        title="Sign Up"
                    >
                        <UserPlus size={12} />
                        Sign Up
                    </button>
                </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}