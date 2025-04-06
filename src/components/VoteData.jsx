// src/components/VoteData.jsx - Using the shared utility function
import React, { useState, useEffect, useCallback } from 'react';
import { useBlockchainData } from '../contexts/BlockchainDataContext';
import { useWeb3 } from '../contexts/Web3Context';
import Loader from './Loader';
import { PROPOSAL_STATES } from '../utils/constants';
import { getAccurateVoteCounts } from '../utils/getAccurateVoteCounts';
import { ethers } from 'ethers';

/**
 * VoteData component - Fetches and displays blockchain vote data 
 * using direct contract calls and accurate event-based vote counting
 */
const VoteData = ({ proposalId, showDetailedInfo = false }) => {
  const { contracts, contractsReady } = useWeb3();
  
  const [voteData, setVoteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [proposalState, setProposalState] = useState(null);

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

  // Fetch vote data using the utility function for consistent results
  const fetchVoteData = useCallback(async () => {
    if (!proposalId || !contractsReady || !contracts.governance) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching vote data for proposal #${proposalId}`);
      
      // Get the state
      const state = await fetchProposalState();
      
      // Use the shared utility function to get accurate vote counts
      const voteResult = await getAccurateVoteCounts(contracts.governance, proposalId);
      
      // Add state to the result
      voteResult.isActive = state === PROPOSAL_STATES.ACTIVE;
      voteResult.state = state;
      voteResult.fetchedAt = Date.now();
      
      console.log(`Final vote data for proposal #${proposalId}:`, voteResult);
      setVoteData(voteResult);
    } catch (err) {
      console.error(`Error fetching vote data for proposal ${proposalId}:`, err);
      setError(`Failed to load vote data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [proposalId, fetchProposalState, contracts, contractsReady]);

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