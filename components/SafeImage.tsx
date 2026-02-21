import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackIcon?: React.ReactNode;
  maxSize?: 'sm' | 'md' | 'lg' | 'full';
}

/**
 * A robust image component that handles lazy loading, caching hints,
 * and error states. Designed to work with the Buildscape Media Infrastructure.
 */
export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  alt, 
  className, 
  fallbackIcon,
  maxSize = 'md',
  ...props 
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Reset state if src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 border border-gray-800 rounded-lg text-gray-600 ${className}`}>
        {fallbackIcon || <AlertCircle size={maxSize === 'sm' ? 16 : 24} />}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gray-900/50 rounded-lg ${className}`}>
      {/* Loading Shimmer / Icon */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
          <ImageIcon size={maxSize === 'sm' ? 16 : 24} className="text-gray-700" />
        </div>
      )}

      <img
        src={src}
        alt={alt || 'Media content'}
        className={`
          w-full h-full object-cover transition-opacity duration-500
          ${loaded ? 'opacity-100' : 'opacity-0'}
        `}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        {...props}
      />
    </div>
  );
};
