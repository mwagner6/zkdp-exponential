interface GameNavbarProps {
  onBack: () => void;
}

export default function GameNavbar({ onBack }: GameNavbarProps) {
  return (
    <nav className="game-navbar">
      <button className="game-back-button" onClick={onBack}>
        ‹ Back
      </button>
      <div className="game-navbar-title">Verifiable Binomial Mechanism Example</div>
    </nav>
  );
} 