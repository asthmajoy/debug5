import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, ArrowRight, RefreshCw, Users, FileText, Layers } from 'lucide-react';
import { formatPercentage, formatCountdown } from '../utils/formatters';
import { formatTokenAmount } from '../utils/tokenFormatters';
import Loader from './Loader';
import blockchainDataCache from '../utils/blockchainDataCache';
import { useWeb3 } from '../contexts/Web3Context';
import DismissibleMintNotice from './DismissibleMintNotice';

// Cache expiration time in milliseconds (1 minute)
const CACHE_EXPIRATION = 60 * 1000;

// Proposal batch size for optimized loading
const PROPOSAL_BATCH_SIZE = 20;

const DashboardTab = ({ user, stats, loading, proposals, getProposalVoteTotals, onRefresh }) => {
  const { contracts, isConnected } = useWeb3();
  const [directStats, setDirectStats] = useState({
    activeProposalsCount: 0,
    totalProposalsCount: 0,
    loading: true,
    stateBreakdown: {
      active: 0,
      canceled: 0,
      defeated: 0,
      succeeded: 0,
      queued: 0,
      executed: 0,
      expired: 0
    },
    lastUpdated: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [proposalVoteData, setProposalVoteData] = useState({});
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(CACHE_EXPIRATION);
  
  // Format numbers for display with better null/undefined handling
  const formatNumberDisplay = (value) => {
    if (value === undefined || value === null) return "0";
    
    // Handle string inputs
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // If it's NaN or not a number, return "0"
    if (isNaN(numValue)) return "0";
    
    // For whole numbers, don't show decimals
    if (Math.abs(numValue - Math.round(numValue)) < 0.00001) {
      return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    
    // For decimal numbers, limit to 2 decimal places
    return numValue.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };
  
  // Utilize our token formatter directly to ensure consistent display
  const formatToFiveDecimals = (value) => {
    return formatTokenAmount(value);
  };
  
  // Responsive formatter for token values with dynamic decimal places
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  // Update window width on resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  // Format with dynamic decimal places based on screen size and layout
  const formatDynamicDecimals = (value) => {
    if (value === undefined || value === null) return "0";
    
    // Handle string inputs
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // If it's NaN or not a number, return "0"
    if (isNaN(numValue)) return "0";
    
    // Dynamic decimal places based on screen width and layout
    let decimalPlaces = 10; // Default for large screens
    
    // In a responsive grid, cards stack at small screens (< 768px)
    // which gives more horizontal space per card
    if (windowWidth < 768) { 
      // Small screens with stacked layout (more horizontal space)
      decimalPlaces = 8;
    } else if (windowWidth < 900) {
      // Medium-small screens with 3-column layout (very constrained)
      decimalPlaces = 4; 
    } else if (windowWidth < 1024) {
      // Medium screens
      decimalPlaces = 6;
    } else if (windowWidth < 1280) {
      // Medium-large screens
      decimalPlaces = 8;
    }
    
    return numValue.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    });
  };

  // Combined refresh function to update all data
  const refreshAllData = useCallback(async (force = false) => {
    const now = Date.now();
    setLastRefreshTime(now);
    setTimeUntilRefresh(CACHE_EXPIRATION);
    
    // Only refresh if forced or if the cache has expired
    if (force || !directStats.lastUpdated || (now - directStats.lastUpdated > CACHE_EXPIRATION)) {
      setIsRefreshing(true);
      
      // If onRefresh is provided from parent, call it
      if (onRefresh) await onRefresh();
      
      try {
        // Optimize by running these in parallel instead of sequentially
        await Promise.all([
          countProposalsWithCache(),
          fetchVoteDataWithCache()
        ]);
      } catch (error) {
        console.error("Error refreshing data:", error);
      }
      
      setIsRefreshing(false);
    }
  }, [directStats.lastUpdated, onRefresh]);

  // Countdown timer for next refresh
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastRefreshTime;
      const remaining = Math.max(0, CACHE_EXPIRATION - elapsed);
      setTimeUntilRefresh(remaining);
      
      // Auto-refresh when the time is up
      if (remaining === 0) {
        refreshAllData();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [lastRefreshTime, refreshAllData]);

  // OPTIMIZED: Batch proposal counting using multicall if available, or optimized batches if not
  const countProposalsWithCache = useCallback(async () => {
    if (!isConnected || !contracts.governance) {
      setDirectStats(prev => ({
        ...prev,
        loading: false,
        activeProposalsCount: 0,
        totalProposalsCount: 0,
        lastUpdated: Date.now()
      }));
      return;
    }

    try {
      console.log("Checking cached proposal counts...");
      
      // Try to get from cache first
      const cacheKey = 'dashboard-proposal-counts';
      const cachedData = blockchainDataCache.get(cacheKey);
      const now = Date.now();
      
      // If we have valid cached data that's less than 1 minute old, use it
      if (cachedData && cachedData.timestamp && (now - cachedData.timestamp < CACHE_EXPIRATION)) {
        console.log("Using cached proposal counts from", new Date(cachedData.timestamp));
        setDirectStats({
          ...cachedData.data,
          loading: false,
          lastUpdated: cachedData.timestamp
        });
        return;
      }
      
      console.log("Cache expired or missing, counting proposals with optimized method...");
      
      // State names for logging
      const stateNames = [
        'active',     // 0
        'canceled',   // 1
        'defeated',   // 2
        'succeeded',  // 3
        'queued',     // 4
        'executed',   // 5
        'expired'     // 6
      ];
      
      // Initialize counters
      const stateBreakdown = {
        active: 0,
        canceled: 0,
        defeated: 0,
        succeeded: 0,
        queued: 0,
        executed: 0,
        expired: 0
      };
      
      // First, try to use the analyticsHelper contract if available
      // This is much faster as it can return all data in a single call
      if (contracts.analyticsHelper) {
        try {
          console.log("Using analyticsHelper for fast proposal counting");
          
          // Try to get the latest proposal ID first to optimize the range
          let latestProposalId = 0;
          
          // Check if we can get total proposals directly from the analytics helper
          if (typeof contracts.analyticsHelper.getTotalProposalsCount === 'function') {
            try {
              const count = await contracts.analyticsHelper.getTotalProposalsCount();
              latestProposalId = Math.max(0, Number(count) - 1);
              console.log(`Got total proposal count: ${count}, latest ID: ${latestProposalId}`);
            } catch (e) {
              console.warn("Error getting total proposals count:", e);
            }
          }
          
          // If we couldn't get the count, try to estimate it by checking recent IDs
          if (latestProposalId === 0) {
            for (let i = 100; i >= 0; i -= 5) { // Check every 5th ID for efficiency
              try {
                await contracts.governance.getProposalState(i);
                // If this succeeds, start checking sequentially from this point
                for (let j = i + 1; j <= i + 5; j++) {
                  try {
                    await contracts.governance.getProposalState(j);
                    latestProposalId = Math.max(latestProposalId, j);
                  } catch {
                    break;
                  }
                }
                break;
              } catch {
                // This ID doesn't exist, continue checking
              }
            }
          }
          
          // Get proposal analytics from the helper
          const analytics = await contracts.analyticsHelper.getProposalAnalytics(0, latestProposalId);
          
          // Process the analytics data
          stateBreakdown.active = Number(analytics.activeProposals) || 0;
          stateBreakdown.canceled = Number(analytics.canceledProposals) || 0;
          stateBreakdown.defeated = Number(analytics.defeatedProposals) || 0;
          stateBreakdown.succeeded = Number(analytics.succeededProposals) || 0;
          stateBreakdown.queued = Number(analytics.queuedProposals) || 0;
          stateBreakdown.executed = Number(analytics.executedProposals) || 0;
          stateBreakdown.expired = Number(analytics.expiredProposals) || 0;
          
          const totalProposals = Number(analytics.totalProposals) || 0;
          
          console.log("Fast proposal counting results:", {
            total: totalProposals,
            active: stateBreakdown.active,
            breakdown: stateBreakdown
          });
          
          // Create the data to cache and set in state
          const dataToCache = {
            activeProposalsCount: stateBreakdown.active,
            totalProposalsCount: totalProposals,
            stateBreakdown
          };
          
          // Cache the results
          blockchainDataCache.set(cacheKey, {
            timestamp: now,
            data: dataToCache
          });
          
          // Update state with fresh data
          setDirectStats({
            ...dataToCache,
            loading: false,
            lastUpdated: now
          });
          
          return;
        } catch (error) {
          console.error("Error using analytics helper for proposal counting:", error);
          // Continue to fallback method
        }
      }
      
      // Fallback: Use batch processing for better performance
      console.log("Using optimized batch processing for proposal counting");
      
      let foundProposals = 0;
      const MAX_PROPOSAL_ID = 100; // Adjust as needed
      
      // Process proposals in batches for better performance
      for (let batchStart = 0; batchStart < MAX_PROPOSAL_ID; batchStart += PROPOSAL_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + PROPOSAL_BATCH_SIZE, MAX_PROPOSAL_ID);
        const batchPromises = [];
        
        // Create a batch of promises
        for (let id = batchStart; id < batchEnd; id++) {
          batchPromises.push(
            contracts.governance.getProposalState(id)
              .then(state => {
                // Convert state to number (handle BigNumber or other formats)
                const stateNum = typeof state === 'object' && state.toNumber 
                  ? state.toNumber() 
                  : Number(state);
                
                return { id, state: stateNum };
              })
              .catch(() => null) // Return null for non-existent proposals
          );
        }
        
        // Execute batch in parallel
        const results = await Promise.all(batchPromises);
        
        // Process results
        for (const result of results) {
          if (result) {
            foundProposals++;
            const stateName = stateNames[result.state];
            if (stateName && stateBreakdown.hasOwnProperty(stateName)) {
              stateBreakdown[stateName]++;
            }
          }
        }
      }
      
      // Create the data to cache and set in state
      const dataToCache = {
        activeProposalsCount: stateBreakdown.active,
        totalProposalsCount: foundProposals,
        stateBreakdown
      };
      
      // Cache the results
      blockchainDataCache.set(cacheKey, {
        timestamp: now,
        data: dataToCache
      });
      
      console.log("Updated proposal counts:", dataToCache);
      
      // Update state with fresh data
      setDirectStats({
        ...dataToCache,
        loading: false,
        lastUpdated: now
      });
    } catch (error) {
      console.error("Error in proposal counting:", error);
      setDirectStats(prev => ({
        ...prev,
        loading: false,
        lastUpdated: Date.now()
      }));
    }
  }, [contracts.governance, contracts.analyticsHelper, isConnected]);

  // Initial load of proposal counts
  useEffect(() => {
    // Only run once on initial load
    if (directStats.loading && !directStats.lastUpdated) {
      countProposalsWithCache();
    }
  }, [countProposalsWithCache, directStats.loading, directStats.lastUpdated]);

  // OPTIMIZED: Optimized vote data fetching with batch processing
  const fetchVoteDataWithCache = useCallback(async () => {
    if (!getProposalVoteTotals || !proposals || proposals.length === 0) return;
    
    console.log("Optimized vote data fetching for", proposals.length, "proposals");
    const now = Date.now();
    let voteData = {};
    
    // Check cached data first for all proposals
    const cachedData = {};
    const proposalsNeedingFetch = [];
    
    // First pass: Check cache for all proposals
    for (const proposal of proposals) {
      const cacheKey = `dashboard-votes-${proposal.id}`;
      const cached = blockchainDataCache.get(cacheKey);
      
      if (cached && cached.fetchedAt && (now - cached.fetchedAt < CACHE_EXPIRATION)) {
        console.log(`Using cached vote data for proposal #${proposal.id}`);
        cachedData[proposal.id] = cached;
      } else {
        proposalsNeedingFetch.push(proposal);
      }
    }
    
    // If we need to fetch data for some proposals
    if (proposalsNeedingFetch.length > 0) {
      console.log(`Fetching fresh vote data for ${proposalsNeedingFetch.length} proposals`);
      
      // Check if we can use the analyticsHelper for a batch request
      if (contracts.analyticsHelper && 
          typeof contracts.analyticsHelper.getProposalVoteTotals === 'function') {
        try {
          console.log("Using analyticsHelper for batch vote data fetch");
          
          // Map proposals to just their IDs
          const proposalIds = proposalsNeedingFetch.map(p => p.id);
          
          // Use the helper to get vote data for all proposals in one call
          const batchResults = await contracts.analyticsHelper.getProposalVoteTotals(proposalIds);
          
          // Process the batch results
          for (let i = 0; i < proposalIds.length; i++) {
            const id = proposalIds[i];
            const data = batchResults[i] || {};
            
            // Process the data to ensure consistent format
            const processedData = {
              yesVotes: parseFloat(data.yesVotes) || 0,
              noVotes: parseFloat(data.noVotes) || 0,
              abstainVotes: parseFloat(data.abstainVotes) || 0,
              yesVotingPower: parseFloat(data.yesVotes || data.yesVotingPower) || 0,
              noVotingPower: parseFloat(data.noVotes || data.noVotingPower) || 0,
              abstainVotingPower: parseFloat(data.abstainVotes || data.abstainVotingPower) || 0,
              totalVoters: data.totalVoters || 0,
              fetchedAt: now
            };
            
            // Calculate total voting power
            processedData.totalVotingPower = processedData.yesVotingPower + 
                                          processedData.noVotingPower + 
                                          processedData.abstainVotingPower;
            
            // Calculate percentages
            if (processedData.totalVotingPower > 0) {
              processedData.yesPercentage = (processedData.yesVotingPower / processedData.totalVotingPower) * 100;
              processedData.noPercentage = (processedData.noVotingPower / processedData.totalVotingPower) * 100;
              processedData.abstainPercentage = (processedData.abstainVotingPower / processedData.totalVotingPower) * 100;
            } else {
              processedData.yesPercentage = 0;
              processedData.noPercentage = 0;
              processedData.abstainPercentage = 0;
            }
            
            // Cache the result
            const cacheKey = `dashboard-votes-${id}`;
            blockchainDataCache.set(cacheKey, processedData);
            
            // Store in our results
            cachedData[id] = processedData;
          }
        } catch (error) {
          console.error("Error in batch vote data fetch:", error);
          // Fall back to individual fetches
        }
      }
      
      // If we still have proposals needing data (batch method failed or isn't available)
      const remainingProposals = proposalsNeedingFetch.filter(p => !cachedData[p.id]);
      
      if (remainingProposals.length > 0) {
        console.log(`Fetching individual vote data for ${remainingProposals.length} proposals`);
        
        // Process remaining proposals in smaller batches for better performance
        const batchSize = 5;
        for (let i = 0; i < remainingProposals.length; i += batchSize) {
          const batch = remainingProposals.slice(i, i + batchSize);
          
          // Process this batch in parallel
          const batchResults = await Promise.allSettled(
            batch.map(async (proposal) => {
              try {
                console.log(`Fetching vote data for proposal #${proposal.id}`);
                
                // Use the getProposalVoteTotals function from the context
                const data = await getProposalVoteTotals(proposal.id);
                
                // Process the data to ensure consistent format
                const processedData = {
                  yesVotes: parseFloat(data.yesVotes) || 0,
                  noVotes: parseFloat(data.noVotes) || 0,
                  abstainVotes: parseFloat(data.abstainVotes) || 0,
                  yesVotingPower: parseFloat(data.yesVotes || data.yesVotingPower) || 0,
                  noVotingPower: parseFloat(data.noVotes || data.noVotingPower) || 0,
                  abstainVotingPower: parseFloat(data.abstainVotes || data.abstainVotingPower) || 0,
                  totalVoters: data.totalVoters || 0,
                  
                  // Store percentages based on voting power
                  yesPercentage: data.yesPercentage || 0,
                  noPercentage: data.noPercentage || 0,
                  abstainPercentage: data.abstainPercentage || 0,
                  
                  // Add a timestamp to know when the data was fetched
                  fetchedAt: now
                };
                
                // Calculate total voting power
                processedData.totalVotingPower = processedData.yesVotingPower + 
                                              processedData.noVotingPower + 
                                              processedData.abstainVotingPower;
                
                // If percentages aren't provided, calculate them based on voting power
                if (!data.yesPercentage && !data.noPercentage && !data.abstainPercentage) {
                  if (processedData.totalVotingPower > 0) {
                    processedData.yesPercentage = (processedData.yesVotingPower / processedData.totalVotingPower) * 100;
                    processedData.noPercentage = (processedData.noVotingPower / processedData.totalVotingPower) * 100;
                    processedData.abstainPercentage = (processedData.abstainVotingPower / processedData.totalVotingPower) * 100;
                  }
                }
                
                // Cache the result
                const cacheKey = `dashboard-votes-${proposal.id}`;
                blockchainDataCache.set(cacheKey, processedData);
                
                return {
                  id: proposal.id,
                  data: processedData
                };
              } catch (error) {
                console.error(`Error fetching vote data for proposal ${proposal.id}:`, error);
                return {
                  id: proposal.id,
                  data: null
                };
              }
            })
          );
          
          // Collect successful results from this batch
          batchResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value && result.value.data) {
              cachedData[result.value.id] = result.value.data;
            }
          });
        }
      }
    }
    
    // Update state with all collected vote data
    setProposalVoteData(cachedData);
  }, [proposals, getProposalVoteTotals, contracts.analyticsHelper]);

  // Initial load of vote data
  useEffect(() => {
    // Only run on initial load or when proposals change
    fetchVoteDataWithCache();
  }, [fetchVoteDataWithCache]);

  // Calculate proposal success rate the same way as AnalyticsTab
  const calculateProposalSuccessRate = () => {
    const { stateBreakdown } = directStats;
    const successfulProposals = (stateBreakdown.succeeded || 0) + 
                              (stateBreakdown.queued || 0) + 
                              (stateBreakdown.executed || 0);
    const nonCanceledCount = directStats.totalProposalsCount - (stateBreakdown.canceled || 0);
    return nonCanceledCount > 0 ? (successfulProposals / nonCanceledCount) : 0;
  };
  
  // Get the success rate and format it
  const proposalSuccessRate = useMemo(() => calculateProposalSuccessRate(), [directStats]);
  const formattedSuccessRate = formatPercentage(proposalSuccessRate);
  
  // Format the time until next refresh
  const formatTimeUntilRefresh = () => {
    const seconds = Math.ceil(timeUntilRefresh / 1000);
    return `${seconds}s`;
  };
  
  return (
    <div>
      {/* Dismissible JST Minting Notice */}
      <DismissibleMintNotice />
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold dark:text-white">Dashboard</h2>
        
      </div>
      
      {/* Governance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">DAO Overview</h3>
          {directStats.loading && !directStats.lastUpdated ? (
            <Loader size="small" text="Loading stats..." />
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Token Holders</p>
                <p className="text-2xl font-bold dark:text-white flex items-center">
  <Users className="h-5 w-5 mr-2 text-blue-500 dark:text-blue-400" />
  {formatNumberDisplay(stats.totalHolders)}
</p>
                {stats.totalHolders === 0 && <p className="text-xs text-orange-500 dark:text-orange-400"></p>}
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Circulating</p>
                <p className="text-2xl font-bold dark:text-white">{formatNumberDisplay(stats.circulatingSupply)}</p>
                {stats.circulatingSupply === "0" && <p className="text-xs text-orange-500 dark:text-orange-400"></p>}
              </div>
              <div>
              <p className="text-gray-500 dark:text-gray-400">
                Active <br /> Proposals
              </p>
              <p className="text-2xl font-bold dark:text-white flex items-center">
              <FileText className="h-5 w-5 mr-2 text-green-500 dark:text-green-400" />
              {directStats.activeProposalsCount}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">
                Total <br /> Proposals
              </p>
              <p className="text-2xl font-bold dark:text-white flex items-center">
                <Layers className="h-5 w-5 mr-2 text-purple-500 dark:text-purple-400" />
                {directStats.totalProposalsCount}
              </p>
            </div>
            </div>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Your Account</h3>
          <div className="space-y-3">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Balance</p>
              <div className="relative">
                <p className="text-xl md:text-2xl font-bold overflow-hidden text-ellipsis whitespace-nowrap dark:text-white">
                  {formatDynamicDecimals(user.balance)} <span className="text-sm md:text-base font-medium">JST</span>
                </p>
              </div>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Voting Power</p>
              <div className="relative">
                <p className="text-xl md:text-2xl font-bold overflow-hidden text-ellipsis whitespace-nowrap dark:text-white">
                  {formatDynamicDecimals(user.votingPower)} <span className="text-sm md:text-base font-medium">JST</span>
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <button 
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium flex items-center"
                onClick={() => document.querySelector('[data-tab="delegation"]')?.click()}
              >
                View Delegation Details
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Governance Health</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Participation Rate</p>
                <p className="text-sm font-medium dark:text-gray-300">{stats.formattedParticipationRate || formatPercentage(stats.participationRate)}</p>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 dark:bg-green-600 h-2 rounded-full" style={{ width: `${Math.min(stats.participationRate * 100, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Delegation Rate</p>
                <p className="text-sm font-medium dark:text-gray-300">{stats.formattedDelegationRate || formatPercentage(stats.delegationRate)}</p>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 dark:bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(stats.delegationRate * 100, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-gray-500 dark:text-gray-400 text-sm">Proposal Success Rate</p>
                <p className="text-sm font-medium dark:text-gray-300">{formattedSuccessRate}</p>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-indigo-500 dark:bg-indigo-600 h-2 rounded-full" style={{ width: `${Math.min(proposalSuccessRate * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Error Message (if any) */}
      {stats.errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-6">
          <p className="font-medium">Error loading dashboard data:</p>
          <p className="text-sm">{stats.errorMessage}</p>
          <p className="text-sm mt-2">Try refreshing the page or check your network connection.</p>
        </div>
      )}
      
      {/* Active Proposals */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active Proposals</h3>
          <button 
            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
            onClick={() => document.querySelector('[data-tab="proposals"]')?.click()}
          >
            View All
          </button>
        </div>
        {loading && proposals.length === 0 ? (
          <Loader size="small" text="Loading proposals..." />
        ) : (
          <div className="space-y-4">
            {proposals && proposals.length > 0 ? (
              proposals.map((proposal, idx) => {
                // Get vote data from our state
                const voteData = proposalVoteData[proposal.id] || {
                  yesVotes: parseFloat(proposal.yesVotes) || 0,
                  noVotes: parseFloat(proposal.noVotes) || 0,
                  abstainVotes: parseFloat(proposal.abstainVotes) || 0,
                  yesVotingPower: parseFloat(proposal.yesVotes) || 0,
                  noVotingPower: parseFloat(proposal.noVotes) || 0,
                  abstainVotingPower: parseFloat(proposal.abstainVotes) || 0,
                  totalVoters: 0,
                  yesPercentage: 0,
                  noPercentage: 0,
                  abstainPercentage: 0
                };

                // Ensure we have all required properties with correct types
                const processedVoteData = {
                  // Original values from blockchain
                  yesVotingPower: parseFloat(voteData.yesVotingPower || voteData.yesVotes || 0),
                  noVotingPower: parseFloat(voteData.noVotingPower || voteData.noVotes || 0),
                  abstainVotingPower: parseFloat(voteData.abstainVotingPower || voteData.abstainVotes || 0),
                  totalVoters: voteData.totalVoters || 0,
                  
                  // Use existing percentages if available, otherwise calculate
                  yesPercentage: voteData.yesPercentage || 0,
                  noPercentage: voteData.noPercentage || 0,
                  abstainPercentage: voteData.abstainPercentage || 0
                };

                // Calculate total voting power
                const totalVotingPower = processedVoteData.yesVotingPower + 
                                        processedVoteData.noVotingPower + 
                                        processedVoteData.abstainVotingPower;

                // If percentages aren't provided, calculate them based on voting power
                if (!voteData.yesPercentage && !voteData.noPercentage && !voteData.abstainPercentage) {
                  if (totalVotingPower > 0) {
                    processedVoteData.yesPercentage = (processedVoteData.yesVotingPower / totalVotingPower) * 100;
                    processedVoteData.noPercentage = (processedVoteData.noVotingPower / totalVotingPower) * 100;
                    processedVoteData.abstainPercentage = (processedVoteData.abstainVotingPower / totalVotingPower) * 100;
                  }
                }
                
                return (
                  <div key={idx} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium dark:text-white">{proposal.title || `Proposal #${proposal.id}`}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Proposal #{proposal.id}</p>
                      </div>
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded-full flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatCountdown(proposal.deadline)}
                      </span>
                    </div>
                    
                    {/* Vote percentages */}
                    <div className="flex justify-between text-sm mb-2 dark:text-gray-300">
                      <span>Yes: {processedVoteData.yesPercentage.toFixed(1)}%</span>
                      <span>No: {processedVoteData.noPercentage.toFixed(1)}%</span>
                      <span>Abstain: {processedVoteData.abstainPercentage.toFixed(1)}%</span>
                    </div>
                    
                    {/* Vote bar */}
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="flex h-full">
                        <div 
                          className="bg-green-500 h-full" 
                          style={{ width: `${processedVoteData.yesPercentage}%` }}
                        ></div>
                        <div 
                          className="bg-red-500 h-full" 
                          style={{ width: `${processedVoteData.noPercentage}%` }}
                        ></div>
                        <div 
                          className="bg-gray-400 dark:bg-gray-500 h-full" 
                          style={{ width: `${processedVoteData.abstainPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Voting power display */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <div>{formatToFiveDecimals(processedVoteData.yesVotingPower)} JST</div>
                      <div className="text-center">{formatToFiveDecimals(processedVoteData.noVotingPower)} JST</div>
                      <div className="text-right">{formatToFiveDecimals(processedVoteData.abstainVotingPower)} JST</div>
                    </div>
                    
                    {/* Total voters count */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                      Total voters: {processedVoteData.totalVoters || 0}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                No active proposals at the moment
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Last updated info */}
      {directStats.lastUpdated && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-right">
          Last updated: {new Date(directStats.lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default DashboardTab;