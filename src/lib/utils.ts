import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Fusionne les classes Tailwind avec prise en charge des conflits
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formate une date au format local français
export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Formate une heure au format local français
export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
