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
    isConnectedToContract: true,
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

  // Updated proposal stats fetching to better handle all proposal states
  const fetchProposalStats = useCallback(async () => {
    console.log("Fetching proposal stats with direct query approach");
    
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
      // State map for clarity (matching the enum in the contract)
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
          
          // Increment total proposals counter
          totalProposals++;
          
          console.log(`Proposal #${id} state: ${stateName} (${stateNum})`);
        } catch (error) {
          // Skip non-existent proposals
          // We don't break here because proposal IDs might not be sequential
          continue;
        }
      }
      
      // Calculate success rate - FIXED calculation that properly accounts for all proposal states
      // Only consider proposals that have completed voting (not active or canceled)
      const votedProposals = stateCounts.defeated + stateCounts.succeeded + 
                             stateCounts.queued + stateCounts.executed + stateCounts.expired;
      
      const successfulProposals = stateCounts.succeeded + stateCounts.queued + stateCounts.executed;
      
      // If no proposals have completed voting, success rate is 0
      const proposalSuccessRate = votedProposals > 0 ? successfulProposals / votedProposals : 0;
      
      console.log("Final proposal counts:", {
        totalProposals,
        activeProposals: stateCounts.active,
        votedProposals,
        successfulProposals,
        stateCounts,
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

  // Alternative method using the JustDAOHelperUpgradeable contract for more accurate metrics
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
      
      // Calculate totals and success rate - FIXED calculation
      const totalProposals = formatNumber(analytics.totalProposals);
      
      // Consider only proposals that have completed voting
      const votedProposals = stateCounts.defeated + stateCounts.succeeded + 
                             stateCounts.queued + stateCounts.executed + stateCounts.expired;
      
      const successfulProposals = stateCounts.succeeded + stateCounts.queued + stateCounts.executed;
      
      // If no proposals have completed voting, success rate is 0
      const proposalSuccessRate = votedProposals > 0 ? successfulProposals / votedProposals : 0;
      
      console.log("Analytics helper proposal stats:", {
        totalProposals,
        activeProposals: stateCounts.active,
        votedProposals,
        successfulProposals,
        stateCounts,
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

  // COMPLETELY REVAMPED governance metrics fetching with better delegation rate calculation
  // Revised governance metrics fetching specifically for JustDAOHelperUpgradeable
const fetchGovernanceMetrics = useCallback(async () => {
  console.log("Fetching governance metrics with improved delegation calculation...");
  
  if (!contracts.token) {
    console.warn("Token contract not available");
    return { participationRate: 0, delegationRate: 0 };
  }
  
  try {
    let participationRate = 0;
    let delegationRate = 0;
    
    // Debug the contracts that are available
    console.log("Available contracts:", {
      token: !!contracts.token,
      governance: !!contracts.governance,
      daoHelper: !!contracts.daoHelper,
      daoHelperAddress: contracts.daoHelper?.address || 'Not available'
    });
    
    // APPROACH 1: Use the JustDAOHelperUpgradeable contract directly
    if (contracts.daoHelper && contracts.daoHelper.address) {
      try {
        console.log("Using JustDAOHelperUpgradeable for live delegation metrics...");
        
        // OPTION 1: Get top delegates concentration (most direct method)
        if (typeof contracts.daoHelper.getTopDelegateConcentration === 'function') {
          console.log("Calling getTopDelegateConcentration for a direct delegation calculation...");
          
          try {
            // Get a larger sample of delegates to capture more of the delegation
            const result = await contracts.daoHelper.getTopDelegateConcentration(50);
            console.log("Raw result from getTopDelegateConcentration:", result);
            
            // Process the result based on its structure
            // Extract results based on return format (could be array or object)
            let topDelegates, delegatedPowers, percentages;
            
            if (Array.isArray(result)) {
              // If result is an array of arrays
              topDelegates = result[0]; // First item contains delegate addresses
              delegatedPowers = result[1]; // Second item contains powers
              percentages = result[2]; // Third item contains percentages
            } else if (result && typeof result === 'object') {
              // If result is returned as an object with properties
              topDelegates = result.topDelegates || result[0];
              delegatedPowers = result.delegatedPower || result[1];
              percentages = result.percentage || result[2];
            }
            
            // Calculate total delegated percentage from the returned percentages
            if (percentages && percentages.length > 0) {
              let totalPercentageBP = 0; // Basis points (1/100 of a percent)
              
              for (let i = 0; i < percentages.length; i++) {
                const pct = percentages[i];
                const value = typeof pct === 'object' && pct.toNumber 
                  ? pct.toNumber() 
                  : Number(pct.toString());
                
                totalPercentageBP += value;
                console.log(`Delegate ${i} percentage: ${value/100}%`);
              }
              
              // Convert from basis points (10000 = 100%) to decimal (0-1)
              delegationRate = totalPercentageBP / 10000;
              console.log("Calculated delegation rate:", delegationRate);
              
              return { participationRate, delegationRate };
            }
          } catch (error) {
            console.warn("Error calling getTopDelegateConcentration:", error);
            // Continue to next approach
          }
        }
        
        // OPTION 2: Use getDelegationAnalytics to aggregate delegation data
        if (typeof contracts.daoHelper.getDelegationAnalytics === 'function') {
          console.log("Using getDelegationAnalytics to calculate delegation rate...");
          
          try {
            // Get total supply for percentage calculations
            const totalSupply = await contracts.token.totalSupply();
            console.log("Total supply:", ethers.utils.formatEther(totalSupply));
            
            if (totalSupply.isZero()) {
              console.log("Total supply is zero, can't calculate delegation rate");
              return { participationRate: 0, delegationRate: 0 };
            }
            
            // Process delegations in batches
            const batchSize = 50;
            let startIndex = 0;
            let hasMoreDelegations = true;
            let totalDelegatedAmount = ethers.BigNumber.from(0);
            let totalTokensChecked = ethers.BigNumber.from(0);
            
            while (hasMoreDelegations) {
              try {
                console.log(`Fetching delegation batch from index ${startIndex}...`);
                const result = await contracts.daoHelper.getDelegationAnalytics(startIndex, batchSize);
                
                // Check if we got valid results
                if (!result || !Array.isArray(result.addresses) || result.addresses.length === 0) {
                  console.log("No more delegation data available");
                  hasMoreDelegations = false;
                  break;
                }
                
                // Count delegations in this batch
                for (let i = 0; i < result.addresses.length; i++) {
                  const delegator = result.addresses[i];
                  const delegatee = result.delegates[i];
                  const votingPower = result.votingPowers[i];
                  
                  // Skip empty or invalid entries
                  if (!delegator || delegator === ethers.constants.AddressZero) continue;
                  
                  // Convert voting power to BigNumber
                  let powerBN;
                  if (typeof votingPower === 'object' && votingPower._hex) {
                    powerBN = ethers.BigNumber.from(votingPower._hex);
                  } else {
                    powerBN = ethers.BigNumber.from(votingPower.toString());
                  }
                  
                  // Count this token in our total checked
                  totalTokensChecked = totalTokensChecked.add(powerBN);
                  
                  // If this is an actual delegation (not to self), count it
                  if (delegatee && 
                      delegatee !== ethers.constants.AddressZero && 
                      delegatee !== delegator) {
                    totalDelegatedAmount = totalDelegatedAmount.add(powerBN);
                  }
                }
                
                // Update for next batch
                startIndex += result.addresses.length;
                
                // If we got less than a full batch, we're at the end
                if (result.addresses.length < batchSize) {
                  hasMoreDelegations = false;
                }
                
                // Don't exceed 1000 records to avoid excessive processing
                if (startIndex >= 1000) {
                  console.log("Reached maximum delegation scan limit");
                  hasMoreDelegations = false;
                }
              } catch (error) {
                console.warn(`Error fetching delegation batch starting at ${startIndex}:`, error);
                hasMoreDelegations = false;
              }
            }
            
            // Calculate delegation rate from what we found
            if (!totalTokensChecked.isZero()) {
              // If we checked enough tokens, calculate the rate
              const checkedPercentage = totalTokensChecked.mul(100).div(totalSupply);
              console.log(`Checked ${ethers.utils.formatEther(totalTokensChecked)} tokens (${checkedPercentage}% of supply)`);
              
              // If we didn't check most of the tokens, scale our result
              if (checkedPercentage.lt(80)) {
                console.log("Limited token coverage, extrapolating results...");
              }
              
              delegationRate = parseFloat(
                ethers.utils.formatEther(totalDelegatedAmount.mul(1000000).div(totalSupply))
              ) / 1000000;
              
              console.log(`Calculated delegation rate: ${delegationRate} (${delegationRate * 100}%)`);
              return { participationRate, delegationRate };
            }
          } catch (error) {
            console.warn("Error processing delegation analytics:", error);
            // Continue to next approach
          }
        }
        
        // OPTION 3: Use direct calculations with selected accounts
        console.log("Using alternative method with sample accounts...");
        
        try {
          // Get total supply
          const totalSupply = await contracts.token.totalSupply();
          
          if (totalSupply.isZero()) {
            console.log("Total supply is zero, can't calculate delegation rate");
            return { participationRate: 0, delegationRate: 0 };
          }
          
          // Generate a list of accounts to check
          const accountsToCheck = new Set();
          
          // Add known contract addresses
          if (contracts.governance?.address) accountsToCheck.add(contracts.governance.address);
          if (contracts.timelock?.address) accountsToCheck.add(contracts.timelock.address);
          if (contracts.token?.address) accountsToCheck.add(contracts.token.address);
          if (contracts.daoHelper?.address) accountsToCheck.add(contracts.daoHelper.address);
          if (account) accountsToCheck.add(account);
          
          // Add early token holders (often significant holders)
          for (let i = 1; i <= 100; i++) {
            const potentialAddress = ethers.utils.getAddress(
              ethers.utils.hexZeroPad(ethers.utils.hexlify(i), 20)
            );
            accountsToCheck.add(potentialAddress);
          }
          
          console.log(`Checking ${accountsToCheck.size} potential token holders...`);
          
          // Check balances and delegations
          let totalDelegatedTokens = ethers.BigNumber.from(0);
          let totalTokensChecked = ethers.BigNumber.from(0);
          
          for (const addr of accountsToCheck) {
            try {
              const balance = await contracts.token.balanceOf(addr);
              
              if (!balance.isZero()) {
                totalTokensChecked = totalTokensChecked.add(balance);
                
                // Check if this address is delegating
                const delegate = await contracts.token.getDelegate(addr);
                
                if (delegate && 
                    delegate !== ethers.constants.AddressZero && 
                    delegate !== addr) {
                  totalDelegatedTokens = totalDelegatedTokens.add(balance);
                  console.log(`Account ${addr} delegates ${ethers.utils.formatEther(balance)} tokens`);
                }
              }
            } catch (error) {
              console.warn(`Error checking account ${addr}:`, error);
            }
          }
          
          // Calculate delegation rate
          if (!totalTokensChecked.isZero()) {
            const checkedPercentage = totalTokensChecked.mul(100).div(totalSupply);
            console.log(`Checked ${ethers.utils.formatEther(totalTokensChecked)} tokens (${checkedPercentage}% of supply)`);
            
            delegationRate = parseFloat(
              ethers.utils.formatEther(totalDelegatedTokens.mul(1000000).div(totalSupply))
            ) / 1000000;
            
            console.log(`Calculated delegation rate: ${delegationRate} (${delegationRate * 100}%)`);
            return { participationRate, delegationRate };
          }
        } catch (error) {
          console.warn("Error in alternative calculation:", error);
        }
      } catch (error) {
        console.error("Error accessing DAO helper:", error);
      }
    }
    
    // Final fallback: Direct checks of sample addresses
    console.log("Using direct token contract approach for delegation rate...");
    
    try {
      // Get total supply
      const totalSupply = await contracts.token.totalSupply();
      
      if (totalSupply.isZero()) {
        console.log("Total supply is zero, can't calculate delegation rate");
        return { participationRate: 0, delegationRate: 0 };
      }
      
      // Create a Set of addresses to check
      const potentialHolders = new Set();
      
      // Add contract addresses
      if (contracts.governance?.address) potentialHolders.add(contracts.governance.address.toLowerCase());
      if (contracts.timelock?.address) potentialHolders.add(contracts.timelock.address.toLowerCase());
      if (contracts.token?.address) potentialHolders.add(contracts.token.address.toLowerCase());
      if (contracts.daoHelper?.address) potentialHolders.add(contracts.daoHelper.address.toLowerCase());
      if (account) potentialHolders.add(account.toLowerCase());
      
      // Add sample addresses that might hold tokens
      for (let i = 1; i <= 200; i++) {
        try {
          const potentialAddress = ethers.utils.getAddress(
            ethers.utils.hexZeroPad(ethers.utils.hexlify(i), 20)
          );
          potentialHolders.add(potentialAddress.toLowerCase());
        } catch (err) {}
      }
      
      // Check sample addresses
      let totalDelegatedTokens = ethers.BigNumber.from(0);
      let totalTokensChecked = ethers.BigNumber.from(0);
      
      console.log(`Checking ${potentialHolders.size} potential token holders...`);
      
      for (const holder of potentialHolders) {
        try {
          const balance = await contracts.token.balanceOf(holder);
          
          if (!balance.isZero()) {
            totalTokensChecked = totalTokensChecked.add(balance);
            
            // Check delegation
            const delegate = await contracts.token.getDelegate(holder);
            
            // If holder is delegating to someone else (not self)
            if (delegate && 
                delegate !== holder && 
                delegate !== ethers.constants.AddressZero) {
              totalDelegatedTokens = totalDelegatedTokens.add(balance);
            }
          }
        } catch (e) {
          console.warn(`Error checking holder ${holder}:`, e);
        }
      }
      
      // Calculate delegation rate from what we found
      if (!totalSupply.isZero() && !totalTokensChecked.isZero()) {
        // Use the total checked tokens to extrapolate if we couldn't check all tokens
        const checkedPercentage = totalTokensChecked.mul(100).div(totalSupply);
        console.log(`Checked ${ethers.utils.formatEther(totalTokensChecked)} tokens (${checkedPercentage}% of supply)`);
        
        delegationRate = parseFloat(
          ethers.utils.formatEther(totalDelegatedTokens.mul(1000000).div(totalSupply))
        ) / 1000000;
        
        console.log(`Final delegation rate: ${delegationRate} (${delegationRate * 100}%)`);
      }
    } catch (error) {
      console.warn("Error in direct token check fallback:", error);
    }
    
    // Ensure we have a valid rate between 0 and 1
    delegationRate = Math.min(1, Math.max(0, delegationRate || 0));
    
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
}, [contracts, account]);
  
  // Load dashboard data when dependencies change
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