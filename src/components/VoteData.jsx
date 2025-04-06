// src/components/VoteData.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useBlockchainData } from '../contexts/BlockchainDataContext';
import { useWeb3 } from '../contexts/Web3Context';
import Loader from './Loader';
import { PROPOSAL_STATES } from '../utils/constants';
import { ethers } from 'ethers';

/**
 * VoteData component - Fetches and displays blockchain vote data 
 * with automatic refresh for active proposals
 */
const VoteData = ({ proposalId, showDetailedInfo = false }) => {
  const { getProposalVoteTotals } = useBlockchainData();
  const { contracts, contractsReady } = useWeb3();
  
  const [voteData, setVoteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [proposalState, setProposalState] = useState(null);

  // Format numbers with appropriate decimals
  const formatNumber = (value, decimals = 2) => {
    if (value === undefined || value === null) return '0';
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0';
    
    // For whole numbers, don't show decimals
    if (Math.abs(numValue - Math.round(numValue)) < 0.00001) {
      return numValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    
    return numValue.toLocaleString(undefined, { 
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  };

  // Format token values for display
  const formatTokenAmount = (value) => {
    if (value === undefined || value === null) return '0';
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '0';
    
    if (numValue === 0) return '0';
    
    // Use more decimals for smaller values
    if (numValue < 0.01) return numValue.toFixed(5);
    if (numValue < 1) return numValue.toFixed(4);
    if (numValue < 10) return numValue.toFixed(3);
    if (numValue < 1000) return numValue.toFixed(2);
    
    return numValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Get the proposal state directly from the contract
  const fetchProposalState = useCallback(async () => {
    if (!contractsReady || !contracts.governance || !proposalId) return;
    
    try {
      const state = await contracts.governance.getProposalState(proposalId);
      setProposalState(Number(state));
      return Number(state);
    } catch (err) {
      console.error(`Error fetching state for proposal ${proposalId}:`, err);
      return null;
    }
  }, [contractsReady, contracts, proposalId]);

  // Fetch vote data directly from the governance contract
  const fetchVoteData = useCallback(async () => {
    if (!proposalId || !contractsReady || !contracts.governance) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Directly calling contract getProposalVoteTotals for proposal #${proposalId}`);
      
      // Fetch proposal state first to determine if it's active
      const state = await fetchProposalState();
      
      // DIRECTLY call the contract's getProposalVoteTotals function
      const [forVotes, againstVotes, abstainVotes, totalVotingPower, voterCount] = 
        await contracts.governance.getProposalVoteTotals(proposalId);
      
      console.log(`Raw contract data for proposal #${proposalId}:`, {
        forVotes: forVotes.toString(),
        againstVotes: againstVotes.toString(),
        abstainVotes: abstainVotes.toString(),
        totalVotingPower: totalVotingPower.toString(),
        voterCount: voterCount.toString()
      });
      
      // Convert BigNumber values to formatted strings
      const formattedData = {
        yesVotes: ethers.utils.formatEther(forVotes),
        noVotes: ethers.utils.formatEther(againstVotes),
        abstainVotes: ethers.utils.formatEther(abstainVotes),
        totalVotingPower: ethers.utils.formatEther(totalVotingPower),
        totalVoters: voterCount.toNumber(),
        source: 'direct-contract-call'
      };
      
      // Process the data to ensure consistent format
      // Process the data to ensure consistent format
      const processedData = {
        ...formattedData,
        // Ensure we have numeric values for percentages
        yesVotingPower: parseFloat(formattedData.yesVotes),
        noVotingPower: parseFloat(formattedData.noVotes),
        abstainVotingPower: parseFloat(formattedData.abstainVotes),
      };
      
      // Calculate total voting power in case it's needed
      const totalVotingPowerNum = parseFloat(formattedData.totalVotingPower);
      processedData.totalVotingPower = totalVotingPowerNum;
      // Calculate voter counts based on percentages if needed
      // First estimated approach using voter percentages
      if (processedData.totalVoters > 0) {
        // Use BigNumber calculations for more accuracy
        if (!forVotes.isZero() || !againstVotes.isZero() || !abstainVotes.isZero()) {
          // Calculate voter distribution proportionally to voting power
          const totalPower = forVotes.add(againstVotes).add(abstainVotes);
          
          if (!totalPower.isZero()) {
            const yesRatio = forVotes.mul(100).div(totalPower);
            const noRatio = againstVotes.mul(100).div(totalPower);
            const abstainRatio = totalPower.sub(forVotes).sub(againstVotes).mul(100).div(totalPower);
            
            // Calculate estimated voter counts based on voting power distribution
            processedData.yesVoters = Math.max(
              forVotes.gt(0) ? 1 : 0, 
              Math.round((yesRatio.toNumber() / 100) * processedData.totalVoters)
            );
            
            processedData.noVoters = Math.max(
              againstVotes.gt(0) ? 1 : 0,
              Math.round((noRatio.toNumber() / 100) * processedData.totalVoters)
            );
            
            processedData.abstainVoters = Math.max(
              abstainVotes.gt(0) ? 1 : 0,
              Math.round((abstainRatio.toNumber() / 100) * processedData.totalVoters)
            );
            
            // Ensure total adds up
            const calculatedTotal = processedData.yesVoters + processedData.noVoters + processedData.abstainVoters;
            if (calculatedTotal !== processedData.totalVoters) {
              // Adjust largest group to ensure total matches
              const diff = processedData.totalVoters - calculatedTotal;
              if (processedData.yesVoters >= processedData.noVoters && processedData.yesVoters >= processedData.abstainVoters) {
                processedData.yesVoters += diff;
              } else if (processedData.noVoters >= processedData.yesVoters && processedData.noVoters >= processedData.abstainVoters) {
                processedData.noVoters += diff;
              } else {
                processedData.abstainVoters += diff;
              }
            }
          }
        } else {
          // No votes cast yet
          processedData.yesVoters = 0;
          processedData.noVoters = 0;
          processedData.abstainVoters = 0;
        }
      } else {
        // Default to at least 1 voter per vote type with power
        processedData.yesVoters = parseFloat(processedData.yesVotes) > 0 ? 1 : 0;
        processedData.noVoters = parseFloat(processedData.noVotes) > 0 ? 1 : 0;
        processedData.abstainVoters = parseFloat(processedData.abstainVotes) > 0 ? 1 : 0;
        processedData.totalVoters = processedData.yesVoters + processedData.noVoters + processedData.abstainVoters;
      }
      
      // Calculate percentages for display
      if (totalVotingPowerNum > 0) {
        processedData.yesPercentage = (processedData.yesVotingPower / totalVotingPowerNum) * 100;
        processedData.noPercentage = (processedData.noVotingPower / totalVotingPowerNum) * 100;
        processedData.abstainPercentage = (processedData.abstainVotingPower / totalVotingPowerNum) * 100;
      } else {
        processedData.yesPercentage = 0;
        processedData.noPercentage = 0;
        processedData.abstainPercentage = 0;
      }
      
      // Add metadata
      processedData.isActive = state === PROPOSAL_STATES.ACTIVE;
      processedData.state = state;
      processedData.fetchedAt = Date.now();
      
      setVoteData(processedData);
    } catch (err) {
      console.error(`Error fetching vote data for proposal ${proposalId}:`, err);
      setError(`Failed to load vote data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [getProposalVoteTotals, proposalId, fetchProposalState]);

  // Initial data fetch
  useEffect(() => {
    fetchVoteData();
  }, [fetchVoteData, proposalId]);

  // Set up polling for active proposals
  useEffect(() => {
    // Only poll if it's an active proposal
    if (proposalState !== PROPOSAL_STATES.ACTIVE) return;
    
    const pollInterval = setInterval(() => {
      fetchVoteData();
    }, 30000); // Poll every 30 seconds for active proposals
    
    return () => clearInterval(pollInterval);
  }, [fetchVoteData, proposalState, proposalId]);

  // Render loading state
  if (loading && !voteData) {
    return <Loader size="small" text="Loading vote data..." />;
  }

  // Render error state
  if (error && !voteData) {
    return (
      <div className="text-red-500 dark:text-red-400 text-sm py-2">
        {error}
      </div>
    );
  }

  // Render no data state
  if (!voteData) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm py-2">
        No vote data available
      </div>
    );
  }

  // Basic version with just the vote bar and percentages
  if (!showDetailedInfo) {
    return (
      <div>
        {/* Vote percentages */}
        <div className="grid grid-cols-3 gap-4 text-sm sm:text-base mb-3">
          <div className="text-green-600 dark:text-green-400 font-medium">
            Yes: {voteData.yesPercentage.toFixed(1)}%
          </div>
          <div className="text-red-600 dark:text-red-400 font-medium text-center">
            No: {voteData.noPercentage.toFixed(1)}%
          </div>
          <div className="text-gray-600 dark:text-gray-400 font-medium text-right">
            Abstain: {voteData.abstainPercentage.toFixed(1)}%
          </div>
        </div>
        
        {/* Vote bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="flex h-full">
            <div 
              className="bg-green-500 h-full" 
              style={{ width: `${voteData.yesPercentage}%` }}
            ></div>
            <div 
              className="bg-red-500 h-full" 
              style={{ width: `${voteData.noPercentage}%` }}
            ></div>
            <div 
              className="bg-gray-400 dark:bg-gray-500 h-full" 
              style={{ width: `${voteData.abstainPercentage}%` }}
            ></div>
          </div>
        </div>
        
        {/* Vote counts */}
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
          <div>{voteData.yesVoters || 0} voter{(voteData.yesVoters || 0) !== 1 && 's'}</div>
          <div className="text-center">{voteData.noVoters || 0} voter{(voteData.noVoters || 0) !== 1 && 's'}</div>
          <div className="text-right">{voteData.abstainVoters || 0} voter{(voteData.abstainVoters || 0) !== 1 && 's'}</div>
        </div>
      </div>
    );
  }

  // Detailed version with voting power and totals
  return (
    <div>
      {/* Vote percentages */}
      <div className="grid grid-cols-3 gap-4 text-sm sm:text-base mb-3">
        <div className="text-green-600 dark:text-green-400 font-medium">
          Yes: {voteData.yesPercentage.toFixed(1)}%
        </div>
        <div className="text-red-600 dark:text-red-400 font-medium text-center">
          No: {voteData.noPercentage.toFixed(1)}%
        </div>
        <div className="text-gray-600 dark:text-gray-400 font-medium text-right">
          Abstain: {voteData.abstainPercentage.toFixed(1)}%
        </div>
      </div>
      
      {/* Vote bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="flex h-full">
          <div 
            className="bg-green-500 h-full" 
            style={{ width: `${voteData.yesPercentage}%` }}
          ></div>
          <div 
            className="bg-red-500 h-full" 
            style={{ width: `${voteData.noPercentage}%` }}
          ></div>
          <div 
            className="bg-gray-400 dark:bg-gray-500 h-full" 
            style={{ width: `${voteData.abstainPercentage}%` }}
          ></div>
        </div>
      </div>
      
      {/* Vote counts */}
      <div className="grid grid-cols-3 gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
        <div>{voteData.yesVoters || 0} voter{(voteData.yesVoters || 0) !== 1 && 's'}</div>
        <div className="text-center">{voteData.noVoters || 0} voter{(voteData.noVoters || 0) !== 1 && 's'}</div>
        <div className="text-right">{voteData.abstainVoters || 0} voter{(voteData.abstainVoters || 0) !== 1 && 's'}</div>
      </div>
      
      {/* Voting power section */}
      <div className="mt-5 border-t dark:border-gray-700 pt-4 text-sm text-gray-600 dark:text-gray-400">
        {/* Display voting power values */}
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
          <div>{formatTokenAmount(voteData.yesVotingPower)} JST</div>
          <div className="text-center">{formatTokenAmount(voteData.noVotingPower)} JST</div>
          <div className="text-right">{formatTokenAmount(voteData.abstainVotingPower)} JST</div>
        </div>
      </div>
      
      {/* Total voters count */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-right">
        Total voters: {voteData.totalVoters || 0}
      </div>
      
      {/* Data source info (can be removed in production) */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
          Source: {voteData.source || 'blockchain'} | 
          Updated: {new Date(voteData.fetchedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default VoteData;