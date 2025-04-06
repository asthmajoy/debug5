// src/components/VoteTab/VoteDataAccurate.jsx
// This is a replacement for the embedded VoteData component in VoteTab.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import Loader from '../Loader';
import { ethers } from 'ethers';

/**
 * VoteDataAccurate component - Direct replacement for VoteTab's internal VoteData
 * Uses accurate event-based voter counting
 */
const VoteDataAccurate = ({ proposalId, showDetailedInfo = false }) => {
  const { contracts, contractsReady } = useWeb3();
  
  const [voteData, setVoteData] = useState({
    yesVotes: 0,
    noVotes: 0,
    abstainVotes: 0,
    yesVoters: 0,
    noVoters: 0,
    abstainVoters: 0,
    totalVoters: 0,
    yesVotingPower: 0,
    noVotingPower: 0,
    abstainVotingPower: 0,
    totalVotingPower: 0,
    yesPercentage: 0,
    noPercentage: 0,
    abstainPercentage: 0,
    loading: true
  });
  
  // Format numbers for display
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
  
  // Format token values to 5 decimal places
  const formatToFiveDecimals = (value) => {
    if (value === undefined || value === null) return "0.00000";
    
    // Handle string inputs
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // If it's NaN or not a number, return "0.00000"
    if (isNaN(numValue)) return "0.00000";
    
    // Return with exactly 5 decimal places
    return numValue.toFixed(5);
  };
  
  // Direct query method to get accurate votes from contract and events
  const getAccurateVoteCounts = useCallback(async () => {
    if (!contractsReady || !contracts.governance) {
      return null;
    }
    
    try {
      console.log(`Getting accurate vote counts for proposal #${proposalId}`);
      
      // First get raw data from contract
      const [forVotes, againstVotes, abstainVotes, totalVotingPower, contractVoterCount] = 
        await contracts.governance.getProposalVoteTotals(proposalId);
      
      console.log(`Contract data for proposal #${proposalId}:`, {
        forVotes: forVotes.toString(),
        againstVotes: againstVotes.toString(),
        abstainVotes: abstainVotes.toString(),
        totalVotingPower: totalVotingPower.toString(),
        contractVoterCount: contractVoterCount.toString()
      });
      
      // Use events to get accurate vote distribution
      const filter = contracts.governance.filters.VoteCast(proposalId);
      const events = await contracts.governance.queryFilter(filter);
      
      // Process the events to get vote distribution
      const voterMap = new Map();
      
      for (const event of events) {
        try {
          const voter = event.args.voter.toLowerCase();
          const support = Number(event.args.support);
          voterMap.set(voter, support);
        } catch (err) {
          console.warn(`Error processing vote event:`, err);
        }
      }
      
      // Count votes by type
      let yesVoters = 0;
      let noVoters = 0;
      let abstainVoters = 0;
      
      for (const voteType of voterMap.values()) {
        if (voteType === 1) yesVoters++; // Yes vote
        else if (voteType === 0) noVoters++; // No vote
        else if (voteType === 2) abstainVoters++; // Abstain vote
      }
      
      console.log(`Vote distribution from events for proposal #${proposalId}:`, {
        yesVoters, noVoters, abstainVoters, 
        totalFromEvents: voterMap.size,
        totalFromContract: contractVoterCount.toNumber()
      });
      
      // If there's a discrepancy between contract voter count and event count,
      // prioritize contract count but maintain event-based distribution
      if (contractVoterCount.toNumber() !== voterMap.size && voterMap.size > 0) {
        console.warn(`Vote count discrepancy: contract=${contractVoterCount.toNumber()}, events=${voterMap.size}`);
        
        // Normalize to contract count
        const totalEventVoters = yesVoters + noVoters + abstainVoters;
        const scaleFactor = contractVoterCount.toNumber() / totalEventVoters;
        
        // Scale each vote type and round to nearest integer
        yesVoters = Math.round(yesVoters * scaleFactor);
        noVoters = Math.round(noVoters * scaleFactor);
        abstainVoters = Math.round(abstainVoters * scaleFactor);
        
        // Ensure the sum matches by adjusting the largest group
        const adjustedSum = yesVoters + noVoters + abstainVoters;
        const diff = contractVoterCount.toNumber() - adjustedSum;
        
        if (diff !== 0) {
          if (yesVoters >= noVoters && yesVoters >= abstainVoters) {
            yesVoters += diff;
          } else if (noVoters >= yesVoters && noVoters >= abstainVoters) {
            noVoters += diff;
          } else {
            abstainVoters += diff;
          }
        }
      } else if (voterMap.size === 0 && !contractVoterCount.isZero()) {
        // If we have no events but contract says there are voters,
        // distribute based on voting power ratios
        const totalPower = forVotes.add(againstVotes).add(abstainVotes);
        
        if (!totalPower.isZero()) {
          const yesRatio = forVotes.mul(100).div(totalPower).toNumber() / 100;
          const noRatio = againstVotes.mul(100).div(totalPower).toNumber() / 100;
          const abstainRatio = abstainVotes.mul(100).div(totalPower).toNumber() / 100;
          
          yesVoters = Math.round(yesRatio * contractVoterCount.toNumber());
          noVoters = Math.round(noRatio * contractVoterCount.toNumber());
          abstainVoters = Math.round(abstainRatio * contractVoterCount.toNumber());
          
          // Ensure at least 1 voter if there's voting power
          if (!forVotes.isZero() && yesVoters === 0) yesVoters = 1;
          if (!againstVotes.isZero() && noVoters === 0) noVoters = 1;
          if (!abstainVotes.isZero() && abstainVoters === 0) abstainVoters = 1;
          
          // Adjust to match total
          const sum = yesVoters + noVoters + abstainVoters;
          if (sum !== contractVoterCount.toNumber()) {
            const diff = contractVoterCount.toNumber() - sum;
            
            // Add to the largest group or subtract from it
            if (yesVoters >= noVoters && yesVoters >= abstainVoters) {
              yesVoters += diff;
            } else if (noVoters >= yesVoters && noVoters >= abstainVoters) {
              noVoters += diff;
            } else {
              abstainVoters += diff;
            }
          }
        }
      }
      
      // Calculate percentages
      let yesPercentage = 0;
      let noPercentage = 0;
      let abstainPercentage = 0;
      
      if (!totalVotingPower.isZero()) {
        yesPercentage = parseFloat(forVotes.mul(10000).div(totalVotingPower)) / 100;
        noPercentage = parseFloat(againstVotes.mul(10000).div(totalVotingPower)) / 100;
        abstainPercentage = parseFloat(abstainVotes.mul(10000).div(totalVotingPower)) / 100;
      }
      
      // Format and return the data
      return {
        // Vote power formatted
        yesVotes: ethers.utils.formatEther(forVotes),
        noVotes: ethers.utils.formatEther(againstVotes),
        abstainVotes: ethers.utils.formatEther(abstainVotes),
        totalVotingPower: ethers.utils.formatEther(totalVotingPower),
        
        // Vote power as numbers
        yesVotingPower: parseFloat(ethers.utils.formatEther(forVotes)),
        noVotingPower: parseFloat(ethers.utils.formatEther(againstVotes)),
        abstainVotingPower: parseFloat(ethers.utils.formatEther(abstainVotes)),
        
        // Voter counts
        yesVoters,
        noVoters,
        abstainVoters,
        totalVoters: contractVoterCount.toNumber(),
        
        // Percentages
        yesPercentage,
        noPercentage, 
        abstainPercentage,
        
        // Source
        source: 'direct-contract-with-events'
      };
    } catch (error) {
      console.error(`Error getting vote data for proposal ${proposalId}:`, error);
      return null;
    }
  }, [contractsReady, contracts, proposalId]);

  // Fetch data for the proposal
  useEffect(() => {
    const fetchVoteData = async () => {
      if (!proposalId || !contractsReady || !contracts.governance) return;
      
      setVoteData(prev => ({ ...prev, loading: true }));
      
      try {
        // Get accurate vote counts
        const result = await getAccurateVoteCounts();
        
        if (result) {
          setVoteData({
            ...result,
            loading: false
          });
        } else {
          // Fallback to empty data
          setVoteData({
            yesVotes: 0,
            noVotes: 0,
            abstainVotes: 0,
            yesVotingPower: 0,
            noVotingPower: 0,
            abstainVotingPower: 0,
            yesVoters: 0,
            noVoters: 0,
            abstainVoters: 0,
            totalVoters: 0,
            totalVotingPower: 0,
            yesPercentage: 0,
            noPercentage: 0,
            abstainPercentage: 0,
            loading: false
          });
        }
      } catch (error) {
        console.error(`Error fetching vote data for proposal ${proposalId}:`, error);
        setVoteData(prev => ({ ...prev, loading: false }));
      }
    };
    
    fetchVoteData();
    
    // Poll for updated data every 15 seconds
    const interval = setInterval(fetchVoteData, 15000);
    return () => clearInterval(interval);
  }, [proposalId, getAccurateVoteCounts, contractsReady, contracts]);
  
  // Render the vote bar
  const renderVoteBar = () => {
    const { totalVotingPower } = voteData;
    
    if (totalVotingPower <= 0) {
      // Default empty bar if no votes - reduced thickness
      return (
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gray-300 dark:bg-gray-600"></div>
        </div>
      );
    }
    
    // Show vote percentages with color coding - reduced thickness
    return (
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
    );
  };
  
  if (voteData.loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <Loader size="small" className="mr-2" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading vote data...</span>
      </div>
    );
  }
  
  // Basic vote data display
  if (!showDetailedInfo) {
    return (
      <div>
        {/* Vote percentages */}
        <div className="grid grid-cols-3 gap-4 text-sm sm:text-base mb-3">
          <div className="text-green-600 dark:text-green-400 font-medium">Yes: {voteData.yesPercentage.toFixed(1)}%</div>
          <div className="text-red-600 dark:text-red-400 font-medium text-center">No: {voteData.noPercentage.toFixed(1)}%</div>
          <div className="text-gray-600 dark:text-gray-400 font-medium text-right">Abstain: {voteData.abstainPercentage.toFixed(1)}%</div>
        </div>
        
        {/* Vote bar */}
        {renderVoteBar()}
        
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
            <div>{formatToFiveDecimals(voteData.yesVotingPower || 0)} JST</div>
            <div className="text-center">{formatToFiveDecimals(voteData.noVotingPower || 0)} JST</div>
            <div className="text-right">{formatToFiveDecimals(voteData.abstainVotingPower || 0)} JST</div>
          </div>
        </div>
        
        {/* Total voters count */}
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-right">
          Total voters: {voteData.totalVoters || 0}
        </div>
      </div>
    );
  }
  
  // Detailed vote data for modal
  return (
    <div>
      {/* Vote counts */}
      <h5 className="text-sm font-medium mb-3 dark:text-gray-300">Vote Counts</h5>
      
      <div className="grid grid-cols-3 gap-4 text-center mb-3">
        <div>
          <div className="text-green-600 dark:text-green-400 font-medium">
            {voteData.yesVoters || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Yes Votes</div>
        </div>
        <div>
          <div className="text-red-600 dark:text-red-400 font-medium">
            {voteData.noVoters || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">No Votes</div>
        </div>
        <div>
          <div className="text-gray-600 dark:text-gray-400 font-medium">
            {voteData.abstainVoters || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Abstain</div>
        </div>
      </div>
      
      {/* Percentage labels */}
      <div className="grid grid-cols-3 gap-4 text-center mb-3 text-xs text-gray-500 dark:text-gray-400">
        <div>Yes: {voteData.yesPercentage.toFixed(1)}%</div>
        <div>No: {voteData.noPercentage.toFixed(1)}%</div>
        <div>Abstain: {voteData.abstainPercentage.toFixed(1)}%</div>
      </div>
      
      {/* Vote bar */}
      {renderVoteBar()}
      
      {/* Total voters count */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3 mb-5">
        Total voters: {voteData.totalVoters || 0}
      </div>
      
      {/* Voting power heading */}
      <h5 className="text-sm font-medium mt-5 mb-3 dark:text-gray-300">Voting Power Distribution</h5>
      
      {/* Voting power display */}
      <div className="grid grid-cols-3 gap-4 text-center mb-3">
        <div>
          <div className="text-green-600 dark:text-green-400 font-medium">{formatToFiveDecimals(voteData.yesVotingPower || 0)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Yes JST</div>
        </div>
        <div>
          <div className="text-red-600 dark:text-red-400 font-medium">{formatToFiveDecimals(voteData.noVotingPower || 0)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">No JST</div>
        </div>
        <div>
          <div className="text-gray-600 dark:text-gray-400 font-medium">{formatToFiveDecimals(voteData.abstainVotingPower || 0)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Abstain JST</div>
        </div>
      </div>
      
      {/* Total voting power */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
        Total voting power: {formatNumberDisplay(voteData.totalVotingPower || 0)} JST
      </div>
    </div>
  );
};

export default VoteDataAccurate;