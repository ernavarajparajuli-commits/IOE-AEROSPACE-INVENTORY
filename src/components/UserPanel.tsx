/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, InventoryItem, TransactionLog, SheetMetadata, InventoryStatus } from '../types';
import {
  User,
  Users,
  Plus,
  Trash2,
  Database,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Wrench,
  ChevronRight,
  ShieldAlert,
  Edit3,
  BookOpen,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  RefreshCw,
  Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserPanelProps {
  metadata: SheetMetadata;
  currentUserProfile: UserProfile | null;
  users: UserProfile[];
  inventories: InventoryItem[];
  logs: TransactionLog[];
  onSaveProfile: (profile: UserProfile) => Promise<void>;
  onSaveInventory: (item: InventoryItem) => Promise<void>;
  onDeleteInventory: (id: string) => Promise<void>;
  onTransferInventory: (itemId: string, targetEmail: string, notes: string) => Promise<void>;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export default function UserPanel({
  metadata,
  currentUserProfile,
  users,
  inventories,
  logs,
  onSaveProfile,
  onSaveInventory,
  onDeleteInventory,
  onTransferInventory,
  onSync,
  isSyncing
}: UserPanelProps) {
  const [activeTab, setActiveTab] = useState<'my-items' | 'directory' | 'profile'>('my-items');

  // Directory Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Inventory Registration State
  const [regForm, setRegForm] = useState({
    name: '',
    serialNumber: '',
    category: 'General Lab Equipments',
    totalQuantity: 1,
    conditionNotes: '',
  });
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Transfer State
  const [transferringItem, setTransferringItem] = useState<InventoryItem | null>(null);
  const [targetUserEmail, setTargetUserEmail] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Edit Profile State
  const [profileForm, setProfileForm] = useState({
    name: currentUserProfile?.name || '',
    designation: currentUserProfile?.designation || 'Student',
    phone: currentUserProfile?.phone || '',
  });
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  // Status/Notice States
  const [successText, setSuccessText] = useState('');
  const [errorText, setErrorText] = useState('');

  const setNotice = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      setSuccessText(text);
      setErrorText('');
      setTimeout(() => setSuccessText(''), 4000);
    } else {
      setErrorText(text);
      setSuccessText('');
      setTimeout(() => setErrorText(''), 5000);
    }
  };

  // Derived inventories in my name
  const myInventories = inventories.filter(
    (item) => item.assignedToEmail.toLowerCase() === (currentUserProfile?.email || '').toLowerCase()
  );

  // Filter users based on query
  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle Inventory Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.serialNumber.trim()) {
      setNotice('error', 'Name and Serial Number are required.');
      return;
    }

    setIsSubmittingReg(true);
    try {
      const newItem: InventoryItem = {
        id: 'EQ-' + Date.now().toString(36).toUpperCase(),
        name: regForm.name.trim(),
        serialNumber: regForm.serialNumber.trim(),
        category: regForm.category,
        totalQuantity: Number(regForm.totalQuantity),
        status: 'Available',
        assignedToEmail: currentUserProfile?.email || '', // Auto register in their own name
        conditionNotes: regForm.conditionNotes.trim(),
        lastUpdated: new Date().toISOString(),
      };

      await onSaveInventory(newItem);
      setNotice('success', `Equipment "${newItem.name}" successfully registered under your profile.`);
      setIsRegisterOpen(false);
      setRegForm({
        name: '',
        serialNumber: '',
        category: 'Aerodynamics',
        totalQuantity: 1,
        conditionNotes: '',
      });
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to register equipment.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Handle Inventory Removal
  const handleRemoveItem = async (item: InventoryItem) => {
    const confirmRemove = window.confirm(
      `Are you sure you want to remove "${item.name}" (S/N: ${item.serialNumber}) from the campus registry? This is a destructive operation.`
    );
    if (!confirmRemove) return;

    try {
      await onDeleteInventory(item.id);
      setNotice('success', `Equipment "${item.name}" removed from registry.`);
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to remove equipment.');
    }
  };

  // Handle Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringItem) return;
    if (!targetUserEmail) {
      setNotice('error', 'Please select a recipient.');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      await onTransferInventory(transferringItem.id, targetUserEmail, transferNotes.trim());
      setNotice('success', `Passed "${transferringItem.name}" to ${targetUserEmail} successfully.`);
      setIsTransferOpen(false);
      setTransferringItem(null);
      setTargetUserEmail('');
      setTransferNotes('');
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to transfer equipment.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleOpenTransfer = (item: InventoryItem) => {
    setTransferringItem(item);
    setTargetUserEmail('');
    setTransferNotes('');
    setIsTransferOpen(true);
  };

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.phone.trim()) {
      setNotice('error', 'Name and Phone number are required.');
      return;
    }

    setIsSubmittingProfile(true);
    try {
      const updatedProfile: UserProfile = {
        email: currentUserProfile?.email || '',
        role: currentUserProfile?.role || 'USER',
        profileStatus: currentUserProfile?.profileStatus || 'ACTIVE',
        joinedDate: currentUserProfile?.joinedDate || new Date().toISOString().split('T')[0],
        ...currentUserProfile,
        name: profileForm.name.trim(),
        designation: profileForm.designation,
        phone: profileForm.phone.trim(),
      };

      await onSaveProfile(updatedProfile);
      setNotice('success', 'Your department profile has been updated.');
      setIsEditProfileOpen(false);
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to update profile.');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Notices */}
      <AnimatePresence>
        {errorText && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 rounded bg-red-50 border border-red-150 text-red-700 flex items-center gap-2 text-xs font-semibold"
          >
            <AlertCircle size={14} className="shrink-0" />
            {errorText}
          </motion.div>
        )}
        {successText && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 rounded bg-emerald-50 border border-emerald-150 text-emerald-800 flex items-center gap-2 text-xs font-semibold"
          >
            <CheckCircle2 size={14} className="shrink-0" />
            {successText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Welcome Card */}
        <div className="bg-blue-900 p-6 rounded-lg text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 text-white/5 pointer-events-none">
            <User size={150} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-blue-200 bg-blue-800 px-2 py-0.5 rounded">
              My Profile
            </span>
            <h2 className="text-lg font-bold mt-4 tracking-tight leading-snug">{currentUserProfile?.name || 'Loading Name...'}</h2>
            <p className="text-xs text-blue-100 font-medium mt-1">{currentUserProfile?.designation || 'Loading Designation...'}</p>
          </div>
          <div className="flex items-center gap-2 mt-4 text-[10px] text-blue-200 font-mono">
            <Mail size={12} /> {currentUserProfile?.email || 'Loading Email...'}
          </div>
        </div>

        {/* Quantities Card */}
        <div className="bg-white border border-slate-200 p-6 rounded-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-4 top-4 text-slate-100 pointer-events-none">
            <Box size={50} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Registered Under My Name
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-3">
              {myInventories.reduce((sum, item) => sum + item.totalQuantity, 0)} Units
            </h3>
            <p className="text-xs text-slate-500 mt-1">{myInventories.length} Equipment item groups</p>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs font-bold text-blue-900">
            <Database size={12} /> Dynamic synchronization online
          </div>
        </div>

        {/* Realtime database status */}
        <div className="bg-white border border-slate-200 p-6 rounded-lg flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Academic Sheets Hub
            </span>
            <div className="flex items-center gap-2 mt-3">
              <span className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
              <span className="text-xs font-bold text-slate-800">
                {isSyncing ? 'Synchronizing Sheets...' : 'Live Synced (Read & Write)'}
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-1.5 leading-relaxed">
              Every action directly syncs back to the secure campus spreadsheet in your Google Drive.
            </p>
          </div>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="mt-4 w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 font-bold text-xs text-slate-700 py-2 rounded transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
            Force Sync Now
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6 flex items-center justify-between">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'my-items', name: 'My Inventories', count: myInventories.length },
            { id: 'directory', name: 'Campus Directory', count: users.length },
            { id: 'profile', name: 'Profile Configuration', count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedUser(null);
              }}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-bold text-xs transition uppercase tracking-wider cursor-pointer
                ${activeTab === tab.id
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {tab.name}
              {tab.count !== null && (
                <span className="ml-2 py-0.5 px-1.5 rounded font-mono text-[10px] bg-slate-100 text-slate-600 font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {activeTab === 'my-items' && (
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded transition cursor-pointer"
          >
            <Plus size={14} /> Register Lab Equipment
          </button>
        )}
      </div>

      {/* Panels */}
      <AnimatePresence mode="wait">
        {/* MY ITEMS TAB */}
        {activeTab === 'my-items' && (
          <motion.div
            key="my-items"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myInventories.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-350 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {item.id}
                      </span>
                      <span className={`
                        text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider
                        ${item.status === 'Available' ? 'bg-green-50 text-green-700 border border-green-100' : ''}
                        ${item.status === 'In Use' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
                        ${item.status === 'Under Repair' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                        ${item.status === 'Damaged' ? 'bg-rose-50 text-rose-700 border border-rose-100' : ''}
                      `}>
                        {item.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-xs tracking-tight mb-1">{item.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">{item.category}</p>

                    <div className="space-y-2 border-t border-b border-slate-100 py-3 mb-3 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400 uppercase tracking-wider font-semibold text-[9px]">S/N:</span>
                        <span className="font-mono text-slate-900 font-bold">{item.serialNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 uppercase tracking-wider font-semibold text-[9px]">Total Quantity:</span>
                        <span className="font-bold text-slate-900">{item.totalQuantity} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 uppercase tracking-wider font-semibold text-[9px]">Last Registered:</span>
                        <span className="font-mono text-slate-500">{new Date(item.lastUpdated).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {item.conditionNotes && (
                      <div className="bg-slate-50 rounded p-2.5 text-[10px] text-slate-600 mb-4 border border-slate-200">
                        <span className="font-bold block text-slate-700 mb-0.5 uppercase tracking-wider">Notes:</span>
                        {item.conditionNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenTransfer(item)}
                      className="flex-1 inline-flex justify-center items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-100 font-bold text-xs py-2 rounded transition cursor-pointer"
                    >
                      <ArrowRightLeft size={13} /> Hand over to Peer
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="inline-flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 p-2 rounded transition cursor-pointer"
                      title="De-register Equipment"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {myInventories.length === 0 && (
                <div className="col-span-full bg-white border border-slate-200 rounded-lg py-12 text-center text-slate-400 text-xs font-medium space-y-2">
                  <Database className="mx-auto text-slate-300" size={32} />
                  <p>No aerospace assets are currently registered in your name.</p>
                  <button
                    onClick={() => setIsRegisterOpen(true)}
                    className="inline-flex text-xs font-bold text-blue-900 hover:underline pt-2 cursor-pointer"
                  >
                    Register your first equipment item →
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* DIRECTORY TAB */}
        {activeTab === 'directory' && (
          <motion.div
            key="directory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Search Directory */}
            <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search campus directory by name, email, designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full border border-slate-200 bg-slate-50 rounded text-xs placeholder-slate-400 focus:outline-none focus:border-blue-900 focus:bg-white focus:ring-1 focus:ring-blue-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Users List */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden lg:col-span-1">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h4 className="text-[10px] font-bold font-mono uppercase text-slate-400 tracking-wider">Department Directory</h4>
                </div>
                <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto">
                  {filteredUsers.map((u) => {
                    const active = u.profileStatus === 'ACTIVE';
                    const holdsCount = inventories.filter(
                      (inv) => inv.assignedToEmail.toLowerCase() === u.email.toLowerCase()
                    ).length;

                    return (
                      <button
                        key={u.email}
                        onClick={() => setSelectedUser(u)}
                        className={`
                          w-full p-4 flex items-center justify-between text-left transition hover:bg-slate-50 cursor-pointer
                          ${selectedUser?.email === u.email ? 'bg-blue-50/50 border-l-4 border-blue-900' : ''}
                        `}
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs">
                            {active ? u.name : 'Awaiting Profile Setup'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">{u.email}</p>
                          <p className="text-[10px] text-blue-900 font-bold uppercase tracking-wide">{active ? u.designation : 'Uninitialized'}</p>
                        </div>
                        <div className="text-right flex items-center gap-1">
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {holdsCount} items
                          </span>
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                      </button>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <p className="p-6 text-center text-slate-400 text-xs">No matching members found.</p>
                  )}
                </div>
              </div>

              {/* User Detailed view & Inventories */}
              <div className="lg:col-span-2">
                {selectedUser ? (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white border border-slate-200 rounded-lg p-6 space-y-6"
                  >
                    {/* User Header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 pb-5 border-b border-slate-100">
                      <div>
                        <span className="text-[9px] uppercase font-bold bg-blue-50 text-blue-900 px-2 py-0.5 rounded tracking-wider">
                          {selectedUser.role} Account
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-2">
                          {selectedUser.profileStatus === 'ACTIVE' ? selectedUser.name : 'Setup Pending'}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">{selectedUser.designation || 'Aerospace Department Member'}</p>
                      </div>

                      <div className="space-y-1.5 text-xs font-mono text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail size={12} /> <span>{selectedUser.email}</span>
                        </div>
                        {selectedUser.profileStatus === 'ACTIVE' && (
                          <>
                            <div className="flex items-center gap-2">
                              <Phone size={12} /> <span>{selectedUser.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar size={12} /> <span>Joined: {new Date(selectedUser.joinedDate).toLocaleDateString()}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Inventories Held by User */}
                    <div>
                      <h5 className="text-[10px] font-bold font-mono text-slate-400 uppercase mb-3 tracking-wider">Equipment Currently Held</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {inventories
                          .filter((i) => i.assignedToEmail.toLowerCase() === selectedUser.email.toLowerCase())
                          .map((item) => (
                            <div key={item.id} className="border border-slate-200 rounded p-4 space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-mono font-bold text-[9px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded">
                                  {item.id}
                                </span>
                                <span className={`
                                  text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider
                                  ${item.status === 'Available' ? 'bg-green-50 text-green-700' : ''}
                                  ${item.status === 'In Use' ? 'bg-blue-50 text-blue-700' : ''}
                                  ${item.status === 'Under Repair' ? 'bg-amber-50 text-amber-700' : ''}
                                  ${item.status === 'Damaged' ? 'bg-rose-50 text-rose-700' : ''}
                                `}>
                                  {item.status}
                                </span>
                              </div>
                              <h6 className="font-bold text-slate-900 leading-snug">{item.name}</h6>
                              <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-50 pt-1.5">
                                <span>S/N: <strong className="font-mono text-slate-700">{item.serialNumber}</strong></span>
                                <span>Qty: <strong className="text-slate-700">{item.totalQuantity}</strong></span>
                              </div>
                            </div>
                          ))}

                        {inventories.filter((i) => i.assignedToEmail.toLowerCase() === selectedUser.email.toLowerCase()).length === 0 && (
                          <p className="col-span-full py-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded text-slate-400 text-xs">
                            This member currently holds no aerospace equipment items.
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-lg py-20 text-center text-slate-400 text-xs font-medium space-y-2 h-full flex flex-col justify-center items-center">
                    <Users className="text-slate-300" size={40} />
                    <p>Select any member from the left directory column to inspect their profile and registered asset list.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-2xl">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Department Profile Information</h4>
              
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Full Name:</span>
                    <strong className="text-slate-900 text-sm">{currentUserProfile.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Email Address:</span>
                    <strong className="text-slate-900 font-mono">{currentUserProfile.email}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Designation:</span>
                    <strong className="text-slate-900">{currentUserProfile.designation}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Phone Number:</span>
                    <strong className="text-slate-900 font-mono">{currentUserProfile.phone}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-4">
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">System Permissions:</span>
                    <strong className="text-slate-900">{currentUserProfile.role} Account</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Joined Date:</span>
                    <strong className="text-slate-900 font-mono">{new Date(currentUserProfile.joinedDate).toLocaleDateString()}</strong>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setProfileForm({
                        name: currentUserProfile.name,
                        designation: currentUserProfile.designation,
                        phone: currentUserProfile.phone,
                      });
                      setIsEditProfileOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-100 font-bold text-xs px-4 py-2 rounded transition cursor-pointer"
                  >
                    <Edit3 size={13} /> Edit Profile Details
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================================
          USER MODALS
          ============================================================================ */}

      {/* MODAL: REGISTER LAB EQUIPMENT */}
      <AnimatePresence>
        {isRegisterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsRegisterOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-sm">
                <h4 className="font-bold text-slate-950 flex items-center gap-2 uppercase tracking-wider text-xs">
                  <Plus className="text-blue-900" size={16} /> Register Department Asset
                </h4>
                <button onClick={() => setIsRegisterOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Equipment Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    placeholder="e.g., Quadcopter F450 Thesis Drone"
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-blue-900 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Serial Number / Tag</label>
                    <input
                      type="text"
                      required
                      value={regForm.serialNumber}
                      onChange={(e) => setRegForm({ ...regForm, serialNumber: e.target.value })}
                      placeholder="e.g., IOE-UAV-004"
                      className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-blue-900 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Category</label>
                    <select
                      value={regForm.category}
                      onChange={(e) => setRegForm({ ...regForm, category: e.target.value })}
                      className="w-full border border-slate-200 rounded px-2.5 py-2 focus:outline-none focus:border-blue-900 bg-white text-xs cursor-pointer"
                    >
                      <option value="General Lab Equipments">General Lab Equipments</option>
                      <option value="General Office Equipment">General Office Equipment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Total Quantity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={regForm.totalQuantity}
                    onChange={(e) => setRegForm({ ...regForm, totalQuantity: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-blue-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Condition & Location Notes</label>
                  <textarea
                    rows={2}
                    value={regForm.conditionNotes}
                    onChange={(e) => setRegForm({ ...regForm, conditionNotes: e.target.value })}
                    placeholder="e.g., Fully operational, stored in Thesis Rack B."
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-blue-900 text-xs"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded border border-slate-200 transition text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReg}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2 rounded transition text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingReg ? 'Syncing to Sheets...' : 'Register Equipment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: TRANSFER PEER HANDOVER */}
      <AnimatePresence>
        {isTransferOpen && transferringItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsTransferOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Hand Over Equipment to Peer
                </h4>
                <button onClick={() => setIsTransferOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer">✕</button>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded">
                <p className="text-xs font-bold text-slate-950">{transferringItem.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">S/N: {transferringItem.serialNumber} • Qty: {transferringItem.totalQuantity}</p>
              </div>

              <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Target Account / Recipient</label>
                  <select
                    required
                    value={targetUserEmail}
                    onChange={(e) => setTargetUserEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded px-2.5 py-2 focus:outline-none focus:border-blue-900 bg-white text-xs"
                  >
                    <option value="">-- Choose Recipient --</option>
                    {users
                      .filter((u) => u.email.toLowerCase() !== (currentUserProfile?.email || '').toLowerCase())
                      .map((u) => (
                        <option key={u.email} value={u.email}>
                          {u.email} ({u.profileStatus === 'ACTIVE' ? u.name : 'Waiting setup'})
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    The recipient must be invited by the Admin to show in this directory.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Handover Notes / Instructions</label>
                  <textarea
                    rows={2}
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="e.g., Transferred sensor module for propulsion test setup. In fully working condition."
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-blue-900 text-xs"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTransferOpen(false)}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-4 py-2 border border-slate-200 rounded transition text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTransfer}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2 rounded transition text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingTransfer ? 'Transferring...' : 'Confirm Handover'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT PROFILE */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsEditProfileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-950 text-xs uppercase tracking-wider">
                  Edit Department Profile
                </h4>
                <button onClick={() => setIsEditProfileOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-blue-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Academic Designation</label>
                  <select
                    value={profileForm.designation}
                    onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                    className="w-full border border-slate-200 rounded px-2.5 py-2 focus:outline-none focus:border-blue-900 bg-white text-xs"
                  >
                    <option value="Student">Aerospace Student</option>
                    <option value="Professor">Professor / Faculty</option>
                    <option value="Lab Assistant">Lab Assistant / Officer</option>
                    <option value="Researcher">Researcher</option>
                    <option value="Department Staff">Department Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Contact Number</label>
                  <input
                    type="text"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:border-blue-900 text-xs font-mono"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-4 py-2 border border-slate-200 rounded transition text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingProfile}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2 rounded transition text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
