import React, { useState } from 'react';
import { X } from 'lucide-react';

const DismissibleMintNotice = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 p-3 rounded-lg mb-4 shadow-sm relative">
      <button 
        className="absolute top-1 right-1 text-indigo-400 hover:text-indigo-600 p-1"
        onClick={() => setIsVisible(false)}
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="text-center">
        <h3 className="font-medium text-indigo-800 text-sm">Mint Justice Tokens (JST)</h3>
        <div className="mt-1">
          <p className="text-indigo-700 text-xs mb-1">Send ETH to:</p>
          <div className="inline-block bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-sm">
            <span className="font-mono text-indigo-800 text-xs tracking-wide">
              0x0DB1Fe54b3202F198863747b43C9138502e4D6D5
            </span>
          </div>
          <p className="text-indigo-600 mt-1 text-xs">1:1 ratio • Auto-remitted to sender</p>
        </div>
      </div>
    </div>
  );
};

export default DismissibleMintNotice;