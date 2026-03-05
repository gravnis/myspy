interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-card-bg border border-card-border rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
}
