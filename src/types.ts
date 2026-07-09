/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  profileStatus: 'PENDING_SETUP' | 'ACTIVE';
  designation: string; // e.g., Student, Professor, Lab Assistant, Researcher
  phone: string;
  joinedDate: string;
}

export type InventoryStatus = 'Available' | 'In Use' | 'Under Repair' | 'Damaged';

export interface InventoryItem {
  id: string;
  name: string;
  serialNumber: string;
  category: string; // e.g., Aerodynamics, Avionics, Propulsion, Structures
  totalQuantity: number;
  status: InventoryStatus;
  assignedToEmail: string; // Email of user or "None"
  conditionNotes: string;
  lastUpdated: string;
}

export interface TransactionLog {
  id: string;
  inventoryId: string;
  inventoryName: string;
  action: 'REGISTRATION' | 'ASSIGNMENT' | 'TRANSFER' | 'REMOVAL' | 'STATUS_UPDATE' | 'PROFILE_SETUP';
  fromEmail: string;
  toEmail: string;
  quantity: number;
  notes: string;
  timestamp: string;
}

export interface SheetMetadata {
  id: string; // Spreadsheet ID
  sheetIds: {
    Users: number;
    Inventories: number;
    Transactions: number;
  };
}
