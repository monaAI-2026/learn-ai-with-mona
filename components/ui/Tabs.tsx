import React from 'react';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeKey, onChange }) => {
  return (
    <div className="flex items-center gap-1 border-b border-warm-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3 py-3.5 text-[13px] transition-all duration-150 border-b-2 -mb-px ${
            activeKey === tab.key
              ? 'font-medium text-warm-900 border-warm-900'
              : 'font-normal text-warm-500 border-transparent hover:text-warm-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
