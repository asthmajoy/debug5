import { ethers } from 'ethers';

/**
 * Fetches the on-chain voting power for an address
 * @param {string} address - The address to check voting power for
 * @param {object} tokenContract - The token contract instance
 * @returns {Promise<string>} - Formatted voting power as a string
 */
export async function fetchOnChainVotingPower(address, tokenContract) {
  if (!address || !tokenContract) {
    console.log("Missing required parameters for fetchOnChainVotingPower");
    return "0";
  }
  
  try {
    // Get the current snapshot ID
    const snapshotId = await tokenContract.getCurrentSnapshotId();
    
    // Get effective voting power directly from the contract
    const votingPower = await tokenContract.getEffectiveVotingPower(address, snapshotId);
    
    // Format the result
    return ethers.utils.formatEther(votingPower);
  } catch (error) {
    console.error("Error fetching on-chain voting power:", error);
    return "0";
  }
}

/**
 * Fetches detailed voting power breakdown for an address
 * @param {string} address - The address to check
 * @param {object} tokenContract - The token contract instance
 * @returns {Promise<object>} - Voting power details
 */
export async function fetchVotingPowerDetails(address, tokenContract) {
  if (!address || !tokenContract) {
    return {
      ownBalance: "0",
      delegatedToYou: "0",
      totalVotingPower: "0",
      currentDelegate: null,
      isSelfDelegated: true
    };
  }
  
  try {
    // Get current snapshot
    const snapshotId = await tokenContract.getCurrentSnapshotId();
    
    // Get total voting power
    const votingPower = await tokenContract.getEffectiveVotingPower(address, snapshotId);
    
    // Get own balance
    const balance = await tokenContract.balanceOf(address);
    
    // Get current delegate
    const currentDelegate = await tokenContract.getDelegate(address);
    
    // Get delegated to you
    const delegatedToYou = await tokenContract.getDelegatedToAddress(address);
    
    // Check if self-delegated
    const isSelfDelegated = 
      currentDelegate === address || 
      currentDelegate === ethers.constants.AddressZero;
    
    return {
      ownBalance: ethers.utils.formatEther(balance),
      delegatedToYou: ethers.utils.formatEther(delegatedToYou),
      totalVotingPower: ethers.utils.formatEther(votingPower),
      currentDelegate,
      isSelfDelegated
    };
  } catch (error) {
    console.error("Error fetching voting power details:", error);
    return {
      ownBalance: "0",
      delegatedToYou: "0",
      totalVotingPower: "0",
      currentDelegate: null,
      isSelfDelegated: true
    };
  }
}

/**
 * Calculates voting power from local data (no blockchain call)
 * @param {string} userBalance - User token balance
 * @param {string} delegatedToYou - Tokens delegated to the user
 * @param {boolean} isSelfDelegated - Whether the user is self-delegated
 * @returns {string} - Calculated voting power
 */
export function calculateLocalVotingPower(userBalance, delegatedToYou, isSelfDelegated) {
  // If self-delegated, voting power = own balance + delegated to you
  // If not self-delegated, voting power = 0
  if (isSelfDelegated) {
    const balance = parseFloat(userBalance || "0");
    const delegated = parseFloat(delegatedToYou || "0");
    return (balance + delegated).toFixed(5);
  } else {
    return "0.00000";
  }
}