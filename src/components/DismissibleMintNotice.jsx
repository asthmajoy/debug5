import React, { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
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
              address: "0xdbEbf634B4Ba8b8ba8DB670ef666dee3C69d0E39",
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
    <div className="relative bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 flex items-center justify-between space-x-5">
        <div className="flex-grow">
          <div className="flex items-center space-x-2 mb-1">
            <Zap className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <h3 className="font-semibold text-sm text-indigo-800 dark:text-indigo-200">
              Mint Justice Tokens (JST)
            </h3>
          </div>
          <div className="text-xs text-indigo-600 dark:text-indigo-300 space-y-1">
            <p>Donate ETH for 1:1 token conversion</p>
            <div className="bg-white/70 dark:bg-gray-800/50 border border-indigo-100 dark:border-indigo-800/50 rounded-lg px-2 py-1 inline-flex items-center space-x-2">
              <span className="font-mono text-indigo-700 dark:text-indigo-300 text-xs truncate max-w-[200px]">
                0xdbEbf634B4Ba8b8ba8DB670ef666dee3C69d0E39
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col space-y-2">
          <button 
            onClick={addTokenToWallet}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md 
            bg-indigo-100 text-indigo-700 hover:bg-indigo-200 
            dark:bg-indigo-800/30 dark:text-indigo-300 dark:hover:bg-indigo-800/50 
            transition-colors duration-200"
          >
            <Zap className="h-3 w-3 mr-1.5" />
            Add JST
          </button>
        </div>

        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-600 
          dark:text-indigo-500 dark:hover:text-indigo-300 
          p-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-800/50 
          transition-colors duration-200"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DismissibleMintNotice;