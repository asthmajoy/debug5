// src/components/VoteTab.jsx - Complete enhanced version
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import useGovernanceParams from '../hooks/useGovernanceParams';
import { PROPOSAL_TYPES } from '../utils/constants';
import { Clock, Check, X, X as XIcon, Calendar, Users, BarChart2, Settings, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { PROPOSAL_STATES, VOTE_TYPES, THREAT_LEVELS } from '../utils/constants';
import { formatCountdown } from '../utils/formatters';
import Loader from './Loader';
import blockchainDataCache from '../utils/blockchainDataCache';
import { useWeb3 } from '../contexts/Web3Context';
import { useBlockchainData } from '../contexts/BlockchainDataContext';

// Component to handle async vote checking in the modal
const ModalVoteStatus = ({ proposalId, hasUserVoted, getUserVoteType, getVoteTypeText }) => {
  const { isConnected, account } = useWeb3();
  const [userHasVoted, setUserHasVoted] = useState(false);
  const [userVoteType, setUserVoteType] = useState(null);
  const [checkingVote, setCheckingVote] = useState(true);
  
  useEffect(() => {
    const checkUserVote = async () => {
      try {
        setCheckingVote(true);
        const hasVoted = await hasUserVoted(proposalId);
        setUserHasVoted(hasVoted);
        
        if (hasVoted) {
          const voteType = await getUserVoteType(proposalId);
          setUserVoteType(voteType);
        }
      } catch (err) {
        console.error(`Error checking modal vote for proposal ${proposalId}:`, err);
      } finally {
        setCheckingVote(false);
      }
    };
    
    if (isConnected && account) {
      checkUserVote();
    } else {
      setCheckingVote(false);
    }
  }, [proposalId, isConnected, account, hasUserVoted, getUserVoteType]);

  if (checkingVote) {
    return (
      <div className="mt-5 text-center text-sm flex items-center justify-center">
        <Loader size="small" className="mr-2" />
        <span>Checking your vote...</span>
      </div>
    );
  }
  
  if (!userHasVoted) {
    return null;
  }
  
  // Get color based on vote type
  let colorClass = "text-gray-600 dark:text-gray-400";
  if (userVoteType === 1) { // FOR
    colorClass = "text-green-600 dark:text-green-400";
  } else if (userVoteType === 0) { // AGAINST
    colorClass = "text-red-600 dark:text-red-400";
  }
  
  return (
    <div className="mt-5 text-center text-sm">
      <span className="text-gray-600 dark:text-gray-400">Your vote:</span> 
      <span className={`ml-1 font-medium ${colorClass}`}>
        {getVoteTypeText(userVoteType)}
      </span>
    </div>
  );
};

// Function to parse proposal descriptions and extract HTML content
function parseProposalDescription(rawDescription) {
  if (!rawDescription) {
    return { title: '', description: '', descriptionHtml: null };
  }
  
  // Check if the description contains HTML content
  const htmlMarkerIndex = rawDescription.indexOf('|||HTML:');
  
  if (htmlMarkerIndex !== -1) {
    // Extract HTML content
    const htmlContent = rawDescription.substring(htmlMarkerIndex + 8);
    
    // Extract the plain text portion
    const plainTextPortion = rawDescription.substring(0, htmlMarkerIndex).trim();
    
    // The title is typically the first line
    const firstLineBreak = plainTextPortion.indexOf('\n');
    const title = firstLineBreak !== -1 
      ? plainTextPortion.substring(0, firstLineBreak).trim() 
      : plainTextPortion.trim();
    
    // The description is everything after the first line, but before the HTML marker
    const description = firstLineBreak !== -1 
      ? plainTextPortion.substring(firstLineBreak).trim() 
      : '';
      
    return { title, description, descriptionHtml: htmlContent };
  }
  
  // If no HTML marker is found, handle it as plain text only
  const lines = rawDescription.split('\n');
  const title = lines[0] || '';
  const description = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';
  
  return { title, description, descriptionHtml: null };
}

// Enhanced function to safely truncate HTML content while preserving formatting
function truncateHtml(html, maxLength = 200) {
  if (!html) return '';
  
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Get the text content for length checking
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  
  // If the text is already short enough, return the original HTML
  if (textContent.length <= maxLength) {
    return html;
  }
  
  // We'll use a more sophisticated approach to truncate while preserving structure
  let charCount = 0;
  let truncatedHTML = '';
  let isTruncated = false;
  
  // Helper function to process nodes
  function processNode(node) {
    if (isTruncated) return;
    
    // Text node
    if (node.nodeType === 3) { // Text node
      const remainingChars = maxLength - charCount;
      if (remainingChars <= 0) {
        isTruncated = true;
        return;
      }
      
      const text = node.textContent;
      if (charCount + text.length <= maxLength) {
        truncatedHTML += text;
        charCount += text.length;
      } else {
        truncatedHTML += text.substr(0, remainingChars) + '...';
        isTruncated = true;
      }
      return;
    }
    
    // Element node
    if (node.nodeType === 1) { // Element node
      const tagName = node.tagName.toLowerCase();
      
      // Skip style, script, etc.
      if (['style', 'script', 'noscript', 'iframe', 'object', 'embed'].includes(tagName)) {
        return;
      }
      
      // Clone attributes if needed for elements we want to preserve
      let attrs = '';
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'strong', 'em', 'u', 'b', 'i', 'span', 'p', 'div'].includes(tagName)) {
        Array.from(node.attributes).forEach(attr => {
          attrs += ` ${attr.name}="${attr.value}"`;
        });
      }
      
      // Opening tag
      truncatedHTML += `<${tagName}${attrs}>`;
      
      // Process child nodes
      Array.from(node.childNodes).forEach(childNode => {
        if (!isTruncated) {
          processNode(childNode);
        }
      });
      
      // Closing tag
      truncatedHTML += `</${tagName}>`;
    }
  }
  
  // Process the top-level nodes
  Array.from(tempDiv.childNodes).forEach(childNode => {
    if (!isTruncated) {
      processNode(childNode);
    }
  });
  
  return truncatedHTML;
}

