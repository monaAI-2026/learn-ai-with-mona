import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="border-b border-gray-100 py-4 px-6 flex items-center justify-between bg-white sticky top-0 z-50">
      <div 
        className="flex items-center space-x-3 cursor-pointer"
        onClick={() => navigate('/')}
      >
        <div className="w-[3px] h-4 bg-[#D14F2A]" />
        <span className="text-[#8B8476] font-sf-mono text-sm tracking-wide">Learn AI with Mona</span>
      </div>
      
      <div className="flex items-center space-x-6">
        <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-300 transition-colors">
          ML
        </div>
      </div>
    </header>
  );
};

export default Header;