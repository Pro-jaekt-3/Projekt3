import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../lib/firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL;

type AppUserRole = "ADMIN" | "INSTRUCTOR" | "PARTICIPANT";

type AppUser = {
  id: number;
  email: string;
  role: AppUserRole;
  firebaseUid: string;
};

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isLoading: boolean;
  authError: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);

      if (!user) {
        setAppUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load authenticated user.");
        }

        setAppUser(data);
      } catch (error) {
        setAppUser(null);
        setAuthError(
          error instanceof Error ? error.message : "Failed to load authenticated user."
        );
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      firebaseUser,
      appUser,
      isLoading,
      authError,
    }),
    [firebaseUser, appUser, isLoading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};

export { AuthProvider, useAuth };
export type { AppUser, AppUserRole };
