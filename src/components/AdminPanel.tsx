/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile, InventoryItem, TransactionLog, SheetMetadata, InventoryStatus } from '../types';
import {
  Users,
  Plus,
  Trash2,
  Sliders,
  Database,
  Calendar,
  Layers,
  ArrowRightLeft,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Wrench,
  UserCheck,
  UserX,
  Share2,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  metadata: SheetMetadata;
  users: UserProfile[];
  inventories: InventoryItem[];
  logs: TransactionLog[];
  onAddUser: (email: string) => Promise<void>;
  onRemoveUser: (email: string) => Promise<void>;
  onToggleUserRole: (user: UserProfile) => Promise<void>;
  onSaveInventory: (item: InventoryItem) => Promise<void>;
  onDeleteInventory: (id: string) => Promise<void>;
  onAssignInventory: (itemId: string, userEmail: string, notes: string) => Promise<void>;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  currentUserEmail: string;
}

export default function AdminPanel({
  metadata,
  users,
  inventories,
  logs,
  onAddUser,
  onRemoveUser,
  onToggleUserRole,
  onSaveInventory,
  onDeleteInventory,
  onAssignInventory,
  onSync,
  isSyncing,
  currentUserEmail
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventories' | 'users' | 'logs'>('dashboard');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal States
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Form States
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Inventory Form State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [invForm, setInvForm] = useState({
    name: '',
    serialNumber: '',
    category: 'General Lab Equipments',
    totalQuantity: 1,
    status: 'Available' as InventoryStatus,
    conditionNotes: '',
  });
  const [isSubmittingInventory, setIsSubmittingInventory] = useState(false);

  // Assign Form State
  const [assigningItem, setAssigningItem] = useState<InventoryItem | null>(null);
  const [assignedUserEmail, setAssignedUserEmail] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  // Notifications or errors
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  // Auto-clear notices
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

  // Stats Calculations
  const stats = {
    totalItems: inventories.reduce((acc, curr) => acc + curr.totalQuantity, 0),
    uniqueModels: inventories.length,
    activeUsers: users.filter(u => u.profileStatus === 'ACTIVE').length,
    pendingUsers: users.filter(u => u.profileStatus === 'PENDING_SETUP').length,
    available: inventories.filter(i => i.status === 'Available').reduce((acc, c) => acc + c.totalQuantity, 0),
    inUse: inventories.filter(i => i.status === 'In Use').reduce((acc, c) => acc + c.totalQuantity, 0),
    underRepair: inventories.filter(i => i.status === 'Under Repair').reduce((acc, c) => acc + c.totalQuantity, 0),
    damaged: inventories.filter(i => i.status === 'Damaged').reduce((acc, c) => acc + c.totalQuantity, 0),
  };

  const categories = ['All', ...Array.from(new Set(inventories.map(i => i.category)))];

  // Filtered Inventories
  const filteredInventories = inventories.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Handle Add User
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) {
      setNotice('error', 'Please enter a valid email address.');
      return;
    }
    setIsSubmittingUser(true);
    try {
      await onAddUser(newUserEmail.trim().toLowerCase());
      setNotice('success', `User ${newUserEmail} registered! Google Drive invitation dispatched.`);
      setNewUserEmail('');
      setIsAddUserOpen(false);
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to add user.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Handle Toggle User Role
  const handleToggleRole = async (user: UserProfile) => {
    if (user.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      setNotice('error', 'You cannot change your own Administrator permissions.');
      return;
    }
    const confirmChange = window.confirm(`Change role of ${user.email} to ${user.role === 'ADMIN' ? 'USER' : 'ADMIN'}?`);
    if (!confirmChange) return;

    try {
      await onToggleUserRole(user);
      setNotice('success', `User permissions for ${user.email} updated.`);
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to change role.');
    }
  };

  // Handle Remove User
  const handleRemoveUserClick = async (email: string) => {
    if (email.toLowerCase() === currentUserEmail.toLowerCase()) {
      setNotice('error', 'You cannot remove yourself as Administrator.');
      return;
    }
    const confirmDelete = window.confirm(`Are you sure you want to remove ${email}? This blocks their login access to the inventory panel.`);
    if (!confirmDelete) return;

    try {
      await onRemoveUser(email);
      setNotice('success', `User ${email} removed successfully from database.`);
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to remove user.');
    }
  };

  // Handle Save Inventory Item (Add & Edit)
  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invForm.name.trim() || !invForm.serialNumber.trim()) {
      setNotice('error', 'Name and Serial Number are required.');
      return;
    }

    setIsSubmittingInventory(true);
    try {
      const itemToSave: InventoryItem = {
        id: editingItem ? editingItem.id : 'EQ-' + Date.now().toString(36).toUpperCase(),
        name: invForm.name.trim(),
        serialNumber: invForm.serialNumber.trim(),
        category: invForm.category,
        totalQuantity: Number(invForm.totalQuantity),
        status: invForm.status,
        assignedToEmail: editingItem ? editingItem.assignedToEmail : 'None',
        conditionNotes: invForm.conditionNotes.trim(),
        lastUpdated: new Date().toISOString(),
      };

      await onSaveInventory(itemToSave);
      setNotice('success', `Inventory item "${itemToSave.name}" updated successfully.`);
      setIsInventoryModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to save inventory item.');
    } finally {
      setIsSubmittingInventory(false);
    }
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setInvForm({
      name: item.name,
      serialNumber: item.serialNumber,
      category: item.category,
      totalQuantity: item.totalQuantity,
      status: item.status,
      conditionNotes: item.conditionNotes,
    });
    setIsInventoryModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setInvForm({
      name: '',
      serialNumber: '',
      category: 'General Lab Equipments',
      totalQuantity: 1,
      status: 'Available',
      conditionNotes: '',
    });
    setIsInventoryModalOpen(true);
  };

  // Handle Delete Inventory
  const handleDeleteInventoryClick = async (item: InventoryItem) => {
    const confirmDelete = window.confirm(`Permanently remove equipment "${item.name}" (S/N: ${item.serialNumber})? This is irreversible.`);
    if (!confirmDelete) return;

    try {
      await onDeleteInventory(item.id);
      setNotice('success', `Equipment "${item.name}" successfully deleted.`);
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to delete equipment.');
    }
  };

  // Handle Assign Item
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningItem) return;
    if (!assignedUserEmail) {
      setNotice('error', 'Please choose a target user to assign this item to.');
      return;
    }

    setIsSubmittingAssignment(true);
    try {
      await onAssignInventory(assigningItem.id, assignedUserEmail, assignNotes.trim());
      setNotice('success', `Equipment "${assigningItem.name}" assigned to ${assignedUserEmail}.`);
      setIsAssignModalOpen(false);
      setAssigningItem(null);
      setAssignedUserEmail('');
      setAssignNotes('');
    } catch (err: any) {
      setNotice('error', err.message || 'Failed to assign inventory item.');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleOpenAssignModal = (item: InventoryItem) => {
    setAssigningItem(item);
    setAssignedUserEmail(item.assignedToEmail !== 'None' ? item.assignedToEmail : '');
    setAssignNotes('');
    setIsAssignModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Notifications Panel */}
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

      {/* Main Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs relative overflow-hidden">
          <div className="absolute right-4 top-4 text-slate-100/60 pointer-events-none"><Database size={36} /></div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-sans">Aerospace Assets</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{stats.totalItems} Units</h3>
          <p className="text-xs text-slate-500 mt-1">{stats.uniqueModels} distinct design configurations</p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs relative overflow-hidden">
          <div className="absolute right-4 top-4 text-slate-100/60 pointer-events-none"><Users size={36} /></div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-sans">Registered Directory</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{users.length} Users</h3>
          <p className="text-xs text-blue-900 font-semibold mt-1">
            {stats.activeUsers} Active • {stats.pendingUsers} Setup Pending
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs relative overflow-hidden">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-sans block mb-2">Status Allocation</span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span>Ready: <strong className="text-slate-950 font-semibold">{stats.available}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0"></span>
              <span>In Use: <strong className="text-slate-950 font-semibold">{stats.inUse}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>
              <span>Repair: <strong className="text-slate-950 font-semibold">{stats.underRepair}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0"></span>
              <span>Damage: <strong className="text-slate-950 font-semibold">{stats.damaged}</strong></span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-sans block">Sheet Realtime Engine</span>
            <div className="flex items-center gap-2 mt-2">
              <span className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-xs font-semibold text-slate-800">
                {isSyncing ? 'Syncing...' : 'Connected & Active'}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="w-full inline-flex justify-center items-center gap-1.5 text-[11px] font-semibold text-blue-900 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-3 py-2 rounded transition disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw size={12} className={isSyncing ? 'animate-spin' : ''} />
              Sync Database
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6 flex items-center justify-between">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', name: 'Dashboard Overview', count: null },
            { id: 'inventories', name: 'Equipment Assets', count: inventories.length },
            { id: 'users', name: 'User Management', count: users.length },
            { id: 'logs', name: 'Activity Log', count: logs.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-xs transition cursor-pointer
                ${activeTab === tab.id
                  ? 'border-blue-900 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
              `}
            >
              {tab.name}
              {tab.count !== null && (
                <span className="ml-2 py-0.5 px-2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {activeTab === 'inventories' && (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs px-3.5 py-2 rounded transition cursor-pointer"
          >
            <Plus size={14} /> Register Equipment
          </button>
        )}
        {activeTab === 'users' && (
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center gap-1 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs px-3.5 py-2 rounded transition cursor-pointer"
          >
            <Plus size={14} /> Invite User by Email
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Quick Informational Box */}
            <div className="bg-blue-50/40 rounded-lg border border-blue-100/50 p-5 flex items-start gap-4">
              <div className="p-3 bg-white rounded text-blue-900 shadow-xs border border-blue-50 shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">Secure Google Sheets Synchronization</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  This interface maps directly to the Google Drive sheet <span className="font-semibold text-blue-900">"IOE Aerospace Inventory Database"</span>.
                  Whenever you add equipment, update statuses, or register users, changes are instantly synchronized.
                  Authorized campus staff receive automatic writer capabilities for high-performance direct data syncing.
                </p>
                <div className="pt-2 flex items-center gap-4 text-[10px] font-mono text-slate-500">
                  <span>Spreadsheet ID: <strong className="text-slate-800">{metadata.id.slice(0, 8)}...</strong></span>
                  <span>Permissions: <strong className="text-emerald-600">Administrator Verified</strong></span>
                </div>
              </div>
            </div>

            {/* Graphic Distribution Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
                <h4 className="text-xs font-bold text-slate-900 mb-4">Equipment Category Distribution</h4>
                <div className="space-y-4">
                  {['General Lab Equipments', 'General Office Equipment', 'Other'].map(cat => {
                    const count = inventories.filter(i => i.category === cat).reduce((sum, current) => sum + current.totalQuantity, 0);
                    const percent = stats.totalItems > 0 ? (count / stats.totalItems) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-700">{cat}</span>
                          <span className="font-mono text-slate-900 font-bold">{count} Units ({percent.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-900 rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Visual Ring & Count */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-4">Condition and Status Tracking</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3 flex flex-col">
                      <span className="text-[9px] uppercase font-mono text-emerald-700 font-bold">Ready / Available</span>
                      <strong className="text-xl text-emerald-800 mt-1">{stats.available}</strong>
                    </div>
                    <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-3 flex flex-col">
                      <span className="text-[9px] uppercase font-mono text-blue-900 font-bold">Assigned / In Use</span>
                      <strong className="text-xl text-blue-900 mt-1">{stats.inUse}</strong>
                    </div>
                    <div className="border border-amber-100 bg-amber-50/30 rounded-lg p-3 flex flex-col">
                      <span className="text-[9px] uppercase font-mono text-amber-700 font-bold">Under Repair</span>
                      <strong className="text-xl text-amber-800 mt-1">{stats.underRepair}</strong>
                    </div>
                    <div className="border border-rose-100 bg-rose-50/30 rounded-lg p-3 flex flex-col">
                      <span className="text-[9px] uppercase font-mono text-rose-700 font-bold">Damaged</span>
                      <strong className="text-xl text-rose-800 mt-1">{stats.damaged}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 text-xs text-slate-500 leading-relaxed">
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mb-1">
                    <AlertTriangle size={14} className="text-amber-500" /> Maintenance Warning
                  </span>
                  {stats.damaged + stats.underRepair > 0 ? (
                    <span>Currently, {stats.damaged + stats.underRepair} aerospace units are undergoing repair or offline. Ensure status checks are run periodically.</span>
                  ) : (
                    <span>All active department assets are verified in fully operational condition.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Logs */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-bold text-slate-900">Recent Transactions (Realtime)</h4>
                <button onClick={() => setActiveTab('logs')} className="text-xs text-blue-900 hover:underline font-bold cursor-pointer">
                  View All Logs
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {logs.slice(0, 4).map((log) => (
                  <div key={log.id} className="py-3 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`
                        p-1.5 rounded flex items-center justify-center
                        ${log.action === 'REGISTRATION' ? 'bg-emerald-50 text-emerald-700' : ''}
                        ${log.action === 'ASSIGNMENT' ? 'bg-blue-50 text-blue-900' : ''}
                        ${log.action === 'TRANSFER' ? 'bg-purple-50 text-purple-700' : ''}
                        ${log.action === 'REMOVAL' ? 'bg-rose-50 text-rose-700' : ''}
                        ${log.action === 'STATUS_UPDATE' ? 'bg-amber-50 text-amber-700' : ''}
                      `}>
                        <ArrowRightLeft size={12} />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-950">{log.inventoryName}</p>
                        <p className="text-slate-500 text-[10px]">
                          Action: <span className="font-bold">{log.action}</span> • By: {log.fromEmail}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium text-slate-800">{new Date(log.timestamp).toLocaleDateString()}</p>
                      <p className="text-slate-400 text-[10px] font-mono">{log.id.slice(0, 10)}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-center py-6 text-slate-400 text-xs">No records available yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* INVENTORIES TAB */}
        {activeTab === 'inventories' && (
          <motion.div
            key="inventories"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Search and Filters */}
            <div className="bg-white border border-slate-200 p-4 rounded-lg flex flex-col sm:flex-row gap-3 shadow-xs">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search assets by name, serial number, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full border border-slate-200 bg-slate-50 rounded text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 focus:bg-white"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
                  <Filter size={12} className="text-slate-500" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-none border-none p-0 cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    <option value="General Lab Equipments">General Lab Equipments</option>
                    <option value="General Office Equipment">General Office Equipment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
                  <Sliders size={12} className="text-slate-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-none border-none p-0 cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Available">Available</option>
                    <option value="In Use">In Use</option>
                    <option value="Under Repair">Under Repair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grid layout for inventories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredInventories.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs hover:shadow-sm transition flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Status badge */}
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {item.id}
                      </span>
                      <span className={`
                        text-[9px] font-bold px-2 py-0.5 rounded-full uppercase
                        ${item.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : ''}
                        ${item.status === 'In Use' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
                        ${item.status === 'Under Repair' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                        ${item.status === 'Damaged' ? 'bg-rose-50 text-rose-700 border border-rose-100' : ''}
                      `}>
                        {item.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-xs leading-tight mb-1">{item.name}</h4>
                    <p className="text-[10px] text-slate-500 font-medium mb-3">{item.category}</p>

                    <div className="space-y-2 border-t border-b border-slate-100 py-3 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Serial Number:</span>
                        <span className="font-mono text-slate-900 font-semibold">{item.serialNumber}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Total Quantity:</span>
                        <span className="font-bold text-slate-900">{item.totalQuantity} units</span>
                      </div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-slate-500">Holder:</span>
                        <span className={`
                          font-semibold px-2 py-0.5 rounded text-[11px]
                          ${item.assignedToEmail === 'None' ? 'text-slate-400 bg-slate-50' : 'text-blue-900 bg-blue-50'}
                        `}>
                          {item.assignedToEmail === 'None' ? 'No occupant (Lab)' : item.assignedToEmail}
                        </span>
                      </div>
                    </div>

                    {item.conditionNotes && (
                      <div className="bg-slate-50 rounded p-2.5 text-[11px] text-slate-600 mb-4 border border-slate-100">
                        <span className="font-bold block mb-0.5 text-slate-700">Notes:</span>
                        {item.conditionNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-50">
                    <button
                      onClick={() => handleOpenAssignModal(item)}
                      className="flex-1 inline-flex justify-center items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-100 font-bold text-xs py-2 rounded transition cursor-pointer"
                    >
                      <UserCheck size={14} /> Assign Owner
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="inline-flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 p-2 rounded transition cursor-pointer"
                      title="Edit Item"
                    >
                      <Wrench size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteInventoryClick(item)}
                      className="inline-flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 p-2 rounded transition cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {filteredInventories.length === 0 && (
                <div className="col-span-full bg-white border border-slate-200 rounded-lg py-12 text-center text-slate-500 text-xs font-medium space-y-2">
                  <Sliders className="mx-auto text-slate-300" size={32} />
                  <p>No inventory match found. Adjust filters or register a new asset.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">Registered Campusees & Staff</h4>
                <p className="text-xs text-slate-500">Total invited: {users.length}</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50">
                    <tr className="text-left text-xs text-slate-500 font-mono">
                      <th className="px-6 py-3">Email Address</th>
                      <th className="px-6 py-3">Full Name</th>
                      <th className="px-6 py-3">Designation</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3">Account State</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.map((user) => (
                      <tr key={user.email} className="hover:bg-slate-50/30">
                        <td className="px-6 py-3.5 font-semibold text-slate-900">{user.email}</td>
                        <td className="px-6 py-3.5 text-slate-700">
                          {user.profileStatus === 'PENDING_SETUP' ? (
                            <span className="text-slate-400 italic">Waiting for initial log-in</span>
                          ) : (
                            user.name
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-slate-600">
                          {user.profileStatus === 'PENDING_SETUP' ? '-' : user.designation}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-slate-600">
                          {user.profileStatus === 'PENDING_SETUP' ? '-' : user.phone}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`
                            px-2 py-0.5 text-[9px] rounded-full font-bold uppercase
                            ${user.profileStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}
                          `}>
                            {user.profileStatus}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* Change role button */}
                          <button
                            onClick={() => handleToggleRole(user)}
                            className={`
                              px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer
                              ${user.role === 'ADMIN'
                                ? 'bg-blue-50 hover:bg-blue-100 text-blue-950'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}
                            `}
                          >
                            {user.role} (Toggle Role)
                          </button>
                          
                          {/* Delete user button */}
                          <button
                            onClick={() => handleRemoveUserClick(user.email)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded transition inline-flex items-center justify-center cursor-pointer"
                            title="Remove User"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-900">Database Transaction Ledger</h4>
                <p className="text-xs text-slate-500">Every audit log tracks a direct mutation inside Google Sheets</p>
              </div>

              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50/20 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`
                          text-[9px] font-bold px-1.5 py-0.5 rounded uppercase
                          ${log.action === 'REGISTRATION' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : ''}
                          ${log.action === 'ASSIGNMENT' ? 'bg-blue-50 text-blue-700 border border-blue-100' : ''}
                          ${log.action === 'TRANSFER' ? 'bg-purple-50 text-purple-700 border border-purple-100' : ''}
                          ${log.action === 'REMOVAL' ? 'bg-rose-50 text-rose-700 border border-rose-100' : ''}
                          ${log.action === 'STATUS_UPDATE' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                          ${log.action === 'PROFILE_SETUP' ? 'bg-slate-100 text-slate-700' : ''}
                        `}>
                          {log.action}
                        </span>
                        <strong className="text-slate-900">{log.inventoryName}</strong>
                      </div>
                      <p className="text-slate-600 leading-normal">
                        {log.notes || 'No description notes.'}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>From: <strong className="text-slate-600">{log.fromEmail}</strong></span>
                        <span>•</span>
                        <span>To: <strong className="text-slate-600">{log.toEmail}</strong></span>
                        {log.quantity > 0 && (
                          <>
                            <span>•</span>
                            <span>Qty: <strong className="text-slate-600">{log.quantity}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col justify-between items-center sm:items-end text-[10px] text-slate-500 font-mono">
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-mono mt-1">
                        {log.id}
                      </span>
                    </div>
                  </div>
                ))}

                {logs.length === 0 && (
                  <p className="text-center py-12 text-slate-400 font-medium">No logs recorded yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================================
          MODALS
          ============================================================================ */}

      {/* MODAL: ADD USER */}
      <AnimatePresence>
        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsAddUserOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-lg border border-slate-200 shadow-lg max-w-md w-full p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Share2 className="text-blue-900" size={16} /> Invite Campus Member
                </h4>
                <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleAddUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Campus Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="student.name@ioe.edu.np"
                    className="w-full border border-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Adding an email registers them into the Users directory. Our backend will automatically communicate with Google Drive to share file-level read/write capacities so that they can manage logs in real-time.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingUser ? 'Inviting & Sharing...' : 'Invite member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: REGISTER / EDIT INVENTORY */}
      <AnimatePresence>
        {isInventoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsInventoryModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-lg border border-slate-200 shadow-lg max-w-lg w-full p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">
                  {editingItem ? 'Update Equipment Details' : 'Register New Aerospace Asset'}
                </h4>
                <button onClick={() => setIsInventoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleInventorySubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Equipment / Asset Name</label>
                    <input
                      type="text"
                      required
                      value={invForm.name}
                      onChange={(e) => setInvForm({ ...invForm, name: e.target.value })}
                      placeholder="e.g., Subsonic Wind Tunnel Model"
                      className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Serial Number / Asset Tag</label>
                    <input
                      type="text"
                      required
                      value={invForm.serialNumber}
                      onChange={(e) => setInvForm({ ...invForm, serialNumber: e.target.value })}
                      placeholder="e.g., IOE-AERO-WT-02"
                      className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Category</label>
                    <select
                      value={invForm.category}
                      onChange={(e) => setInvForm({ ...invForm, category: e.target.value })}
                      className="w-full border border-slate-200 rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 bg-white text-xs cursor-pointer"
                    >
                      <option value="General Lab Equipments">General Lab Equipments</option>
                      <option value="General Office Equipment">General Office Equipment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Total Quantity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={invForm.totalQuantity}
                      onChange={(e) => setInvForm({ ...invForm, totalQuantity: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 uppercase">Current Status</label>
                    <select
                      value={invForm.status}
                      onChange={(e) => setInvForm({ ...invForm, status: e.target.value as any })}
                      className="w-full border border-slate-200 rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 bg-white text-xs cursor-pointer"
                    >
                      <option value="Available">Available</option>
                      <option value="In Use">In Use</option>
                      <option value="Under Repair">Under Repair</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase">Condition Notes & Storage Location</label>
                  <textarea
                    rows={3}
                    value={invForm.conditionNotes}
                    onChange={(e) => setInvForm({ ...invForm, conditionNotes: e.target.value })}
                    placeholder="e.g., Stored in Aerodynamics Lab Cabinet A. Calibration complete."
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 text-xs"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInventoryModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInventory}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingInventory ? 'Saving to Sheets...' : 'Save Asset'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ASSIGN OWNER */}
      <AnimatePresence>
        {isAssignModalOpen && assigningItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsAssignModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-lg border border-slate-200 shadow-lg max-w-md w-full p-6 z-10 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm">
                  Assign Asset Owner
                </h4>
                <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer">✕</button>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-3.5 rounded">
                <p className="text-xs font-bold text-slate-900">{assigningItem.name}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">S/N: {assigningItem.serialNumber} • Qty: {assigningItem.totalQuantity}</p>
              </div>

              <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Target Account / Assignee</label>
                  <select
                    required
                    value={assignedUserEmail}
                    onChange={(e) => setAssignedUserEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 bg-white text-xs cursor-pointer"
                  >
                    <option value="">-- Choose User Profile --</option>
                    <option value="None">None (De-assign / Return to Lab)</option>
                    {users.map(u => (
                      <option key={u.email} value={u.email}>
                        {u.email} ({u.profileStatus === 'ACTIVE' ? u.name : 'Awaiting login setup'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assignment / Dispatch Notes</label>
                  <textarea
                    rows={2}
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="e.g., Handed over wind tunnel sensor for thesis research. Due in 3 weeks."
                    className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 text-xs"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAssignment}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingAssignment ? 'Assigning...' : 'Confirm Assignment'}
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
