import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { Clock, Shield, Check, Copy, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// Export these utility functions so they can be imported by other components
export function getThreatLevelLabel(level) {
  const threatLevelLabels = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH", 
    3: "CRITICAL"
  };
  
  return threatLevelLabels[level] || "Unknown";
}

export function getThreatLevelColor(level) {
  switch (Number(level)) {
    case 0: // LOW
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 1: // MEDIUM
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 2: // HIGH
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 3: // CRITICAL
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function formatTimeRemaining(etaTimestamp) {
  if (!etaTimestamp) return null;
  
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const timeRemaining = etaTimestamp - now;
  
  if (timeRemaining <= 0) return "Ready to execute";
  
  const days = Math.floor(timeRemaining / 86400);
  const hours = Math.floor((timeRemaining % 86400) / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
}

// FIXED VERSION with better memory management and reliability
const TimelockInfoDisplay = ({ 
  proposal, 
  contracts, 
  timelockInfo, 
  setTimelockInfo, 
  copiedText, 
  setCopiedText 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  
  // Cache key generation - simplified and stable
  const cacheKey = useMemo(() => {
    return `timelock-${proposal?.id || 0}`;
  }, [proposal?.id]);

  // Determine if this is a queued proposal - more robust check
  const isQueuedProposal = useMemo(() => {
    if (!proposal) return false;
    
    // Multiple ways to check for queued status
    const isStateQueued = proposal.stateLabel?.toLowerCase() === 'queued';
    const hasTimelockDisplay = proposal.displayStateLabel?.toLowerCase()?.includes('timelock');
    const hasTimelockTxHash = !!proposal.timelockTxHash && 
      proposal.timelockTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    return isStateQueued || hasTimelockDisplay || hasTimelockTxHash;
  }, [proposal]);

  // Copy function with useCallback to prevent recreation
  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  }, [setCopiedText]);

  // FIXED: More efficient fetch timelock data with better error handling
  const fetchTimelockData = useCallback(async () => {
    // Skip if conditions aren't met
    if (!contracts?.timelock || !proposal?.id || !isQueuedProposal) {
      return;
    }
  
    // Prevent multiple simultaneous fetches and rate limiting
    const now = Date.now();
    if (isLoading || (now - lastFetchTime < 5000 && retryCount === 0)) {
      return;
    }
  
    setIsLoading(true);
    setError(null);
    setLastFetchTime(now);
  
    try {
      // First check if we already have cached data that's fresh enough
      const cachedInfo = timelockInfo[proposal.id];
      if (cachedInfo?.lastUpdated && 
          now - cachedInfo.lastUpdated < 20000 && // Reduced cache time to 20 seconds
          retryCount === 0) {
        // Use cached data
        console.log(`Using cached timelock data for proposal #${proposal.id}`);
        setIsLoading(false);
        return;
      }
  
      // Rest of the function...
      // [Keep existing implementation]
      
    } catch (error) {
      console.error("Error fetching timelock information:", error);
      setError("Failed to fetch timelock data");
    } finally {
      setIsLoading(false);
    }
  }, [
    contracts?.timelock, 
    proposal?.id,
    proposal?.target,
    proposal?.timelockTxHash, 
    proposal?.timelockThreatLevel,
    isQueuedProposal,
    isLoading,
    lastFetchTime,
    retryCount,
    timelockInfo,
    setTimelockInfo,
    contracts?.governance
  ]);

  // Get cached timelock info with stability
  const info = useMemo(() => {
    if (!isQueuedProposal || !proposal?.id) return null;
    return timelockInfo[proposal.id] || null;
  }, [isQueuedProposal, timelockInfo, proposal?.id]);

  // Memoized ready state to prevent re-renders due to time changes
  const isReadyToExecute = useMemo(() => {
    if (!info?.eta) return false;
    return Math.floor(Date.now() / 1000) >= info.eta;
  }, [info?.eta]);

  // FIXED: Better fetch scheduling with proper cleanup
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    
    // Debounced fetch with single timeout
    const debouncedFetch = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (isMounted && isQueuedProposal) {
          fetchTimelockData();
        }
      }, retryCount > 0 ? 100 : 300); // Slightly faster initial load
    };
    
    if (isQueuedProposal && proposal?.id) {
      debouncedFetch();
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchTimelockData, retryCount, isQueuedProposal, proposal?.id]);

  // Render nothing if not a queued proposal
  if (!isQueuedProposal) {
    return null;
  }

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h5 className="font-medium text-gray-700 dark:text-gray-300">Timelock Information</h5>
        
      </div>
      
      <div className="p-4 space-y-3 dark:bg-gray-800">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-2 rounded-md text-sm flex items-center mb-3">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}
      
        <div className="flex flex-wrap md:flex-nowrap gap-4">
          <div className="min-w-[200px]">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Threat Level</p>
            <span 
              className={`inline-block text-xs px-2 py-1 rounded ${
                getThreatLevelColor(info?.level || 0)
              }`}
            >
              {info?.label || "Unknown"}
            </span>
          </div>
          
          <div className="min-w-[200px]">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
            <span className={`inline-block text-xs px-2 py-1 rounded flex items-center ${
              !info?.eta ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' :
              isReadyToExecute ? 
                'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}>
              {!info?.eta ? 'Unknown' :
               isReadyToExecute ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Ready to Execute
                </>
               ) : (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTimeRemaining(info.eta)}
                </>
               )}
            </span>
          </div>
        </div>
        
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Executable After</p>
          <p className="text-sm font-medium dark:text-gray-300">
            {info?.eta 
              ? new Date(info.eta * 1000).toLocaleString() 
              : "Unknown"}
          </p>
        </div>
        
        {(info?.txHash || proposal?.timelockTxHash) && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transaction Hash</p>
            <div className="flex items-center">
              <span className="text-sm font-mono truncate dark:text-gray-300">
                {(info?.txHash || proposal?.timelockTxHash).substring(0, 10) + '...' + 
                 (info?.txHash || proposal?.timelockTxHash).substring((info?.txHash || proposal?.timelockTxHash).length - 8)}
              </span>
              <button 
                onClick={() => copyToClipboard(info?.txHash || proposal?.timelockTxHash)} 
                className="ml-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {copiedText === (info?.txHash || proposal?.timelockTxHash) 
                  ? <Check className="w-4 h-4 text-green-500 dark:text-green-400" /> 
                  : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TimelockInfoDisplay);