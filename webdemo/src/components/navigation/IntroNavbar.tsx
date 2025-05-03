interface IntroNavbarProps {
  onNext: () => void;
  disabled?: boolean;
}

export default function IntroNavbar({ onNext, disabled }: IntroNavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[1001] flex h-[60px] items-center bg-white p-3 shadow-md">
      {/* Title with Tailwind classes */}
      <div className="absolute left-1/2 -translate-x-1/2 text-lg font-medium text-gray-800">
        Introduction to Zero-Knowledge Differential Privacy
      </div>

      {/* Next button with Tailwind classes */}
      <button 
        className="ml-auto cursor-pointer rounded bg-transparent p-2 text-base text-gray-600 transition hover:bg-gray-100 border-none disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={onNext}
        disabled={disabled}
      >
        Next ›
      </button>
    </nav>
  );
} 