// Enhanced VoteData component - combines the best of both implementations
const VoteData = ({ proposalId, showDetailedInfo = false }) => {
  const { contracts, contractsReady } = useWeb3();
  const { getProposalVoteTotals } = useBlockchainData();
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
  
  // Helper function to ensure vote count consistency
  const ensureVoteCountConsistency = (data) => {
    // Make a copy to avoid mutating the original
    const result = { ...data };
    
    // Ensure vote counts are numbers
    result.yesVoters = parseInt(result.yesVoters) || 0;
    result.noVoters = parseInt(result.noVoters) || 0;
    result.abstainVoters = parseInt(result.abstainVoters) || 0;
    result.totalVoters = parseInt(result.totalVoters) || 0;
    
    // Check if we have voting power but no voters
    if (result.yesVotingPower > 0 && result.yesVoters === 0) result.yesVoters = 1;
    if (result.noVotingPower > 0 && result.noVoters === 0) result.noVoters = 1;
    if (result.abstainVotingPower > 0 && result.abstainVoters === 0) result.abstainVoters = 1;
    
    // Ensure total matches sum
    const calculatedTotal = result.yesVoters + result.noVoters + result.abstainVoters;
    
    if (calculatedTotal !== result.totalVoters) {
      // If individual counts don't add up to total, adjust total to match sum
      result.totalVoters = calculatedTotal;
    }
    
    return result;
  };
  
  // Direct query method to get votes from events
  const directQueryVotes = useCallback(async () => {
    if (!contractsReady || !contracts.governance) {
      return null;
    }
    
    try {
      console.log(`Direct query for votes on proposal ${proposalId}`);
      
      // Use VoteCast events - the most reliable method
      const filter = contracts.governance.filters.VoteCast(proposalId);
      const events = await contracts.governance.queryFilter(filter);
      
      // If no votes at all, return zeros
      if (events.length === 0) {
        return {
          yesVotes: "0",
          noVotes: "0",
          abstainVotes: "0",
          totalVotes: 0,
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
          totalVotingPower: "0",
          source: 'direct-query-no-votes'
        };
      }
      
      // Process each vote event
      const voters = new Map(); // Track unique voters and their latest vote
      let yesTotal = ethers.BigNumber.from(0);
      let noTotal = ethers.BigNumber.from(0);
      let abstainTotal = ethers.BigNumber.from(0);
      
      // Process all events first to build a map of the final vote for each voter
      for (const event of events) {
        try {
          const voter = event.args.voter.toLowerCase();
          const support = Number(event.args.support);
          const power = event.args.votingPower;
          
          // Store or update this voter's latest vote
          voters.set(voter, { support, power });
        } catch (err) {
          console.warn(`Error processing vote event:`, err);
        }
      }
      
      // Now count voters and sum up voting power by type
      let yesVoterCount = 0;
      let noVoterCount = 0;
      let abstainVoterCount = 0;
      
      // Calculate totals from each voter's final vote
      for (const [_, voteInfo] of voters.entries()) {
        const { support, power } = voteInfo;
        
        if (support === 1) { // Yes
          yesTotal = yesTotal.add(power);
          yesVoterCount++;
        } else if (support === 0) { // No
          noTotal = noTotal.add(power);
          noVoterCount++;
        } else if (support === 2) { // Abstain
          abstainTotal = abstainTotal.add(power);
          abstainVoterCount++;
        }
      }
      
      // Calculate total voting power and percentages
      const totalVotingPower = yesTotal.add(noTotal).add(abstainTotal);
      let yesPercentage = 0;
      let noPercentage = 0;
      let abstainPercentage = 0;
      
      if (!totalVotingPower.isZero()) {
        yesPercentage = yesTotal.mul(100).div(totalVotingPower).toNumber();
        noPercentage = noTotal.mul(100).div(totalVotingPower).toNumber();
        abstainPercentage = abstainTotal.mul(100).div(totalVotingPower).toNumber();
      }
      
      // Verify that the voter counts add up correctly
      const totalCalculatedVoters = yesVoterCount + noVoterCount + abstainVoterCount;
      if (totalCalculatedVoters !== voters.size) {
        console.warn(`Voter count mismatch in directQueryVotes: sum=${totalCalculatedVoters}, map size=${voters.size}`);
        // Adjust to ensure consistency - if we counted the voters directly, that's more reliable
        const votersSize = totalCalculatedVoters;
        
        return {
          yesVotes: ethers.utils.formatEther(yesTotal),
          noVotes: ethers.utils.formatEther(noTotal),
          abstainVotes: ethers.utils.formatEther(abstainTotal),
          totalVotes: votersSize,
          totalVoters: votersSize, // Use our calculated total
          yesVoters: yesVoterCount,
          noVoters: noVoterCount,
          abstainVoters: abstainVoterCount,
          yesPercentage,
          noPercentage,
          abstainPercentage,
          yesVotingPower: ethers.utils.formatEther(yesTotal),
          noVotingPower: ethers.utils.formatEther(noTotal),
          abstainVotingPower: ethers.utils.formatEther(abstainTotal),
          totalVotingPower: ethers.utils.formatEther(totalVotingPower),
          source: 'direct-query'
        };
      }
      
      return {
        yesVotes: ethers.utils.formatEther(yesTotal),
        noVotes: ethers.utils.formatEther(noTotal),
        abstainVotes: ethers.utils.formatEther(abstainTotal),
        totalVotes: voters.size,
        totalVoters: voters.size,
        yesVoters: yesVoterCount,
        noVoters: noVoterCount,
        abstainVoters: abstainVoterCount,
        yesPercentage,
        noPercentage,
        abstainPercentage,
        yesVotingPower: ethers.utils.formatEther(yesTotal),
        noVotingPower: ethers.utils.formatEther(noTotal),
        abstainVotingPower: ethers.utils.formatEther(abstainTotal),
        totalVotingPower: ethers.utils.formatEther(totalVotingPower),
        source: 'direct-query'
      };
    } catch (error) {
      console.error(`Error in directQueryVotes for proposal ${proposalId}:`, error);
      return null;
    }
  }, [contractsReady, contracts, proposalId]);

  // Fetch vote data using the caching mechanism
  useEffect(() => {
    const fetchVoteData = async () => {
      if (!getProposalVoteTotals || !proposalId) return;
      
      setVoteData(prev => ({ ...prev, loading: true }));

      try {
        // Try to get from cache first
        const cacheKey = `dashboard-votes-${proposalId}`;
        const cachedData = blockchainDataCache.get(cacheKey);
        
        if (cachedData) {
          console.log(`Using cached data for proposal #${proposalId}`);
          const consistentData = ensureVoteCountConsistency(cachedData);
          setVoteData({ ...consistentData, loading: false });
          return;
        }
        
        // Get fresh data from the blockchain
        console.log(`Fetching vote data for proposal #${proposalId}`);
        const data = await getProposalVoteTotals(proposalId);
        
        if (!data) {
          throw new Error(`No data returned for proposal #${proposalId}`);
        }
        
        // Process the data consistently
        const processedData = {
          yesVotes: parseFloat(data.yesVotes) || 0,
          noVotes: parseFloat(data.noVotes) || 0,
          abstainVotes: parseFloat(data.abstainVotes) || 0,
          yesVotingPower: parseFloat(data.yesVotes || data.yesVotingPower) || 0,
          noVotingPower: parseFloat(data.noVotes || data.noVotingPower) || 0,
          abstainVotingPower: parseFloat(data.abstainVotes || data.abstainVotingPower) || 0,
          yesVoters: data.yesVoters || 0,
          noVoters: data.noVoters || 0,
          abstainVoters: data.abstainVoters || 0,
          totalVoters: parseInt(data.totalVoters) || 0,
          fetchedAt: Date.now(),
          loading: false
        };
        
        // Calculate total voting power
        processedData.totalVotingPower = 
          processedData.yesVotingPower + 
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
        
        // Ensure consistency
        const consistentData = ensureVoteCountConsistency(processedData);
        
        // Cache the result
        blockchainDataCache.set(cacheKey, consistentData, 60);
        
        setVoteData(consistentData);
      } catch (error) {
        console.error(`Error fetching vote data for proposal ${proposalId}:`, error);
        
        try {
          // Try direct query votes as a backup approach
          const directQueryResult = await directQueryVotes();
          if (directQueryResult) {
            // Cache this direct query data
            const cacheKey = `dashboard-votes-${proposalId}`;
            blockchainDataCache.set(cacheKey, directQueryResult, 300);
            
            setVoteData({ ...directQueryResult, loading: false });
            return;
          }
        } catch (fallbackErr) {
          console.error("Error creating fallback data:", fallbackErr);
        }
        
        // Set empty data structure as last resort
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
    };
    
    fetchVoteData();
    
    // Poll for updated data for active proposals
    const interval = setInterval(fetchVoteData, 15000);
    return () => clearInterval(interval);
  }, [proposalId, getProposalVoteTotals, directQueryVotes]);
  
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

// Enhanced QuorumProgress component with consistent theme color
const QuorumProgress = ({ proposalId, quorum }) => {
  const { contracts, contractsReady } = useWeb3();
  const [progress, setProgress] = useState(0);
  const [voteCount, setVoteCount] = useState("0");
  const [loading, setLoading] = useState(true);
  
  // Define formatNumberDisplay locally within the component
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
  
  // Fetch quorum data directly from the contract
  useEffect(() => {
    const fetchQuorumData = async () => {
      if (!contractsReady || !contracts.governance || !proposalId) return;
      
      try {
        setLoading(true);
        // Directly call the contract's getProposalVoteTotals function
        const [forVotes, againstVotes, abstainVotes, totalVotingPower] = 
          await contracts.governance.getProposalVoteTotals(proposalId);
        
        // Calculate total votes
        const totalVotes = forVotes.add(againstVotes).add(abstainVotes);
        
        // Convert to readable format for display
        const totalVotesFormatted = ethers.utils.formatEther(totalVotes);
        
        // Calculate progress
        let quorumValue = ethers.utils.parseEther(quorum.toString());
        if (quorumValue.isZero()) {
          quorumValue = ethers.utils.parseEther('1'); // prevent division by zero
        }
        
        // Calculate percentage with BigNumber to avoid float precision issues
        let progressPercentage = totalVotes.mul(100).div(quorumValue);
        if (progressPercentage.gt(100)) {
          progressPercentage = ethers.BigNumber.from(100);
        }
        
        setProgress(progressPercentage.toNumber());
        setVoteCount(totalVotesFormatted);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching quorum data:", err);
        setLoading(false);
      }
    };
    
    fetchQuorumData();
    
    // Poll for active proposals
    const interval = setInterval(fetchQuorumData, 30000);
    return () => clearInterval(interval);
  }, [contracts, contractsReady, proposalId, quorum]);
  
  return (
    <div>
      {/* Quorum progress bar with consistent theme color */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-300 ease-in-out bg-indigo-500 dark:bg-indigo-600"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      {/* Vote count display */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
        {loading ? (
          <span className="flex items-center justify-end">
            <Loader size="tiny" className="mr-1" />
            Loading...
          </span>
        ) : (
          <span>
            {formatNumberDisplay(voteCount)} / {formatNumberDisplay(quorum)} JST ({progress}%)
            {progress >= 100 && ' ✓ Quorum reached'}
          </span>
        )}
      </div>
    </div>
  );
};

// Proposal Card Component - Full featured version
const ProposalCard = ({ 
  proposal, 
  votingPower, 
  castVote, 
  formatToFiveDecimals, 
  govParams, 
  hasUserVoted,
  getUserVoteType,
  getVoteTypeText,
  VOTE_TYPES,
  PROPOSAL_STATES,
  getProposalStateInfo,
  renderProposalDescription,
  setSelectedProposal,
  setShowModal,
  voting
}) => {
  const { isConnected, account } = useWeb3();
  const [userHasVoted, setUserHasVoted] = useState(false);
  const [userVoteType, setUserVoteType] = useState(null);
  const [checkingVote, setCheckingVote] = useState(true);
  
  const hasVotingPower = parseFloat(votingPower) > 0;
  const stateInfo = getProposalStateInfo(proposal);
  
  // Check if the user has voted on this proposal
  useEffect(() => {
    const checkUserVote = async () => {
      try {
        setCheckingVote(true);
        const hasVoted = await hasUserVoted(proposal.id);
        setUserHasVoted(hasVoted);
        
        if (hasVoted) {
          const voteType = await getUserVoteType(proposal.id);
          setUserVoteType(voteType);
        }
      } catch (err) {
        console.error(`Error checking vote for proposal ${proposal.id}:`, err);
      } finally {
        setCheckingVote(false);
      }
    };
    
    if (isConnected && account) {
      checkUserVote();
    } else {
      setCheckingVote(false);
    }
  }, [proposal.id, isConnected, account, hasUserVoted, getUserVoteType]);
  
  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="text-xl font-medium mb-1 dark:text-white">{proposal.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Proposal #{proposal.id}</p>
        </div>
        <span className={`text-sm ${stateInfo.color} px-3 py-1 rounded-full flex items-center`}>
          {proposal.state === PROPOSAL_STATES.ACTIVE ? (
            <>
              <Clock className="w-4 h-4 mr-1" />
              {formatCountdown(proposal.deadline)}
            </>
          ) : (
            stateInfo.label
          )}
        </span>
      </div>
      
      {/* Render proposal description with HTML support */}
      {renderProposalDescription(proposal, true, 200)}
      
      {/* Vote data display using the enhanced VoteData component */}
      <div className="mb-6">
        <VoteData proposalId={proposal.id} />
      </div>
      
      {/* Always show quorum progress regardless of vote status */}
      {govParams.quorum > 0 && (
        <div className="mt-3 mb-5">
          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-2">
            <span className="font-medium">Quorum Progress</span>
          </div>
          
          {/* Enhanced QuorumProgress component */}
          <QuorumProgress proposalId={proposal.id} quorum={govParams.quorum} />
        </div>
      )}
      
      {checkingVote ? (
        <div className="flex items-center justify-center text-base text-gray-700 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Loader size="small" className="mr-2" />
          <span>Checking your vote status...</span>
        </div>
      ) : userHasVoted ? (
        <div className="flex items-center text-base text-gray-700 dark:text-gray-300 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="mr-2">You voted:</span>
          <span className="px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 font-medium">
            {getVoteTypeText(userVoteType)}
          </span>
        </div>
      ) : proposal.state === PROPOSAL_STATES.ACTIVE && (
        <div>
          {hasVotingPower ? (
            <div>
              <div className="mb-3 text-base text-gray-700 dark:text-gray-300 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                Your voting power: <span className="font-medium">{formatToFiveDecimals(votingPower)} JST</span>
              </div>
              
              {/* Vote buttons */}
              <div className="flex flex-wrap gap-4 mt-6">
                <button 
                  className="flex-1 min-w-0 bg-emerald-500 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white dark:text-white py-2 px-2 rounded-lg flex items-center justify-center text-sm font-medium transition-colors shadow-sm hover:shadow"
                  onClick={() => castVote(proposal.id, VOTE_TYPES.FOR)}
                  disabled={voting.processing}
                >
                  <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Yes</span>
                </button>
                <button 
                  className="flex-1 min-w-0 bg-rose-500 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-700 text-white dark:text-white py-2 px-2 rounded-lg flex items-center justify-center text-sm font-medium transition-colors shadow-sm hover:shadow"
                  onClick={() => castVote(proposal.id, VOTE_TYPES.AGAINST)}
                  disabled={voting.processing}
                >
                  <X className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">No</span>
                </button>
                <button 
                  className="flex-1 min-w-0 bg-slate-500 hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500 text-white dark:text-white py-2 px-2 rounded-lg flex items-center justify-center text-sm font-medium transition-colors shadow-sm hover:shadow"
                  onClick={() => castVote(proposal.id, VOTE_TYPES.ABSTAIN)}
                  disabled={voting.processing}
                >
                  <span className="truncate">Abstain</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 px-6 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg my-3">
              You did not have enough voting power at the time of the proposal snapshot
            </div>
          )}
        </div>
      )}
      
      <div className="mt-6 text-center">
        <button 
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium px-3 py-1.5 border border-indigo-300 dark:border-indigo-600 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/40"
          onClick={() => {
            setSelectedProposal(proposal);
            setShowModal(true);
          }}
        >
          View Full Details
        </button>
      </div>
    </div>
  );
};

// Main VoteTab component
const VoteTab = ({ proposals, castVote, hasVoted, getVotingPower, voting, account }) => {
  const { contracts, contractsReady, isConnected } = useWeb3();
  
  const [voteFilter, setVoteFilter] = useState('active');
  const [votingPowers, setVotingPowers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [quorum, setQuorum] = useState(null);
  
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Replace govParams state with the hook
  const govParams = useGovernanceParams();
  
  // Track locally which proposals the user has voted on and how
  const [votedProposals, setVotedProposals] = useState({});
  
  // Add state for tracking the current threat level display
  const [currentThreatLevel, setCurrentThreatLevel] = useState(THREAT_LEVELS.LOW);
  const [threatLevelDelays, setThreatLevelDelays] = useState({});
  const [autoScroll, setAutoScroll] = useState(true);
  
  const [isGovExpanded, setIsGovExpanded] = useState(true);
  
  // Debug logging for proposals
  useEffect(() => {
    console.log('VoteTab received proposals:', proposals?.length || 0);
    if (proposals?.length > 0) {
      const proposalIds = proposals.map(p => Number(p.id));
      console.log('Proposal ID range:', Math.min(...proposalIds), 'to', Math.max(...proposalIds));
    }
  }, [proposals]);
  
  // Function to cycle through threat levels
  const cycleThreatLevel = (direction) => {
    setCurrentThreatLevel(prevLevel => {
      const levels = Object.values(THREAT_LEVELS);
      const currentIndex = levels.indexOf(prevLevel);
      
      if (direction === 'next') {
        return levels[(currentIndex + 1) % levels.length];
      } else {
        return levels[(currentIndex - 1 + levels.length) % levels.length];
      }
    });
  };
  
  // Set up automatic scrolling through threat levels
  useEffect(() => {
    if (!autoScroll) return;
    
    const interval = setInterval(() => {
      cycleThreatLevel('next');
    }, 10000); // Change every 10 seconds
    
    return () => clearInterval(interval); // Clean up on unmount
  }, [autoScroll]);
  
  // Get threat level name from value
  const getThreatLevelName = (level) => {
    const keys = Object.keys(THREAT_LEVELS);
    const values = Object.values(THREAT_LEVELS);
    const index = values.indexOf(level);
    return keys[index];
  };
  
  // Fetch threat level delays from the contract
  useEffect(() => {
    const fetchThreatLevelDelays = async () => {
      if (!contractsReady || !contracts.governance || !contracts.timelock) return;
      
      try {
        const delays = {};
        
        // Threat level delays are stored in the timelock contract, not governance
        for (const [name, level] of Object.entries(THREAT_LEVELS)) {
          try {
            const delay = await contracts.timelock.getDelayForThreatLevel(level);
            delays[level] = delay ? delay.toNumber() : 0;
            console.log(`Fetched ${name} threat level delay: ${delays[level]} seconds`);
          } catch (error) {
            console.warn(`Couldn't fetch delay for threat level ${name}:`, error);
          }
        }
        
        setThreatLevelDelays(delays);
      } catch (error) {
        console.error("Error fetching threat level delays:", error);
      }
    };
    
    fetchThreatLevelDelays();
  }, [contracts, contractsReady]);

  // Fetch voting powers for each proposal
  useEffect(() => {
    const fetchVotingPowers = async () => {
      if (!getVotingPower || !proposals.length || !account) return;
      
      try {
        setLoading(true);
        const powers = {};
        
        // Process proposals in batches to avoid overwhelming the network
        const batchSize = 5;
        const batches = [];
        
        for (let i = 0; i < proposals.length; i += batchSize) {
          batches.push(proposals.slice(i, i + batchSize));
        }
        
        for (const batch of batches) {
          const batchResults = await Promise.all(
            batch.map(async (proposal) => {
              try {
                if (proposal.snapshotId) {
                  // Try to get from cache first
                  const cacheKey = `votingPower-${account}-${proposal.snapshotId}`;
                  const cachedPower = blockchainDataCache.get(cacheKey);
                  if (cachedPower !== null) {
                    return { id: proposal.id, power: cachedPower };
                  }
                  
                  const power = await getVotingPower(proposal.snapshotId);
                  
                  // Cache the result with long TTL since snapshot data is historical
                  const ttl = 86400 * 7; // 7 days
                  blockchainDataCache.set(cacheKey, power, ttl);
                  
                  return { id: proposal.id, power };
                }
                return { id: proposal.id, power: "0" };
              } catch (err) {
                console.error(`Error getting voting power for proposal ${proposal.id}:`, err);
                return { id: proposal.id, power: "0" };
              }
            })
          );
          
          // Update powers object with batch results
          batchResults.forEach(({ id, power }) => {
            powers[id] = power;
          });
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setVotingPowers(powers);
      } catch (err) {
        console.error("Error fetching voting powers:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVotingPowers();
  }, [getVotingPower, proposals, account]);

  // Initialize votedProposals from the proposals data
  useEffect(() => {
    const voted = {};
    proposals.forEach(proposal => {
      if (proposal.hasVoted) {
        // Set default vote type to abstain if not specified
        let voteType = VOTE_TYPES.ABSTAIN;
        if (proposal.votedYes) voteType = VOTE_TYPES.FOR;
        if (proposal.votedNo) voteType = VOTE_TYPES.AGAINST;
        
        voted[proposal.id] = voteType;
      }
    });
    setVotedProposals(voted);
  }, [proposals, VOTE_TYPES]);
  
  // When govParams changes, update the quorum state for backward compatibility
  useEffect(() => {
    setQuorum(govParams.quorum?.toString());
  }, [govParams.quorum]);

  // Helper function to format time durations in a human-readable way
  const formatTimeDuration = (seconds) => {
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
  };

  // Filter proposals based on vote status
  const filteredProposals = proposals.filter(p => {
    // Safety check for null/undefined proposal
    if (!p) return false;
    
    // Check if we've locally voted on this proposal
    const locallyVoted = votedProposals[p.id] !== undefined;
    
    if (voteFilter === 'active') {
      // Only check if proposal is active, don't exclude based on vote status
      return p.state === PROPOSAL_STATES.ACTIVE;
    } else if (voteFilter === 'voted') {
      return p.hasVoted || locallyVoted;
    }
    return true; // 'all' filter
  });
  
  // Sort proposals by ID in descending order (newest first)
  const sortedProposals = [...filteredProposals].sort((a, b) => Number(b.id) - Number(a.id));
  
  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProposals = sortedProposals.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedProposals.length / itemsPerPage);
  
  // Pagination navigation functions
  const goToPage = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Check if user has voted on the proposal (directly check contract)
  const hasUserVoted = useCallback(async (proposalId) => {
    if (!isConnected || !account || !contractsReady || !contracts.governance) return false;
    
    try {
      // Check directly from contract - this is the correct method
      const voterInfo = await contracts.governance.proposalVoterInfo(proposalId, account);
      return !voterInfo.isZero(); // If non-zero, user has voted
    } catch (err) {
      console.error(`Error checking if user has voted on proposal ${proposalId}:`, err);
      
      // Fallback to local state
      return votedProposals[proposalId] !== undefined;
    }
  }, [isConnected, account, contractsReady, contracts, votedProposals]);
  
  // Get the vote type (directly check from events)
  const getUserVoteType = useCallback(async (proposalId) => {
    // First check our local state
    if (votedProposals[proposalId] !== undefined) {
      return votedProposals[proposalId];
    }
    
    if (!isConnected || !account || !contractsReady || !contracts.governance) {
      return null;
    }
    
    try {
      // Try to find vote cast events for this user on this proposal
      const filter = contracts.governance.filters.VoteCast(proposalId, account);
      const events = await contracts.governance.queryFilter(filter);
      
      if (events.length > 0) {
        // Use the most recent vote
        const latestVote = events[events.length - 1];
        return Number(latestVote.args.support);
      }
    } catch (err) {
      console.error(`Error getting vote type for proposal ${proposalId}:`, err);
    }
    
    return null;
  }, [votedProposals, isConnected, account, contractsReady, contracts]);

  // Enhanced function to render proposal description with proper rich text support
  const renderProposalDescription = (proposal, truncate = true, maxLength = 200) => {
    // Direct extraction of HTML content - don't rely on previous processing
    let descriptionHtml = null;
    let descriptionText = proposal.description || '';
    
    // Check if description contains HTML marker
    const htmlMarkerIndex = descriptionText.indexOf('|||HTML:');
    if (htmlMarkerIndex !== -1) {
      // Extract HTML content directly
      descriptionHtml = descriptionText.substring(htmlMarkerIndex + 8);
      // Get the plain text part
      descriptionText = descriptionText.substring(0, htmlMarkerIndex).trim();
    }
    
    // Use the extracted HTML if available, otherwise use the original descriptionHtml property
    const htmlContent = descriptionHtml || proposal.descriptionHtml;
    
    if (htmlContent) {
      if (truncate) {
        // Simple styling for truncated view (non-expanded)
        return (
          <div 
            className="text-sm text-gray-700 dark:text-gray-300 mb-6"
            dangerouslySetInnerHTML={{ __html: truncateHtml(htmlContent, maxLength) }}
          />
        );
      } else {
        // Full prose styling for expanded view with dark mode support
        return (
          <div 
            className="prose prose-sm max-w-none mb-4 dark:prose-invert dark:text-gray-200"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        );
      }
    } else {
      if (truncate) {
        return (
          <p className="text-gray-700 dark:text-gray-300 mb-6 text-base">
            {descriptionText.substring(0, maxLength)}
            {descriptionText.length > maxLength ? '...' : ''}
          </p>
        );
      } else {
        return (
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
            {descriptionText}
          </p>
        );
      }
    }
  };

  // Function to submit a vote
  const submitVote = async (proposalId, support) => {
    try {
      // Find the proposal in the list
      const proposal = proposals.find(p => p.id === proposalId);
      if (!proposal) {
        console.error("Proposal not found:", proposalId);
        return;
      }
      
      console.log(`Submitting vote for proposal #${proposalId} with type ${support}`);
      
      // Actually send the vote transaction to the blockchain
      const result = await castVote(proposalId, support);
      console.log("Vote transaction confirmed:", result);
      
      // Update the voted proposals state
      setVotedProposals(prev => ({
        ...prev,
        [proposalId]: support
      }));
      
      return result;
    } catch (err) {
      console.error("Error submitting vote:", err);
      throw err;
    }
  };

  // Helper to convert vote type to text
  const getVoteTypeText = (voteType) => {
    if (voteType === VOTE_TYPES.FOR) return 'Yes';
    if (voteType === VOTE_TYPES.AGAINST) return 'No';
    if (voteType === VOTE_TYPES.ABSTAIN) return 'Abstain';
    return '';
  };
  
  // Updated helper to get proposal type label with improved names
  const getProposalTypeLabel = (proposal) => {
    // Check if proposal has a typeLabel property
    if (proposal.typeLabel) {
      return proposal.typeLabel;
    }
    
    // Define the type labels mapping
    const typeLabels = {
      [PROPOSAL_TYPES.GENERAL]: "Contract Interaction",
      [PROPOSAL_TYPES.WITHDRAWAL]: "ETH Withdrawal",
      [PROPOSAL_TYPES.TOKEN_TRANSFER]: "Treasury Transfer",
      [PROPOSAL_TYPES.GOVERNANCE_CHANGE]: "Governance Parameter Update",
      [PROPOSAL_TYPES.EXTERNAL_ERC20_TRANSFER]: "External Token Transfer",
      [PROPOSAL_TYPES.TOKEN_MINT]: "Token Issuance",
      [PROPOSAL_TYPES.TOKEN_BURN]: "Token Consolidation",
      [PROPOSAL_TYPES.SIGNALING]: "Binding Community Vote"
    };
    
    // Return the type label based on the proposal type
    return typeLabels[proposal.type] || "Binding Community Vote";
  };
  
  // Helper to get proposal state label and color
  const getProposalStateInfo = (proposal) => {
    // Get actual state instead of relying on deadline
    const state = proposal.state;
    
    const stateLabels = {
      [PROPOSAL_STATES.ACTIVE]: { label: "Active", color: "bg-yellow-100 text-yellow-800" },
      [PROPOSAL_STATES.CANCELED]: { label: "Canceled", color: "bg-gray-100 text-gray-800" },
      [PROPOSAL_STATES.DEFEATED]: { label: "Defeated", color: "bg-red-100 text-red-800" },
      [PROPOSAL_STATES.SUCCEEDED]: { label: "Succeeded", color: "bg-green-100 text-green-800" },
      [PROPOSAL_STATES.QUEUED]: { label: "Queued", color: "bg-blue-100 text-blue-800" },
      [PROPOSAL_STATES.EXECUTED]: { label: "Executed", color: "bg-green-100 text-green-800" },
      [PROPOSAL_STATES.EXPIRED]: { label: "Expired", color: "bg-gray-100 text-gray-800" }
    };
    
    return stateLabels[parseInt(state)] || { label: "Unknown", color: "bg-gray-100 text-gray-800" };
  };

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
  
  // Format date correctly
  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    
    // Convert seconds to milliseconds if needed
    const dateValue = timestamp > 10000000000 ? timestamp : timestamp * 1000;
    
    try {
      return new Date(dateValue).toLocaleDateString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold dark:text-white">Vote</h2>
        <p className="text-gray-500 dark:text-gray-400">Cast your votes on active proposals</p>
      </div>
      
      {/* Governance Parameters Section */}
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow mb-6 border-l-4 border-indigo-500 dark:border-indigo-400 transition-all duration-300 ${isGovExpanded ? 'p-6' : 'p-4'}`}>
        <div className={`${isGovExpanded ? 'mb-4' : 'mb-0'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings 
                className={`h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2 transition-transform duration-300 ${isGovExpanded ? '' : 'transform rotate-180'}`} 
              />
              <h3 className="text-lg font-medium dark:text-white">Governance Parameters</h3>
              {govParams.loading && <Loader size="small" className="ml-2" />}
            </div>
            <button 
              onClick={() => setIsGovExpanded(!isGovExpanded)}
              className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
              aria-label={isGovExpanded ? "Collapse section" : "Expand section"}
            >
              {isGovExpanded ? 
                <ChevronUp className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> : 
                <ChevronDown className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              }
            </button>
          </div>
          {govParams.error && (
            <div className="text-sm text-red-500 dark:text-red-400 mt-1">
              {govParams.error}
            </div>
          )}
        </div>
        
        {/* Collapsible content with smooth transition */}
        <div 
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isGovExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/20 p-3 rounded-lg">
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Quorum</div>
              <div className="text-lg font-bold dark:text-white">{govParams.formattedQuorum} JST</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/20 p-3 rounded-lg">
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Voting Duration</div>
              <div className="text-lg font-bold dark:text-white">{govParams.formattedDuration}</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/20 p-3 rounded-lg">
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Proposal Threshold</div>
              <div className="text-lg font-bold dark:text-white">{govParams.formattedThreshold} JST</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/20 p-3 rounded-lg">
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Proposal Stake</div>
              <div className="text-lg font-bold dark:text-white">{govParams.formattedStake} JST</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Defeated Refund</div>
              <div className="text-lg dark:text-white">{govParams.defeatedRefundPercentage}%</div>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Canceled Refund</div>
              <div className="text-lg dark:text-white">{govParams.canceledRefundPercentage}%</div>
            </div>
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Expired Refund</div>
              <div className="text-lg dark:text-white">{govParams.expiredRefundPercentage}%</div>
            </div>
            
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 relative bg-gray-50 dark:bg-gray-800/80" style={{ height: "85px", width: "100%" }}>
              <div className="flex justify-center items-center">
                <div className="text-xs text-gray-700 dark:text-gray-300 font-medium text-center">
                  Threat Level Delays
                </div>
              </div>
              <div className="flex flex-col items-center justify-center mt-1" style={{ height: "40px" }}>
                <div className={`text-xs font-medium ${
                  getThreatLevelName(currentThreatLevel) === 'LOW' ? 'text-green-600 dark:text-green-400' :
                  getThreatLevelName(currentThreatLevel) === 'MEDIUM' ? 'text-yellow-600 dark:text-yellow-400' :
                  getThreatLevelName(currentThreatLevel) === 'HIGH' ? 'text-orange-600 dark:text-orange-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {getThreatLevelName(currentThreatLevel)}
                </div>
                <div className="text-sm font-medium mt-1 dark:text-white">
                  {formatTimeDuration(threatLevelDelays[currentThreatLevel] || 0)}
                </div>
              </div>
              <div className="absolute bottom-1 left-0 w-full px-3">
                <div className="h-0.5 bg-indigo-100 dark:bg-indigo-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ease-in-out ${
                      getThreatLevelName(currentThreatLevel) === 'LOW' ? 'bg-gradient-to-r from-green-400 to-green-600 dark:from-green-500 dark:to-green-300' :
                      getThreatLevelName(currentThreatLevel) === 'MEDIUM' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 dark:from-yellow-500 dark:to-yellow-300' :
                      getThreatLevelName(currentThreatLevel) === 'HIGH' ? 'bg-gradient-to-r from-orange-400 to-orange-600 dark:from-orange-500 dark:to-orange-300' :
                      'bg-gradient-to-r from-red-400 to-red-600 dark:from-red-500 dark:to-red-300'
                    }`}
                    style={{ 
                      width: `${(Object.values(THREAT_LEVELS).indexOf(currentThreatLevel) + 1) * 25}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter options */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
        <div className="flex flex-wrap gap-3">
          {['active', 'voted', 'all'].map(filter => (
            <button
              key={filter}
              className={`px-4 py-2 rounded-full text-sm ${
                voteFilter === filter 
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 font-medium' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
              onClick={() => {
                setVoteFilter(filter);
                setCurrentPage(1); // Reset to the first page on filter change
              }}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Voting cards */}
      <div className="space-y-8">
        {loading && currentProposals.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader size="large" text="Loading proposals..." />
          </div>
        ) : currentProposals.length > 0 ? (
          <>
            {currentProposals.map((proposal) => (
              <ProposalCard 
                key={proposal.id}
                proposal={proposal}
                votingPower={votingPowers[proposal.id] || "0"}
                castVote={submitVote}
                formatToFiveDecimals={formatToFiveDecimals}
                govParams={govParams}
                hasUserVoted={hasUserVoted}
                getUserVoteType={getUserVoteType}
                getVoteTypeText={getVoteTypeText}
                VOTE_TYPES={VOTE_TYPES}
                PROPOSAL_STATES={PROPOSAL_STATES}
                getProposalStateInfo={getProposalStateInfo}
                renderProposalDescription={renderProposalDescription}
                setSelectedProposal={setSelectedProposal}
                setShowModal={setShowModal}
                voting={voting}
              />
            ))}
            
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow dark:shadow-gray-700/20">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing proposals {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, sortedProposals.length)} of {sortedProposals.length}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className={`flex items-center justify-center p-2 rounded-md ${currentPage === 1 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30'}`}
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {/* Page numbers */}
                  <div className="flex space-x-1">
                    {/* Show limited page numbers with ellipsis for better UI */}
                    {[...Array(totalPages)].map((_, i) => {
                      // Only show first page, last page, current page, and pages around current
                      const pageNum = i + 1;
                      
                      // Logic to determine which page numbers to show
                      const shouldShowPage = 
                        pageNum === 1 || // Always show first page
                        pageNum === totalPages || // Always show last page
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1); // Show current and surrounding pages
                      
                      // Show ellipsis before and after skipped pages
                      const showPrevEllipsis = i === 1 && currentPage > 3;
                      const showNextEllipsis = i === totalPages - 2 && currentPage < totalPages - 2;
                      
                      if (shouldShowPage) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md ${
                              currentPage === pageNum
                                ? 'bg-indigo-600 text-white dark:bg-indigo-700'
                                : 'text-gray-700 hover:bg-indigo-50 dark:text-gray-300 dark:hover:bg-indigo-900/30'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (showPrevEllipsis || showNextEllipsis) {
                        return (
                          <div key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center">
                            &hellip;
                          </div>
                        );
                      } else {
                        return null;
                      }
                    })}
                  </div>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className={`flex items-center justify-center p-2 rounded-md ${currentPage === totalPages 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30'}`}
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            No proposals found for this filter
          </div>
        )}
      </div>
      
      {/* Proposal Details Modal */}
      {showModal && selectedProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start p-4 border-b dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold dark:text-white">{selectedProposal.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Proposal #{selectedProposal.id}</p>
              </div>
              <button 
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => setShowModal(false)}
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Proposal type and status */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-xs px-2 py-1 rounded-full">
                  {getProposalTypeLabel(selectedProposal)}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${getProposalStateInfo(selectedProposal).color}`}>
                  {getProposalStateInfo(selectedProposal).label}
                </span>
              </div>
              
              {/* Proposal metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                  <div className="dark:text-gray-300">
                    <span className="text-gray-600 dark:text-gray-400">Created:</span> {formatDate(selectedProposal.createdAt)}
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                  <div className="dark:text-gray-300">
                    <span className="text-gray-600 dark:text-gray-400">Deadline:</span> {formatCountdown(selectedProposal.deadline)}
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <Users className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                  <div className="dark:text-gray-300">
                    <span className="text-gray-600 dark:text-gray-400">Proposer:</span> {selectedProposal.proposer?.substring(0, 6)}...{selectedProposal.proposer?.slice(-4)}
                  </div>
                </div>
                <div className="flex items-center text-sm">
                  <BarChart2 className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                  <div className="dark:text-gray-300">
                    <span className="text-gray-600 dark:text-gray-400">Snapshot ID:</span>{" "}
                    {selectedProposal.snapshotId ? `#${selectedProposal.snapshotId}` : "N/A"}
                  </div>
                </div>
              </div>
              
              {/* Full description with proper HTML rendering */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded border dark:border-gray-700">
                  {renderProposalDescription(selectedProposal, false)}
                </div>
              </div>
              
              {/* Vote results - Using our enhanced VoteData component for consistent data */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Voting Results</h4>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded border dark:border-gray-700">
                  <VoteData proposalId={selectedProposal.id} showDetailedInfo={true} />
                  
                  {/* Quorum progress */}
                  {govParams.quorum > 0 && selectedProposal.state !== PROPOSAL_STATES.DEFEATED && (
                    <div className="mt-4 mb-5">
                      <h5 className="text-sm font-medium mb-2 dark:text-gray-300">Quorum Progress</h5>
                      <QuorumProgress proposalId={selectedProposal.id} quorum={govParams.quorum} />
                    </div>
                  )}
                  
                  {/* Use ModalVoteStatus component to handle async vote checking */}
                  <ModalVoteStatus 
                    proposalId={selectedProposal.id}
                    hasUserVoted={hasUserVoted}
                    getUserVoteType={getUserVoteType}
                    getVoteTypeText={getVoteTypeText}
                  />
                </div>
              </div>
              
              {/* Additional proposal details */}
              {selectedProposal.actions && selectedProposal.actions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Actions</h4>
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded border dark:border-gray-700">
                    <ul className="list-disc pl-5 text-sm dark:text-gray-300">
                      {selectedProposal.actions.map((action, i) => (
                        <li key={i} className="mb-1">{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Transaction details if available */}
              {selectedProposal.txHash && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Hash</h4>
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded border dark:border-gray-700 text-sm break-all dark:text-gray-300">
                    {selectedProposal.txHash}
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t dark:border-gray-700 p-4 flex justify-end">
              <button
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoteTab;