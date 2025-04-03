import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

const GovInfo = () => {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold dark:text-white">Governance Overview</h2>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Learn about how JustDAO's governance system works to fund legal aid initiatives while maintaining regulatory compliance.
        </p>
      </div>
      
      {/* Elect Model Explanation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-gray-700/20">
        <div className="p-5">
          <h2 className="text-xl font-bold text-indigo-600 mb-3 dark:text-indigo-400">Governance: The Selection Process</h2>
          <p className="text-gray-600 mb-5 dark:text-gray-300">
            JustDAO's governance process empowers our community to select qualified legal aid providers 
            for both organizational funding and individual client representation, while maintaining proper regulatory separation.
          </p>
          
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/2">
              <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
                <h3 className="font-semibold text-lg mb-3 dark:text-white">The Two-Layer Approach</h3>
                <div className="space-y-5">
                  <div className="bg-white p-4 rounded shadow-sm dark:bg-gray-700">
                    <div className="flex items-center mb-2">
                      <div className="bg-indigo-100 rounded-full p-2 mr-3 dark:bg-indigo-800">
                        <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h4 className="font-medium dark:text-white">Governance Layer (DAO members)</h4>
                    </div>
                    <p className="text-gray-600 text-sm pl-9 dark:text-gray-300">
                      Makes high-level funding decisions and selects trusted entities through proposals and voting
                    </p>
                  </div>
                  
                  <div className="flex justify-center">
                    <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  
                  <div className="bg-white p-4 rounded shadow-sm dark:bg-gray-700">
                    <div className="flex items-center mb-2">
                      <div className="bg-indigo-100 rounded-full p-2 mr-3 dark:bg-indigo-800">
                        <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h4 className="font-medium dark:text-white">Implementation Layer (Elected providers)</h4>
                    </div>
                    <p className="text-gray-600 text-sm pl-9 dark:text-gray-300">
                      Handles direct service provision including both organizational services and individual client representation
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-500 italic dark:text-gray-400">
                  This separation prevents unauthorized practice of law while ensuring funds are directed by community priorities.
                </p>
              </div>
            </div>
            
            <div className="md:w-1/2">
              <h3 className="font-semibold text-lg mb-3 dark:text-white">How Provider Election Works:</h3>
              <ol className="space-y-3">
                <li className="flex">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium dark:text-white">Qualification</h4>
                    <p className="text-gray-600 text-sm dark:text-gray-300">Legal aid organizations apply with credentials and service proposals</p>
                  </div>
                </li>
                
                <li className="flex">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium dark:text-white">Due Diligence</h4>
                    <p className="text-gray-600 text-sm dark:text-gray-300">DAO members evaluate applications against established criteria</p>
                  </div>
                </li>
                
                <li className="flex">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium dark:text-white">Formal Proposal</h4>
                    <p className="text-gray-600 text-sm dark:text-gray-300">Qualified candidates are presented to the community</p>
                  </div>
                </li>
                
                <li className="flex">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium dark:text-white">Community Vote</h4>
                    <p className="text-gray-600 text-sm dark:text-gray-300">Token holders decide which providers to fund</p>
                  </div>
                </li>
                
                <li className="flex">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                    5
                  </div>
                  <div>
                    <h4 className="font-medium dark:text-white">Grant Allocation</h4>
                    <p className="text-gray-600 text-sm dark:text-gray-300">Approved providers receive funding through smart contract execution</p>
                  </div>
                </li>
                
                <li className="flex">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 dark:bg-indigo-500">
                    6
                  </div>
                  <div>
                    <h4 className="font-medium dark:text-white">Performance Tracking</h4>
                    <p className="text-gray-600 text-sm dark:text-gray-300">Elected providers submit regular impact reports on both organizational initiatives and individual cases</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      
      {/* Individual Client Representation Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-gray-700/20">
        <div className="p-5">
          <h2 className="text-xl font-bold text-indigo-600 mb-3 dark:text-indigo-400">Individual Client Representation</h2>
          <p className="text-gray-600 mb-4 dark:text-gray-300">
            JustDAO's elect model enables individual client representation while maintaining all legal and ethical boundaries.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Governance Role</h3>
              <ul className="space-y-2 pl-5 list-disc text-gray-600 dark:text-gray-300">
                <li>Set eligibility criteria for individual representation</li>
                <li>Approve funding allocations for client pools</li>
                <li>Review anonymized outcome metrics</li>
                <li>Establish ethical guidelines for representation</li>
                <li>Vote on provider selection and renewal</li>
              </ul>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Provider Role</h3>
              <ul className="space-y-2 pl-5 list-disc text-gray-600 dark:text-gray-300">
                <li>Identify and screen eligible clients</li>
                <li>Establish direct attorney-client relationships</li>
                <li>Manage case strategy and execution</li>
                <li>Maintain strict client confidentiality</li>
                <li>Report anonymized outcome data to DAO</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p className="italic">
              This clear separation ensures proper attorney-client privilege while allowing community-driven funding to reach individuals in need.
            </p>
          </div>
        </div>
      </div>
      
      {/* Legal Compliance Alert */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 border-l-4 border-yellow-400 dark:border-yellow-500 dark:shadow-gray-700/20">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Legal Compliance Notice</h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-200">
              <p>
                JustDAO's elect model ensures compliance with legal regulations by maintaining separation between
                governance decisions and direct legal services. When participating in governance:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Focus on provider qualifications and performance metrics</li>
                <li>Avoid directing specific case handling or legal strategy</li>
                <li>Remember that only licensed attorneys can provide legal advice</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Proposal Types */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-gray-700/20">
        <div className="p-5">
          <h2 className="text-xl font-bold text-indigo-600 mb-3 dark:text-indigo-400">Proposal Types</h2>
          <p className="text-gray-600 mb-5 dark:text-gray-300">
            JustDAO supports multiple proposal types to enable different governance actions and decisions:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Governance Proposals</h3>
              <ul className="space-y-2 pl-5 list-disc text-gray-600 dark:text-gray-300">
                <li><span className="font-medium">Smart Contract Interaction:</span> Execute specific function calls to vetted contracts for advanced operations</li>
                <li><span className="font-medium">Framework Adjustment:</span> Update key governance parameters like voting duration, quorum, or thresholds to adapt to community needs</li>
                <li><span className="font-medium">Community Vote:</span> Binding votes on important issues, including polls and initiatives that establish DAO priorities</li>
              </ul>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Financial Proposals</h3>
              <ul className="space-y-2 pl-5 list-disc text-gray-600 dark:text-gray-300">
                <li><span className="font-medium">Fund Distribution:</span> Transfer ETH from the DAO treasury to legal aid providers and initiatives</li>
                <li><span className="font-medium">Token Allocation:</span> Distribute governance tokens to align incentives or reward participation</li>
                <li><span className="font-medium">External Asset Management:</span> Transfer other ERC20 tokens held by the DAO as part of treasury diversification</li>
                <li><span className="font-medium">Supply Management:</span> Control token supply through carefully governed minting and burning processes</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
            <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Service Provider Selection</h3>
            <p className="text-gray-600 dark:text-gray-300">
              These specialized proposals are central to JustDAO's mission, enabling the community to select and fund qualified legal aid providers through our two-layer governance model:
            </p>
            <ul className="mt-2 space-y-2 pl-5 list-disc text-gray-600 dark:text-gray-300">
              <li>Rigorous nomination and election process with due diligence requirements</li>
              <li>Comprehensive definition of service scope, funding allocation, and term length</li>
              <li>Transparent performance metrics and mandatory impact reporting</li>
              <li>Clear client eligibility criteria to ensure funds reach intended beneficiaries</li>
              <li>Built-in accountability mechanisms and renewal conditions</li>
              <li>Geographic and practice area diversification requirements</li>
            </ul>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              This process ensures that our funding reaches the most effective legal service providers, maximizing impact while maintaining democratic oversight by token holders.
            </p>
          </div>
        </div>
      </div>
      
      {/* Governance Workflow */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-gray-700/20">
        <div className="p-5">
          <h2 className="text-xl font-bold text-indigo-600 mb-3 dark:text-indigo-400">Governance Workflow</h2>
          <p className="text-gray-600 mb-5 dark:text-gray-300">
            The complete life cycle of a JustDAO governance proposal:
          </p>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white dark:bg-gray-800 text-lg font-medium text-gray-900 dark:text-white">
                Proposal Lifecycle
              </span>
            </div>
          </div>
          
          <div className="flow-root mt-6">
            <ul className="-mb-8">
              <li>
                <div className="relative pb-8">
                  <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                  <div className="relative flex items-start space-x-3">
                    <div>
                      <div className="relative px-1">
                        <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div>
                        <div className="text-lg font-medium text-gray-900 dark:text-white">1. Proposal Creation</div>
                      </div>
                      <div className="mt-2 text-gray-700 dark:text-gray-300">
                        <p>Token holders create proposals with a required stake. When submitted, a snapshot is created to freeze voting power distribution for this proposal.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              
              <li>
                <div className="relative pb-8">
                  <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                  <div className="relative flex items-start space-x-3">
                    <div>
                      <div className="relative px-1">
                        <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div>
                        <div className="text-lg font-medium text-gray-900 dark:text-white">2. Voting Period</div>
                      </div>
                      <div className="mt-2 text-gray-700 dark:text-gray-300">
                        <p>Token holders vote FOR, AGAINST, or ABSTAIN during the voting period. A proposal succeeds if it receives more FOR than AGAINST votes and meets the quorum requirement.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              
              <li>
                <div className="relative pb-8">
                  <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                  <div className="relative flex items-start space-x-3">
                    <div>
                      <div className="relative px-1">
                        <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div>
                        <div className="text-lg font-medium text-gray-900 dark:text-white">3. Queuing</div>
                      </div>
                      <div className="mt-2 text-gray-700 dark:text-gray-300">
                        <p>Successful proposals are queued in the timelock contract with a delay period based on the transaction's threat level (from 1 to 14 days).</p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              
              <li>
                <div className="relative pb-8">
                  <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-indigo-600 dark:bg-indigo-500" aria-hidden="true"></span>
                  <div className="relative flex items-start space-x-3">
                    <div>
                      <div className="relative px-1">
                        <div className="h-10 w-10 bg-indigo-500 dark:bg-indigo-600 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div>
                        <div className="text-lg font-medium text-gray-900 dark:text-white">4. Execution</div>
                      </div>
                      <div className="mt-2 text-gray-700 dark:text-gray-300">
                        <p>After the timelock delay, any token holder can execute the proposal. The proposer's stake is fully refunded upon successful execution.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              
              <li>
                <div className="relative">
                  <div className="relative flex items-start space-x-3">
                    <div>
                      <div className="relative px-1">
                        <div className="h-10 w-10 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div>
                        <div className="text-lg font-medium text-gray-900 dark:text-white">5. Implementation</div>
                      </div>
                      <div className="mt-2 text-gray-700 dark:text-gray-300">
                        <p>Funds are allocated to legal aid initiatives according to the executed proposal. This might include direct ETH transfers, token distributions, or contract interactions.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Security Features */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-gray-700/20">
        <div className="p-5">
          <h2 className="text-xl font-bold text-indigo-600 mb-3 dark:text-indigo-400">Security & Compliance</h2>
          <p className="text-gray-600 mb-5 dark:text-gray-300">
            JustDAO implements several security and compliance features to protect funds and maintain regulatory alignment:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Tiered Security</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Different transactions require different waiting periods based on risk level, from 1 day for basic operations to 14 days for critical changes.
              </p>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Delegation Controls</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Sophisticated delegation system with safeguards against cycles and a maximum delegation depth of 8 to prevent excessive chains.
              </p>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Role-Based Access</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Strict permission management with role hierarchies for admins, guardians, governance, and specialized roles.
              </p>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Guardian Role</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Emergency safety mechanisms allowing designated guardians to pause contracts and cancel transactions in emergency situations.
              </p>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Regulatory Separation</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Clear boundaries between governance decisions and legal service provision to maintain compliance with legal ethics and regulations.
              </p>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-lg dark:bg-indigo-900/30">
              <h3 className="font-medium text-indigo-700 mb-2 dark:text-indigo-300">Upgradeable Contracts</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                All contracts use the Universal Upgradeable Proxy Standard (UUPS) to allow improvements while preserving state and funds.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Call to Action */}
      <div className="bg-indigo-600 dark:bg-indigo-700 rounded-lg shadow overflow-hidden mb-6">
        <div className="px-6 py-8 sm:p-10 sm:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <h3 className="text-xl font-semibold text-white">Ready to participate in governance?</h3>
              <p className="mt-2 text-indigo-100">
                Join JustDAO today to help fund legal aid initiatives and shape the future of legal access for underserved communities.
              </p>
            </div>
            <div className="text-center md:text-right">
              <button className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-indigo-700">
                Launch App
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovInfo;