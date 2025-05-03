interface GameNavbarProps {
  onBack: () => void;
}

export default function GameNavbar({ onBack }: GameNavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[1001] flex h-[60px] items-center bg-white p-3 shadow-md">
      {/* Back button that changes to chevron on wider screens */}
      <button 
        className="mr-2 min-[1300px]:mr-4 cursor-pointer rounded bg-transparent p-2 text-base text-gray-600 transition hover:bg-gray-100 border-none" 
        onClick={onBack}
      >
        <span className="hidden min-[1300px]:inline">‹ Back</span>
        <span className="min-[1300px]:hidden">‹</span>
      </button>

      {/* Title that adjusts size on wider screens */}
      <div className="absolute left-1/2 -translate-x-1/2 text-base min-[1300px]:text-lg font-medium text-gray-800 max-w-[50%] min-[1300px]:max-w-none truncate">
        Verifiable Binomial Mechanism Example
      </div>

      {/* Color references that collapse on wider screens */}
      <div className="ml-auto flex items-center gap-1 min-[1300px]:gap-3">
        <div className="flex items-center gap-1 text-xs">
          <div className="h-3.5 w-3.5 rounded-sm bg-blue-500"></div>
          <span className="hidden min-[1300px]:inline">Private to the curator</span>
          <span className="min-[1300px]:hidden">Private</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <div className="h-3.5 w-3.5 rounded-sm bg-green-500"></div>
          <span className="hidden min-[1300px]:inline">Public to the verifier</span>
          <span className="min-[1300px]:hidden">Public</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <div className="h-3.5 w-3.5 rounded-sm bg-red-600"></div>
          <span className="hidden min-[1300px]:inline">Attempt to lie by the Curator</span>
          <span className="min-[1300px]:hidden">Lie</span>
        </div>
      </div>
    </nav>
  );
} 