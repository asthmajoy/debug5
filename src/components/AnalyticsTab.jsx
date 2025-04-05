import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart, PieChart, LineChart, AreaChart } from 'lucide-react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { formatPercentage, formatNumber, formatBigNumber } from '../utils/formatters';
import useGovernanceParams from '../hooks/useGovernanceParams';

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

const AnalyticsTab = () => {
  const { contracts, contractsReady, account, provider } = useWeb3();
  const [selectedMetric, setSelectedMetric] = useState('proposal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionDetails, setConnectionDetails] = useState(null);
  
  // Get governance parameters using the same hook as VoteTab
  const govParams = useGovernanceParams();
  
  // Analytics state
  const [proposalAnalytics, setProposalAnalytics] = useState(null);
  const [voterAnalytics, setVoterAnalytics] = useState(null);
  const [tokenAnalytics, setTokenAnalytics] = useState(null);
  const [timelockAnalytics, setTimelockAnalytics] = useState(null);
  const [healthScore, setHealthScore] = useState(null);
  const [delegationAnalytics, setDelegationAnalytics] = useState(null);
  
  // Cache references
  const cacheRef = useRef({
    proposal: { data: null, timestamp: 0 },
    voter: { data: null, timestamp: 0 },
    token: { data: null, timestamp: 0 },
    timelock: { data: null, timestamp: 0 },
    delegation: { data: null, timestamp: 0 },
    health: { data: null, timestamp: 0 }
  });
  
  // Track component mount state
  const isMountedRef = useRef(true);
  
  // Threat level states to match VoteTab
  const THREAT_LEVELS = useMemo(() => ({
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3
  }), []);
  const [threatLevelDelays, setThreatLevelDelays] = useState({});

  // Improved BigNumber to Number conversion
  const formatBigNumberToNumber = useCallback((bn) => {
    if (!bn) return 0;
    if (typeof bn === 'number') return bn;
    
    // Try using ethers BigNumber methods first
    if (ethers.BigNumber.isBigNumber(bn)) {
      try {
        // If the number isn't too large, convert directly
        return bn.toNumber();
      } catch (e) {
        // For large numbers, convert to string then parse
        return parseFloat(bn.toString());
      }
    }
    
    // Handle regular objects with toString method
    try {
      if (bn.toString && typeof bn.toString === 'function') {
        const str = bn.toString();
        // Remove any "e+" scientific notation
        if (str.includes('e+')) {
          return parseFloat(str);
        }
        return parseFloat(str);
      }
    } catch (err) {
      console.error("Error parsing value:", err, bn);
    }
    
    // Last resort - try to use formatUnits
    try {
      return parseFloat(ethers.utils.formatUnits(bn, 0));
    } catch (e) {
      console.error("All conversion methods failed for:", bn);
    }
    
    return 0;
  }, []);

  // Helper function to check if an address is self-delegated
  const isSelfDelegated = useCallback((delegator, delegate) => {
    if (!delegator || !delegate) return true;
    const normalizedDelegator = delegator.toLowerCase();
    const normalizedDelegate = delegate.toLowerCase();
    return normalizedDelegator === normalizedDelegate || 
           delegate === ethers.constants.AddressZero;
  }, []);

  // Safely get property value with fallback
  const safeGet = useCallback((obj, path, defaultValue = 0) => {
    if (!obj) return defaultValue;
    const keys = path.split('.');
    return keys.reduce((o, key) => 
      (o && o[key] !== undefined) ? o[key] : defaultValue, obj);
  }, []);

  // Debug function to check contract connectivity
  const checkContractConnectivity = useCallback(async () => {
    if (!contractsReady) {
      return {
        connected: false,
        message: "Contracts not ready. Connect your wallet to continue."
      };
    }

    const details = {
      connected: true,
      contracts: {},
      account: account || "Not connected",
      networkId: null
    };

    try {
      if (provider) {
        const network = await provider.getNetwork();
        details.networkId = network.chainId;
      }

      // Check each contract
      if (contracts.justToken) {
        try {
          const symbol = await contracts.justToken.symbol();
          const totalSupply = await contracts.justToken.totalSupply();
          details.contracts.justToken = {
            address: contracts.justToken.address,
            symbol,
            totalSupply: ethers.utils.formatEther(totalSupply)
          };
        } catch (err) {
          details.contracts.justToken = {
            address: contracts.justToken.address,
            error: err.message
          };
        }
      } else {
        details.contracts.justToken = "Not initialized";
      }

      if (contracts.governance) {
        try {
          // Get a simple call to check connection
          const state = await contracts.governance.getProposalState(0).catch(() => "No proposals");
          details.contracts.governance = {
            address: contracts.governance.address,
            status: "Connected"
          };
        } catch (err) {
          details.contracts.governance = {
            address: contracts.governance?.address,
            error: err.message
          };
        }
      } else {
        details.contracts.governance = "Not initialized";
      }

      if (contracts.timelock) {
        try {
          const minDelay = await contracts.timelock.minDelay();
          details.contracts.timelock = {
            address: contracts.timelock.address,
            minDelay: minDelay.toString()
          };
        } catch (err) {
          details.contracts.timelock = {
            address: contracts.timelock?.address,
            error: err.message
          };
        }
      } else {
        details.contracts.timelock = "Not initialized";
      }

      if (contracts.daoHelper) {
        try {
          // Check if we can call a simple function
          details.contracts.daoHelper = {
            address: contracts.daoHelper.address,
            status: "Connected"
          };
        } catch (err) {
          details.contracts.daoHelper = {
            address: contracts.daoHelper?.address,
            error: err.message
          };
        }
      } else {
        details.contracts.daoHelper = "Not initialized";
      }

      return details;
    } catch (err) {
      return {
        connected: false,
        message: `Error checking contracts: ${err.message}`
      };
    }
  }, [contractsReady, contracts, account, provider]);

  // Helper function to check cache validity
  const isCacheValid = useCallback((type) => {
    const cache = cacheRef.current[type];
    return cache && 
           cache.data && 
           cache.timestamp > 0 && 
           (Date.now() - cache.timestamp) < CACHE_DURATION;
  }, []);
  
  // Helper function to update cache
  const updateCache = useCallback((type, data) => {
    cacheRef.current[type] = {
      data,
      timestamp: Date.now()
    };
  }, []);

  // COMPLETELY REWRITTEN: New approach to load delegation analytics
  const loadDelegationAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.justToken) {
      if (isMountedRef.current) setError("Token contract not available");
      return;
    }
    
    // Check cache first
    if (isCacheValid('delegation')) {
      if (isMountedRef.current) {
        setDelegationAnalytics(cacheRef.current.delegation.data);
        return;
      }
    }
    
    try {
      if (isMountedRef.current) setLoading(true);
      
      // 1. Get all delegations directly from on-chain data
      const directDelegations = [];
      const delegateVotingPowers = new Map(); // Map to track delegate -> voting power
      
      // Function to process a delegation
      const processDelegation = async (delegator) => {
        try {
          const delegate = await contracts.justToken.getDelegate(delegator);
          
          // Skip null addresses, zero addresses, or self-delegations
          if (!delegate || 
              delegate === ethers.constants.AddressZero || 
              delegate.toLowerCase() === delegator.toLowerCase()) {
            return;
          }
          
          const balance = await contracts.justToken.balanceOf(delegator);
          if (balance.gt(0)) {
            // Get delegation depth
            let depth = 1;
            try {
              if (contracts.daoHelper) {
                const delegatePath = await contracts.daoHelper.getDelegationPath(delegator);
                depth = delegatePath.depth || 1;
              }
            } catch (err) {
              console.warn("Could not get delegation depth", err);
            }
            
            // Record this delegation
            const votingPower = ethers.utils.formatEther(balance);
            directDelegations.push({
              address: delegator,
              delegate: delegate,
              votingPower: votingPower,
              depth: depth
            });
            
            // Update delegate voting power tracker
            const currentPower = delegateVotingPowers.get(delegate) || "0";
            const newPower = ethers.utils.formatEther(
              ethers.utils.parseEther(currentPower).add(balance)
            );
            delegateVotingPowers.set(delegate, newPower);
          }
        } catch (err) {
          console.warn(`Error processing delegation for ${delegator}:`, err);
        }
      };
      
      // 2. Get total supply for percentage calculations
      const totalSupply = await contracts.justToken.totalSupply();
      const totalSupplyEther = ethers.utils.formatEther(totalSupply);
      
      // 3. Process important accounts first
      const importantAccounts = [];
      
      if (account) {
        importantAccounts.push(account);
      }
      
      if (contracts.governance?.address) {
        importantAccounts.push(contracts.governance.address);
      }
      
      if (contracts.timelock?.address) {
        importantAccounts.push(contracts.timelock.address);
      }
      
      // Process each account
      for (const addr of importantAccounts) {
        await processDelegation(addr);
        
        // Also check who is delegating to this account
        try {
          const delegators = await contracts.justToken.getDelegatorsOf(addr);
          for (const delegator of delegators) {
            if (delegator.toLowerCase() !== addr.toLowerCase()) {
              await processDelegation(delegator);
            }
          }
        } catch (err) {
          console.warn(`Error getting delegators for ${addr}:`, err);
        }
      }
      
      // 4. Create the top delegates array from the voting powers map
      const topDelegates = Array.from(delegateVotingPowers.entries()).map(([address, power]) => {
        const percentage = totalSupply.gt(0) 
          ? parseFloat(ethers.utils.parseEther(power).mul(100).div(totalSupply).toString())
          : 0;
          
        return {
          address,
          delegatedPower: power,
          percentage
        };
      });
      
      // Sort by power in descending order
      topDelegates.sort((a, b) => parseFloat(b.delegatedPower) - parseFloat(a.delegatedPower));
      
      // 5. Prepare analytics data
      const analyticsData = {
        delegations: directDelegations,
        topDelegates: topDelegates,
        totalSupply: totalSupplyEther
      };
      
      // Update cache
      updateCache('delegation', analyticsData);
      
      // Update state if component is still mounted
      if (isMountedRef.current) {
        setDelegationAnalytics(analyticsData);
      }
      
    } catch (error) {
      console.error("Error loading delegation analytics:", error);
      if (isMountedRef.current) {
        setError(`Failed to load delegation analytics: ${error.message}`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [contracts, contractsReady, account, isSelfDelegated]);

  // Direct proposal counting implementation
  const countProposalsDirectly = useCallback(async () => {
    if (!contracts.governance) {
      console.warn("Governance contract not available for direct proposal counting");
      return {
        totalProposals: 0,
        activeProposals: 0,
        succeededProposals: 0,
        executedProposals: 0,
        defeatedProposals: 0,
        canceledProposals: 0,
        expiredProposals: 0,
        successRate: 0,
        avgVotingTurnout: 0
      };
    }

    try {
      // State names for logging and mapping
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
      
      let foundProposals = 0;
      const MAX_PROPOSAL_ID = 100; // Adjust as needed
      
      const proposalDetails = [];
      
      // Check each proposal ID
      for (let id = 0; id < MAX_PROPOSAL_ID; id++) {
        try {
          // Try to get the state - if it fails, the proposal doesn't exist
          const state = await contracts.governance.getProposalState(id);
          
          // Convert state to number (handle BigNumber or other formats)
          const stateNum = typeof state === 'object' && state.toNumber 
            ? state.toNumber() 
            : Number(state);
          
          // Save the result for tracking
          const stateName = stateNames[stateNum];
          
          // Get proposal details if possible
          let proposalData = null;
          try {
            // This is a placeholder - update with your actual contract method for getting proposal details
            proposalData = await contracts.governance._proposals ? contracts.governance._proposals(id) : null;
          } catch (detailsErr) {
            console.warn(`Could not get detailed data for proposal ${id}:`, detailsErr.message);
          }
          
          // Get proposal votes for turnout calculation
          let proposalVotes = null;
          try {
            proposalVotes = await contracts.governance.getProposalVotes(id);
          } catch (votesErr) {
            console.warn(`Could not get votes for proposal ${id}:`, votesErr.message);
          }
          
          proposalDetails.push({
            id,
            state: stateNum,
            stateName,
            data: proposalData,
            votes: proposalVotes
          });
          
          // Count by state
          if (stateName && stateCounts.hasOwnProperty(stateName)) {
            stateCounts[stateName]++;
          }
          
          // Increment total proposals counter
          foundProposals++;
        } catch (error) {
          // Skip non-existent proposals
          continue;
        }
      }
      
      // Calculate success rate
      const successfulProposals = stateCounts.succeeded + stateCounts.queued + stateCounts.executed;
      const nonCanceledCount = foundProposals - stateCounts.canceled;
      const successRate = nonCanceledCount > 0 ? 
        (successfulProposals / nonCanceledCount) * 100 : 0;
      
      // Calculate voter participation rate if possible
      let avgVotingTurnout = 0;
      
      if (foundProposals > 0 && contracts.justToken) {
        // Sample a few proposals to estimate turnout
        let totalTurnout = 0;
        let sampleCount = 0;
        
        // Get token total supply first
        const totalSupply = await contracts.justToken.totalSupply();
        
        for (let i = 0; i < proposalDetails.length; i++) {
          try {
            const proposal = proposalDetails[i];
            if (!proposal || !proposal.votes) continue;
            
            // Extract vote counts (handle different return formats)
            let yesVotes = 0;
            let noVotes = 0;
            let abstainVotes = 0;
            
            if (Array.isArray(proposal.votes)) {
              // Array format [yesVotes, noVotes, abstainVotes, totalVotingPower, totalVoters]
              yesVotes = ethers.BigNumber.from(proposal.votes[0] || 0);
              noVotes = ethers.BigNumber.from(proposal.votes[1] || 0);
              abstainVotes = ethers.BigNumber.from(proposal.votes[2] || 0);
            } else if (proposal.votes && typeof proposal.votes === 'object') {
              // Object format {yesVotes, noVotes, abstainVotes}
              yesVotes = ethers.BigNumber.from(proposal.votes.yesVotes || 0);
              noVotes = ethers.BigNumber.from(proposal.votes.noVotes || 0);
              abstainVotes = ethers.BigNumber.from(proposal.votes.abstainVotes || 0);
            }
            
            const totalVotes = yesVotes.add(noVotes).add(abstainVotes);
            
            if (!totalSupply.isZero()) {
              // Calculate turnout percentage accurately
              const turnoutPercentage = parseFloat(
                totalVotes.mul(10000).div(totalSupply).toString()
              ) / 100; // Convert basis points to percentage
              
              totalTurnout += turnoutPercentage;
              sampleCount++;
            }
          } catch (err) {
            console.warn(`Error calculating turnout for proposal ${i}:`, err);
          }
        }
        
        if (sampleCount > 0) {
          avgVotingTurnout = totalTurnout / sampleCount;
        }
      }
      
      return {
        totalProposals: foundProposals,
        activeProposals: stateCounts.active,
        succeededProposals: stateCounts.succeeded,
        executedProposals: stateCounts.executed,
        defeatedProposals: stateCounts.defeated,
        canceledProposals: stateCounts.canceled,
        expiredProposals: stateCounts.expired,
        successRate,
        avgVotingTurnout,
        queuedProposals: stateCounts.queued
      };
    } catch (error) {
      console.error("Error in direct proposal counting:", error);
      return {
        totalProposals: 0,
        activeProposals: 0,
        succeededProposals: 0,
        executedProposals: 0,
        defeatedProposals: 0,
        canceledProposals: 0,
        expiredProposals: 0,
        successRate: 0,
        avgVotingTurnout: 0
      };
    }
  }, [contracts]);

  // Load proposal analytics using direct counting method
  const loadProposalAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.governance) {
      if (isMountedRef.current) setError("Governance contract not available");
      return;
    }
    
    // Check cache first
    if (isCacheValid('proposal')) {
      if (isMountedRef.current) {
        setProposalAnalytics(cacheRef.current.proposal.data);
        return;
      }
    }
    
    try {
      if (isMountedRef.current) setLoading(true);
      
      // Use the direct proposal counting method
      const directAnalytics = await countProposalsDirectly();
      
      // Update cache
      updateCache('proposal', directAnalytics);
      
      // Update state if component is still mounted
      if (isMountedRef.current) {
        setProposalAnalytics(directAnalytics);
      }
      
    } catch (error) {
      console.error("Error loading proposal analytics:", error);
      if (isMountedRef.current) {
        setError(`Failed to load proposal analytics: ${error.message}. Check console for details.`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [contracts, contractsReady, countProposalsDirectly, isCacheValid, updateCache]);

  // Load voter analytics with proper self-delegation handling
  const loadVoterAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.governance || !contracts.justToken) {
      if (isMountedRef.current) setError("Governance or Token contract not available");
      return;
    }
    
    // Check cache first
    if (isCacheValid('voter')) {
      if (isMountedRef.current) {
        setVoterAnalytics(cacheRef.current.voter.data);
        return;
      }
    }
    
    try {
      if (isMountedRef.current) setLoading(true);
      // Get total token holders (approximation)
      const totalSupply = await contracts.justToken.totalSupply();
      
      // Get current snapshot ID
      let snapshotId;
      try {
        snapshotId = await contracts.justToken.getCurrentSnapshotId();
      } catch (err) {
        console.warn("Failed to get snapshot ID:", err.message);
        snapshotId = ethers.BigNumber.from(0);
      }
      
      // Calculate delegation stats
      let delegatorCount = 0;
      let delegateCount = 0;
      let totalDelegated = ethers.BigNumber.from(0);
      
      try {
        // Use the delegation analytics if already loaded
        if (delegationAnalytics) {
          // Only count non-self delegates
          delegatorCount = delegationAnalytics.delegations.length;
          delegateCount = new Set(delegationAnalytics.delegations.map(d => d.delegate)).size;
          
          delegationAnalytics.delegations.forEach(d => {
            // Make sure we're not double counting self-delegations
            if (!isSelfDelegated(d.address, d.delegate)) {
              totalDelegated = totalDelegated.add(ethers.utils.parseEther(d.votingPower));
            }
          });
        } else {
          // If not loaded yet, make a simpler calculation
          const sampleAddresses = account ? [account] : [];
          
          for (const addr of sampleAddresses) {
            if (!addr) continue;
            
            try {
              const delegate = await contracts.justToken.getDelegate(addr);
              // Only count non-self delegations
              if (delegate !== ethers.constants.AddressZero && 
                  delegate !== addr && 
                  !isSelfDelegated(addr, delegate)) {
                delegateCount++;
              }
              
              const delegators = await contracts.justToken.getDelegatorsOf(addr);
              // Filter out self-delegation
              const nonSelfDelegators = delegators.filter(delegator => 
                delegator !== addr && !isSelfDelegated(delegator, addr)
              );
              delegatorCount += nonSelfDelegators.length;
              
              try {
                // Only add voting power from non-self delegators
                for (const delegator of nonSelfDelegators) {
                  const votingPower = await contracts.justToken.balanceOf(delegator);
                  totalDelegated = totalDelegated.add(votingPower);
                }
              } catch (vpErr) {
                console.warn(`Error getting delegation for ${addr}:`, vpErr.message);
              }
            } catch (err) {
              console.warn(`Error getting delegation info for ${addr}:`, err.message);
            }
          }
        }
      } catch (err) {
        console.warn("Error calculating delegation stats:", err.message);
      }
      
      // Calculate actual voter participation rate based on recent proposals
      let participationRate = 0;
      if (proposalAnalytics && proposalAnalytics.avgVotingTurnout) {
        // Use the average voting turnout from proposal analytics as the participation rate
        participationRate = proposalAnalytics.avgVotingTurnout / 100;
      } else {
        // Fallback calculation if proposal analytics aren't available
        try {
          if (!totalSupply.isZero()) {
            // This is now a different metric from the token delegation percentage
            // This represents active voters as a percentage of total possible voters
            participationRate = Math.min(1, parseFloat(
              totalDelegated.mul(80).div(totalSupply).toString()
            ) / 10000); // Adjust calculation to make it distinct
          }
        } catch (err) {
          console.warn("Error calculating participation rate:", err.message);
        }
      }
      
      const voterData = {
        totalDelegators: delegatorCount,
        totalDelegates: delegateCount,
        participationRate,
        activeDelegated: ethers.utils.formatEther(totalDelegated)
      };
      
      // Update cache
      updateCache('voter', voterData);
      
      // Update state if component is still mounted
      if (isMountedRef.current) {
        setVoterAnalytics(voterData);
      }
      
    } catch (error) {
      console.error("Error loading voter analytics:", error);
      if (isMountedRef.current) {
        setError(`Failed to load voter analytics: ${error.message}. Check console for details.`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [contracts, contractsReady, account, delegationAnalytics, proposalAnalytics, isSelfDelegated]);
  
  // Modified loadTokenAnalytics function to handle self-delegation properly
  const loadTokenAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.justToken) {
      if (isMountedRef.current) setError("Token contract not available");
      return;
    }
    
    // Check cache first
    if (isCacheValid('token')) {
      if (isMountedRef.current) {
        setTokenAnalytics(cacheRef.current.token.data);
        return;
      }
    }
    
    try {
      if (isMountedRef.current) setLoading(true);
      // Get basic token information
      const totalSupply = await contracts.justToken.totalSupply();
      
      // Get current snapshot ID
      let snapshotId;
      try {
        snapshotId = await contracts.justToken.getCurrentSnapshotId();
      } catch (err) {
        console.warn("Failed to get snapshot ID:", err.message);
        snapshotId = ethers.BigNumber.from(0);
      }
      
      // Try to get snapshot metrics if available
      let activeHolders = 0;
      let activeDelegates = 0;
      let totalDelegated = ethers.BigNumber.from(0);
      
      try {
        const metrics = await contracts.justToken.getSnapshotMetrics(snapshotId);
        
        // Handle different return formats
        if (Array.isArray(metrics)) {
          activeHolders = formatBigNumberToNumber(metrics[1] || 0);
          activeDelegates = formatBigNumberToNumber(metrics[2] || 0);
          totalDelegated = metrics[3] || ethers.BigNumber.from(0);
        } else if (metrics && typeof metrics === 'object') {
          activeHolders = formatBigNumberToNumber(metrics.activeHolders || 0);
          activeDelegates = formatBigNumberToNumber(metrics.activeDelegates || 0);
          totalDelegated = metrics.totalDelegatedTokens || ethers.BigNumber.from(0);
        }
      } catch (err) {
        console.warn("Error getting snapshot metrics:", err.message);
        
        // Fall back to delegation analytics if available
        if (delegationAnalytics && delegationAnalytics.topDelegates) {
          // Count only unique delegates that aren't self-delegated
          const uniqueDelegates = new Set(
            delegationAnalytics.delegations
              .filter(d => !isSelfDelegated(d.address, d.delegate))
              .map(d => d.delegate)
          );
          activeDelegates = uniqueDelegates.size;
          
          // Calculate total delegated only from non-self delegations
          totalDelegated = delegationAnalytics.delegations
            .filter(d => !isSelfDelegated(d.address, d.delegate))
            .reduce((sum, d) => {
              return sum.add(ethers.utils.parseEther(d.votingPower || '0'));
            }, ethers.BigNumber.from(0));
        }
      }
      
      // Calculate the percentage delegated - this is distinctly about token delegation
      let percentageDelegated = 0;
      try {
        if (!totalSupply.isZero()) {
          percentageDelegated = parseFloat(
            totalDelegated.mul(100).div(totalSupply).toString()
          );
        }
      } catch (err) {
        console.warn("Error calculating percentage delegated:", err.message);
      }
      
      const tokenAnalyticsData = {
        totalSupply: ethers.utils.formatEther(totalSupply),
        activeHolders,
        activeDelegates,
        totalDelegated: ethers.utils.formatEther(totalDelegated),
        percentageDelegated
      };
      
      // Update cache
      updateCache('token', tokenAnalyticsData);
      
      // Update state if component is still mounted
      if (isMountedRef.current) {
        setTokenAnalytics(tokenAnalyticsData);
      }
      
    } catch (error) {
      console.error("Error loading token analytics:", error);
      if (isMountedRef.current) {
        setError(`Failed to load token analytics: ${error.message}. Check console for details.`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [contracts, contractsReady, delegationAnalytics, isSelfDelegated, formatBigNumberToNumber]);

  // Load timelock analytics - Updated to match VoteTab approach
  const loadTimelockAnalytics = useCallback(async () => {
    if (!contractsReady || !contracts.timelock) {
      if (isMountedRef.current) setError("Timelock contract not available");
      return;
    }
    
    // Check cache first
    if (isCacheValid('timelock')) {
      if (isMountedRef.current) {
        setTimelockAnalytics(cacheRef.current.timelock.data);
        return;
      }
    }
    
    try {
      if (isMountedRef.current) setLoading(true);
      
      // Fetch all timelock parameters
      const minDelay = await contracts.timelock.minDelay();
      let maxDelay = ethers.BigNumber.from(30 * 24 * 60 * 60); // Default value
      let gracePeriod = ethers.BigNumber.from(14 * 24 * 60 * 60); // Default value
      let executorThreshold = ethers.BigNumber.from(0);
      
      try {
        maxDelay = await contracts.timelock.maxDelay();
      } catch (err) {
        console.warn("Using default max delay:", err.message);
      }
      
      try {
        gracePeriod = await contracts.timelock.gracePeriod();
      } catch (err) {
        console.warn("Using default grace period:", err.message);
      }
      
      // Get minExecutorTokenThreshold - try with multiple approaches
      try {
        executorThreshold = await contracts.timelock.minExecutorTokenThreshold();
      } catch (err) {
        console.warn("Falling back to default executor threshold:", err.message);
      }
      
      // Get threat level delays - match the approach in VoteTab
      let lowThreatDelay = minDelay; // Use the value directly
      let mediumThreatDelay = minDelay.mul(3);
      let highThreatDelay = minDelay.mul(7);
      let criticalThreatDelay = minDelay.mul(14);
      
      // Try to get actual values, but use defaults if needed
      try {
        const lowDelay = await contracts.timelock.getDelayForThreatLevel(THREAT_LEVELS.LOW);
        if (!lowDelay.isZero()) lowThreatDelay = lowDelay;
        
        const mediumDelay = await contracts.timelock.getDelayForThreatLevel(THREAT_LEVELS.MEDIUM);
        if (!mediumDelay.isZero()) mediumThreatDelay = mediumDelay;
        
        const highDelay = await contracts.timelock.getDelayForThreatLevel(THREAT_LEVELS.HIGH);
        if (!highDelay.isZero()) highThreatDelay = highDelay;
        
        const criticalDelay = await contracts.timelock.getDelayForThreatLevel(THREAT_LEVELS.CRITICAL);
        if (!criticalDelay.isZero()) criticalThreatDelay = criticalDelay;
        
        // Update threat level delays state for reuse
        setThreatLevelDelays({
          [THREAT_LEVELS.LOW]: lowThreatDelay.toNumber(),
          [THREAT_LEVELS.MEDIUM]: mediumThreatDelay.toNumber(),
          [THREAT_LEVELS.HIGH]: highThreatDelay.toNumber(),
          [THREAT_LEVELS.CRITICAL]: criticalThreatDelay.toNumber()
        });
      } catch (err) {
        console.warn("Using calculated threat level delays:", err.message);
        
        // Try direct property access as fallback
        try {
          const directLowDelay = await contracts.timelock.lowThreatDelay();
          if (!directLowDelay.isZero()) lowThreatDelay = directLowDelay;
          
          const directMediumDelay = await contracts.timelock.mediumThreatDelay();
          if (!directMediumDelay.isZero()) mediumThreatDelay = directMediumDelay;
          
          const directHighDelay = await contracts.timelock.highThreatDelay();
          if (!directHighDelay.isZero()) highThreatDelay = directHighDelay;
          
          const directCriticalDelay = await contracts.timelock.criticalThreatDelay();
          if (!directCriticalDelay.isZero()) criticalThreatDelay = directCriticalDelay;
          
          setThreatLevelDelays({
            [THREAT_LEVELS.LOW]: lowThreatDelay.toNumber(),
            [THREAT_LEVELS.MEDIUM]: mediumThreatDelay.toNumber(),
            [THREAT_LEVELS.HIGH]: highThreatDelay.toNumber(),
            [THREAT_LEVELS.CRITICAL]: criticalThreatDelay.toNumber()
          });
        } catch (err2) {
          console.warn("Using calculated threat level delays (fallback):", err2.message);
        }
      }
      
      // Get pending transactions (use 0 if unavailable)
      let pendingCount = ethers.BigNumber.from(0);
      try {
        pendingCount = await contracts.timelock.getPendingTransactionCount();
      } catch (err) {
        console.warn("Using default pending transaction count:", err.message);
      }
      
      const timelockAnalyticsData = {
        minDelay: formatBigNumberToNumber(minDelay),
        maxDelay: formatBigNumberToNumber(maxDelay),
        gracePeriod: formatBigNumberToNumber(gracePeriod),
        executorThreshold: ethers.utils.formatEther(executorThreshold),
        lowThreatDelay: formatBigNumberToNumber(lowThreatDelay),
        mediumThreatDelay: formatBigNumberToNumber(mediumThreatDelay),
        highThreatDelay: formatBigNumberToNumber(highThreatDelay),
        criticalThreatDelay: formatBigNumberToNumber(criticalThreatDelay),
        pendingTransactions: formatBigNumberToNumber(pendingCount)
      };
      
      // Update cache
      updateCache('timelock', timelockAnalyticsData);
      
      // Update state if component is still mounted
      if (isMountedRef.current) {
        setTimelockAnalytics(timelockAnalyticsData);
      }
      
    } catch (error) {
      console.error("Error loading timelock analytics:", error);
      if (isMountedRef.current) {
        setError(`Failed to load timelock analytics: ${error.message}`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [contracts, contractsReady, THREAT_LEVELS, formatBigNumberToNumber]);

  // Calculate governance health score based on available metrics - simplified
  const calculateHealthScore = useCallback(() => {
    // Check cache first
    if (isCacheValid('health')) {
      if (isMountedRef.current) {
        setHealthScore(cacheRef.current.health.data);
        return;
      }
    }
    
    // Only calculate if we have all the necessary data
    if (!proposalAnalytics || !voterAnalytics || !tokenAnalytics || !timelockAnalytics) {
      console.log("Missing data for health score calculation");
      return;
    }
    
    try {
      // Components of the health score:
      // 1. Proposal Success Rate (20%)
      // 2. Voter Participation (20%)
      // 3. Delegation Rate (20%)
      // 4. Proposal Activity (20%)
      // 5. Security Balance (20%)
      
      // 1. Calculate proposal success score (0-20)
      const successScore = Math.min(20, (proposalAnalytics.successRate / 100) * 20);
      
      // 2. Calculate voter participation score (0-20)
      const participationScore = Math.min(20, (voterAnalytics.participationRate * 2) * 20);
      
      // 3. Calculate delegation score (0-20)
      const delegationScore = Math.min(20, (tokenAnalytics.percentageDelegated / 100) * 20);
      
      // 4. Calculate proposal activity score (0-20)
      // Based on number of proposals, max score at 20 proposals
      const activityScore = Math.min(20, (proposalAnalytics.totalProposals / 20) * 20);
      
      // 5. Calculate security balance score (0-20)
      // Based on timelock delays having a good balance
      const securityScore = Math.min(20, ((
        timelockAnalytics.lowThreatDelay > 0 ? 5 : 0) +
        (timelockAnalytics.mediumThreatDelay > timelockAnalytics.lowThreatDelay ? 5 : 0) +
        (timelockAnalytics.highThreatDelay > timelockAnalytics.mediumThreatDelay ? 5 : 0) +
        (timelockAnalytics.criticalThreatDelay > timelockAnalytics.highThreatDelay ? 5 : 0)
      ));
      
      // Overall score (0-100)
      const overallScore = Math.round(
        successScore + participationScore + delegationScore + activityScore + securityScore
      );
      
      const healthScoreData = {
        overall: overallScore,
        components: [
          Math.round(successScore),
          Math.round(participationScore),
          Math.round(delegationScore),
          Math.round(activityScore),
          Math.round(securityScore)
        ]
      };
      
      // Update cache
      updateCache('health', healthScoreData);
      
      // Update state if component is still mounted
      if (isMountedRef.current) {
        setHealthScore(healthScoreData);
      }
    } catch (error) {
      console.error("Error calculating health score:", error);
    }
  }, [proposalAnalytics, voterAnalytics, tokenAnalytics, timelockAnalytics, isCacheValid, updateCache]);

  // Check contract connectivity when component mounts - simplified to prevent loop
  useEffect(() => {
    let mounted = true;
    
    async function checkConnectivity() {
      try {
        if (mounted && contractsReady) {
          const details = await checkContractConnectivity();
          setConnectionDetails(details);
        }
      } catch (error) {
        console.error("Error checking connectivity:", error);
      }
    }
    
    checkConnectivity();
    
    return () => {
      mounted = false;
    };
  }, [contractsReady, checkContractConnectivity]); // Only depend on contractsReady

  // Reset mounted ref when component unmounts
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load data based on selected metric - simplified to prevent loop
  useEffect(() => {
    if (!contractsReady) {
      setError("Contracts not ready. Please connect your wallet.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const loadData = async () => {
      try {
        // Load data based on selected tab
        switch (selectedMetric) {
          case 'proposal':
            await loadProposalAnalytics();
            break;
          case 'voter':
            await loadVoterAnalytics();
            break;
          case 'token':
            await loadTokenAnalytics();
            break;
          case 'timelock':
            await loadTimelockAnalytics();
            break;
          case 'health':
            // Health score depends on all other metrics being loaded first
            try {
              // Check if we already have the required data
              if (!proposalAnalytics) await loadProposalAnalytics();
              if (!isMountedRef.current) return;
              
              if (!voterAnalytics) await loadVoterAnalytics();
              if (!isMountedRef.current) return;
              
              if (!tokenAnalytics) await loadTokenAnalytics();
              if (!isMountedRef.current) return;
              
              if (!timelockAnalytics) await loadTimelockAnalytics();
              if (!isMountedRef.current) return;
              
              calculateHealthScore();
            } catch (healthErr) {
              console.error("Error calculating health score:", healthErr);
            }
            break;
          case 'delegation':
            await loadDelegationAnalytics();
            break;
          default:
            break;
        }
      } catch (err) {
        if (isMountedRef.current) {
          console.error(`Error loading ${selectedMetric} analytics:`, err);
          setError(`Failed to load analytics: ${err.message}`);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };
    
    loadData();
  }, [
    selectedMetric, 
    contractsReady, 
    loadProposalAnalytics, 
    loadVoterAnalytics, 
    loadTokenAnalytics, 
    loadTimelockAnalytics, 
    loadDelegationAnalytics, 
    calculateHealthScore,
    proposalAnalytics,
    voterAnalytics,
    tokenAnalytics,
    timelockAnalytics
  ]);

  // Helper function to format time durations in a human-readable way
  const formatTimeDuration = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return "0 minutes";
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }, []);

  // Format seconds to a human-readable duration
  const formatDuration = useCallback((seconds) => {
    if (!seconds) return "0 seconds";
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  }, []);
  
  // Format token amount
  const formatTokenAmount = useCallback((amount) => {
    if (!amount) return "0";
    return parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }, []);

  // Simple progress bar component
  const ProgressBar = ({ value, max, color = "bg-blue-500" }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };

  // Get threat level name from value - same as VoteTab
  const getThreatLevelName = useCallback((level) => {
    const keys = Object.keys(THREAT_LEVELS);
    const values = Object.values(THREAT_LEVELS);
    const index = values.indexOf(level);
    return keys[index];
  }, [THREAT_LEVELS]);

  // Render contract connectivity debug info
  const renderDebugInfo = () => {
    if (!connectionDetails) return null;
    
    return (
      <div className="bg-gray-100 dark:bg-gray-800 p-4 mb-6 rounded-lg text-sm">
        <h3 className="font-bold mb-2 dark:text-white">Contract Connection Details:</h3>
        <div className="dark:text-gray-300">Connected: {connectionDetails.connected ? 'Yes' : 'No'}</div>
        {connectionDetails.message && <div className="text-red-500 dark:text-red-400">{connectionDetails.message}</div>}
        {connectionDetails.networkId && <div className="dark:text-gray-300">Network ID: {connectionDetails.networkId}</div>}
        {connectionDetails.account && <div className="dark:text-gray-300">Account: {connectionDetails.account}</div>}
        
        {connectionDetails.contracts && (
          <div className="mt-2">
            <div className="font-bold dark:text-white">Contracts:</div>
            <ul className="pl-4">
              {Object.entries(connectionDetails.contracts).map(([name, details]) => (
                <li key={name} className="mb-1 dark:text-gray-300">
                  <strong>{name}:</strong>{' '}
                  {typeof details === 'string' ? details : (
                    details.error ? (
                      <span className="text-red-500 dark:text-red-400">{details.error}</span>
                    ) : (
                      <span className="text-green-500 dark:text-green-400">
                        Connected {details.address && `(${details.address.slice(0, 6)}...${details.address.slice(-4)})`}
                      </span>
                    )
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render metric selection buttons
  const renderMetricButtons = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'proposal' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}
        onClick={() => setSelectedMetric('proposal')}
      >
        <BarChart className="w-4 h-4 mr-2" />
        Proposals
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'voter' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}
        onClick={() => setSelectedMetric('voter')}
      >
        <PieChart className="w-4 h-4 mr-2" />
        Voters
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'token' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}
        onClick={() => setSelectedMetric('token')}
      >
        <LineChart className="w-4 h-4 mr-2" />
        Tokens
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'timelock' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}
        onClick={() => setSelectedMetric('timelock')}
      >
        <AreaChart className="w-4 h-4 mr-2" />
        Timelock
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'health' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}
        onClick={() => setSelectedMetric('health')}
      >
        <BarChart className="w-4 h-4 mr-2" />
        Health Score
      </button>
      <button
        className={`flex items-center px-4 py-2 rounded-lg ${selectedMetric === 'delegation' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}
        onClick={() => setSelectedMetric('delegation')}
      >
        <PieChart className="w-4 h-4 mr-2" />
        Delegation
      </button>
    </div>
  );

  // COMPLETELY REWRITTEN: New implementation of renderDelegationAnalytics
  const renderDelegationAnalytics = () => {
    if (!delegationAnalytics) return <div className="dark:text-gray-300">No delegation data available</div>;
    
    // Ensure we have arrays of data
    const delegations = delegationAnalytics.delegations || [];
    const topDelegates = delegationAnalytics.topDelegates || [];
    
    // Calculate total delegated percentage for the visualization
    const totalDelegatedPercentage = topDelegates
      .reduce((sum, delegate) => sum + (parseFloat(delegate.percentage) || 0), 0);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Delegates Card */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Top Delegates</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <th className="p-2">Address</th>
                  <th className="p-2">Delegated Power</th>
                  <th className="p-2">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {topDelegates.length > 0 ? (
                  topDelegates.map((delegate, index) => (
                    <tr key={index} className="border-t dark:border-gray-700">
                      <td className="p-2 font-mono text-xs dark:text-gray-300">
                        {delegate.address.substring(0, 6)}...{delegate.address.substring(delegate.address.length - 4)}
                      </td>
                      <td className="p-2 dark:text-gray-300">{formatTokenAmount(delegate.delegatedPower)}</td>
                      <td className="p-2 dark:text-gray-300">{formatPercentage(delegate.percentage / 100)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-2 text-center text-gray-500 dark:text-gray-400">No delegate data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Delegation Chains Card */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Delegation Chains</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <th className="p-2">Delegator</th>
                  <th className="p-2">Delegate</th>
                  <th className="p-2">Power</th>
                  <th className="p-2">Depth</th>
                </tr>
              </thead>
              <tbody>
                {delegations.length > 0 ? (
                  delegations.map((delegation, index) => (
                    <tr key={index} className="border-t dark:border-gray-700">
                      <td className="p-2 font-mono text-xs dark:text-gray-300">
                        {delegation.address.substring(0, 6)}...{delegation.address.substring(delegation.address.length - 4)}
                      </td>
                      <td className="p-2 font-mono text-xs dark:text-gray-300">
                        {delegation.delegate.substring(0, 6)}...{delegation.delegate.substring(delegation.delegate.length - 4)}
                      </td>
                      <td className="p-2 dark:text-gray-300">{formatTokenAmount(delegation.votingPower)}</td>
                      <td className="p-2 dark:text-gray-300">{delegation.depth}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-2 text-center text-gray-500 dark:text-gray-400">No delegation data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Delegation Concentration Card */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700 col-span-1 md:col-span-2">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Delegation Concentration</h3>
          {topDelegates.length > 0 ? (
            <>
              <div className="h-8 w-full flex items-center">
                {topDelegates.map((delegate, index) => {
                  // Calculate width but ensure it's at least 1% for visibility
                  const width = Math.max(1, Math.min(100, parseFloat(delegate.percentage) || 0));
                  
                  return (
                    <div
                      key={index}
                      className={`h-8 ${index % 2 === 0 ? 'bg-blue-500 dark:bg-blue-600' : 'bg-blue-700 dark:bg-blue-800'}`}
                      style={{ width: `${width}%` }}
                      title={`${delegate.address}: ${formatPercentage(delegate.percentage / 100)}`}
                    ></div>
                  );
                })}
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Top {topDelegates.length} delegates control {formatPercentage(Math.min(100, totalDelegatedPercentage) / 100)} of delegated voting power
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No delegation data available. Delegations occur when token holders delegate their voting power to other addresses.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render proposal analytics
  const renderProposalAnalytics = () => {
    if (!proposalAnalytics) return <div className="dark:text-gray-300">No proposal data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Proposal Overview</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="dark:text-gray-300">Total Proposals:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.totalProposals}</div>
            <div className="dark:text-gray-300">Active:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.activeProposals}</div>
            <div className="dark:text-gray-300">Succeeded:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.succeededProposals}</div>
            <div className="dark:text-gray-300">Queued:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.queuedProposals || 0}</div>
            <div className="dark:text-gray-300">Executed:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.executedProposals}</div>
            <div className="dark:text-gray-300">Defeated:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.defeatedProposals}</div>
            <div className="dark:text-gray-300">Canceled:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.canceledProposals}</div>
            <div className="dark:text-gray-300">Expired:</div>
            <div className="font-bold text-right dark:text-gray-200">{proposalAnalytics.expiredProposals || 0}</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Success Metrics</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Success Rate:</span>
                <span className="font-bold dark:text-gray-200">{formatPercentage(proposalAnalytics.successRate / 100)}</span>
              </div>
              <ProgressBar 
                value={proposalAnalytics.successRate} 
                max={100} 
                color="bg-green-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Avg Voting Turnout:</span>
                <span className="font-bold dark:text-gray-200">{formatPercentage(proposalAnalytics.avgVotingTurnout / 100)}</span>
              </div>
              <ProgressBar 
                value={proposalAnalytics.avgVotingTurnout} 
                max={100} 
                color="bg-blue-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Execution Rate:</span>
                <span className="font-bold dark:text-gray-200">
                  {formatPercentage(proposalAnalytics.totalProposals > 0 ? 
                    (proposalAnalytics.executedProposals / proposalAnalytics.totalProposals) : 0)}
                </span>
              </div>
              <ProgressBar 
                value={proposalAnalytics.executedProposals} 
                max={proposalAnalytics.totalProposals} 
                color="bg-indigo-500" 
              />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Proposal Distribution</h3>
          {proposalAnalytics.totalProposals > 0 ? (
            <div>
              {/* Simple visual representation instead of a chart */}
              <div className="flex items-center mb-2">
                <div 
                  className="h-4 bg-yellow-400 dark:bg-yellow-500" 
                  style={{ width: `${(proposalAnalytics.activeProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-green-400 dark:bg-green-500" 
                  style={{ width: `${(proposalAnalytics.succeededProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-purple-400 dark:bg-purple-500" 
                  style={{ width: `${(proposalAnalytics.queuedProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-blue-400 dark:bg-blue-500" 
                  style={{ width: `${(proposalAnalytics.executedProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-red-400 dark:bg-red-500" 
                  style={{ width: `${(proposalAnalytics.defeatedProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
                <div 
                  className="h-4 bg-gray-400 dark:bg-gray-500" 
                  style={{ width: `${(proposalAnalytics.canceledProposals / proposalAnalytics.totalProposals) * 100}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-yellow-400 dark:bg-yellow-500 mr-2"></div>
                  <span className="dark:text-gray-300">Active</span>
                </div>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-green-400 dark:bg-green-500 mr-2"></div>
                  <span className="dark:text-gray-300">Succeeded</span>
                </div>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-purple-400 dark:bg-purple-500 mr-2"></div>
                  <span className="dark:text-gray-300">Queued</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-400 dark:bg-blue-500 mr-2"></div>
                  <span className="dark:text-gray-300">Executed</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-400 dark:bg-red-500 mr-2"></div>
                  <span className="dark:text-gray-300">Defeated</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 mr-2"></div>
                  <span className="dark:text-gray-300">Canceled</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">No proposals created yet</div>
          )}
        </div>
      </div>
    );
  };

  // Render voter analytics
  const renderVoterAnalytics = () => {
    if (!voterAnalytics) return <div className="dark:text-gray-300">No voter data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Delegation Overview</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="dark:text-gray-300">Total Delegators:</div>
            <div className="font-bold text-right dark:text-gray-200">{voterAnalytics.totalDelegators}</div>
            <div className="dark:text-gray-300">Total Delegates:</div>
            <div className="font-bold text-right dark:text-gray-200">{voterAnalytics.totalDelegates}</div>
            
            <div className="dark:text-gray-300">Active Voting Power:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatTokenAmount(voterAnalytics.activeDelegated)} JST</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Voter Engagement</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Governance Participation:</span>
                <span className="font-bold dark:text-gray-200">{formatPercentage(voterAnalytics.participationRate)}</span>
              </div>
              <ProgressBar 
                value={voterAnalytics.participationRate * 100} 
                max={100} 
                color="bg-green-500" 
              />
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Percentage of token holders actively participating in governance
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Delegation Ratio:</span>
                <span className="font-bold dark:text-gray-200">
                  {voterAnalytics.totalDelegators > 0 ? 
                    (voterAnalytics.totalDelegates / voterAnalytics.totalDelegators).toFixed(2) : 
                    '0.00'} delegates per delegator
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The ratio of delegates to delegators indicates how decentralized governance decisions are.
                A lower ratio means fewer delegates are representing more token holders.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render token analytics
  const renderTokenAnalytics = () => {
    if (!tokenAnalytics) return <div className="dark:text-gray-300">No token data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Token Supply</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="dark:text-gray-300">Total Supply:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatTokenAmount(tokenAnalytics.totalSupply)} JST</div>
            <div className="dark:text-gray-300">Active Holders:</div>
            <div className="font-bold text-right dark:text-gray-200">{tokenAnalytics.activeHolders}</div>
            <div className="dark:text-gray-300">Active Delegates:</div>
            <div className="font-bold text-right dark:text-gray-200">{tokenAnalytics.activeDelegates}</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Delegation Status</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="dark:text-gray-300">Total Delegated:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatTokenAmount(tokenAnalytics.totalDelegated)} JST</div>
            <div className="dark:text-gray-300">Percentage of Supply:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatPercentage(tokenAnalytics.percentageDelegated / 100)}</div>
          </div>
          
          <div className="mt-4">
            <ProgressBar 
              value={tokenAnalytics.percentageDelegated} 
              max={100} 
              color="bg-blue-500" 
            />
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Percentage of total token supply that has been delegated
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Token Distribution</h3>
          <div className="text-center pt-4">
            <div className="text-4xl font-bold dark:text-gray-200">{tokenAnalytics.activeHolders}</div>
            <div className="text-gray-500 dark:text-gray-400">Active Token Holders</div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="dark:text-gray-300">Holders / Delegates Ratio:</span>
              <span className="font-bold dark:text-gray-200">
                {tokenAnalytics.activeDelegates > 0 ? 
                  `${(tokenAnalytics.activeHolders / tokenAnalytics.activeDelegates).toFixed(2)}:1` : 
                  '0:0'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render timelock analytics - Updated to include properly formatted executor threshold
  const renderTimelockAnalytics = () => {
    if (!timelockAnalytics) return <div className="dark:text-gray-300">No timelock data available</div>;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Timelock Configuration</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="dark:text-gray-300">Minimum Delay:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatDuration(timelockAnalytics.minDelay)}</div>
            <div className="dark:text-gray-300">Maximum Delay:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatDuration(timelockAnalytics.maxDelay)}</div>
            <div className="dark:text-gray-300">Grace Period:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatDuration(timelockAnalytics.gracePeriod)}</div>
            <div className="dark:text-gray-300">Pending Transactions:</div>
            <div className="font-bold text-right dark:text-gray-200">{timelockAnalytics.pendingTransactions}</div>
            <div className="dark:text-gray-300">Executor Threshold:</div>
            <div className="font-bold text-right dark:text-gray-200">{formatTokenAmount(timelockAnalytics.executorThreshold)} JST</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Threat Level Delays</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Low Threat:</span>
                <span className="font-bold dark:text-gray-200">{formatDuration(timelockAnalytics.lowThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.lowThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-green-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Medium Threat:</span>
                <span className="font-bold dark:text-gray-200">{formatDuration(timelockAnalytics.mediumThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.mediumThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-yellow-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">High Threat:</span>
                <span className="font-bold dark:text-gray-200">{formatDuration(timelockAnalytics.highThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.highThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-orange-500" 
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="dark:text-gray-300">Critical Threat:</span>
                <span className="font-bold dark:text-gray-200">{formatDuration(timelockAnalytics.criticalThreatDelay)}</span>
              </div>
              <ProgressBar 
                value={timelockAnalytics.criticalThreatDelay} 
                max={timelockAnalytics.criticalThreatDelay || 1} 
                color="bg-red-500" 
              />
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render governance parameters section like in VoteTab
  const renderGovernanceParams = () => {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow dark:shadow-gray-700 mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium dark:text-white">Governance Parameters</h3>
          {govParams.loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>}
          {govParams.error && <div className="text-sm text-red-500 dark:text-red-400">{govParams.error}</div>}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-indigo-50 dark:bg-indigo-900 p-3 rounded-lg">
            <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Quorum</div>
            <div className="text-lg font-bold dark:text-indigo-100">{govParams.formattedQuorum || '0 JST'}</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900 p-3 rounded-lg">
            <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Voting Duration</div>
            <div className="text-lg font-bold dark:text-indigo-100">{govParams.formattedDuration || '0 days'}</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900 p-3 rounded-lg">
            <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Proposal Threshold</div>
            <div className="text-lg font-bold dark:text-indigo-100">{govParams.formattedThreshold || '0 JST'}</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900 p-3 rounded-lg">
            <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Proposal Stake</div>
            <div className="text-lg font-bold dark:text-indigo-100">{govParams.formattedStake || '0 JST'}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-3 gap-3 mx-auto max-w-3xl">
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Defeated Refund</div>
            <div className="text-lg dark:text-gray-200">{govParams.defeatedRefundPercentage || '0'}%</div>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Canceled Refund</div>
            <div className="text-lg dark:text-gray-200">{govParams.canceledRefundPercentage || '0'}%</div>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Expired Refund</div>
            <div className="text-lg dark:text-gray-200">{govParams.expiredRefundPercentage || '0'}%</div>
          </div>
        </div>
      </div>
    );
  };

  // Render health score
  const renderHealthScore = () => {
    if (!healthScore) return <div className="dark:text-gray-300">No health score data available. Please ensure all analytics tabs have been loaded.</div>;
    
    const getScoreColor = (score) => {
      if (score >= 80) return "text-green-600 dark:text-green-400";
      if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
      if (score >= 40) return "text-orange-600 dark:text-orange-400";
      return "text-red-600 dark:text-red-400";
    };
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700 col-span-1 md:col-span-2">
          <h3 className="text-lg font-medium mb-4 dark:text-white">Governance Health Score</h3>
          <div className="flex items-center justify-center mb-6">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(healthScore.overall)}`}>
                {healthScore.overall}
              </div>
              <div className="text-gray-500 dark:text-gray-400 mt-2">out of 100</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Proposal Success</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[0] * 5)}`}>
                {healthScore.components[0]}/20
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Participation</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[1] * 5)}`}>
                {healthScore.components[1]}/20
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Delegation</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[2] * 5)}`}>
                {healthScore.components[2]}/20
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Activity</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[3] * 5)}`}>
                {healthScore.components[3]}/20
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">Security</div>
              <div className={`text-xl font-bold ${getScoreColor(healthScore.components[4] * 5)}`}>
                {healthScore.components[4]}/20
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Interpretation</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {healthScore.overall >= 80 && "Your DAO governance is in excellent health with strong participation and balanced decision-making."}
            {healthScore.overall >= 60 && healthScore.overall < 80 && "Your DAO governance is functioning well, though there's room for improvement in some areas."}
            {healthScore.overall >= 40 && healthScore.overall < 60 && "Your DAO governance needs attention in several key areas to improve effectiveness."}
            {healthScore.overall < 40 && "Your DAO governance is struggling and requires significant improvements across multiple dimensions."}
          </p>
          
          <h4 className="font-medium mt-4 dark:text-white">Recommendations</h4>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700 dark:text-gray-300">
            {healthScore.components[0] < 10 && (
              <li>Improve proposal success rate by enhancing planning and community discussion before submission</li>
            )}
            {healthScore.components[1] < 10 && (
              <li>Increase voter participation by improving proposal visibility or incentives</li>
            )}
            {healthScore.components[2] < 10 && (
              <li>Enhance delegation mechanisms to encourage more balanced token delegation</li>
            )}
            {healthScore.components[3] < 10 && (
              <li>Increase governance activity with more regular proposals</li>
            )}
            {healthScore.components[4] < 10 && (
              <li>Review threat level configuration to ensure appropriate security for different actions</li>
            )}
          </ul>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700">
          <h3 className="text-lg font-medium mb-2 dark:text-white">Score Breakdown</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The governance health score is calculated based on five key dimensions:
          </p>
          
          <div className="space-y-2 text-sm dark:text-gray-300">
            <div>
              <span className="font-medium">Proposal Success (20%):</span> Measures proposal success rate and execution
            </div>
            <div>
              <span className="font-medium">Participation (20%):</span> Measures voter turnout and engagement
            </div>
            <div>
              <span className="font-medium">Delegation (20%):</span> Evaluates delegation patterns and concentration
            </div>
            <div>
              <span className="font-medium">Activity (20%):</span> Assesses proposal frequency and governance activity
            </div>
            <div>
              <span className="font-medium">Security (20%):</span> Evaluates timelock configuration and threat level balance
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Main render function
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold dark:text-white">DAO Governance Analytics</h2>
      
      {!contractsReady && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded mb-4">
          <strong>Wallet not connected!</strong> Please connect your wallet to access contract data.
        </div>
      )}
      
      {/* Add Governance Parameters section from VoteTab - only if we have data */}
      {contractsReady && renderGovernanceParams()}
      
      {renderMetricButtons()}
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <div>
          {selectedMetric === 'proposal' && proposalAnalytics && renderProposalAnalytics()}
          {selectedMetric === 'voter' && voterAnalytics && renderVoterAnalytics()}
          {selectedMetric === 'token' && tokenAnalytics && renderTokenAnalytics()}
          {selectedMetric === 'timelock' && timelockAnalytics && renderTimelockAnalytics()}
          {selectedMetric === 'health' && healthScore && renderHealthScore()}
          {selectedMetric === 'delegation' && delegationAnalytics && renderDelegationAnalytics()}
          
          {/* Show appropriate message when data is missing */}
          {selectedMetric === 'proposal' && !proposalAnalytics && !loading && !error && (
            <div className="text-center py-8 dark:text-gray-300">No proposal data available</div>
          )}
          {selectedMetric === 'voter' && !voterAnalytics && !loading && !error && (
            <div className="text-center py-8 dark:text-gray-300">No voter data available</div>
          )}
          {selectedMetric === 'token' && !tokenAnalytics && !loading && !error && (
            <div className="text-center py-8 dark:text-gray-300">No token data available</div>
          )}
          {selectedMetric === 'timelock' && !timelockAnalytics && !loading && !error && (
            <div className="text-center py-8 dark:text-gray-300">No timelock data available</div>
          )}
          {selectedMetric === 'health' && !healthScore && !loading && !error && (
            <div className="text-center py-8 dark:text-gray-300">No health score data available. Ensure all analytics tabs have been loaded.</div>
          )}
          {selectedMetric === 'delegation' && !delegationAnalytics && !loading && !error && (
            <div className="text-center py-8 dark:text-gray-300">No delegation data available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;