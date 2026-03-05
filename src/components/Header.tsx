interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          className="pl-10 pr-4 py-2 w-64 border border-card-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>
    </header>
  );
}
