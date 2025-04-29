import { useState, useEffect, useRef } from 'react';
import GameNavbar from '../navigation/GameNavbar';
import './GameScreen.css';

interface GameScreenProps {
  onBack: () => void;
}

interface ClientInput {
  id: number;
  value: number; // 0 or 1
  committed: boolean;
}

interface FloatingIndicator {
  id: number;
  value: number;
  top: number;
  left: number;
}

export default function GameScreen({ onBack }: GameScreenProps) {
  const [clients, setClients] = useState<ClientInput[]>([]);
  const [epsilon, setEpsilon] = useState<number>(1.0);
  const [count, setCount] = useState<number>(0);
  const [privateCount, setPrivateCount] = useState<number | null>(null);
  const [proof, setProof] = useState<string>('');
  const [step, setStep] = useState<'input' | 'compute' | 'verify'>('input');
  const [isAddingClients, setIsAddingClients] = useState<boolean>(false);
  const [floatingIndicators, setFloatingIndicators] = useState<FloatingIndicator[]>([]);
  const countRef = useRef<HTMLDivElement>(null);

  // Add 1000 clients with random binary inputs
  const addAllClients = () => {
    if (isAddingClients) return;
    setIsAddingClients(true);
    
    // Generate a uniform target count between 0 and 1000
    const targetCount = Math.floor(Math.random() * 1001);
    const newClients: ClientInput[] = [];
    
    // Create an array of 1's and 0's
    const values = Array(1000).fill(0);
    for (let i = 0; i < targetCount; i++) {
      values[i] = 1;
    }
    
    // Shuffle the array to interleave 1's and 0's
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    
    // Create clients with shuffled values
    for (let i = 0; i < 1000; i++) {
      newClients.push({
        id: clients.length + i + 1,
        value: values[i],
        committed: true
      });
    }

    // Animate the count update
    let currentCount = count;
    const interval = setInterval(() => {
      if (newClients.length === 0) {
        clearInterval(interval);
        setIsAddingClients(false);
        setClients(prev => [...prev, ...newClients]);
        return;
      }

      const client = newClients.shift()!;
      currentCount += client.value;
      setCount(currentCount);
      
      // Add floating indicator
      if (countRef.current) {
        const rect = countRef.current.getBoundingClientRect();
        const indicator: FloatingIndicator = {
          id: Date.now() + Math.random(),
          value: client.value,
          top: rect.top + Math.random() * 20,
          left: client.value === 1 
            ? rect.left + Math.random() * 50  // +1 goes right
            : rect.left - Math.random() * 50  // +0 goes left
        };
        setFloatingIndicators(prev => [...prev, indicator]);
        
        // Remove indicator after animation
        setTimeout(() => {
          setFloatingIndicators(prev => prev.filter(i => i.id !== indicator.id));
        }, 1000);
      }
    }, 0);

    setClients(prev => [...prev, ...newClients]);
  };

  // Compute the differentially private count
  const computePrivateCount = () => {
    const trueCount = clients.reduce((sum, client) => sum + client.value, 0);
    setCount(trueCount);
    
    // Simulate binomial noise addition
    const noise = Math.floor(Math.random() * 10) - 5; // Simplified noise for demo
    setPrivateCount(trueCount + noise);
    setStep('verify');
  };

  // Generate and verify the proof
  const verifyProof = () => {
    // In a real implementation, this would generate a proper zero-knowledge proof
    setProof('Proof generated and verified successfully!');
  };

  return (
    <div className="game-screen">
      <GameNavbar onBack={onBack} />
      <div className="game-content">
        <div className="game-controls">
          <div className="epsilon-control">
            <label>Privacy Parameter (ε)</label>
            <input 
              type="range" 
              min="0.1" 
              max="5" 
              step="0.1" 
              value={epsilon} 
              onChange={(e) => setEpsilon(parseFloat(e.target.value))}
            />
            <span className="epsilon-value">ε = {epsilon}</span>
          </div>
        </div>

        <div className="computation-section">
          <h3>Differentially Private Computation</h3>
          <button 
            onClick={addAllClients} 
            className="add-client-btn"
            disabled={isAddingClients}
          >
            {isAddingClients ? 'Adding Clients...' : 'Add 1000 Clients'}
          </button>
          <div className="computation-steps">
            <div className={`step ${step === 'input' ? 'active' : ''}`}>
              <h4>Step 1: Input Collection</h4>
              {isAddingClients ? <p>Adding client inputs...</p> : null}
              <div className="count-display" ref={countRef}>
                Client count: {clients.length} | Current Sum: {count}
              </div>
              {floatingIndicators.map(indicator => (
                <div 
                  key={indicator.id}
                  className={`floating-indicator ${indicator.value === 1 ? 'positive' : 'zero'}`}
                  style={{
                    top: `${indicator.top}px`,
                    left: `${indicator.left}px`
                  }}
                >
                  +{indicator.value}
                </div>
              ))}
            </div>
            <div className={`step ${step === 'compute' ? 'active' : ''}`}>
              <h4>Step 2: Compute Private Count</h4>
              <button 
                onClick={computePrivateCount} 
                disabled={clients.length === 0 || isAddingClients}
              >
                Compute
              </button>
            </div>
            <div className={`step ${step === 'verify' ? 'active' : ''}`}>
              <h4>Step 3: Verify Proof</h4>
              <button 
                onClick={verifyProof} 
                disabled={privateCount === null}
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 