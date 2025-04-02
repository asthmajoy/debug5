import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useWeb3 } from '../contexts/Web3Context';

const DismissibleMintNotice = () => {
  const { isConnected, account } = useWeb3();
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (isConnected && account) {
      const storageKey = `mintNoticeDismissed-${account}`;
      setIsVisible(localStorage.getItem(storageKey) !== 'true');
      return () => setIsVisible(true);
    } else {
      setIsVisible(true);
    }
  }, [isConnected, account]);

  const handleDismiss = () => {
    if (isConnected && account) {
      localStorage.setItem(`mintNoticeDismissed-${account}`, 'true');
    }
    setIsVisible(false);
  };

  const addTokenToWallet = async () => {
    try {
      if (window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: "0xE4237735e7fCA96a01BF4a81D438D42b1D96E751",
              symbol: "JST",
              decimals: 18,
              name: "Justice Token"
            }
          }
        });
      }
    } catch (error) {
      console.error("Error adding token to wallet:", error);
    }
  };

  if (!isVisible || !isConnected) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/40 border border-indigo-200 dark:border-indigo-800 p-3 rounded-lg mb-4 shadow-sm relative">
      <button 
        className="absolute top-1 right-1 text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 p-1"
        onClick={handleDismiss}
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="text-center">
        <h3 className="font-medium text-indigo-800 dark:text-indigo-300 text-sm">Mint Justice Tokens (JST)</h3>
        <div className="mt-1">
          <p className="text-indigo-700 dark:text-indigo-400 text-xs mb-1">Donate ETH at:</p>
          <div className="inline-block bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <span className="font-mono text-indigo-800 dark:text-indigo-300 text-xs">
            0xE4237735e7fCA96a01BF4a81D438D42b1D96E751
            </span>
          </div>
          <div className="flex items-center justify-center mt-2 space-x-2">
            <p className="text-indigo-600 dark:text-indigo-400 text-xs">1:1 ratio • Auto-remitted</p>
            <button 
              onClick={addTokenToWallet}
              className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-800/50 dark:text-indigo-300"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add JST to wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DismissibleMintNotice;