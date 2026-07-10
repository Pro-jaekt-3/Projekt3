import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
    toast.success("Password reset email sent");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to send password reset email.");
  }
}
