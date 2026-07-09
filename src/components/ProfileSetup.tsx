/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { UserPlus, Sparkles, BookOpen, GraduationCap, Shield } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileSetupProps {
  firebaseUser: User;
  onSetupComplete: (updatedProfile: UserProfile) => void;
  isSaving: boolean;
  onLogout: () => void;
}

export default function ProfileSetup({
  firebaseUser,
  onSetupComplete,
  isSaving,
  onLogout
}: ProfileSetupProps) {
  const [name, setName] = useState(firebaseUser.displayName || '');
  const [designation, setDesignation] = useState('Student');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }

    const updatedProfile: UserProfile = {
      email: firebaseUser.email || '',
      name: name.trim(),
      role: 'USER', // Auto-role for new email setup; Admins can promote via panel
      profileStatus: 'ACTIVE',
      designation,
      phone: phone.trim(),
      joinedDate: new Date().toISOString().split('T')[0],
    };

    onSetupComplete(updatedProfile);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded bg-blue-50 flex items-center justify-center border border-blue-150 text-blue-900">
            <GraduationCap size={32} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-900">
          IOE Aerospace Department
        </h2>
        <p className="mt-2 text-center text-xs text-slate-500">
          Set up your official inventory user profile for{' '}
          <span className="font-semibold text-slate-800">{firebaseUser.email}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white py-8 px-6 border border-slate-200 rounded-lg sm:px-10"
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded bg-red-50 p-3 border border-red-100 text-xs text-red-600 font-semibold">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-900"
                placeholder="Navaraj Parajuli"
              />
            </div>

            <div>
              <label htmlFor="designation" className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">
                Academic Designation
              </label>
              <select
                id="designation"
                name="designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="block w-full rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-900"
              >
                <option value="Student">Aerospace Student</option>
                <option value="Professor">Professor / Faculty</option>
                <option value="Lab Assistant">Lab Assistant / Officer</option>
                <option value="Researcher">Researcher</option>
                <option value="Department Staff">Department Staff</option>
              </select>
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-bold tracking-wider uppercase text-slate-400 mb-1">
                Contact Number
              </label>
              <div className="relative rounded">
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full rounded border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-900"
                  placeholder="98XXXXXXXX"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onLogout}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline"
              >
                Sign out
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex justify-center items-center gap-2 rounded bg-blue-900 hover:bg-blue-800 px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
