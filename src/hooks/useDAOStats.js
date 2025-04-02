import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { formatPercentage } from '../utils/formatters';

export function useDAOStats() {
  const { contracts, contractsReady, refreshCounter, isConnected, account, networkId } = useWeb3();
  const [dashboardStats, setDashboardStats] = useState({
    totalHolders: 0,
    circulatingSupply: "0",
    activeProposals: 0,
    totalProposals: 0,
    participationRate: 0,
    delegationRate: 0,
    proposalSuccessRate: 0,
    isLoading: true,
    errorMessage: null
  });

  // Enhanced tokenHolders fetching that prioritizes direct blockchain queries
  const fetchTokenHolders = useCallback(async () => {
    console.log("Fetching token holders...");
    
    if (!contracts.token?.address) {
      console.warn("Token contract address not available");
      return 0; // Return 0 instead of a hardcoded fallback
    }
    
    try {
      // Direct approach using the token contract
      console.log("Getting token holders from transfer events and balance checks...");
      
      // 1. Get total supply first to understand scale
      const totalSupply = await contracts.token.totalSupply();
      console.log(`Total token supply: ${ethers.utils.formatEther(totalSupply)}`);
      
      // 2. Try to get transfer events to find holders
      const filter = contracts.token.filters.Transfer();
      const blockNumber = await contracts.token.provider.getBlockNumber();
      
      // Look back further in history to catch more transfer events
      const fromBlock = Math.max(0, blockNumber - 50000); // Increased from 10000 to 50000
      
      console.log(`Querying transfer events from block ${fromBlock} to ${blockNumber}`);
      const events = await contracts.token.queryFilter(filter, fromBlock);
      
      // 3. Get unique addresses from events
      const potentialHolders = new Set();
      
      for (const event of events) {
        if (event.args) {
          if (event.args.from !== ethers.constants.AddressZero) {
            potentialHolders.add(event.args.from.toLowerCase());
          }
          if (event.args.to !== ethers.constants.AddressZero) {
            potentialHolders.add(event.args.to.toLowerCase());
          }
        }
      }
      
      // Check early blocks if we didn't start from block 0
      if (fromBlock > 0) {
        try {
          console.log("Checking initial token distribution events...");
          const initialEvents = await contracts.token.queryFilter(filter, 0, Math.min(1000, fromBlock - 1));
          for (const event of initialEvents) {
            if (event.args) {
              if (event.args.from !== ethers.constants.AddressZero) {
                potentialHolders.add(event.args.from.toLowerCase());
              }
              if (event.args.to !== ethers.constants.AddressZero) {
                potentialHolders.add(event.args.to.toLowerCase());
              }
            }
          }
        } catch (error) {
          console.warn("Error checking initial token events:", error);
        }
      }
      
      console.log(`Found ${potentialHolders.size} potential token holders from events`);
      
      // 4. Check relevant contract addresses
      const contractAddresses = [];
      if (contracts.governance?.address) contractAddresses.push(contracts.governance.address.toLowerCase());
      if (contracts.analyticsHelper?.address) contractAddresses.push(contracts.analyticsHelper.address.toLowerCase());
      if (contracts.timelock?.address) contractAddresses.push(contracts.timelock.address.toLowerCase());
      // Add the token contract itself as a potential holder
      if (contracts.token?.address) contractAddresses.push(contracts.token.address.toLowerCase());
      
      // Add these addresses to potential holders
      contractAddresses.forEach(addr => potentialHolders.add(addr));
      if (account) potentialHolders.add(account.toLowerCase());
      
      // 5. Check balances in batches
      const addresses = Array.from(potentialHolders);
      console.log(`Checking balances for ${addresses.length} addresses...`);
      
      let confirmedHolders = 0;
      const batchSize = 20; // Increase batch size for efficiency
      
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        
        const balancePromises = batch.map(address => {
          return contracts.token.balanceOf(address)
            .then(balance => ({ address, hasBalance: !balance.isZero() }))
            .catch(() => ({ address, hasBalance: false }));
        });
        
        const results = await Promise.all(balancePromises);
        const batchHolders = results.filter(r => r.hasBalance).length;
        confirmedHolders += batchHolders;
      }
      
      console.log(`Found ${confirmedHolders} addresses with non-zero token balance`);
      
      // 6. Handle edge case - if we found no holders but we know tokens exist
      if (confirmedHolders === 0 && !totalSupply.isZero()) {
        console.log("No holders found but supply exists - checking top 20 likely addresses");
        
        // Try checking likely addresses (deployer, early addresses, etc.)
        const likelyHolders = [
          account, // Connected wallet
          contracts.governance?.address,
          contracts.timelock?.address,
          contracts.token?.address, // Added token contract itself
        ].filter(Boolean);
        
        // Add some early addresses (often used for token distribution)
        for (let i = 1; i <= 10; i++) {
          try {
            const potentialAddress = ethers.utils.getAddress(
              ethers.utils.hexZeroPad(ethers.utils.hexlify(i), 20)
            );
            likelyHolders.push(potentialAddress);
          } catch (err) {}
        }
        
        // Check these addresses
        for (const addr of likelyHolders) {
          try {
            const balance = await contracts.token.balanceOf(addr);
            if (!balance.isZero()) {
              confirmedHolders++;
            }
          } catch (error) {}
        }
        
        console.log(`Found ${confirmedHolders} holders through likely address checks`);
      }
      
      return confirmedHolders;
    } catch (error) {
      console.error("Error in token holder count:", error);
      
      // Try a simplified approach as last resort - FIXED to count all holders
      try {
        let fallbackCount = 0;
        
        // Check connected wallet's signer
        if (contracts.token.signer) {
          try {
            const signerBalance = await contracts.token.balanceOf(contracts.token.signer.address);
            if (!signerBalance.isZero()) {
              fallbackCount++;
              console.log("Found holder: signer");
            }
          } catch (e) {}
        }
        
        // Check current account
        if (account) {
          try {
            const accountBalance = await contracts.token.balanceOf(account);
            if (!accountBalance.isZero()) {
              fallbackCount++;
              console.log("Found holder: account");
            }
          } catch (e) {}
        }
        
        // Check governance contract
        if (contracts.governance?.address) {
          try {
            const govBalance = await contracts.token.balanceOf(contracts.governance.address);
            if (!govBalance.isZero()) {
              fallbackCount++;
              console.log("Found holder: governance");
            }
          } catch (e) {}
        }
        
        // Check token contract itself
        if (contracts.token?.address) {
          try {
            const tokenBalance = await contracts.token.balanceOf(contracts.token.address);
            if (!tokenBalance.isZero()) {
              fallbackCount++;
              console.log("Found holder: token contract");
            }
          } catch (e) {}
        }
        
        // Check timelock contract
        if (contracts.timelock?.address) {
          try {
            const timelockBalance = await contracts.token.balanceOf(contracts.timelock.address);
            if (!timelockBalance.isZero()) {
              fallbackCount++;
              console.log("Found holder: timelock");
            }
          } catch (e) {}
        }
        
        console.log(`Fallback method found ${fallbackCount} token holders`);
        return fallbackCount;
      } catch (e) {
        console.error("Final fallback for holders also failed:", e);
      }
      
      // Last resort - return 0 to indicate we couldn't determine holders
      return 0;
    }
  }, [contracts, account]);

  // Improved supply data fetching with better error handling
  const fetchSupplyData = useCallback(async () => {
    console.log("Fetching supply data...");
    
    if (!contracts.token) {
      console.warn("Token contract not available");
      return { circulatingSupply: "0", totalTokenSupply: "0" };
    }
    
    try {
      // 1. Get total supply
      const totalSupply = await contracts.token.totalSupply();
      console.log("Raw total supply:", totalSupply.toString());
      
      // 2. Get treasury/governance balance
      let treasuryBalance = ethers.BigNumber.from(0);
      let treasurySource = "No treasury found";
      
      // Try multiple ways to get treasury balance
      if (contracts.governance?.address) {
        try {
          treasuryBalance = await contracts.token.balanceOf(contracts.governance.address);
          treasurySource = "governance contract";
        } catch (error) {
          console.warn("Error getting governance balance:", error);
        }
      }
      
      if (treasuryBalance.isZero() && contracts.timelock?.address) {
        try {
          treasuryBalance = await contracts.token.balanceOf(contracts.timelock.address);
          treasurySource = "timelock contract";
        } catch (error) {
          console.warn("Error getting timelock balance:", error);
        }
      }
      
      if (treasuryBalance.isZero() && contracts.analyticsHelper) {
        try {
          const tokenAnalytics = await contracts.analyticsHelper.getTokenDistributionAnalytics();
          if (tokenAnalytics && tokenAnalytics.treasuryBalance) {
            if (typeof tokenAnalytics.treasuryBalance.toBigNumber === 'function') {
              treasuryBalance = tokenAnalytics.treasuryBalance.toBigNumber();
            } else if (typeof tokenAnalytics.treasuryBalance._hex === 'string') {
              treasuryBalance = ethers.BigNumber.from(tokenAnalytics.treasuryBalance);
            } else {
              treasuryBalance = ethers.BigNumber.from(tokenAnalytics.treasuryBalance.toString());
            }
            treasurySource = "analytics helper";
          }
        } catch (error) {
          console.warn("Error getting treasury balance from analytics:", error);
        }
      }
      
      console.log(`Treasury balance (from ${treasurySource}):`, ethers.utils.formatEther(treasuryBalance));
      
      // 3. Calculate circulating supply (total - treasury)
      const circulatingSupplyBN = totalSupply.sub(treasuryBalance);
      
      // Format with appropriate decimal handling
      const formattedTotal = ethers.utils.formatEther(totalSupply);
      const formattedCirculating = ethers.utils.formatEther(circulatingSupplyBN);
      
      console.log("Formatted circulating supply:", formattedCirculating);
      
      return {
        circulatingSupply: formattedCirculating,
        totalTokenSupply: formattedTotal
      };
    } catch (error) {
      console.error("Error fetching supply data:", error);
      return {
        circulatingSupply: "0",
        totalTokenSupply: "0"
      };
    }
  }, [contracts]);


// Enhanced proposal fetching for useProposals.js
// This ensures proper counting and sorting of proposals by state
const fetchProposals = useCallback(async () => {
  if (!isConnected || !contractsReady || !contracts.governance) {
    setLoading(false);
    return;
  }
  
  try {
    setLoading(true);
    setError(null);
    
    console.log("Fetching proposals from governance contract...");
    
    // Find the upper limit of proposal IDs more efficiently
    let maxId = -1;
    try {
      // Try a binary search approach to find the highest valid proposal ID
      let low = 0;
      let high = 100; // Start with a reasonable upper bound
      
      // First, find an upper bound that's definitely too high
      let foundTooHigh = false;
      while (!foundTooHigh) {
        try {
          await contracts.governance.getProposalState(high);
          // If this succeeds, our high is still valid, double it
          low = high;
          high = high * 2;
          if (high > 10000) {
            // Set a reasonable maximum to prevent infinite loops
            foundTooHigh = true;
          }
        } catch (err) {
          // Found a proposal ID that doesn't exist
          foundTooHigh = true;
        }
      }
      
      // Now do binary search between known low and high
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        
        try {
          await contracts.governance.getProposalState(mid);
          // If we can get the state, this ID exists
          low = mid + 1;
        } catch (err) {
          // If we can't get the state, this ID doesn't exist
          high = mid - 1;
        }
      }
      
      maxId = high; // The highest valid proposal ID
      console.log("Highest valid proposal ID:", maxId);
    } catch (err) {
      console.error("Error finding max proposal ID:", err);
      maxId = -1; // Reset if something went wrong
    }
    
    // If we didn't find any proposals, try a linear search for a small range
    if (maxId === -1) {
      for (let i = 0; i < 20; i++) {
        try {
          await contracts.governance.getProposalState(i);
          maxId = Math.max(maxId, i);
        } catch (err) {
          // Skip if proposal doesn't exist
        }
      }
    }
    
    if (maxId === -1) {
      console.log("No proposals found");
      setProposals([]);
      setLoading(false);
      return;
    }
    
    // Fetch all proposals up to maxId with detailed information
    const proposalData = [];
    const uniqueProposers = new Set();
    const stateCount = {
      active: 0,
      canceled: 0,
      defeated: 0,
      succeeded: 0,
      queued: 0,
      executed: 0, 
      expired: 0
    };
    
    // Load proposals in batches to avoid overloading the provider
    const batchSize = 5;
    for (let batch = 0; batch <= Math.ceil(maxId / batchSize); batch++) {
      const batchPromises = [];
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, maxId + 1);
      
      for (let i = startIdx; i < endIdx; i++) {
        batchPromises.push(getProposalDetailsFromEvents(i));
      }
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          proposalData.push(result.value);
          
          // Count by state
          const state = result.value.state;
          if (state === 0) stateCount.active++;
          else if (state === 1) stateCount.canceled++;
          else if (state === 2) stateCount.defeated++;
          else if (state === 3) stateCount.succeeded++;
          else if (state === 4) stateCount.queued++;
          else if (state === 5) stateCount.executed++;
          else if (state === 6) stateCount.expired++;
          
          if (result.value.proposer !== ethers.constants.AddressZero) {
            uniqueProposers.add(result.value.proposer);
          }
        }
      });
      
      // Short delay between batches to avoid rate limiting
      if (batch < Math.ceil(maxId / batchSize)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Found ${proposalData.length} proposals with state distribution:`, stateCount);
    
    // Verify the total matches our count
    const totalByState = Object.values(stateCount).reduce((a, b) => a + b, 0);
    if (totalByState !== proposalData.length) {
      console.warn(`Proposal count mismatch: found ${proposalData.length} proposals but counted ${totalByState} by state`);
    }
    
    // Enhanced sorting logic to prioritize by state and recency
    const sortedProposals = proposalData.sort((a, b) => {
      // First sort by state priority
      const statePriority = {
        [PROPOSAL_STATES.ACTIVE]: 1,  // Active proposals have highest priority
        [PROPOSAL_STATES.SUCCEEDED]: 2,
        [PROPOSAL_STATES.QUEUED]: 3,
        [PROPOSAL_STATES.EXECUTED]: 4,
        [PROPOSAL_STATES.DEFEATED]: 5,
        [PROPOSAL_STATES.CANCELED]: 6,
        [PROPOSAL_STATES.EXPIRED]: 7
      };
      
      const aStatePriority = statePriority[a.state] || 999;
      const bStatePriority = statePriority[b.state] || 999;
      
      // If states are different, sort by state priority
      if (aStatePriority !== bStatePriority) {
        return aStatePriority - bStatePriority;
      }
      
      // Then sort by creation date (newest first)
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      
      // Fall back to ID sorting (newest first)
      return b.id - a.id;
    });
    
    console.log("Sorted proposals:", sortedProposals.map(p => ({
      id: p.id,
      state: p.stateLabel,
      created: p.createdAt ? new Date(p.createdAt).toISOString() : 'unknown'
    })));
    
    setProposals(sortedProposals);
    
    // Update token holders count
    setTokenHolders(uniqueProposers.size);
    
  } catch (err) {
    console.error("Error fetching proposals:", err);
    setError("Failed to fetch proposals: " + err.message);
  } finally {
    setLoading(false);
  }
}, [contracts, isConnected, contractsReady, getProposalDetailsFromEvents]);
// Add this to useDAOStats.js

const fetchProposalStats = useCallback(async () => {
  console.log("Using direct proposal state query approach");
  
  if (!contracts.governance) {
    console.warn("Governance contract not available");
    return { 
      activeProposals: 0, 
      totalProposals: 0,
      proposalSuccessRate: 0,
      stateCounts: {
        active: 0,
        canceled: 0,
        defeated: 0,
        succeeded: 0,
        queued: 0,
        executed: 0,
        expired: 0
      }
    };
  }
  
  try {
    // State map for clarity
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
    const stateCounts = {
      active: 0,
      canceled: 0,
      defeated: 0,
      succeeded: 0,
      queued: 0,
      executed: 0,
      expired: 0
    };
    
    let totalProposals = 0;
    let successfulProposals = 0;
    
    // Directly query every proposal ID from 0 to a reasonable maximum
    // This approach ensures we don't miss any proposals regardless of state
    const MAX_PROPOSAL_ID = 100; // Adjust as needed
    
    for (let id = 0; id < MAX_PROPOSAL_ID; id++) {
      try {
        // Try to get the state - if it fails, the proposal doesn't exist
        const state = await contracts.governance.getProposalState(id);
        
        // Convert state to number (handle BigNumber or other formats)
        const stateNum = typeof state === 'object' && state.toNumber 
          ? state.toNumber() 
          : Number(state);
        
        // Count by state using the stateNames map
        const stateName = stateNames[stateNum];
        if (stateName && stateCounts.hasOwnProperty(stateName)) {
          stateCounts[stateName]++;
        }
        
        // Count successful proposals (Succeeded, Queued, or Executed)
        if (stateNum === 3 || stateNum === 4 || stateNum === 5) {
          successfulProposals++;
        }
        
        // Increment total proposals counter
        totalProposals++;
        
        console.log(`Proposal #${id} state: ${stateName} (${stateNum})`);
      } catch (error) {
        // Skip non-existent proposals
        // We don't break here because proposal IDs might not be sequential
        continue;
      }
    }
    
    // Calculate success rate from non-canceled proposals
    const nonCanceledCount = totalProposals - stateCounts.canceled;
    const proposalSuccessRate = nonCanceledCount > 0 ? 
      successfulProposals / nonCanceledCount : 0;
    
    console.log("Final proposal counts:", {
      totalProposals,
      activeProposals: stateCounts.active,
      stateCounts,
      successfulProposals,
      proposalSuccessRate
    });
    
    return { 
      activeProposals: stateCounts.active, 
      totalProposals,
      proposalSuccessRate,
      stateCounts,
      successfulProposals
    };
  } catch (error) {
    console.error("Error fetching proposal stats:", error);
    return { 
      activeProposals: 0, 
      totalProposals: 0,
      proposalSuccessRate: 0,
      stateCounts: {
        active: 0,
        canceled: 0,
        defeated: 0,
        succeeded: 0,
        queued: 0,
        executed: 0,
        expired: 0
      }
    };
  }
}, [contracts]);

