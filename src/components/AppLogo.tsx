import React from 'react';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
}) => {
  const pixelSizes = {
    xs: 18,
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const px = pixelSizes[size] || 32;

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Precision Vector Logo Icon */}
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm transition-transform hover:scale-105"
      >
        <defs>
          <linearGradient id={`logoBg_${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>

          <linearGradient id={`logoCorner_${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </linearGradient>

          <linearGradient id={`boltGrad_${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        {/* Squircle / Sticky Note Shape with peeled corner */}
        <path
          d="M 10 6 
             L 54 6 
             A 6 6 0 0 1 60 12 
             L 60 46 
             L 46 60 
             L 10 60 
             A 6 6 0 0 1 4 54 
             L 4 12 
             A 6 6 0 0 1 10 6 Z"
          fill={`url(#logoBg_${size})`}
          stroke="#fef9c3"
          strokeWidth="1.5"
        />

        {/* Peeled Corner Triangle with depth */}
        <path
          d="M 46 60 L 46 48 A 2 2 0 0 1 48 46 L 60 46 Z"
          fill={`url(#logoCorner_${size})`}
        />
        <path
          d="M 46 60 L 46 48 A 2 2 0 0 1 48 46 L 60 46 Z"
          fill="#fef08a"
          opacity="0.3"
        />

        {/* Stylized Desktop PC monitor mini icon on left */}
        <rect x="12" y="18" width="16" height="11" rx="1.5" fill="#1c1917" />
        <rect x="14" y="20" width="12" height="7" rx="0.5" fill="#292524" />
        <line x1="16" y1="23" x2="23" y2="23" stroke="#fef08a" strokeWidth="1" strokeLinecap="round" />
        <path d="M 18 29 L 17 32 L 23 32 L 22 29 Z" fill="#44403c" />

        {/* Stylized Mobile Phone mini icon on right */}
        <rect x="38" y="20" width="10" height="16" rx="2.5" fill="#1c1917" />
        <rect x="39.5" y="22" width="7" height="12" rx="1" fill="#292524" />
        <circle cx="43" cy="21" r="0.5" fill="#78716c" />
        <line x1="41" y1="25" x2="45" y2="25" stroke="#38bdf8" strokeWidth="0.8" strokeLinecap="round" />

        {/* Electric Lightning Sync Bolt connecting both devices */}
        <path
          d="M 33 13 L 23 27 L 30 27 L 22 41 L 39 23 L 31 23 Z"
          fill={`url(#boltGrad_${size})`}
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M 32 16 L 25 26 L 29 26 L 24 37 L 36 24 L 31 24 Z"
          fill="#38bdf8"
        />
      </svg>

      {showText && (
        <span className="font-bold tracking-tight text-neutral-100 flex items-center">
          <span>Clip</span>
          <span className="text-amber-400">Sync</span>
        </span>
      )}
    </div>
  );
};
