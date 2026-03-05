import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export default function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "bg-gray-100 text-foreground hover:bg-gray-200 border border-card-border",
    danger: "bg-danger text-white hover:bg-red-700",
    ghost: "text-muted hover:bg-gray-100",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
