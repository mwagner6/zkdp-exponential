import React, { useState, useEffect } from 'react';

interface MorraAnimationProps {
  onComplete: () => void;
}

const MorraAnimation: React.FC<MorraAnimationProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false); // Track completion
  const totalSteps = 8; // Adjust based on the number of animation steps

  useEffect(() => {
    if (!isFinished && step < totalSteps) { // Only run timers if not finished
      const timer = setTimeout(() => {
        setStep(step + 1);
      }, 500); // Adjust delay between steps
      return () => clearTimeout(timer);
    } else if (!isFinished && step === totalSteps) { // When animation reaches the end
      setIsFinished(true); // Mark as finished
      onComplete(); // Signal parent component
    }
  }, [step, onComplete, totalSteps, isFinished]);

  const getStepClass = (stepIndex: number) => {
    return step >= stepIndex
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-2';
  };

  const getArrowClass = (stepIndex: number) => {
     return step >= stepIndex ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0';
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md border border-gray-200 font-sans text-sm">
       <style>
        {`
          .step-item {
            transition: opacity 0.5s ease-out, transform 0.5s ease-out;
            will-change: opacity, transform;
            transform-origin: center;
          }
          .arrow {
             transition: opacity 0.5s ease-out, transform 0.5s ease-out;
             transform-origin: left;
             will-change: opacity, transform;
          }
          .arrow-right::after {
            content: '→';
            font-size: 1.5em;
            line-height: 1;
          }
          .arrow-left::before {
             content: '←';
             font-size: 1.5em;
             line-height: 1;
          }
        `}
      </style>
      <h3 className="text-lg font-semibold text-center mb-4 text-gray-700">Morra Protocol Visualization</h3>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Curator/Server Column */}
        <div className="flex flex-col items-center gap-3 border-r pr-4">
          <h4 className="font-medium text-gray-600 mb-2">Curator/Servers (k)</h4>

          {/* Step 1: Sample m_k */}
          <div className={`step-item p-2 bg-blue-50 border border-blue-200 rounded w-full text-center ${getStepClass(1)}`}>
            Sample secret 𝑚<sub>k</sub> ← ℤ<sub>q</sub>
          </div>

          {/* Step 3: Pick r_k, compute c_k */}
           <div className={`step-item p-2 bg-blue-50 border border-blue-200 rounded w-full text-center ${getStepClass(3)}`}>
            Pick random 𝑟<sub>k</sub> ∈ ℤ<sub>q</sub><br/>
            Compute 𝑐<sub>k</sub> = g<sup>𝑚<sub>k</sub></sup>h<sup>𝑟<sub>k</sub></sup>
          </div>

          {/* Step 5: Reveal (m_k, r_k) */}
           <div className={`step-item p-2 bg-blue-50 border border-blue-200 rounded w-full text-center ${getStepClass(5)}`}>
             Reveal (𝑚<sub>k</sub>, 𝑟<sub>k</sub>) (reverse order)
          </div>

          {/* Step 7: Compute X, z */}
          <div className={`step-item p-2 bg-blue-50 border border-blue-200 rounded w-full text-center ${getStepClass(7)}`}>
             Compute X = Σ 𝑚<sub>k</sub> mod q<br/>
             Compute z = (X ≤ ⌈q/2⌉) ? 0 : 1
          </div>
        </div>

        {/* Arrows Column */}
        <div className="flex flex-col justify-around h-full mt-10">
           {/* Step 4: Broadcast c_k */}
           <div className={`arrow arrow-right text-blue-500 text-center h-10 mt-5 ${getArrowClass(4)}`}></div>
            {/* Step 6: Reveal (m_k, r_k) Arrow */}
           <div className={`arrow arrow-right text-blue-500 text-center h-10 ${getArrowClass(6)}`}></div>
        </div>


        {/* Verifier Column */}
        <div className="flex flex-col items-center gap-3 border-l pl-4">
          <h4 className="font-medium text-gray-600 mb-2">Verifier</h4>

           {/* Step 2: Placeholder */}
          <div className={`step-item h-10 ${getStepClass(2)}`}></div>

          {/* Step 4: Receive c_k */}
          <div className={`step-item p-2 bg-green-50 border border-green-200 rounded w-full text-center ${getStepClass(4)}`}>
            Receive commitment 𝑐<sub>k</sub>
          </div>


          {/* Step 6: Verify commitment */}
          <div className={`step-item p-2 bg-green-50 border border-green-200 rounded w-full text-center ${getStepClass(6)}`}>
             Receive (𝑚<sub>k</sub>, 𝑟<sub>k</sub>)<br/>
             Verify Com(𝑚<sub>k</sub>, 𝑟<sub>k</sub>) == 𝑐<sub>k</sub>
          </div>

          {/* Step 8: Receive z */}
           <div className={`step-item p-2 bg-green-50 border border-green-200 rounded w-full text-center ${getStepClass(8)}`}>
             Receive public bit z
           </div>
        </div>
      </div>

      {/* Disclaimer Section - shown only when finished */}
      {isFinished && (
        <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-600 text-left space-y-2">
          <h5 className="font-semibold text-gray-700">Note on Public Randomness Generation:</h5>
          <p>
            The interactive Morra protocol shown above is suitable for multi-party computation (MPC) settings where multiple curators participate.
          </p>
          <p>
            In a single-curator setting (like this demo), alternatives exist:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>
              <strong>Random Oracle Model (Fiat-Shamir):</strong> The curator and verifier could post commitments and proofs to a public bulletin board. Public bits are then derived by hashing the board's contents.
            </li>
            <li>
              <strong>External Randomness Beacon:</strong> Trusting an external source like a blockchain-based beacon or a Verifiable Delay Function (VDF) for public randomness.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default MorraAnimation; 