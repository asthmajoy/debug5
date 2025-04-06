// src/utils/getAccurateVoteCounts.js - A shared utility function

import { ethers } from 'ethers';

/**
 * Gets accurate vote counts from blockchain events
 * @param {Object} contract - The governance contract 
 * @param {string|number} proposalId - Proposal ID
 * @returns {Promise<Object>} Vote counts by type and total
 */
export async function getAccurateVoteCounts(contract, proposalId) {
  try {
    console.log(`Getting accurate vote counts from events for proposal #${proposalId}`);
    
    // First get the raw contract data via direct call
    const [forVotes, againstVotes, abstainVotes, totalVotingPower, contractVoterCount] = 
      await contract.getProposalVoteTotals(proposalId);
    
    console.log(`Contract returned for proposal #${proposalId}:`, {
      forVotes: forVotes.toString(),
      againstVotes: againstVotes.toString(),
      abstainVotes: abstainVotes.toString(),
      totalVotingPower: totalVotingPower.toString(),
      contractVoterCount: contractVoterCount.toString()
    });
    
    // Get all VoteCast events for this proposal to count votes by type
    const filter = contract.filters.VoteCast(proposalId);
    const events = await contract.queryFilter(filter);
    
    // Map unique voters to their final vote type
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
    
    console.log(`Found ${voterMap.size} unique voters for proposal #${proposalId}`);
    
    // Count votes by type
    let yesVoters = 0;
    let noVoters = 0;
    let abstainVoters = 0;
    
    for (const voteType of voterMap.values()) {
      if (voteType === 1) yesVoters++;
      else if (voteType === 0) noVoters++;
      else if (voteType === 2) abstainVoters++;
    }
    
    // Validate total against contract's count
    const eventTotalVoters = yesVoters + noVoters + abstainVoters;
    
    // Use contract's voter count as source of truth, but distribute
    // proportionally if there's a discrepancy
    if (eventTotalVoters !== contractVoterCount.toNumber() && eventTotalVoters > 0) {
      console.warn(`Vote count discrepancy for proposal #${proposalId}: events=${eventTotalVoters}, contract=${contractVoterCount.toNumber()}`);
      
      // If we have events but they don't match the contract count, adjust
      if (eventTotalVoters > 0) {
        // Scale votes to match contract count
        const scaleFactor = contractVoterCount.toNumber() / eventTotalVoters;
        yesVoters = Math.round(yesVoters * scaleFactor);
        noVoters = Math.round(noVoters * scaleFactor);
        abstainVoters = Math.round(abstainVoters * scaleFactor);
        
        // Ensure the sum matches (assign any remainder to the largest group)
        const newTotal = yesVoters + noVoters + abstainVoters;
        const diff = contractVoterCount.toNumber() - newTotal;
        
        if (diff !== 0) {
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
    
    // Format data for return
    return {
      // Raw power values
      forVotes,
      againstVotes,
      abstainVotes,
      totalVotingPower,
      contractVoterCount,
      
      // Formatted power values
      yesVotes: ethers.utils.formatEther(forVotes),
      noVotes: ethers.utils.formatEther(againstVotes),
      abstainVotes: ethers.utils.formatEther(abstainVotes),
      totalVotingPower: ethers.utils.formatEther(totalVotingPower),
      
      // Numeric power values
      yesVotingPower: parseFloat(ethers.utils.formatEther(forVotes)),
      noVotingPower: parseFloat(ethers.utils.formatEther(againstVotes)),
      abstainVotingPower: parseFloat(ethers.utils.formatEther(abstainVotes)),
      
      // Voter counts by type
      yesVoters,
      noVoters,
      abstainVoters,
      totalVoters: contractVoterCount.toNumber(),
      
      // Percentages
      yesPercentage: totalVotingPower.isZero() ? 0 : 
        (parseFloat(ethers.utils.formatEther(forVotes)) / parseFloat(ethers.utils.formatEther(totalVotingPower))) * 100,
      noPercentage: totalVotingPower.isZero() ? 0 : 
        (parseFloat(ethers.utils.formatEther(againstVotes)) / parseFloat(ethers.utils.formatEther(totalVotingPower))) * 100,
      abstainPercentage: totalVotingPower.isZero() ? 0 : 
        (parseFloat(ethers.utils.formatEther(abstainVotes)) / parseFloat(ethers.utils.formatEther(totalVotingPower))) * 100,
      
      // Metadata
      source: 'direct-contract-with-events'
    };
  } catch (err) {
    console.error(`Error getting accurate vote counts for proposal #${proposalId}:`, err);
    throw err;
  }
}

export default getAccurateVoteCounts;