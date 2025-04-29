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
  const [proof, setProof] = useState<string>('');
  const [step, setStep] = useState<
    'input' | 
    'commit-inputs' | 
    'set-epsilon' | 
    'sample-bits' | 
    'commit-bits' | 
    'prove-binary' | 
    'morra' | 
    'xor-bits' | 
    'compute-sum' | 
    'compute-z' | 
    'commit-pedersen' | 
    'release-proofs' | 
    'verify'
  >('input');
  const [isAddingClients, setIsAddingClients] = useState<boolean>(false);
  const [floatingIndicators, setFloatingIndicators] = useState<FloatingIndicator[]>([]);
  const countRef = useRef<HTMLDivElement>(null);

  const isStepEnabled = (stepName: string) => {
    const stepOrder = [
      'input',
      'commit-inputs',
      'set-epsilon',
      'sample-bits',
      'commit-bits',
      'prove-binary',
      'morra',
      'xor-bits',
      'compute-sum',
      'compute-z',
      'commit-pedersen',
      'release-proofs',
      'verify'
    ];
    const currentIndex = stepOrder.indexOf(step);
    const targetIndex = stepOrder.indexOf(stepName);
    return targetIndex <= currentIndex + 1;
  };

  const handleStepComplete = (nextStep: typeof step) => {
    setStep(nextStep);
  };

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
            <div className={`step ${step === 'input' ? 'active' : ''} ${!isStepEnabled('input') ? 'inactive' : ''}`}>
              <h4>Step 1: Input Collection</h4>
              {isAddingClients ? <p>Adding client inputs...</p> : null}
              <div className="count-display" ref={countRef}>
                Client count: {clients.length} | Current (hidden) sum: {count}
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
            <div className={`step ${step === 'commit-inputs' ? 'active' : ''} ${!isStepEnabled('commit-inputs') ? 'inactive' : ''}`}>
              <h4>Step 2: Commit Client Inputs</h4>
              <button 
                onClick={() => handleStepComplete('set-epsilon')} 
                disabled={!isStepEnabled('commit-inputs') || clients.length === 0}
              >
                Commit Inputs
              </button>
            </div>
            <div className={`step ${step === 'set-epsilon' ? 'active' : ''} ${!isStepEnabled('set-epsilon') ? 'inactive' : ''}`}>
              <h4>Step 3: Set Epsilon</h4>
              <div className="epsilon-control">
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
              <button 
                onClick={() => handleStepComplete('sample-bits')}
                disabled={!isStepEnabled('set-epsilon')}
              >
                Confirm Epsilon
              </button>
            </div>
            <div className={`step ${step === 'sample-bits' ? 'active' : ''} ${!isStepEnabled('sample-bits') ? 'inactive' : ''}`}>
              <h4>Step 4: Sample Private Bits</h4>
              <button 
                onClick={() => handleStepComplete('commit-bits')}
                disabled={!isStepEnabled('sample-bits')}
              >
                Sample Bits
              </button>
            </div>
            <div className={`step ${step === 'commit-bits' ? 'active' : ''} ${!isStepEnabled('commit-bits') ? 'inactive' : ''}`}>
              <h4>Step 5: Commit Private Bits</h4>
              <button 
                onClick={() => handleStepComplete('prove-binary')}
                disabled={!isStepEnabled('commit-bits')}
              >
                Commit Bits
              </button>
            </div>
            <div className={`step ${step === 'prove-binary' ? 'active' : ''} ${!isStepEnabled('prove-binary') ? 'inactive' : ''}`}>
              <h4>Step 6: Prove Binary Values</h4>
              <button 
                onClick={() => handleStepComplete('morra')}
                disabled={!isStepEnabled('prove-binary')}
              >
                Generate Sigma-OR Proof
              </button>
            </div>
            <div className={`step ${step === 'morra' ? 'active' : ''} ${!isStepEnabled('morra') ? 'inactive' : ''}`}>
              <h4>Step 7: Play Morra</h4>
              <div className="morra-game">
                <p>Play Morra to generate public bits</p>
                <button 
                  onClick={() => handleStepComplete('xor-bits')}
                  disabled={!isStepEnabled('morra')}
                >
                  Play Morra
                </button>
              </div>
            </div>
            <div className={`step ${step === 'xor-bits' ? 'active' : ''} ${!isStepEnabled('xor-bits') ? 'inactive' : ''}`}>
              <h4>Step 8: XOR Private & Public Bits</h4>
              <button 
                onClick={() => handleStepComplete('compute-sum')}
                disabled={!isStepEnabled('xor-bits')}
              >
                Compute XOR
              </button>
            </div>
            <div className={`step ${step === 'compute-sum' ? 'active' : ''} ${!isStepEnabled('compute-sum') ? 'inactive' : ''}`}>
              <h4>Step 9: Compute Sum</h4>
              <button 
                onClick={() => handleStepComplete('compute-z')}
                disabled={!isStepEnabled('compute-sum')}
              >
                Compute y
              </button>
            </div>
            <div className={`step ${step === 'compute-z' ? 'active' : ''} ${!isStepEnabled('compute-z') ? 'inactive' : ''}`}>
              <h4>Step 10: Compute z</h4>
              <button 
                onClick={() => handleStepComplete('commit-pedersen')}
                disabled={!isStepEnabled('compute-z')}
              >
                Compute z
              </button>
            </div>
            <div className={`step ${step === 'commit-pedersen' ? 'active' : ''} ${!isStepEnabled('commit-pedersen') ? 'inactive' : ''}`}>
              <h4>Step 11: Commit Pedersen</h4>
              <button 
                onClick={() => handleStepComplete('release-proofs')}
                disabled={!isStepEnabled('commit-pedersen')}
              >
                Commit Com(y,z)
              </button>
            </div>
            <div className={`step ${step === 'release-proofs' ? 'active' : ''} ${!isStepEnabled('release-proofs') ? 'inactive' : ''}`}>
              <h4>Step 12: Release Proofs</h4>
              <button 
                onClick={() => handleStepComplete('verify')}
                disabled={!isStepEnabled('release-proofs')}
              >
                Release All Proofs
              </button>
            </div>
            <div className={`step ${step === 'verify' ? 'active' : ''} ${!isStepEnabled('verify') ? 'inactive' : ''}`}>
              <h4>Step 13: Verification</h4>
              <div className="verification-visual">
                <p>Verifier checking all commitments and proofs...</p>
                <button 
                  onClick={verifyProof}
                  disabled={!isStepEnabled('verify')}
                >
                  Complete Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 