import React, { useMemo } from "react";
import { ArrowRight, Download, Lightbulb } from "lucide-react";
import { AppConfigHero, AppConfigLinks } from "../types";

interface HeroProps {
  onReportClick: () => void;
  onSuggestionsClick?: () => void;
  config: AppConfigHero;
  links: AppConfigLinks;
}

export default function Hero({ onReportClick, onSuggestionsClick, config, links }: HeroProps) {

  const headlineStyle = useMemo(() => {
    const hasColor = config.headlineColor && config.headlineColor.trim();
    const isGradient = hasColor && (config.headlineColor.includes('gradient') || config.headlineColor.includes('linear-gradient'));
    
    const bgValue = hasColor 
      ? (isGradient 
          ? config.headlineColor 
          : `linear-gradient(to right, ${config.headlineColor}, ${config.headlineColor})`)
      : 'linear-gradient(to right, #00FFFF, #00fbff)';
    
    return {
      backgroundImage: bgValue,
      backgroundRepeat: 'no-repeat' as const,
      backgroundSize: '100%',
      backgroundPosition: '0 0',
      WebkitBackgroundClip: 'text' as const,
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text' as const,
      color: 'transparent',
      display: 'inline-block',
      width: 'fit-content',
      maxWidth: '100%',
      lineHeight: '1.2',
      position: 'relative' as const,
      zIndex: 1
    };
  }, [config.headlineColor]);

  const glowBoxStyle = useMemo(() => {
    const glowColor = config.headlineGlowColor || '#00fbff';
    const rgbMatch = glowColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    const hexMatch = glowColor.match(/#([0-9a-fA-F]{6})/);
    
    let glowRgb = '0, 251, 255';
    if (rgbMatch) {
      glowRgb = `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`;
    } else if (hexMatch) {
      const hex = hexMatch[1];
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      glowRgb = `${r}, ${g}, ${b}`;
    }
    
    return {
      '--glow-color': `rgba(${glowRgb}, 0.8)`,
      '--glow-color-light': `rgba(${glowRgb}, 0.6)`,
      '--glow-color-dark': `rgba(${glowRgb}, 0.4)`,
      '--glow-bg': `rgba(${glowRgb}, 0.2)`,
      '--glow-bg-light': `rgba(${glowRgb}, 0.3)`,
    } as React.CSSProperties & { 
      '--glow-color': string; 
      '--glow-color-light': string; 
      '--glow-color-dark': string;
      '--glow-bg': string;
      '--glow-bg-light': string;
    };
  }, [config.headlineGlowColor]);

  return (
    <div className="relative overflow-hidden bg-[#121212] py-16 sm:py-24 border-b border-gray-800">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl">
          <div className="relative inline-block">
            <span 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-transparent rounded-lg px-4 py-2 headline-glow-box"
              style={glowBoxStyle}
            />
            <span 
              className="relative gradient-text text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-2 drop-shadow-sm pb-2 inline-block px-4 py-2"
              style={headlineStyle}
            >
              {config.headline}
            </span>
          </div>
          <span className="block text-2xl sm:text-3xl mt-2 text-gray-400 font-medium tracking-tight">
            {config.subheadline}
          </span>
        </h1>
        <p className="mt-6 max-w-md mx-auto text-base text-gray-400 sm:text-lg md:mt-8 md:text-xl md:max-w-4xl leading-relaxed">
          {config.description}
        </p>
        <div className="mt-8 max-w-md mx-auto sm:flex sm:justify-center md:mt-10 gap-4">
              <button 
                onClick={onReportClick}
                className="w-full sm:w-auto px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-900/20 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 group btn-shine"
              >
                <ArrowRight className="group-hover:rotate-12 transition-transform" />
                Report a Bug
              </button>
              {onSuggestionsClick && (
              <button 
                onClick={onSuggestionsClick}
                className="w-full sm:w-auto px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-lg border border-gray-700 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 group"
              >
                <Lightbulb className="text-green-500 group-hover:scale-110 transition-transform" />
                Suggestions
              </button>
              )}
          <div className="mt-3 rounded-md shadow sm:mt-0">
            <a 
              href={`${links.curseforge}/files`}
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full flex items-center justify-center px-8 py-3 border border-gray-700 text-base font-medium rounded-lg text-gray-300 bg-[#1e1e1e] hover:bg-gray-800 md:py-4 md:text-lg md:px-10 transition-all hover:border-gray-500 h-[48px] md:h-[56px] whitespace-nowrap"
            >
              <Download className="mr-2 h-5 w-5 flex-shrink-0" />
              <span className="text-center">Download Mod</span>
            </a>
          </div>
        </div>
        
        <div className="mt-12 flex justify-center space-x-8 text-gray-500 text-sm font-mono">
          <div className="flex items-center">
            <span className="w-2 h-2 bg-[#00FFFF] rounded-full mr-2 shadow-[0_0_8px_rgba(0,255,255,0.6)] animate-pulse"></span>
            Latest: {config.latestModVersion}
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-[#00fbff] rounded-full mr-2 shadow-[0_0_8px_rgba(0,251,255,0.6)] animate-pulse"></span>
            MC: {config.latestMcVersions}
          </div>
        </div>
      </div>
    </div>
  );
}