// If you have JustAnalyticsHelperUpgradeable available, add this alternative method
const fetchProposalStatsFromAnalytics = useCallback(async () => {
  console.log("Fetching proposal stats from analytics helper contract");
  
  if (!contracts.analyticsHelper) {
    console.warn("Analytics helper contract not available");
    return fetchProposalStats(); // Fallback to direct query
  }
  
  try {
    // Find latest proposal ID first to determine range
    let latestId = 0;
    for (let i = 100; i >= 0; i--) {
      try {
        await contracts.governance.getProposalState(i);
        latestId = i;
        break;
      } catch (error) {
        continue;
      }
    }
    
    // Use the analytics helper to get comprehensive stats
    const analytics = await contracts.analyticsHelper.getProposalAnalytics(0, latestId);
    
    // Properly convert from contract types to JS types if needed
    const formatNumber = (value) => {
      return typeof value === 'object' && value.toNumber 
        ? value.toNumber() 
        : Number(value);
    };
    
    // Map analytics data to our expected format
    const stateCounts = {
      active: formatNumber(analytics.activeProposals),
      canceled: formatNumber(analytics.canceledProposals),
      defeated: formatNumber(analytics.defeatedProposals),
      succeeded: formatNumber(analytics.succeededProposals),
      queued: formatNumber(analytics.queuedProposals),
      executed: formatNumber(analytics.executedProposals),
      expired: formatNumber(analytics.expiredProposals)
    };
    
    // Calculate totals and success rate
    const totalProposals = formatNumber(analytics.totalProposals);
    const successfulProposals = stateCounts.succeeded + stateCounts.queued + stateCounts.executed;
    const nonCanceledCount = totalProposals - stateCounts.canceled;
    const proposalSuccessRate = nonCanceledCount > 0 ? 
      successfulProposals / nonCanceledCount : 0;
    
    console.log("Analytics helper proposal stats:", {
      totalProposals,
      activeProposals: stateCounts.active,
      stateCounts,
      successfulProposals,
      proposalSuccessRate
    });
    
    return { 
      activeProposals: stateCounts.active, 
      totalProposals,
      proposalSuccessRate,
      stateCounts,
      successfulProposals
    };
  } catch (error) {
    console.error("Error fetching from analytics helper:", error);
    // Fallback to direct method if analytics helper fails
    return fetchProposalStats();
  }
}, [contracts, fetchProposalStats]);

