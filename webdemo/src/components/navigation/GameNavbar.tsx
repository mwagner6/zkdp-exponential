import './GameNavbar.css';

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

      <div className="game-navbar-right">
        <div className="color-reference">
          <div className="color-square private"></div>
          <span>Private to the curator</span>
        </div>
        <div className="color-reference">
          <div className="color-square public"></div>
          <span>Public to the verifier</span>
        </div>
        <div className="color-reference">
          <div className="color-square nefarious"></div>
          <span>Attempt to lie by the Curator</span>
        </div>
      </div>
    </nav>
  );
} 