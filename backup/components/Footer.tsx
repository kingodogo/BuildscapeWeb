import React, { useState } from "react";
import { Hammer, X, Twitter, Github, Globe, Mail, ExternalLink, Youtube, Twitch, Instagram, Linkedin, Facebook } from "lucide-react";
import { AppConfigLinks, SocialHandles, IconConfig } from "../types";

interface FooterProps {
  links: AppConfigLinks;
  socialHandles?: SocialHandles;
  footerIcon?: IconConfig;
}

export default function Footer({ links, socialHandles, footerIcon }: FooterProps) {
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<'author' | 'leadDev' | null>(null);

  const getSocialLinks = (person: 'author' | 'leadDev') => {
    if (!socialHandles) return null;
    return person === 'author' ? socialHandles.authorLinks : socialHandles.leadDevLinks;
  };

  const getPersonName = (person: 'author' | 'leadDev') => {
    if (!socialHandles) return person === 'author' ? 'DGA' : 'kingodogo';
    return person === 'author' ? (socialHandles.author || 'DGA') : (socialHandles.leadDev || 'kingodogo');
  };

  const handlePersonClick = (person: 'author' | 'leadDev') => {
    setSelectedPerson(person);
    setShowSocialModal(true);
  };

  const getIconForLink = (key: string) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('twitter') || lowerKey.includes('x.com')) return <Twitter size={18} />;
    if (lowerKey.includes('github')) return <Github size={18} />;
    if (lowerKey.includes('youtube')) return <Youtube size={18} />;
    if (lowerKey.includes('twitch')) return <Twitch size={18} />;
    if (lowerKey.includes('instagram')) return <Instagram size={18} />;
    if (lowerKey.includes('linkedin')) return <Linkedin size={18} />;
    if (lowerKey.includes('facebook')) return <Facebook size={18} />;
    if (lowerKey.includes('email') || lowerKey.includes('mail')) return <Mail size={18} />;
    return <Globe size={18} />;
  };

  const formatLinkLabel = (key: string) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('twitter') || lowerKey.includes('x.com')) return 'Twitter/X';
    if (lowerKey.includes('github')) return 'GitHub';
    if (lowerKey.includes('youtube')) return 'YouTube';
    if (lowerKey.includes('twitch')) return 'Twitch';
    if (lowerKey.includes('instagram')) return 'Instagram';
    if (lowerKey.includes('linkedin')) return 'LinkedIn';
    if (lowerKey.includes('facebook')) return 'Facebook';
    if (lowerKey.includes('email') || lowerKey.includes('mail')) return 'Email';
    if (lowerKey.includes('website')) return 'Website';
    return key.charAt(0).toUpperCase() + key.slice(1);
  };

  return (
    <>
      <footer className="bg-[#121212] border-t border-gray-800 py-6 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3 text-center md:text-left">
          {footerIcon?.icon ? (
            <img 
              src={footerIcon.icon}
              alt="Website Icon"
              style={{
                width: `${footerIcon.size || 40}px`,
                height: `${footerIcon.size || 40}px`,
                borderRadius: `${footerIcon.borderRadius || 8}px`,
                backgroundColor: footerIcon.backgroundColor === 'transparent' ? 'transparent' : footerIcon.backgroundColor || 'transparent',
                opacity: footerIcon.backgroundOpacity || 1,
                padding: `${footerIcon.padding || 0}px`,
                border: `${footerIcon.borderWidth || 0}px solid ${footerIcon.borderColor === 'transparent' ? 'transparent' : footerIcon.borderColor || 'transparent'}`,
                objectFit: 'contain'
              }}
              className="shadow-lg"
            />
          ) : (
            <div className="bg-gradient-to-br from-minecraft-grass to-green-800 p-1.5 rounded-lg text-white shadow-lg">
              <Hammer size={20} />
            </div>
          )}
          <div>
          <h3 className="text-white font-bold text-lg mb-1 flex items-center justify-center md:justify-start gap-2">
            Buildscape
          </h3>
          <p className="text-gray-500 text-sm">
              <button 
                onClick={() => handlePersonClick('author')}
                className="hover:text-gray-300 transition-colors cursor-pointer"
              >
                Author: <span className="text-gray-300">{getPersonName('author')}</span>
              </button>
              {' '}&bull;{' '}
              <button 
                onClick={() => handlePersonClick('leadDev')}
                className="hover:text-gray-300 transition-colors cursor-pointer"
              >
                Lead Dev: <span className="text-gray-300">{getPersonName('leadDev')}</span>
              </button>
          </p>
          </div>
        </div>
        
        <div className="flex gap-8 text-sm text-gray-400">
          <a href={links.curseforge} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CurseForge</a>
          <a href={links.modrinth} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Modrinth</a>
          <a href={links.discord} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
          <a href={links.source} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Source Code</a>
        </div>
        
        <div className="text-gray-600 text-xs">
            &copy; 2025 Buildscape Team.
          </div>
        </div>
      </footer>

      
      {showSocialModal && selectedPerson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowSocialModal(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSocialModal(false)}></div>
          <div 
            className="relative bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">
                {selectedPerson === 'author' ? getPersonName('author') : getPersonName('leadDev')}
              </h3>
              <button 
                onClick={() => setShowSocialModal(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {getSocialLinks(selectedPerson) ? (
                Object.entries(getSocialLinks(selectedPerson) || {}).map(([key, url]) => {
                  if (!url) return null;
                  const isEmail = key.toLowerCase().includes('email') || key.toLowerCase().includes('mail');
                  const href = isEmail ? `mailto:${url}` : url;
                  return (
                    <a
                      key={key}
                      href={href}
                      target={isEmail ? undefined : "_blank"}
                      rel={isEmail ? undefined : "noopener noreferrer"}
                      className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg hover:bg-[#252525] transition-colors text-gray-300 hover:text-white"
                    >
                      {getIconForLink(key)}
                      <span className="flex-1">{formatLinkLabel(key)}</span>
                      <ExternalLink size={14} className="text-gray-500" />
                    </a>
                  );
                }).filter(Boolean)
              ) : (
                <p className="text-gray-500 text-sm">No social links configured.</p>
              )}
            </div>
        </div>
      </div>
      )}
    </>
  );
}