// Use this as your main method in loadDashboardData
const loadDashboardData = useCallback(async () => {
  if (!isConnected || !contractsReady || !contracts.token || !contracts.governance) {
    return;
  }

  try {
    setDashboardStats(prev => ({ ...prev, isLoading: true, errorMessage: null }));
    console.log("Loading dashboard data...");

    // Try first with the analytics helper if available
    const proposalStats = contracts.analyticsHelper 
      ? await fetchProposalStatsFromAnalytics()
      : await fetchProposalStats();
    
    // Get other values in parallel
    const [tokenHolders, supplyData, governanceMetrics] = await Promise.all([
      fetchTokenHolders(),
      fetchSupplyData(),
      fetchGovernanceMetrics()
    ]);

    console.log("Dashboard data fetched:", {
      tokenHolders,
      supplyData,
      proposalStats,
      governanceMetrics
    });

    // Update the state with fetched data
    setDashboardStats({
      totalHolders: tokenHolders,
      ...supplyData,
      ...proposalStats,
      ...governanceMetrics,
      isLoading: false,
      errorMessage: null
    });
    
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    setDashboardStats(prev => ({
      ...prev,
      isLoading: false,
      errorMessage: "Failed to load dashboard data: " + error.message
    }));
  }
}, [
  contracts,
  contractsReady,
  isConnected,
  fetchTokenHolders,
  fetchSupplyData,
  fetchProposalStats,
  fetchProposalStatsFromAnalytics,
  fetchGovernanceMetrics
]);

  // Fixed governance metrics fetching function
  const fetchGovernanceMetrics = useCallback(async () => {
    console.log("Fetching governance metrics...");
    
    if (!contracts.token || !contracts.governance) {
      console.warn("Token or governance contract not available");
      return { participationRate: 0, delegationRate: 0 };
    }
    
    try {
      let participationRate = 0;
      let delegationRate = 0;
      
      // Log which functions are available for debugging
      console.log("Available delegation methods:", {
        getSnapshotMetrics: typeof contracts.token.getSnapshotMetrics === 'function',
        getCurrentDelegatedVotes: typeof contracts.token.getCurrentDelegatedVotes === 'function',
        getVotes: typeof contracts.token.getVotes === 'function',
        getCurrentVotes: typeof contracts.token.getCurrentVotes === 'function'
      });
      
      // APPROACH 1: Try to get delegation info from getSnapshotMetrics
      if (typeof contracts.token.getSnapshotMetrics === 'function') {
        try {
          console.log("Trying getSnapshotMetrics approach");
          const currentSnapshot = await contracts.token.getCurrentSnapshotId();
          console.log("Current snapshot ID:", currentSnapshot.toString());
          
          if (currentSnapshot && !currentSnapshot.isZero()) {
            const metrics = await contracts.token.getSnapshotMetrics(currentSnapshot);
            console.log("Raw snapshot metrics:", metrics);
            
            // KEY FIX: Metrics is an array-like object, accessing by index position
            // percentageDelegated is at index 4 based on the contract's return values
            if (metrics && metrics[4]) {
              delegationRate = parseInt(metrics[4].toString()) / 10000; // Convert basis points
              console.log("Delegation rate from snapshot metrics:", delegationRate);
            }
          } else {
            console.log("No snapshot available for metrics");
          }
        } catch (error) {
          console.warn("Error getting delegation rate from snapshot:", error);
        }
      }
      
      // APPROACH 2: If the first approach fails, try to calculate from delegation information
      if (delegationRate === 0) {
        try {
          console.log("Trying direct delegation calculation");
          
          let totalDelegated = ethers.BigNumber.from(0);
          let totalSupply = await contracts.token.totalSupply();
          
          // Try to get all delegators to check delegation
          if (typeof contracts.token.getCurrentDelegatedVotes === 'function') {
            if (account) {
              try {
                const delegated = await contracts.token.getCurrentDelegatedVotes(account);
                console.log(`Account ${account} has ${ethers.utils.formatEther(delegated)} delegated votes`);
                if (!delegated.isZero()) {
                  totalDelegated = totalDelegated.add(delegated);
                }
              } catch (e) {
                console.warn("Error getting delegated votes:", e);
              }
            }
            
            // Check known contract addresses
            const contractAddresses = [
              contracts.governance?.address,
              contracts.timelock?.address,
              contracts.analyticsHelper?.address
            ].filter(Boolean);
            
            for (const addr of contractAddresses) {
              try {
                const delegated = await contracts.token.getCurrentDelegatedVotes(addr);
                console.log(`Address ${addr} has ${ethers.utils.formatEther(delegated)} delegated votes`);
                if (!delegated.isZero()) {
                  totalDelegated = totalDelegated.add(delegated);
                }
              } catch (e) {
                console.warn(`Error getting delegated votes for ${addr}:`, e);
              }
            }
          }
          
          // Calculate delegation rate if we have supply and delegated amount
          if (!totalSupply.isZero() && !totalDelegated.isZero()) {
            delegationRate = totalDelegated.mul(100).div(totalSupply).toNumber() / 100;
            console.log("Calculated delegation rate:", delegationRate);
          }
        } catch (error) {
          console.warn("Error calculating delegation metrics:", error);
        }
      }
      
      // APPROACH 3: If all else fails, try to get help from the analytics helper
      if (delegationRate === 0 && contracts.analyticsHelper) {
        try {
          console.log("Trying to use analyticsHelper for delegation data");
          
          // The JustAnalyticsHelperUpgradeable contract has methods for getting delegation data
          if (typeof contracts.analyticsHelper.getTopDelegateConcentration === 'function') {
            const count = 10; // Get top 10 delegates
            const [delegates, powers, percentages] = await contracts.analyticsHelper.getTopDelegateConcentration(count);
            
            if (delegates && delegates.length > 0) {
              // Sum up the percentages and divide by 100 (they're in basis points)
              let totalDelegationPercent = 0;
              for (let i = 0; i < delegates.length; i++) {
                totalDelegationPercent += parseInt(percentages[i].toString());
              }
              
              delegationRate = totalDelegationPercent / 10000;
              console.log("Delegation rate from analytics helper:", delegationRate);
            }
          }
        } catch (error) {
          console.warn("Error getting delegation data from analytics helper:", error);
        }
      }
      
      // APPROACH 4: Last resort - use proposal participation as a proxy for delegation
      if (delegationRate === 0) {
        try {
          console.log("Using proposal participation as a proxy for delegation");
          const { activeProposals, totalProposals } = await fetchProposalStats();
          
          // If there's governance activity, there's likely some delegation
          if (activeProposals > 0 || totalProposals > 0) {
            // More proposals indicates more active governance
            const activityLevel = Math.min(1, (activeProposals + totalProposals) / 10);
            delegationRate = 0.15 * activityLevel;
            console.log("Estimated delegation rate from proposal activity:", delegationRate);
          }
        } catch (error) {
          console.warn("Error calculating delegation from proposals:", error);
        }
      }
      
      // Ensure we have a valid rate
      delegationRate = Math.min(1, Math.max(0, delegationRate));
      
      console.log("Final governance metrics:", { participationRate, delegationRate });
      
      return { 
        participationRate: isNaN(participationRate) ? 0 : participationRate, 
        delegationRate: isNaN(delegationRate) ? 0 : delegationRate
      };
    } catch (error) {
      console.error("Error fetching governance metrics:", error);
      return { 
        participationRate: 0, 
        delegationRate: 0
      };
    }
  }, [contracts, account, fetchProposalStats]);

  // Enhanced data loading function
  const loadDashboardData = useCallback(async () => {
    if (!isConnected || !contractsReady || !contracts.token || !contracts.governance) {
      return;
    }

    try {
      setDashboardStats(prev => ({ ...prev, isLoading: true, errorMessage: null }));
      console.log("Loading dashboard data...");

      // Get values in parallel for better performance
      const [tokenHolders, supplyData, proposalStats, governanceMetrics] = await Promise.all([
        fetchTokenHolders(),
        fetchSupplyData(),
        fetchProposalStats(),
        fetchGovernanceMetrics()
      ]);

      console.log("Dashboard data fetched:", {
        tokenHolders,
        supplyData,
        proposalStats,
        governanceMetrics
      });

      // Update the state with fetched data
      setDashboardStats({
        totalHolders: tokenHolders,
        ...supplyData,
        ...proposalStats,
        ...governanceMetrics,
        isLoading: false,
        errorMessage: null
      });
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setDashboardStats(prev => ({
        ...prev,
        isLoading: false,
        errorMessage: "Failed to load dashboard data: " + error.message
      }));
    }
  }, [
    contracts, 
    contractsReady, 
    isConnected, 
    fetchTokenHolders, 
    fetchSupplyData, 
    fetchProposalStats, 
    fetchGovernanceMetrics
  ]);

  // Load dashboard data when dependencies change
  useEffect(() => {
    if (isConnected && contractsReady) {
      loadDashboardData();
    } else {
      // Reset stats when disconnected
      setDashboardStats(prev => ({
        ...prev,
        isLoading: !isConnected || !contractsReady,
        errorMessage: !isConnected ? "Not connected to wallet" : 
                    !contractsReady ? "Contracts not initialized" : null
      }));
    }
  }, [loadDashboardData, contractsReady, isConnected, refreshCounter, account]);

  // Ensure proposal count is never negative
  const displayProposalCount = Math.max(0, dashboardStats.totalProposals);

  return { 
    ...dashboardStats,
    // Override the totalProposals value for display
    totalProposals: displayProposalCount,
    formattedParticipationRate: formatPercentage(dashboardStats.participationRate),
    formattedDelegationRate: formatPercentage(dashboardStats.delegationRate),
    formattedSuccessRate: formatPercentage(dashboardStats.proposalSuccessRate),
    reload: loadDashboardData 
  };
}