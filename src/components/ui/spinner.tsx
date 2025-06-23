import * as React from "react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  color?: "default" | "primary" | "secondary" | "white";
}

export function Spinner({ className, size = "md", color = "default", ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  const colorClasses = {
    default: "border-gray-300 border-t-gray-800",
    primary: "border-indigo-200 border-t-indigo-600",
    secondary: "border-gray-200 border-t-gray-600",
    white: "border-gray-300/30 border-t-white",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full",
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      {...props}
    />
  );
} 