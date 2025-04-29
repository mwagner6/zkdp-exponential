interface NavigationButtonProps {
  direction: 'back' | 'next';
  onClick: () => void;
  disabled: boolean;
}

export default function NavigationButton({ direction, onClick, disabled }: NavigationButtonProps) {
  return (
    <button 
      className={`nav-button ${direction}-button`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="button-label">{direction === 'back' ? 'Back' : 'Next'}</span>
      <span className="chevron">{direction === 'back' ? '‹' : '›'}</span>
    </button>
  );
} 