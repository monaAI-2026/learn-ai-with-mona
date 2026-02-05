import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-warm-200/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between max-w-[95vw] 2xl:max-w-[1800px]">
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => navigate('/')}
        >
        {/* Logo Icon */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
          {/* Blue circular background */}
          <circle cx="14" cy="14" r="14" fill="#4285F4" />
          {/* White solid triangle */}
          <path d="M14 7.5 L20.5 19 L7.5 19 Z" fill="white" />
        </svg>
        <span className="text-warm-700 font-medium text-sm tracking-wide group-hover:text-warm-800 transition-colors">
          Learn AI with Mona
        </span>
      </div>

        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 rounded-full bg-accent-light border border-accent-muted/30 flex items-center justify-center text-xs font-bold text-accent cursor-pointer hover:bg-accent-muted/20 transition-colors">
            M
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
