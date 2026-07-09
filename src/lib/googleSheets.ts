/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, InventoryItem, TransactionLog, SheetMetadata } from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Listen to Auth state
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  // Try to load cached token from session storage or keep in memory
  const savedToken = sessionStorage.getItem('g_access_token');
  if (savedToken) {
    cachedAccessToken = savedToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('g_access_token');
      onAuthFailure();
    }
  });
};

// Google Sign In
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google OAuth access token.');
    }

    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('g_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Get active token
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Logout
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  sessionStorage.removeItem('g_access_token');
};

// ============================================================================
// GOOGLE DRIVE & SHEETS REST API OPERATIONS
// ============================================================================

const SPREADSHEET_NAME = 'IOE Aerospace Inventory Database';

// Helper for Google API requests
async function googleFetch(url: string, options: RequestInit = {}) {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No Google Access Token available. Please log in again.');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      // Clear token on 401 to force re-auth
      cachedAccessToken = null;
      sessionStorage.removeItem('g_access_token');
    }
    throw new Error(`Google API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Searches the user's Google Drive for the spreadsheet.
 * If not found, it creates the spreadsheet and initializes headers.
 */
export const findOrCreateDatabase = async (currentUserEmail: string, currentUserName: string): Promise<SheetMetadata> => {
  try {
    // 1. Search for the file
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(SPREADSHEET_NAME)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`;
    const searchResult = await googleFetch(searchUrl);

    if (searchResult.files && searchResult.files.length > 0) {
      const spreadsheetId = searchResult.files[0].id;
      // Fetch metadata to map sheet IDs
      const metadata = await fetchSpreadsheetMetadata(spreadsheetId);
      
      // Check if sheets are present, if any are missing we will build them
      await verifyAndRepairDatabase(metadata, currentUserEmail, currentUserName);
      return metadata;
    } else {
      // 2. Create a new Spreadsheet
      return await createNewDatabase(currentUserEmail, currentUserName);
    }
  } catch (error) {
    console.error('findOrCreateDatabase error:', error);
    throw error;
  }
};

/**
 * Fetch spreadsheet metadata to map sheet (tab) names to numeric sheetIds.
 */
export const fetchSpreadsheetMetadata = async (spreadsheetId: string): Promise<SheetMetadata> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const data = await googleFetch(url);

  const sheetIds = { Users: 0, Inventories: 0, Transactions: 0 };
  
  data.sheets.forEach((s: any) => {
    const title = s.properties.title;
    if (title === 'Users') sheetIds.Users = s.properties.sheetId;
    if (title === 'Inventories') sheetIds.Inventories = s.properties.sheetId;
    if (title === 'Transactions') sheetIds.Transactions = s.properties.sheetId;
  });

  return {
    id: spreadsheetId,
    sheetIds,
  };
};

/**
 * Creates a brand-new Spreadsheet with correct pages.
 */
const createNewDatabase = async (adminEmail: string, adminName: string): Promise<SheetMetadata> => {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: {
      title: SPREADSHEET_NAME,
    },
    sheets: [
      { properties: { title: 'Users' } },
      { properties: { title: 'Inventories' } },
      { properties: { title: 'Transactions' } },
    ],
  };

  const response = await googleFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const spreadsheetId = response.spreadsheetId;
  const sheetIds = { Users: 0, Inventories: 0, Transactions: 0 };
  
  response.sheets.forEach((s: any) => {
    const title = s.properties.title;
    if (title === 'Users') sheetIds.Users = s.properties.sheetId;
    if (title === 'Inventories') sheetIds.Inventories = s.properties.sheetId;
    if (title === 'Transactions') sheetIds.Transactions = s.properties.sheetId;
  });

  // Write headers for each sheet
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A1:G1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [['Email', 'Name', 'Role', 'ProfileStatus', 'Designation', 'Phone', 'JoinedDate']],
    }),
  });

  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Inventories!A1:I1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [['ID', 'Name', 'SerialNumber', 'Category', 'TotalQuantity', 'Status', 'AssignedToEmail', 'ConditionNotes', 'LastUpdated']],
    }),
  });

  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:I1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [['ID', 'InventoryID', 'InventoryName', 'Action', 'FromEmail', 'ToEmail', 'Quantity', 'Notes', 'Timestamp']],
    }),
  });

  // Auto-seed the creator as ACTIVE ADMIN
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:G2?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [[
        adminEmail,
        adminName || 'Department Admin',
        'ADMIN',
        'ACTIVE',
        'Department Head / Admin',
        '9876543210',
        new Date().toISOString().split('T')[0]
      ]],
    }),
  });

  // Add a welcome transaction
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:I2?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [[
        'TX-INIT-' + Date.now(),
        'SYSTEM',
        'Database Initialize',
        'PROFILE_SETUP',
        'System',
        adminEmail,
        0,
        'Database created and main Admin registered.',
        new Date().toISOString()
      ]],
    }),
  });

  return { id: spreadsheetId, sheetIds };
};

