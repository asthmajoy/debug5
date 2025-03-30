import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Clock, Shield, Check, Copy, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// Helper function to get human-readable threat level label
function getThreatLevelLabel(level) {
  const threatLevelLabels = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH", 
    3: "CRITICAL"
  };
  
  return threatLevelLabels[level] || "Unknown";
}

// Helper function for threat level colors
function getThreatLevelColor(level) {
  switch (Number(level)) {
    case 0: // LOW
      return 'bg-green-100 text-green-800';
    case 1: // MEDIUM
      return 'bg-yellow-100 text-yellow-800';
    case 2: // HIGH
      return 'bg-orange-100 text-orange-800';
    case 3: // CRITICAL
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Helper function to format time remaining
function formatTimeRemaining(etaTimestamp) {
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Enhanced function to fetch timelock data specifically for this proposal
  const fetchTimelockData = async () => {
    if (!contracts.timelock || !proposal || proposal.stateLabel?.toLowerCase() !== 'queued') {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const timelockContract = contracts.timelock.connect(provider);
      
      // Get current block number for filtering
      const currentBlock = await provider.getBlockNumber();
      // Look back approximately 2 weeks worth of blocks
      const startBlock = Math.max(0, currentBlock - 100000);
      
      // Search for TransactionQueued events
      const filter = timelockContract.filters.TransactionQueued();
      
      console.log(`Fetching timelock events from block ${startBlock} to ${currentBlock} for proposal #${proposal.id}`);
      
      const events = await timelockContract.queryFilter(filter, startBlock);
      console.log(`Found ${events.length} TransactionQueued events`);
      
      // Try to match by txHash first, then by target address
      let matchingEvent = null;
      
      if (proposal.txHash) {
        matchingEvent = events.find(event => event.args.txHash === proposal.txHash);
        console.log(`Matching by txHash: ${proposal.txHash}`, matchingEvent ? "Found match" : "No match");
      }
      
      // If no match by txHash, try matching by target address
      if (!matchingEvent && proposal.target) {
        matchingEvent = events.find(event => {
          const eventTarget = event.args.target?.toLowerCase();
          const proposalTarget = proposal.target?.toLowerCase();
          return eventTarget === proposalTarget;
        });
        console.log(`Matching by target address: ${proposal.target}`, matchingEvent ? "Found match" : "No match");
      }
      
      // If still no match, try to match by description
      if (!matchingEvent && proposal.timelockTxHash) {
        // Try direct lookup using the proposal's stored txHash
        try {
          const txDetails = await timelockContract.getTransaction(proposal.timelockTxHash);
          if (txDetails && txDetails.target) {
            console.log(`Found transaction details using proposal.timelockTxHash: ${proposal.timelockTxHash}`);
            
            // Now look for the event that corresponds to this transaction
            matchingEvent = events.find(event => event.args.txHash === proposal.timelockTxHash);
          }
        } catch (error) {
          console.warn(`Error fetching transaction with hash ${proposal.timelockTxHash}:`, error);
        }
      }
      
      if (matchingEvent) {
        const threatLevel = Number(matchingEvent.args.threatLevel || 0);
        const etaTimestamp = matchingEvent.args.eta ? Number(matchingEvent.args.eta) : null;
        const txHash = matchingEvent.args.txHash;
        
        console.log(`Found timelock info for proposal #${proposal.id}:`, {
          threatLevel,
          eta: etaTimestamp,
          txHash
        });
        
        const newInfo = {
          ...timelockInfo,
          [proposal.id]: {
            level: threatLevel,
            label: getThreatLevelLabel(threatLevel),
            eta: etaTimestamp,
            txHash
          }
        };
        
        setTimelockInfo(newInfo);
      } else {
        // If no match found but we do have a timelockTxHash, try a direct query
        if (proposal.timelockTxHash && proposal.timelockTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          try {
            const txDetails = await timelockContract.getTransaction(proposal.timelockTxHash);
            if (txDetails && txDetails.eta) {
              // For direct lookups, we might not have threat level info
              const newInfo = {
                ...timelockInfo,
                [proposal.id]: {
                  level: 0, // Default to LOW when threat level unknown
                  label: "UNKNOWN",
                  eta: Number(txDetails.eta),
                  txHash: proposal.timelockTxHash
                }
              };
              
              setTimelockInfo(newInfo);
              console.log(`Found partial timelock info via direct query for proposal #${proposal.id}`);
            }
          } catch (error) {
            console.warn(`Error in direct transaction lookup:`, error);
            setError("Failed to fetch timelock data: " + error.message);
          }
        } else {
          console.warn(`No matching timelock event found for proposal #${proposal.id}`);
          // Only set error if we couldn't find data through any method
          setError("No timelock data found for this proposal");
        }
      }
    } catch (error) {
      console.error("Error fetching timelock information:", error);
      setError("Failed to fetch timelock data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch timelock data when the component mounts or proposal changes
  useEffect(() => {
    if (proposal && proposal.stateLabel?.toLowerCase() === 'queued') {
      fetchTimelockData();
    }
  }, [proposal, retryCount]);

  if (!proposal || proposal.stateLabel?.toLowerCase() !== 'queued') {
    return null;
  }

  const info = timelockInfo[proposal.id];
  
  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
        <h5 className="font-medium text-gray-700">Timelock Information</h5>
        {isLoading ? (
          <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <button 
            onClick={() => {
              setRetryCount(prev => prev + 1);
            }}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center"
            disabled={isLoading}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        {error && (
          <div className="bg-red-50 text-red-700 p-2 rounded-md text-sm flex items-center mb-3">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {error}
          </div>
        )}
      
        <div className="flex flex-wrap md:flex-nowrap gap-4">
          <div className="min-w-[200px]">
            <p className="text-sm text-gray-600 mb-1">Threat Level</p>
            <span 
              className={`inline-block text-xs px-2 py-1 rounded ${
                getThreatLevelColor(info?.level || 0)
              }`}
            >
              {info?.label || "Unknown"}
            </span>
          </div>
          
          <div className="min-w-[200px]">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <span className={`inline-block text-xs px-2 py-1 rounded flex items-center ${
              !info?.eta ? 'bg-gray-100 text-gray-800' :
              Math.floor(Date.now() / 1000) >= info.eta ? 
                'bg-green-100 text-green-800' : 
                'bg-yellow-100 text-yellow-800'
            }`}>
              {!info?.eta ? 'Unknown' :
               Math.floor(Date.now() / 1000) >= info.eta ? (
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
        
        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-600 mb-1">Executable After</p>
          <p className="text-sm font-medium">
            {info?.eta 
              ? new Date(info.eta * 1000).toLocaleString() 
              : "Unknown"}
          </p>
        </div>
        
        {info?.txHash && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Transaction Hash</p>
            <div className="flex items-center">
              <span className="text-sm font-mono truncate">
                {info.txHash.substring(0, 10) + '...' + info.txHash.substring(info.txHash.length - 8)}
              </span>
              <button 
                onClick={() => copyToClipboard(info.txHash)} 
                className="ml-2 text-gray-500 hover:text-indigo-600"
              >
                {copiedText === info.txHash 
                  ? <Check className="w-4 h-4 text-green-500" /> 
                  : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        
        {proposal.timelockTxHash && !info?.txHash && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Transaction Hash (From Proposal)</p>
            <div className="flex items-center">
              <span className="text-sm font-mono truncate">
                {proposal.timelockTxHash.substring(0, 10) + '...' + proposal.timelockTxHash.substring(proposal.timelockTxHash.length - 8)}
              </span>
              <button 
                onClick={() => copyToClipboard(proposal.timelockTxHash)} 
                className="ml-2 text-gray-500 hover:text-indigo-600"
              >
                {copiedText === proposal.timelockTxHash 
                  ? <Check className="w-4 h-4 text-green-500" /> 
                  : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelockInfoDisplay;