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

// IMPROVED VERSION with better memoization and fewer re-renders
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
  
  // Cache key generation
  const cacheKey = useMemo(() => {
    return `timelock-${proposal?.id}-${proposal?.timelockTxHash || "notx"}`;
  }, [proposal?.id, proposal?.timelockTxHash]);

  // Determine if this is a queued proposal - important for preventing unnecessary renders
  const isQueuedProposal = useMemo(() => {
    return proposal && 
           (proposal.stateLabel?.toLowerCase() === 'queued' || 
            proposal.displayStateLabel?.toLowerCase()?.includes('timelock'));
  }, [proposal?.stateLabel, proposal?.displayStateLabel]);

  // Copy function with useCallback to prevent recreation
  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  }, [setCopiedText]);

  // Important: More efficient fetch timelock data with debouncing and caching
  const fetchTimelockData = useCallback(async () => {
    // Skip if conditions aren't met
    if (!contracts.timelock || !proposal || !isQueuedProposal) {
      return;
    }

    // Only fetch if not already loading and enough time has passed since last fetch
    const now = Date.now();
    if (isLoading || (now - lastFetchTime < 10000 && retryCount === 0)) { // 10s instead of 5s
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastFetchTime(now);

    try {
      // First check if we already have cached data that's fresh enough
      if (timelockInfo[proposal.id]?.lastUpdated && 
          now - timelockInfo[proposal.id].lastUpdated < 30000 && // 30 second cache
          retryCount === 0) {
        // Use cached data
        console.log(`Using cached timelock data for proposal #${proposal.id}`);
        setIsLoading(false);
        return;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const timelockContract = contracts.timelock.connect(provider);
      
      // Attempt to get transaction directly using a known txHash
      let txDetails = null;
      let etaTimestamp = null;
      let txHash = null;
      
      // Preserve existing threat level if possible to maintain consistency
      // This is key to preventing the flicker between threat levels
      let threatLevel = timelockInfo[proposal.id]?.level ?? 0;
      
      // Attempt 1: Use the proposal's stored timelockTxHash
      if (proposal.timelockTxHash && proposal.timelockTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        try {
          txDetails = await timelockContract.getTransaction(proposal.timelockTxHash);
          if (txDetails && txDetails.eta) {
            etaTimestamp = Number(txDetails.eta);
            txHash = proposal.timelockTxHash;
            
            // Keep the existing threat level for consistency
            if (proposal.timelockThreatLevel !== undefined) {
              threatLevel = Number(proposal.timelockThreatLevel);
            }
            
            console.log(`Found timelock details via direct lookup for proposal #${proposal.id} - eta: ${etaTimestamp}, threatLevel: ${threatLevel}`);
          }
        } catch (err) {
          console.warn(`Direct lookup for txHash ${proposal.timelockTxHash} failed:`, err.message);
        }
      }

      // Attempt 2: Only if needed - find the transaction in events
      if (!etaTimestamp) {
        // Limit looking for events to once per session to reduce RPC calls
        if (sessionStorage.getItem(`searched-events-${proposal.id}`)) {
          console.log(`Already searched events for proposal #${proposal.id} this session`);
        } else {
          // Get current block number for filtering
          const currentBlock = await provider.getBlockNumber();
          // Look back approximately 1 week worth of blocks
          const startBlock = Math.max(0, currentBlock - 50000);
          
          // Search for TransactionQueued events
          const filter = timelockContract.filters.TransactionQueued();
          
          console.log(`Searching for timelock events from block ${startBlock} to ${currentBlock}`);
          
          const events = await timelockContract.queryFilter(filter, startBlock);
          console.log(`Found ${events.length} TransactionQueued events`);
          
          // Try multiple matching strategies
          let matchingEvent = null;
          
          // Try by target address first (most reliable)
          if (proposal.target) {
            const proposalTarget = proposal.target.toLowerCase();
            matchingEvent = events.find(event => {
              try {
                const eventTarget = event.args.target?.toLowerCase();
                return eventTarget === proposalTarget;
              } catch (e) {
                return false;
              }
            });
            
            if (matchingEvent) {
              console.log(`Found matching event by target address: ${proposal.target}`);
            }
          }
          
          // If we found a match, extract the data
          if (matchingEvent) {
            try {
              // When we find an event, use its threat level
              threatLevel = Number(matchingEvent.args.threatLevel || 0);
              etaTimestamp = matchingEvent.args.eta ? Number(matchingEvent.args.eta) : null;
              txHash = matchingEvent.args.txHash;
              
              // Remember that we found this via event search
              sessionStorage.setItem(`searched-events-${proposal.id}`, 'true');
            } catch (e) {
              console.warn("Error extracting data from matching event:", e);
            }
          }
        }
      }
      
      // If we found timelock data, update the state
      if (etaTimestamp) {
        // IMPORTANT: Only update if we have new data or the threat level has changed
        // This is key to preventing flickering
        const existingInfo = timelockInfo[proposal.id];
        const shouldUpdate = !existingInfo || 
                            existingInfo.eta !== etaTimestamp ||
                            existingInfo.level !== threatLevel ||
                            retryCount > 0;
                            
        if (shouldUpdate) {
          setTimelockInfo(prev => ({
            ...prev,
            [proposal.id]: {
              level: threatLevel,
              label: getThreatLevelLabel(threatLevel),
              eta: etaTimestamp,
              txHash,
              lastUpdated: Date.now()
            }
          }));
        } else {
          console.log(`No changes detected for proposal #${proposal.id}, skipping update`);
        }
      } else {
        console.warn(`No timelock data found for proposal #${proposal.id}`);
        setError("No timelock data found");
      }
    } catch (error) {
      console.error("Error fetching timelock information:", error);
      setError("Failed to fetch timelock data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [
    contracts.timelock, 
    proposal?.id, 
    proposal?.target, 
    proposal?.timelockTxHash,
    proposal?.timelockThreatLevel,
    isQueuedProposal,
    isLoading,
    lastFetchTime,
    retryCount,
    timelockInfo,
    setTimelockInfo
  ]);

  // Get cached timelock info with stability - prefer cached data if available
  const info = useMemo(() => {
    if (!isQueuedProposal) return null;
    
    if (timelockInfo[proposal.id]) {
      // Add ready status calculation based on most current timestamp
      // but avoid re-rendering due to time by doing this in the UI render
      return timelockInfo[proposal.id];
    }
    
    return null;
  }, [isQueuedProposal, timelockInfo, proposal?.id]);

  // Memoized ready state to prevent re-renders due to time changes
  const isReadyToExecute = useMemo(() => {
    if (!info?.eta) return false;
    return Math.floor(Date.now() / 1000) >= info.eta;
  }, [info?.eta]);

  // Fetch data on initial render or when retry is triggered with debouncing
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    
    // Create a debounced fetch function to prevent rapid consecutive calls
    const debouncedFetch = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (isMounted && isQueuedProposal) {
          fetchTimelockData();
        }
      }, retryCount > 0 ? 100 : 500); // Shorter delay for manual refresh
    };
    
    if (isQueuedProposal) {
      debouncedFetch();
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchTimelockData, retryCount, isQueuedProposal]);

  // Render nothing if not a queued proposal
  if (!isQueuedProposal) {
    return null;
  }

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h5 className="font-medium text-gray-700 dark:text-gray-300">Timelock Information</h5>
        {isLoading ? (
          <div className="h-5 w-5 border-2 border-indigo-500 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <button 
            onClick={() => {
              // Use a debounce mechanism for the refresh button
              if (isLoading) return; // Prevent clicks while loading
              
              // Prevent multiple rapid clicks
              if (window.lastTimelockRefreshClick && 
                  Date.now() - window.lastTimelockRefreshClick < 1000) {
                console.log('Refresh clicked too quickly, ignoring');
                return;
              }
              
              window.lastTimelockRefreshClick = Date.now();
              setRetryCount(prev => prev + 1);
            }}
            className={`text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 
                      dark:hover:text-indigo-300 flex items-center transition-all duration-200 
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer'}`}
            disabled={isLoading}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
        )}
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
        
        {info?.txHash && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transaction Hash</p>
            <div className="flex items-center">
              <span className="text-sm font-mono truncate dark:text-gray-300">
                {info.txHash.substring(0, 10) + '...' + info.txHash.substring(info.txHash.length - 8)}
              </span>
              <button 
                onClick={() => copyToClipboard(info.txHash)} 
                className="ml-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {copiedText === info.txHash 
                  ? <Check className="w-4 h-4 text-green-500 dark:text-green-400" /> 
                  : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        
        {proposal.timelockTxHash && !info?.txHash && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transaction Hash (From Proposal)</p>
            <div className="flex items-center">
              <span className="text-sm font-mono truncate dark:text-gray-300">
                {proposal.timelockTxHash.substring(0, 10) + '...' + proposal.timelockTxHash.substring(proposal.timelockTxHash.length - 8)}
              </span>
              <button 
                onClick={() => copyToClipboard(proposal.timelockTxHash)} 
                className="ml-2 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {copiedText === proposal.timelockTxHash 
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