/**
 * Ensures missing sheets are added and initialized if someone deletes tabs.
 */
const verifyAndRepairDatabase = async (metadata: SheetMetadata, email: string, name: string): Promise<void> => {
  const spreadsheetId = metadata.id;
  const requests: any[] = [];
  const existingSheets = Object.keys(metadata.sheetIds);

  if (!metadata.sheetIds.Users) {
    requests.push({ addSheet: { properties: { title: 'Users' } } });
  }
  if (!metadata.sheetIds.Inventories) {
    requests.push({ addSheet: { properties: { title: 'Inventories' } } });
  }
  if (!metadata.sheetIds.Transactions) {
    requests.push({ addSheet: { properties: { title: 'Transactions' } } });
  }

  if (requests.length > 0) {
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });

    // Re-fetch metadata
    const updatedMeta = await fetchSpreadsheetMetadata(spreadsheetId);
    metadata.sheetIds = updatedMeta.sheetIds;

    // Re-write headers for newly added ones
    if (!existingSheets.includes('Users')) {
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A1:G1?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [['Email', 'Name', 'Role', 'ProfileStatus', 'Designation', 'Phone', 'JoinedDate']],
        }),
      });
      // Also seed current admin
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:G2?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [[email, name || 'Department Admin', 'ADMIN', 'ACTIVE', 'Department Head / Admin', '9876543210', new Date().toISOString().split('T')[0]]],
        }),
      });
    }

    if (!existingSheets.includes('Inventories')) {
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Inventories!A1:I1?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [['ID', 'Name', 'SerialNumber', 'Category', 'TotalQuantity', 'Status', 'AssignedToEmail', 'ConditionNotes', 'LastUpdated']],
        }),
      });
    }

    if (!existingSheets.includes('Transactions')) {
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A1:I1?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [['ID', 'InventoryID', 'InventoryName', 'Action', 'FromEmail', 'ToEmail', 'Quantity', 'Notes', 'Timestamp']],
        }),
      });
    }
  }
};

/**
 * Drive API: Share Spreadsheet with another email as 'writer'
 */
export const shareSpreadsheetWithUser = async (spreadsheetId: string, email: string): Promise<boolean> => {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`;
    const body = {
      role: 'writer',
      type: 'user',
      emailAddress: email,
    };
    await googleFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return true;
  } catch (error) {
    console.error(`Error sharing spreadsheet with ${email}:`, error);
    // Return false instead of throwing so it doesn't break user insert if sharing fails due to permission / domain limits
    return false;
  }
};

// ============================================================================
// DATA FETCHERS & CRUDS
// ============================================================================

/**
 * Fetch all users from the Users sheet
 */
export const fetchUsers = async (spreadsheetId: string): Promise<UserProfile[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:G1000`;
  const data = await googleFetch(url);
  
  if (!data.values) return [];

  return data.values.map((row: any) => ({
    email: row[0] || '',
    name: row[1] || '',
    role: (row[2] || 'USER') as 'ADMIN' | 'USER',
    profileStatus: (row[3] || 'PENDING_SETUP') as 'PENDING_SETUP' | 'ACTIVE',
    designation: row[4] || '',
    phone: row[5] || '',
    joinedDate: row[6] || '',
  })).filter((u: UserProfile) => u.email.trim() !== '');
};

/**
 * Save / Update a User Profile row
 */
export const saveUser = async (spreadsheetId: string, profile: UserProfile): Promise<void> => {
  // Fetch existing users to find row index
  const users = await fetchUsers(spreadsheetId);
  const existingIndex = users.findIndex(u => u.email.toLowerCase() === profile.email.toLowerCase());

  const rowValues = [
    profile.email,
    profile.name,
    profile.role,
    profile.profileStatus,
    profile.designation,
    profile.phone,
    profile.joinedDate,
  ];

  if (existingIndex >= 0) {
    // Update existing row. Header is row 1, index 0 is row 2
    const rowIndex = existingIndex + 2;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A${rowIndex}:G${rowIndex}?valueInputOption=RAW`;
    await googleFetch(url, {
      method: 'PUT',
      body: JSON.stringify({ values: [rowValues] }),
    });
  } else {
    // Append new row
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A:G:append?valueInputOption=RAW`;
    await googleFetch(url, {
      method: 'POST',
      body: JSON.stringify({ values: [rowValues] }),
    });
  }
};

