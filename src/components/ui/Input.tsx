import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className = "", ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-foreground mb-1">{label}</label>}
      <input
        ref={ref}
        className={`w-full px-3 py-2 border border-card-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";
export default Input;
