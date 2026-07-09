/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  findOrCreateDatabase,
  fetchUsers,
  fetchInventories,
  fetchTransactionLogs,
  saveUser,
  deleteUser,
  saveInventoryItem,
  deleteInventoryItem,
  addTransactionLog,
  shareSpreadsheetWithUser
} from './lib/googleSheets';
import { UserProfile, InventoryItem, TransactionLog, SheetMetadata } from './types';
import ProfileSetup from './components/ProfileSetup';
import AdminPanel from './components/AdminPanel';
import UserPanel from './components/UserPanel';
import {
  GraduationCap,
  LogOut,
  Database,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('');

  // Sheet Data
  const [metadata, setMetadata] = useState<SheetMetadata | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<TransactionLog[]>([]);

  // Current Logged-in User Profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [uninvitedUser, setUninvitedUser] = useState<string | null>(null);

  // View Mode for Admin
  const [viewMode, setViewMode] = useState<'ADMIN' | 'USER'>('USER');

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize Auth
  useEffect(() => {
    setLoadingStage('Connecting to Firebase Auth...');
    const unsubscribe = initAuth(
      (user, token) => {
        setFirebaseUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setFirebaseUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Database once authenticated
  useEffect(() => {
    if (firebaseUser && accessToken) {
      loadDatabase();
    }
  }, [firebaseUser, accessToken]);

  const loadDatabase = async () => {
    try {
      setIsSyncing(true);
      setIsLoading(true);
      setUninvitedUser(null);
      setLoadingStage('Scanning Google Drive for Inventory Database...');

      const email = firebaseUser?.email || '';
      const name = firebaseUser?.displayName || 'Campus User';

      // 1. Locate or bootstrap Google Sheet
      const meta = await findOrCreateDatabase(email, name);
      setMetadata(meta);

      setLoadingStage('Syncing user database rows...');
      // 2. Fetch Users
      const users = await fetchUsers(meta.id);
      setUsersList(users);

      // Check if current user is registered
      const matchedProfile = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (!matchedProfile) {
        // If this isn't the person who just created the DB, they aren't invited yet!
        setIsLoading(false);
        setUninvitedUser(email);
        setIsSyncing(false);
        return;
      }

      setUserProfile(matchedProfile);
      setViewMode(matchedProfile.role); // Default view to their highest role

      setLoadingStage('Syncing aerospace equipment inventory...');
      // 3. Fetch Inventories
      const invs = await fetchInventories(meta.id);
      setInventories(invs);

      setLoadingStage('Syncing database audit logs...');
      // 4. Fetch Logs
      const transLogs = await fetchTransactionLogs(meta.id);
      setLogs(transLogs);

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading inventory database:', error);
      alert('Error fetching database. Ensure your Google Drive has sufficient space.');
      setIsLoading(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncLatest = async () => {
    if (!metadata) return;
    try {
      setIsSyncing(true);
      const [users, invs, transLogs] = await Promise.all([
        fetchUsers(metadata.id),
        fetchInventories(metadata.id),
        fetchTransactionLogs(metadata.id),
      ]);
      setUsersList(users);
      setInventories(invs);
      setLogs(transLogs);

      const email = firebaseUser?.email || '';
      const matchedProfile = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (matchedProfile) {
        setUserProfile(matchedProfile);
      }
    } catch (err) {
      console.error('Manual Sync Failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Google Sign-In Trigger
  const handleLogin = async () => {
    setIsLoading(true);
    setLoadingStage('Authorizing Google Account permissions...');
    try {
      const res = await googleSignIn();
      if (res) {
        setFirebaseUser(res.user);
        setAccessToken(res.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
      setIsLoading(false);
    }
  };

  // Logout Trigger
  const handleLogout = async () => {
    setIsLoading(true);
    setLoadingStage('Signing out securely...');
    await logout();
    setFirebaseUser(null);
    setAccessToken(null);
    setUserProfile(null);
    setMetadata(null);
    setUninvitedUser(null);
    setNeedsAuth(true);
    setIsLoading(false);
  };

  // Profile Setup Handler
  const handleProfileSetupComplete = async (updatedProfile: UserProfile) => {
    if (!metadata) return;
    setIsLoading(true);
    setLoadingStage('Registering profile data into Sheets...');
    try {
      // Save user profile row
      await saveUser(metadata.id, updatedProfile);
      
      // Write setup log
      const log: TransactionLog = {
        id: 'TX-SETUP-' + Date.now(),
        inventoryId: 'USER-PROFILE',
        inventoryName: updatedProfile.name,
        action: 'PROFILE_SETUP',
        fromEmail: 'System',
        toEmail: updatedProfile.email,
        quantity: 0,
        notes: `Profile registration completed for designated role: ${updatedProfile.designation}.`,
        timestamp: new Date().toISOString(),
      };
      await addTransactionLog(metadata.id, log);

      // Reload
      await loadDatabase();
    } catch (error) {
      console.error('Profile setup save failed:', error);
      alert('Failed to register profile. Retry in a moment.');
      setIsLoading(false);
    }
  };

  // ============================================================================
  // MUTATION HANDLERS (ADMIN ACTIONS)
  // ============================================================================

  const handleAddUser = async (email: string) => {
    if (!metadata) return;
    // Add user as PENDING_SETUP
    const newUser: UserProfile = {
      email,
      name: '',
      role: 'USER',
      profileStatus: 'PENDING_SETUP',
      designation: '',
      phone: '',
      joinedDate: new Date().toISOString().split('T')[0],
    };
    await saveUser(metadata.id, newUser);
    
    // Auto share file permissions via Drive API
    await shareSpreadsheetWithUser(metadata.id, email);

    // Refresh directory
    const updatedUsers = await fetchUsers(metadata.id);
    setUsersList(updatedUsers);
  };

  const handleRemoveUser = async (email: string) => {
    if (!metadata) return;
    await deleteUser(metadata, email);
    
    const updatedUsers = await fetchUsers(metadata.id);
    setUsersList(updatedUsers);
  };

  const handleToggleUserRole = async (user: UserProfile) => {
    if (!metadata) return;
    const updated: UserProfile = {
      ...user,
      role: user.role === 'ADMIN' ? 'USER' : 'ADMIN',
    };
    await saveUser(metadata.id, updated);
    
    const updatedUsers = await fetchUsers(metadata.id);
    setUsersList(updatedUsers);
  };

  const handleSaveInventoryItem = async (item: InventoryItem) => {
    if (!metadata) return;
    const isNew = !inventories.some(inv => inv.id === item.id);
    await saveInventoryItem(metadata.id, item);

    // Audit Log
    const log: TransactionLog = {
      id: 'TX-INV-' + Date.now(),
      inventoryId: item.id,
      inventoryName: item.name,
      action: isNew ? 'REGISTRATION' : 'STATUS_UPDATE',
      fromEmail: firebaseUser?.email || 'Admin',
      toEmail: item.assignedToEmail,
      quantity: item.totalQuantity,
      notes: isNew 
        ? `Equipment asset registered into registry: ${item.category}.`
        : `Equipment status updated to: ${item.status}. ${item.conditionNotes}`,
      timestamp: new Date().toISOString(),
    };
    await addTransactionLog(metadata.id, log);

    // Fetch latest
    const [invs, transLogs] = await Promise.all([
      fetchInventories(metadata.id),
      fetchTransactionLogs(metadata.id)
    ]);
    setInventories(invs);
    setLogs(transLogs);
  };

  const handleDeleteInventory = async (itemId: string) => {
    if (!metadata) return;
    const targetItem = inventories.find(i => i.id === itemId);
    if (!targetItem) return;

    await deleteInventoryItem(metadata, itemId);

    // Log removal
    const log: TransactionLog = {
      id: 'TX-DEL-' + Date.now(),
      inventoryId: itemId,
      inventoryName: targetItem.name,
      action: 'REMOVAL',
      fromEmail: firebaseUser?.email || 'Admin',
      toEmail: 'None',
      quantity: targetItem.totalQuantity,
      notes: `De-registered and retired equipment from lab inventory.`,
      timestamp: new Date().toISOString(),
    };
    await addTransactionLog(metadata.id, log);

    const [invs, transLogs] = await Promise.all([
      fetchInventories(metadata.id),
      fetchTransactionLogs(metadata.id)
    ]);
    setInventories(invs);
    setLogs(transLogs);
  };

  const handleAssignInventory = async (itemId: string, userEmail: string, notes: string) => {
    if (!metadata) return;
    const item = inventories.find(i => i.id === itemId);
    if (!item) return;

    const previousOwner = item.assignedToEmail;
    const updatedItem: InventoryItem = {
      ...item,
      assignedToEmail: userEmail,
      status: userEmail === 'None' ? 'Available' : 'In Use',
      lastUpdated: new Date().toISOString(),
    };

    await saveInventoryItem(metadata.id, updatedItem);

    // Log assignment
    const log: TransactionLog = {
      id: 'TX-ASN-' + Date.now(),
      inventoryId: itemId,
      inventoryName: item.name,
      action: 'ASSIGNMENT',
      fromEmail: previousOwner === 'None' ? 'Laboratory' : previousOwner,
      toEmail: userEmail === 'None' ? 'Laboratory' : userEmail,
      quantity: item.totalQuantity,
      notes: notes || `Direct administration assignment of equipment ownership.`,
      timestamp: new Date().toISOString(),
    };
    await addTransactionLog(metadata.id, log);

    const [invs, transLogs] = await Promise.all([
      fetchInventories(metadata.id),
      fetchTransactionLogs(metadata.id)
    ]);
    setInventories(invs);
    setLogs(transLogs);
  };

  // ============================================================================
  // USER ACTIONS
  // ============================================================================

  const handleTransferInventory = async (itemId: string, targetEmail: string, notes: string) => {
    if (!metadata) return;
    const item = inventories.find(i => i.id === itemId);
    if (!item) return;

    const previousOwner = item.assignedToEmail;
    const updatedItem: InventoryItem = {
      ...item,
      assignedToEmail: targetEmail,
      status: 'In Use',
      lastUpdated: new Date().toISOString(),
    };

    await saveInventoryItem(metadata.id, updatedItem);

    // Write Transfer Log
    const log: TransactionLog = {
      id: 'TX-TRF-' + Date.now(),
      inventoryId: itemId,
      inventoryName: item.name,
      action: 'TRANSFER',
      fromEmail: previousOwner,
      toEmail: targetEmail,
      quantity: item.totalQuantity,
      notes: notes || `Handed over to peer in department.`,
      timestamp: new Date().toISOString(),
    };
    await addTransactionLog(metadata.id, log);

    const [invs, transLogs] = await Promise.all([
      fetchInventories(metadata.id),
      fetchTransactionLogs(metadata.id)
    ]);
    setInventories(invs);
    setLogs(transLogs);
  };

  const handleSaveUserProfile = async (updatedProfile: UserProfile) => {
    if (!metadata) return;
    await saveUser(metadata.id, updatedProfile);
    
    const updatedUsers = await fetchUsers(metadata.id);
    setUsersList(updatedUsers);
    setUserProfile(updatedProfile);
  };


  // ============================================================================
  // RENDER SECTIONS
  // ============================================================================

  // LOADING SCREEN
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="h-10 w-10 border-2 border-slate-200 border-t-blue-900 rounded-full"
        />
        <h3 className="mt-6 text-sm font-bold text-slate-950 tracking-tight">Syncing with Google Cloud</h3>
        <p className="mt-1 text-[11px] text-slate-500 font-mono">{loadingStage}</p>
      </div>
    );
  }

  // LOGIN / OAUTH SIGN-IN SCREEN
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="mx-auto h-12 w-12 rounded bg-blue-50 border border-blue-150 flex items-center justify-center text-blue-900">
            <GraduationCap size={28} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-950 tracking-tight leading-none uppercase">
            IOE Aerospace
          </h2>
          <p className="mt-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Pulchowk Campus • Dept. of Aerospace
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 border border-slate-200 rounded-lg sm:px-10 space-y-6">
            <div className="text-center space-y-1.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lab & Equipment Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect your Google Workspace Account. This application synchronizes all registers, peer handovers, and equipment logs securely inside a dedicated Spreadsheet located on your Google Drive.
              </p>
            </div>

            <div className="border-t border-slate-100 pt-5">
              {/* Google Sign In button standard styling */}
              <button
                onClick={handleLogin}
                className="w-full inline-flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded text-xs transition cursor-pointer"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>Sign in with Google Work Account</span>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded border border-slate-200 flex items-start gap-2.5">
              <Info className="text-blue-900 shrink-0 mt-0.5" size={14} />
              <div className="text-[10px] text-slate-500 leading-normal space-y-1">
                <span className="font-bold text-slate-700 block uppercase tracking-wider">How does Drive Access work?</span>
                <p>The applet uses the Google Sheets authorization to create and write logs. Access is completely isolated and strictly bounded to sheets generated/shared by you.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // UNINVITED MEMBER / ACCESS DENIED SCREEN
  if (uninvitedUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="mx-auto h-12 w-12 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <ShieldAlert size={24} />
          </div>
          <h2 className="mt-6 text-center text-xl font-bold text-slate-900 tracking-tight">
            Campus Verification Required
          </h2>
          <p className="mt-2 text-center text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Your email <span className="font-mono text-slate-900 font-bold bg-slate-150 px-1 py-0.5 rounded">{uninvitedUser}</span> is currently not registered in the IOE Aerospace Inventory ledger.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 border border-slate-200 rounded-lg text-center space-y-4 text-xs">
            <p className="text-slate-600 leading-relaxed">
              To preserve database security, only email addresses approved by the Department's Administrator are granted workspace write authorizations.
            </p>
            <div className="bg-blue-50/50 p-4 rounded border border-blue-100 text-left space-y-1 text-[11px] text-slate-700">
              <span className="font-bold text-blue-950 block uppercase tracking-wider">What should I do?</span>
              <p>Contact your Aerospace Lab Administrator or Department Head and request them to register your email in the Inventory User list. Once added, you will gain access immediately.</p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-800 underline font-semibold cursor-pointer"
              >
                Sign out of account
              </button>
              <button
                onClick={loadDatabase}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-4 py-2 rounded text-xs transition cursor-pointer"
              >
                Check Registration Status
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PROFILE SETUP STATE (Uncompleted profile fields)
  if (userProfile && userProfile.profileStatus === 'PENDING_SETUP') {
    return (
      <ProfileSetup
        firebaseUser={firebaseUser!}
        onSetupComplete={handleProfileSetupComplete}
        isSaving={isLoading}
        onLogout={handleLogout}
      />
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
        <div className="max-w-md w-full bg-white border border-slate-200 p-6 rounded-lg text-center space-y-4 shadow-xs">
          <div className="mx-auto h-12 w-12 rounded bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <ShieldAlert size={24} />
          </div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Profile Not Loaded</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your department profile could not be retrieved from Google Drive. This could be due to a temporary connection problem.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={handleLogout}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded transition cursor-pointer"
            >
              Sign out
            </button>
            <button
              onClick={loadDatabase}
              className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded transition cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN CORE APPLICATION
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* GLOBAL ACADEMIC TOP HEADER */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-blue-900 flex items-center justify-center text-white font-bold">
              <GraduationCap size={18} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-xs font-bold tracking-widest text-slate-400 uppercase leading-none">
                  IOE Pulchowk
                </h1>
                <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  {viewMode} Mode
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-900">Aerospace Dept. Asset Console</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View switcher for admin */}
            {userProfile?.role === 'ADMIN' && (
              <div className="hidden sm:flex bg-slate-50 p-0.5 rounded border border-slate-200">
                <button
                  onClick={() => setViewMode('USER')}
                  className={`px-3 py-1 text-xs font-bold transition rounded-sm cursor-pointer ${viewMode === 'USER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  My Workspace
                </button>
                <button
                  onClick={() => setViewMode('ADMIN')}
                  className={`px-3 py-1 text-xs font-bold transition rounded-sm cursor-pointer ${viewMode === 'ADMIN' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Admin Console
                </button>
              </div>
            )}

            {/* User details */}
            <div className="flex items-center gap-3 border-l border-slate-100 pl-4">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-slate-900">{userProfile?.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{userProfile?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition cursor-pointer"
                title="Log out securely"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mode switcher trigger for mobile admins */}
      {userProfile?.role === 'ADMIN' && (
        <div className="sm:hidden px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-600">Active View:</span>
          <button
            onClick={() => setViewMode(viewMode === 'ADMIN' ? 'USER' : 'ADMIN')}
            className="bg-white border border-slate-200 text-xs font-bold text-blue-900 px-3 py-1 rounded cursor-pointer"
          >
            Switch to {viewMode === 'ADMIN' ? 'User Workspace' : 'Admin Console'}
          </button>
        </div>
      )}

      {/* CORE ACTIVE VIEW MOUNT */}
      <main>
        {viewMode === 'ADMIN' ? (
          <AdminPanel
            metadata={metadata!}
            users={usersList}
            inventories={inventories}
            logs={logs}
            onAddUser={handleAddUser}
            onRemoveUser={handleRemoveUser}
            onToggleUserRole={handleToggleUserRole}
            onSaveInventory={handleSaveInventoryItem}
            onDeleteInventory={handleDeleteInventory}
            onAssignInventory={handleAssignInventory}
            onSync={handleSyncLatest}
            isSyncing={isSyncing}
            currentUserEmail={userProfile?.email || ''}
          />
        ) : (
          <UserPanel
            metadata={metadata!}
            currentUserProfile={userProfile}
            users={usersList}
            inventories={inventories}
            logs={logs}
            onSaveProfile={handleSaveUserProfile}
            onSaveInventory={handleSaveInventoryItem}
            onDeleteInventory={handleDeleteInventory}
            onTransferInventory={handleTransferInventory}
            onSync={handleSyncLatest}
            isSyncing={isSyncing}
          />
        )}
      </main>
    </div>
  );
}