/**
 * Remove user from spreadsheet
 */
export const deleteUser = async (metadata: SheetMetadata, email: string): Promise<void> => {
  const users = await fetchUsers(metadata.id);
  const existingIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

  if (existingIndex >= 0) {
    // Row index to delete (0-based for Sheets batchUpdate is index of the row)
    // users index 0 is Row 2 in sheets (row index 1 in 0-based sheets indexing)
    const rowIndex = existingIndex + 1; // Row 2 becomes index 1
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${metadata.id}:batchUpdate`;
    
    await googleFetch(url, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: metadata.sheetIds.Users,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      }),
    });
  }
};

/**
 * Fetch all inventory items
 */
export const fetchInventories = async (spreadsheetId: string): Promise<InventoryItem[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Inventories!A2:I1000`;
  const data = await googleFetch(url);

  if (!data.values) return [];

  return data.values.map((row: any) => ({
    id: row[0] || '',
    name: row[1] || '',
    serialNumber: row[2] || '',
    category: row[3] || '',
    totalQuantity: parseInt(row[4] || '1', 10) || 1,
    status: (row[5] || 'Available') as 'Available' | 'In Use' | 'Under Repair' | 'Damaged',
    assignedToEmail: row[6] || 'None',
    conditionNotes: row[7] || '',
    lastUpdated: row[8] || '',
  })).filter((inv: InventoryItem) => inv.id.trim() !== '');
};

/**
 * Save / Update an inventory item
 */
export const saveInventoryItem = async (spreadsheetId: string, item: InventoryItem): Promise<void> => {
  const inventories = await fetchInventories(spreadsheetId);
  const existingIndex = inventories.findIndex(inv => inv.id === item.id);

  const rowValues = [
    item.id,
    item.name,
    item.serialNumber,
    item.category,
    item.totalQuantity,
    item.status,
    item.assignedToEmail,
    item.conditionNotes,
    item.lastUpdated,
  ];

  if (existingIndex >= 0) {
    const rowIndex = existingIndex + 2;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Inventories!A${rowIndex}:I${rowIndex}?valueInputOption=RAW`;
    await googleFetch(url, {
      method: 'PUT',
      body: JSON.stringify({ values: [rowValues] }),
    });
  } else {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Inventories!A:I:append?valueInputOption=RAW`;
    await googleFetch(url, {
      method: 'POST',
      body: JSON.stringify({ values: [rowValues] }),
    });
  }
};

/**
 * Delete an inventory item
 */
export const deleteInventoryItem = async (metadata: SheetMetadata, itemId: string): Promise<void> => {
  const inventories = await fetchInventories(metadata.id);
  const existingIndex = inventories.findIndex(inv => inv.id === itemId);

  if (existingIndex >= 0) {
    const rowIndex = existingIndex + 1; // 0-based index of row
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${metadata.id}:batchUpdate`;
    
    await googleFetch(url, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: metadata.sheetIds.Inventories,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      }),
    });
  }
};

/**
 * Fetch all transaction logs
 */
export const fetchTransactionLogs = async (spreadsheetId: string): Promise<TransactionLog[]> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A2:I2000`;
  const data = await googleFetch(url);

  if (!data.values) return [];

  return data.values.map((row: any) => ({
    id: row[0] || '',
    inventoryId: row[1] || '',
    inventoryName: row[2] || '',
    action: (row[3] || 'REGISTRATION') as any,
    fromEmail: row[4] || '',
    toEmail: row[5] || '',
    quantity: parseInt(row[6] || '1', 10) || 0,
    notes: row[7] || '',
    timestamp: row[8] || '',
  })).reverse(); // Show latest logs first
};

/**
 * Add a new Transaction log
 */
export const addTransactionLog = async (spreadsheetId: string, log: TransactionLog): Promise<void> => {
  const rowValues = [
    log.id,
    log.inventoryId,
    log.inventoryName,
    log.action,
    log.fromEmail,
    log.toEmail,
    log.quantity,
    log.notes,
    log.timestamp,
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transactions!A:I:append?valueInputOption=RAW`;
  await googleFetch(url, {
    method: 'POST',
    body: JSON.stringify({ values: [rowValues] }),
  });
};
