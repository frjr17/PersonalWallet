import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, env } from '@/lib/firebase';
import { ensureDefaultCategories } from '@/services/repositories';
import { toast } from 'sonner';
interface AuthValue {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  emulatorLogin: () => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(auth, (current) => {
        if (current && current.uid !== env.VITE_FIREBASE_OWNER_UID) {
          void signOut(auth);
          toast.error('This Google account is not authorized.');
          setUser(null);
        } else {
          setUser(current);
          if (current) void ensureDefaultCategories(current.uid);
        }
        setLoading(false);
      }),
    [],
  );
  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      login: async () => {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      emulatorLogin: async () => {
        if (env.VITE_USE_FIREBASE_EMULATORS !== 'true')
          throw new Error('Emulator login is disabled');
        await signInWithEmailAndPassword(auth, 'owner@example.test', 'local-ledger-owner');
      },
      logout: () => signOut(auth),
    }),
    [user, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
