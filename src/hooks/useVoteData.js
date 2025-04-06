// Import this file as src/hooks/useVoteData.js

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import blockchainDataCache from '../utils/blockchainDataCache';
import { PROPOSAL_STATES } from '../utils/constants';

/**
 * Custom hook for managing vote data fetching and processing
 */
export function useVoteData(proposals = []) {
  const { contracts, isConnected, contractsReady } = useWeb3();
  const [voteData, setVoteData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Get vote data directly from the blockchain contract
   */
  const getVoteDataFromContract = useCallback(async (proposalId) => {
    if (!contractsReady || !isConnected || !contracts.governance) {
      console.error("Cannot get vote data: contracts not ready");
      return null;
    }
    
    try {
      console.log(`Direct contract call for vote data of proposal #${proposalId}`);
      
      // First check if the proposal exists
      try {
        await contracts.governance.getProposalState(proposalId);
      } catch (err) {
        console.error(`Proposal #${proposalId} doesn't exist or can't be accessed`);
        return null;
      }
      
      // Get data directly from the contract's getProposalVoteTotals method
      const [forVotes, againstVotes, abstainVotes, totalVotingPower, voterCount] = 
        await contracts.governance.getProposalVoteTotals(proposalId);
      
      console.log(`Raw data from contract for #${proposalId}:`, {
        forVotes: forVotes.toString(),
        againstVotes: againstVotes.toString(),
        abstainVotes: abstainVotes.toString(),
        totalVotingPower: totalVotingPower.toString(),
        voterCount: voterCount.toString()
      });
      
      // Process the data into a standardized format
      const result = {
        yesVotes: ethers.utils.formatEther(forVotes),
        noVotes: ethers.utils.formatEther(againstVotes),
        abstainVotes: ethers.utils.formatEther(abstainVotes),
        totalVotingPower: ethers.utils.formatEther(totalVotingPower),
        totalVoters: voterCount.toNumber(),
        source: 'direct-contract'
      };
      
      // Calculate percentages
      if (!totalVotingPower.isZero()) {
        result.yesPercentage = parseFloat(forVotes.mul(10000).div(totalVotingPower)) / 100;
        result.noPercentage = parseFloat(againstVotes.mul(10000).div(totalVotingPower)) / 100;
        result.abstainPercentage = parseFloat(abstainVotes.mul(10000).div(totalVotingPower)) / 100;
      } else {
        result.yesPercentage = 0;
        result.noPercentage = 0;
        result.abstainPercentage = 0;
      }
      
      // Add voting power fields for consistency
      result.yesVotingPower = result.yesVotes;
      result.noVotingPower = result.noVotes;
      result.abstainVotingPower = result.abstainVotes;
      
      // Extract voter counts based on percentages if total voters > 0
      if (result.totalVoters > 0) {
        result.yesVoters = result.yesPercentage > 0 
          ? Math.max(1, Math.round((result.yesPercentage / 100) * result.totalVoters))
          : 0;
        
        result.noVoters = result.noPercentage > 0
          ? Math.max(1, Math.round((result.noPercentage / 100) * result.totalVoters))
          : 0;
        
        result.abstainVoters = result.abstainPercentage > 0
          ? Math.max(1, Math.round((result.abstainPercentage / 100) * result.totalVoters))
          : 0;
        
        // Ensure the sum matches total voters
        const calculatedTotal = result.yesVoters + result.noVoters + result.abstainVoters;
        if (calculatedTotal !== result.totalVoters) {
          const diff = result.totalVoters - calculatedTotal;
          
          // Add difference to the largest group
          if (result.yesVoters >= result.noVoters && result.yesVoters >= result.abstainVoters) {
            result.yesVoters += diff;
          } else if (result.noVoters >= result.yesVoters && result.noVoters >= result.abstainVoters) {
            result.noVoters += diff;
          } else {
            result.abstainVoters += diff;
          }
        }
      } else {
        // If no voter count available, at least set values for votes with power
        result.yesVoters = parseFloat(result.yesVotes) > 0 ? 1 : 0;
        result.noVoters = parseFloat(result.noVotes) > 0 ? 1 : 0;
        result.abstainVoters = parseFloat(result.abstainVotes) > 0 ? 1 : 0;
        result.totalVoters = result.yesVoters + result.noVoters + result.abstainVoters;
      }
      
      // Add fetch timestamp
      result.fetchedAt = Date.now();
      
      console.log(`Processed vote data for proposal #${proposalId}:`, result);
      return result;
    } catch (error) {
      console.error(`Error getting vote data from contract for proposal ${proposalId}:`, error);
      return null;
    }
  }, [contracts, isConnected, contractsReady]);

  /**
   * Get vote data from events as a fallback
   */
  const getVoteDataFromEvents = useCallback(async (proposalId) => {
    if (!contractsReady || !isConnected || !contracts.governance) {
      return null;
    }
    
    try {
      console.log(`Getting vote data from events for proposal #${proposalId}`);
      
      // First check if the proposal exists
      try {
        await contracts.governance.getProposalState(proposalId);
      } catch (err) {
        console.error(`Proposal #${proposalId} doesn't exist or can't be accessed`);
        return null;
      }
      
      // Get all vote cast events for this proposal
      const filter = contracts.governance.filters.VoteCast(proposalId);
      const events = await contracts.governance.queryFilter(filter);
      
      console.log(`Found ${events.length} vote events for proposal #${proposalId}`);
      
      if (events.length === 0) {
        // Return empty data structure with zeros
        return {
          yesVotes: "0",
          noVotes: "0",
          abstainVotes: "0",
          totalVotingPower: "0",
          totalVoters: 0,
          yesVoters: 0,
          noVoters: 0,
          abstainVoters: 0,
          yesPercentage: 0,
          noPercentage: 0,
          abstainPercentage: 0,
          yesVotingPower: "0",
          noVotingPower: "0",
          abstainVotingPower: "0",
          source: 'events-empty',
          fetchedAt: Date.now()
        };
      }
      
      // Track unique voters and their votes (most recent vote counts)
      const voterMap = new Map();
      let totalYesVotes = ethers.BigNumber.from(0);
      let totalNoVotes = ethers.BigNumber.from(0);
      let totalAbstainVotes = ethers.BigNumber.from(0);
      
      // Debug - log all events
      events.forEach((event, idx) => {
        try {
          console.log(`Vote event ${idx}:`, {
            voter: event.args.voter,
            support: event.args.support.toString(),
            power: ethers.utils.formatEther(event.args.votingPower)
          });
        } catch (err) {
          console.warn(`Error logging vote event ${idx}:`, err);
        }
      });
      
      // Process each event
      for (const event of events) {
        try {
          const voter = event.args.voter.toLowerCase();
          const support = Number(event.args.support);
          const votingPower = event.args.votingPower;
          
          // Store this voter's latest vote (overwriting previous votes if any)
          voterMap.set(voter, { support, votingPower });
        } catch (err) {
          console.warn(`Error processing vote event for proposal #${proposalId}:`, err);
        }
      }
      
      // Count votes by type
      let yesVoterCount = 0;
      let noVoterCount = 0;
      let abstainVoterCount = 0;
      
      for (const [, voteInfo] of voterMap.entries()) {
        const { support, votingPower } = voteInfo;
        
        if (support === 1) { // Yes vote
          totalYesVotes = totalYesVotes.add(votingPower);
          yesVoterCount++;
        } else if (support === 0) { // No vote
          totalNoVotes = totalNoVotes.add(votingPower);
          noVoterCount++;
        } else if (support === 2) { // Abstain vote
          totalAbstainVotes = totalAbstainVotes.add(votingPower);
          abstainVoterCount++;
        }
      }
      
      // Calculate total voting power
      const totalVotingPower = totalYesVotes.add(totalNoVotes).add(totalAbstainVotes);
      
      // Format the result
      const result = {
        yesVotes: ethers.utils.formatEther(totalYesVotes),
        noVotes: ethers.utils.formatEther(totalNoVotes),
        abstainVotes: ethers.utils.formatEther(totalAbstainVotes),
        totalVotingPower: ethers.utils.formatEther(totalVotingPower),
        totalVoters: voterMap.size,
        yesVoters: yesVoterCount,
        noVoters: noVoterCount,
        abstainVoters: abstainVoterCount,
        source: 'events',
        fetchedAt: Date.now()
      };
      
      // Calculate percentages
      if (!totalVotingPower.isZero()) {
        result.yesPercentage = parseFloat(totalYesVotes.mul(10000).div(totalVotingPower)) / 100;
        result.noPercentage = parseFloat(totalNoVotes.mul(10000).div(totalVotingPower)) / 100;
        result.abstainPercentage = parseFloat(totalAbstainVotes.mul(10000).div(totalVotingPower)) / 100;
      } else {
        result.yesPercentage = 0;
        result.noPercentage = 0;
        result.abstainPercentage = 0;
      }
      
      // Add voting power fields for consistency
      result.yesVotingPower = result.yesVotes;
      result.noVotingPower = result.noVotes;
      result.abstainVotingPower = result.abstainVotes;
      
      console.log(`Event-based vote data for proposal #${proposalId}:`, result);
      return result;
    } catch (error) {
      console.error(`Error getting vote data from events for proposal ${proposalId}:`, error);
      return null;
    }
  }, [contracts, isConnected, contractsReady]);

  /**
   * Get current blockchain state for a proposal
   */
  const getProposalState = useCallback(async (proposalId) => {
    if (!contractsReady || !isConnected || !contracts.governance) {
      return null;
    }
    
    try {
      // Try to get from cache first
      const cacheKey = `proposal-state-${proposalId}`;
      const cachedState = blockchainDataCache.get(cacheKey);
      if (cachedState !== null) {
        return cachedState;
      }
      
      // Get state from contract
      const state = await contracts.governance.getProposalState(proposalId);
      const stateValue = Number(state);
      
      // Cache the result with appropriate TTL
      // Shorter TTL for active proposals, longer for completed ones
      const ttl = stateValue === PROPOSAL_STATES.ACTIVE ? 60 : 3600;
      blockchainDataCache.set(cacheKey, stateValue, ttl);
      
      return stateValue;
    } catch (error) {
      console.error(`Error getting state for proposal ${proposalId}:`, error);
      return null;
    }
  }, [contracts, isConnected, contractsReady]);

  /**
   * Get cached or fetch fresh vote data for a proposal
   */
  const getVoteDataWithCaching = useCallback(async (proposalId, forceRefresh = false) => {
    // Generate cache key
    const cacheKey = `vote-data-${proposalId}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cachedData = blockchainDataCache.get(cacheKey);
      if (cachedData) {
        console.log(`Using cached vote data for proposal #${proposalId}`);
        return cachedData;
      }
    }
    
    console.log(`Fetching fresh vote data for proposal #${proposalId}`);
    
    // Check proposal state first for better caching strategy
    const proposalState = await getProposalState(proposalId);
    const isActive = proposalState === PROPOSAL_STATES.ACTIVE;
    
    // Try direct contract call first
    let voteData = await getVoteDataFromContract(proposalId);
    
    // If that fails, try getting from events
    if (!voteData) {
      console.log(`Falling back to events for proposal #${proposalId}`);
      voteData = await getVoteDataFromEvents(proposalId);
    }
    
    // If we still don't have data, use proposal data if available
    if (!voteData) {
      console.log(`No vote data found for proposal #${proposalId}, using fallback`);
      
      // Find the proposal in our list
      const proposal = proposals.find(p => p.id === proposalId || p.id === Number(proposalId));
      if (proposal) {
        // Create fallback data from proposal
        voteData = {
          yesVotes: proposal.yesVotes || "0",
          noVotes: proposal.noVotes || "0",
          abstainVotes: proposal.abstainVotes || "0",
          yesVotingPower: parseFloat(proposal.yesVotes) || 0,
          noVotingPower: parseFloat(proposal.noVotes) || 0,
          abstainVotingPower: parseFloat(proposal.abstainVotes) || 0,
          totalVoters: 0,
          yesVoters: 0,
          noVoters: 0,
          abstainVoters: 0,
          source: 'fallback',
          fetchedAt: Date.now()
        };
        
        // Calculate total voting power
        const totalVotingPower = 
          voteData.yesVotingPower + 
          voteData.noVotingPower + 
          voteData.abstainVotingPower;
        
        voteData.totalVotingPower = totalVotingPower;
        
        // Calculate percentages
        if (totalVotingPower > 0) {
          voteData.yesPercentage = (voteData.yesVotingPower / totalVotingPower) * 100;
          voteData.noPercentage = (voteData.noVotingPower / totalVotingPower) * 100;
          voteData.abstainPercentage = (voteData.abstainVotingPower / totalVotingPower) * 100;
          
          // Set at least 1 voter for each vote type with power
          voteData.yesVoters = voteData.yesVotingPower > 0 ? 1 : 0;
          voteData.noVoters = voteData.noVotingPower > 0 ? 1 : 0;
          voteData.abstainVoters = voteData.abstainVotingPower > 0 ? 1 : 0;
          voteData.totalVoters = voteData.yesVoters + voteData.noVoters + voteData.abstainVoters;
        }
      } else {
        // Last resort - empty data
        voteData = {
          yesVotes: "0",
          noVotes: "0",
          abstainVotes: "0",
          yesVotingPower: "0",
          noVotingPower: "0",
          abstainVotingPower: "0",
          totalVotingPower: "0",
          totalVoters: 0,
          yesVoters: 0,
          noVoters: 0,
          abstainVoters: 0,
          yesPercentage: 0,
          noPercentage: 0,
          abstainPercentage: 0,
          source: 'empty',
          fetchedAt: Date.now()
        };
      }
    }
    
    // Add the proposal state to the data
    if (proposalState !== null) {
      voteData.state = proposalState;
    }
    
    // Determine the appropriate cache TTL
    let ttlSeconds = 60; // Short TTL for active proposals
    
    // For non-active proposals, use longer TTL
    if (!isActive) {
      ttlSeconds = 86400; // 1 day for inactive proposals
    }
    
    // Cache the result
    if (voteData) {
      blockchainDataCache.set(cacheKey, voteData, ttlSeconds);
    }
    
    return voteData;
  }, [getVoteDataFromContract, getVoteDataFromEvents, proposals, getProposalState]);

  /**
   * Fetch vote data for all proposals
   */
  const fetchAllVoteData = useCallback(async () => {
    if (!proposals.length || !contractsReady || !isConnected) {
      console.log("Cannot fetch vote data: prerequisites not met");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching vote data for ${proposals.length} proposals`);
      
      const newVoteData = {};
      
      // Process proposals in batches
      const batchSize = 3; // Reduce batch size to avoid rate limiting
      
      for (let i = 0; i < proposals.length; i += batchSize) {
        const batch = proposals.slice(i, Math.min(i + batchSize, proposals.length));
        
        // Process each batch in parallel
        const batchPromises = batch.map(async (proposal) => {
          try {
            // Force refresh for active proposals
            const forceRefresh = proposal.state === PROPOSAL_STATES.ACTIVE;
            const data = await getVoteDataWithCaching(proposal.id, forceRefresh);
            
            if (data) {
              return { id: proposal.id, data };
            }
          } catch (err) {
            console.error(`Error fetching vote data for proposal #${proposal.id}:`, err);
          }
          return null;
        });
        
        const results = await Promise.all(batchPromises);
        
        // Add successful results to the data object
        results.forEach(result => {
          if (result && result.data) {
            newVoteData[result.id] = result.data;
          }
        });
        
        // Add a small delay between batches
        if (i + batchSize < proposals.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      console.log(`Successfully fetched vote data for ${Object.keys(newVoteData).length} proposals`);
      setVoteData(newVoteData);
    } catch (err) {
      console.error("Error fetching all vote data:", err);
      setError("Failed to load vote data from blockchain");
    } finally {
      setLoading(false);
    }
  }, [proposals, contractsReady, isConnected, getVoteDataWithCaching]);

  /**
   * Refresh vote data for a specific proposal
   */
  const refreshVoteData = useCallback(async (proposalId) => {
    try {
      const data = await getVoteDataWithCaching(proposalId, true); // Force refresh
      
      if (data) {
        setVoteData(prev => ({
          ...prev,
          [proposalId]: data
        }));
        return data;
      }
    } catch (err) {
      console.error(`Error refreshing vote data for proposal #${proposalId}:`, err);
    }
    return null;
  }, [getVoteDataWithCaching]);

  // Fetch all vote data on initial load and when proposals change
  useEffect(() => {
    if (proposals.length > 0) {
      fetchAllVoteData();
    }
  }, [proposals, fetchAllVoteData]);

  // Set up polling for active proposals
  useEffect(() => {
    if (!proposals.length) return;
    
    const hasActiveProposals = proposals.some(p => p.state === PROPOSAL_STATES.ACTIVE);
    
    if (hasActiveProposals) {
      const interval = setInterval(() => {
        fetchAllVoteData();
      }, 30000); // Poll every 30 seconds for active proposals
      
      return () => clearInterval(interval);
    }
  }, [proposals, fetchAllVoteData]);

  return {
    voteData,
    loading,
    error,
    refreshVoteData,
    getVoteData: (proposalId) => voteData[proposalId] || null,
    fetchAllVoteData,
    // Export contract-level functions for direct use
    getVoteDataFromContract,
    getVoteDataFromEvents,
    getVoteDataWithCaching
  };
}

export default useVoteData;