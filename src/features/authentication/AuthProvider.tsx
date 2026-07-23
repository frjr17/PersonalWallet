import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, ownerUid, usingEmulators } from '@/lib/firebase';
import { AppError, logError } from '@/lib/errors';

/** Emulator-only credentials, created by `npm run seed:emulator`. Never used in production. */
export const EMULATOR_OWNER = {
  uid: 'emulator-owner-uid',
  email: 'owner@example.test',
  password: 'local-ledger-owner',
} as const;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsEmulatorOwner: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      // Client-side owner gate. Firestore rules enforce the same restriction server-side.
      if (nextUser && nextUser.uid !== ownerUid) {
        logError('auth', `Rejected non-owner sign-in for uid ${nextUser.uid}`);
        void signOut(auth);
        setUser(null);
      } else {
        setUser(nextUser);
      }
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user.uid !== ownerUid) {
      await signOut(auth);
      throw new AppError('This ledger belongs to a different Google account.');
    }
  }, []);

  const signInAsEmulatorOwner = useCallback(async () => {
    if (!usingEmulators) throw new AppError('Emulator sign-in is only available locally.');
    await signInWithEmailAndPassword(auth, EMULATOR_OWNER.email, EMULATOR_OWNER.password);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInAsEmulatorOwner, signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}

/** The signed-in owner. Only call under a protected route. */
export function useOwner(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useOwner requires a signed-in user');
  return user;
}
