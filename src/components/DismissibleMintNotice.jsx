import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';

const DismissibleMintNotice = () => {
  const { isConnected, account } = useWeb3();
  const [isVisible, setIsVisible] = useState(true);
  
  // Reset visibility when wallet address changes
  useEffect(() => {
    if (isConnected && account) {
      // Create a storage key that's unique to this wallet address
      const storageKey = `mintNoticeDismissed-${account}`;
      const isDismissed = localStorage.getItem(storageKey) === 'true';
      
      // Set visibility based on whether this specific account has dismissed it
      setIsVisible(!isDismissed);
      
      // Clean up function to reset when wallet changes
      return () => {
        // This will run when the account changes or component unmounts
        setIsVisible(true);
      };
    } else {
      // If wallet is disconnected, reset to visible
      setIsVisible(true);
    }
  }, [isConnected, account]);

  const handleDismiss = () => {
    if (isConnected && account) {
      // Use wallet-specific storage key
      const storageKey = `mintNoticeDismissed-${account}`;
      localStorage.setItem(storageKey, 'true');
    }
    setIsVisible(false);
  };

  // Don't show if dismissed
  if (!isVisible) return null;
  
  // Don't show if wallet not connected
  if (!isConnected) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/40 border border-indigo-200 dark:border-indigo-800 p-3 rounded-lg mb-4 shadow-sm dark:shadow-indigo-900/20 relative">
      <button 
        className="absolute top-1 right-1 text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200 p-1"
        onClick={handleDismiss}
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="text-center">
        <h3 className="font-medium text-indigo-800 dark:text-indigo-300 text-sm">Mint Justice Tokens (JST)</h3>
        <div className="mt-1">
          <p className="text-indigo-700 dark:text-indigo-400 text-xs mb-1">Send ETH to:</p>
          <div className="inline-block bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-700 shadow-sm">
            <span className="font-mono text-indigo-800 dark:text-indigo-300 text-xs tracking-wide">
              0x0DB1Fe54b3202F198863747b43C9138502e4D6D5
            </span>
          </div>
          <p className="text-indigo-600 dark:text-indigo-400 mt-1 text-xs">1:1 ratio • Auto-remitted to sender</p>
        </div>
      </div>
    </div>
  );
};

export default DismissibleMintNotice;