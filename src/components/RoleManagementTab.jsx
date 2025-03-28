import React, { useState, useEffect } from 'react';
import { Shield, PlusCircle, Trash2 } from 'lucide-react';
import Loader from './Loader';

const RoleManagementTab = ({ contracts }) => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleData, setNewRoleData] = useState({
    address: '',
    role: 'admin',
    customRole: ''
  });
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Available roles based on the actual contracts
  const availableRoles = [
    { id: 'admin', name: 'Admin', description: 'Full administrative control over the DAO' },
    { id: 'guardian', name: 'Guardian', description: 'Emergency response capabilities including pause/unpause' },
    { id: 'analytics', name: 'Analytics', description: 'Access to analytics and reporting data' },
    { id: 'proposer', name: 'Proposer', description: 'Can create proposals in the timelock' },
    { id: 'executor', name: 'Executor', description: 'Can execute passed proposals in the timelock' },
    { id: 'canceller', name: 'Canceller', description: 'Can cancel queued transactions in the timelock' },
    { id: 'governance', name: 'Governance', description: 'Special role for governance operations' },
    { id: 'minter', name: 'Minter', description: 'Can mint new tokens' },
    { id: 'custom', name: 'Custom Role', description: 'Define a custom role' }
  ];

  // Role byte32 hashes for contract interaction
  const roleHashes = {
    admin: '0xd0b7542f66b44067c25524298865c94b7d42a42a7e08177fd482a14eee469dbf', // ADMIN_ROLE
    guardian: '0x964d976a856d5d2ae0dd75615803d9eab5f16a935919603edacadbe9649f1da4', // GUARDIAN_ROLE
    analytics: '0x8f2157482fb2bf7ba9a48d0daf4a0d28ce79f04a471517936083435cf5943366', // ANALYTICS_ROLE
    proposer: '0xb923c69a54657b9dbaf776310c008e80b6f272711895f60f84f24b949fefd194', // PROPOSER_ROLE
    executor: '0x7a9ac023163a81858ee74272cc1c75623b6237e15b9ced95c3d14a32c3ba2a3a', // EXECUTOR_ROLE
    canceller: '0x7b28a0c553dedd0dfa7fdd19446dc69f3a36a935a9aadc98b005e4cfb7d059b2', // CANCELLER_ROLE
    governance: '0xee8df5d85e85c80c591fdc921a5a8ee35fac398ad77f8a36e75acab202b4a73f', // GOVERNANCE_ROLE
    minter: '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', // MINTER_ROLE
  };

  // Load roles data
  useEffect(() => {
    const loadRoles = async () => {
      if (!contracts.governance) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Build a list of all roles to check
        const allRoles = [];
        
        // For each role type and contract, check if the contract has that role
        for (const [roleId, roleHash] of Object.entries(roleHashes)) {
          // Try to get role members from each contract that might have roles
          const possibleContracts = [
            'governance', 'token', 'timelock', 'analyticsHelper', 'daoHelper'
          ];
          
          for (const contractName of possibleContracts) {
            if (contracts[contractName]) {
              try {
                const roleCount = await contracts[contractName].getRoleMemberCount(roleHash);
                
                // If this role exists in this contract, get all members
                for (let i = 0; i < roleCount; i++) {
                  const account = await contracts[contractName].getRoleMember(roleHash, i);
                  
                  allRoles.push({
                    address: account,
                    role: roleHash,
                    displayName: availableRoles.find(r => r.id === roleId)?.name || 'Custom Role',
                    contractName: contractName,
                    grantedAt: 'N/A' // We don't have this info without events
                  });
                }
              } catch (error) {
                // This contract might not have this role - just continue
                console.log(`Role ${roleId} may not exist in ${contractName}`);
              }
            }
          }
        }
        
        // Remove duplicates (same address with same role)
        const uniqueRoles = [];
        const seen = new Set();
        
        for (const role of allRoles) {
          const key = `${role.role}-${role.address}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueRoles.push(role);
          }
        }
        
        setRoles(uniqueRoles);
      } catch (error) {
        console.error("Error loading roles:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRoles();
  }, [contracts]);

  // Handle granting new role
  const handleGrantRole = async () => {
    setErrorMessage('');
    
    if (!newRoleData.address) {
      setErrorMessage('Please enter a valid address');
      return;
    }
    
    // Determine role hash
    let roleHash;
    if (newRoleData.role === 'custom') {
      if (!newRoleData.customRole) {
        setErrorMessage('Please enter a custom role hash');
        return;
      }
      roleHash = newRoleData.customRole;
    } else {
      roleHash = roleHashes[newRoleData.role];
      if (!roleHash) {
        setErrorMessage('Invalid role selected');
        return;
      }
    }
    
    // Determine which contract to use (governance by default)
    let targetContract = contracts.governance;
    
    // For certain roles, use specific contracts
    if (['proposer', 'executor', 'canceller'].includes(newRoleData.role)) {
      targetContract = contracts.timelock;
    } else if (newRoleData.role === 'analytics') {
      targetContract = contracts.analyticsHelper || contracts.governance;
    } else if (newRoleData.role === 'minter') {
      targetContract = contracts.token;
    }
    
    if (!targetContract) {
      setErrorMessage('Target contract not available');
      return;
    }
    
    setTransactionLoading(true);
    try {
      // Grant the role using the appropriate function based on contract
      let tx;
      if (targetContract.grantContractRole) {
        // JustGovernance and other contracts have this function
        tx = await targetContract.grantContractRole(roleHash, newRoleData.address);
      } else if (targetContract.grantRole) {
        // Standard OpenZeppelin AccessControl
        tx = await targetContract.grantRole(roleHash, newRoleData.address);
      } else {
        throw new Error('Contract does not support role management');
      }
      
      await tx.wait();
      
      // Update UI
      setRoles([...roles, {
        address: newRoleData.address,
        role: roleHash,
        displayName: newRoleData.role === 'custom' ? 'Custom Role' : 
                     availableRoles.find(r => r.id === newRoleData.role)?.name,
        contractName: targetContract === contracts.governance ? 'governance' :
                      targetContract === contracts.timelock ? 'timelock' :
                      targetContract === contracts.token ? 'token' :
                      targetContract === contracts.analyticsHelper ? 'analyticsHelper' :
                      'unknown',
                      grantedAt: new Date().toISOString().split('T')[0]
                    }]);
      
      // Close modal and reset form
      setShowAddRoleModal(false);
      setNewRoleData({
        address: '',
        role: 'admin',
        customRole: ''
      });
    } catch (error) {
      console.error("Error granting role:", error);
      setErrorMessage(error.message || 'Error granting role. See console for details.');
    } finally {
      setTransactionLoading(false);
    }
  };

  // Handle revoking a role
  const handleRevokeRole = async (roleHash, address, contractName) => {
    if (!window.confirm(`Are you sure you want to revoke this role from ${address}?`)) {
      return;
    }
    
    // Determine which contract to use based on the contractName
    let targetContract;
    switch (contractName) {
      case 'governance':
        targetContract = contracts.governance;
        break;
      case 'token':
        targetContract = contracts.token;
        break;
      case 'timelock':
        targetContract = contracts.timelock;
        break;
      case 'analyticsHelper':
        targetContract = contracts.analyticsHelper;
        break;
      case 'daoHelper':
        targetContract = contracts.daoHelper;
        break;
      default:
        targetContract = contracts.governance;
    }
    
    if (!targetContract) {
      setErrorMessage(`Contract ${contractName} not available`);
      return;
    }
    
    try {
      // Revoke the role using the appropriate function based on contract
      let tx;
      if (targetContract.revokeContractRole) {
        // JustGovernance and other contracts have this function
        tx = await targetContract.revokeContractRole(roleHash, address);
      } else if (targetContract.revokeRole) {
        // Standard OpenZeppelin AccessControl
        tx = await targetContract.revokeRole(roleHash, address);
      } else {
        throw new Error('Contract does not support role revocation');
      }
      
      await tx.wait();
      
      // Update UI by removing the revoked role
      setRoles(roles.filter(r => !(r.role === roleHash && r.address === address)));
    } catch (error) {
      console.error("Error revoking role:", error);
      alert('Error revoking role. See console for details.');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Role Management</h2>
          <p className="text-gray-500">Assign and manage roles</p>
        </div>
        <button 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center"
          onClick={() => setShowAddRoleModal(true)}
        >
          <PlusCircle className="w-4 h-4 mr-1" />
          Assign Role
        </button>
      </div>
      
      {/* Roles List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Role Assignments</h3>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader size="large" text="Loading roles..." />
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No custom roles have been assigned yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contract</th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {roles.map((role, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 text-indigo-500 mr-2" />
                        <span className="text-sm font-medium">{role.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {role.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {role.contractName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        className="text-red-600 hover:text-red-900 flex items-center ml-auto"
                        onClick={() => handleRevokeRole(role.role, role.address, role.contractName)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Assign New Role</h2>
            
            {errorMessage && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p>{errorMessage}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input 
                  type="text" 
                  className="w-full rounded-md border border-gray-300 p-2" 
                  placeholder="0x..."
                  value={newRoleData.address}
                  onChange={(e) => setNewRoleData({...newRoleData, address: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  className="w-full rounded-md border border-gray-300 p-2"
                  value={newRoleData.role}
                  onChange={(e) => setNewRoleData({...newRoleData, role: e.target.value})}
                >
                  {availableRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {availableRoles.find(r => r.id === newRoleData.role)?.description}
                </p>
              </div>
              
              {newRoleData.role === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Role ID</label>
                  <input 
                    type="text" 
                    className="w-full rounded-md border border-gray-300 p-2" 
                    placeholder="0x..."
                    value={newRoleData.customRole}
                    onChange={(e) => setNewRoleData({...newRoleData, customRole: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the keccak256 hash of the role name
                  </p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <button 
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={() => setShowAddRoleModal(false)}
                  disabled={transactionLoading}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400"
                  onClick={handleGrantRole}
                  disabled={transactionLoading}
                >
                  {transactionLoading ? 'Assigning...' : 'Assign Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagementTab;