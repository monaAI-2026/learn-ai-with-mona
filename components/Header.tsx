import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Header: React.FC<{ transparent?: boolean; back?: boolean }> = ({ transparent = false, back = false }) => {
  const navigate = useNavigate();

  return (
    <header className={transparent ? '' : 'bg-white border-b border-warm-200'}>
      <div className="container mx-auto px-3 lg:px-4 py-0 flex items-center justify-between h-14 max-w-[95vw] 2xl:max-w-[1800px]">
        {back ? (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-warm-100 transition-colors text-warm-700 opacity-60"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div
            className="flex items-center space-x-2.5 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <circle cx="12" cy="12" r="12" fill="#1C1B1F" />
              <path d="M12 4.5 C12.7 9.3 14.7 11.3 19.5 12 C14.7 12.7 12.7 14.7 12 19.5 C11.3 14.7 9.3 12.7 4.5 12 C9.3 11.3 11.3 9.3 12 4.5Z" fill="white" />
            </svg>
            <span className="text-warm-800 font-medium text-sm group-hover:text-warm-900 transition-colors">
              Learn AI with Mona
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
