import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import GameNavbar from '../navigation/GameNavbar';
import { Button } from '../ui/button';
import { useCSVReader } from 'react-papaparse';
import MorraAnimation from '../morra/MorraAnimation';

interface GameScreenProps {
  onBack: () => void;
}

interface ClientInput {
  id: number;
  value: number; // 0 or 1
  committed: boolean;
}

interface PedersenCommitment {
  id: number;
  x: number;  // The input value
  r: number;  // Random number
  status: 'pending' | 'committing' | 'committed';
  animationDelay?: number;  // Add animation delay property
}

interface CSVColumn {
  name: string;
  isBinary: boolean;
  values: (number | boolean)[];
  preview: (number | boolean)[];
}

interface CSVResult {
  data: Array<Record<string, string>>;
  errors: unknown[];
  meta: unknown;
}

interface CSVReaderProps {
  getRootProps: () => Record<string, unknown>;
  acceptedFile: File | null;
  ProgressBar: React.ComponentType;
  getRemoveFileProps: () => Record<string, unknown>;
  Remove: React.ComponentType;
}

interface PrivateBit {
  value: number;
  sampledVia: 'uniform' | 'manual' | 'manual probability';
  committed: boolean;
}

interface PublicBit { // Interface for public bits
  value: number;
}

interface NoiseBit { // Interface for noise bits (optional, could reuse PublicBit)
  value: number;
}

// Add state for Step 9: Compute Sum
interface CalculationIntermediateValues {
  sumNoise?: number;
  nbOver2?: number;
  noiseVal?: number;
  originalNoisySumY?: number; // Store the pre-rounded value
}

export default function GameScreen({ onBack }: GameScreenProps) {
  const [clients, setClients] = useState<ClientInput[]>([]);
  const [epsilon, setEpsilon] = useState<number>(1);
  const [delta, setDelta] = useState<number>(0.001);
  const [count, setCount] = useState<number>(0);
  const [displayedClientCount, setDisplayedClientCount] = useState<number>(0);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [pedersenCommitments, setPedersenCommitments] = useState<PedersenCommitment[]>([]);
  const [privateBits, setPrivateBits] = useState<PrivateBit[]>([]);
  const [publicBits, setPublicBits] = useState<PublicBit[]>([]);
  const [noiseBits, setNoiseBits] = useState<NoiseBit[]>([]);
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
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [csvColumns, setCSVColumns] = useState<CSVColumn[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lastDraggedIndex, setLastDraggedIndex] = useState<number | null>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const { CSVReader } = useCSVReader();
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [samplingMethod, setSamplingMethod] = useState<'uniform' | 'manual' | 'probability' | null>(null);
  const [probability, setProbability] = useState<number>(0.5);
  const [isMorraPlaying, setIsMorraPlaying] = useState<boolean>(false);
  const [morraAnimationCompleted, setMorraAnimationCompleted] = useState<boolean>(false);
  const [xorCompleted, setXorCompleted] = useState<boolean>(false);
  const [uniformityConfidenceInterval, setUniformityConfidenceInterval] = useState<string | null>(null);

  // State for Step 9: Compute Sum (y)
  const [noisySumY, setNoisySumY] = useState<number | null>(null);
  const [calculationProgress, setCalculationProgress] = useState<number>(0); // 0: idle, 1: calculating, 2: done
  const [intermediateValues, setIntermediateValues] = useState<CalculationIntermediateValues>({});

  const isStepCompleted = (stepName: string) => {
    return completedSteps.has(stepName);
  };

  // Memoize the step order to prevent recreation on each render
  const stepOrder = useMemo(() => [
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
  ], []);

  // Memoize the step style calculation
  const getStepStyle = useCallback((stepName: string) => {
    const currentIndex = stepOrder.indexOf(step);
    const targetIndex = stepOrder.indexOf(stepName);

    if (targetIndex === currentIndex) {
      return 'bg-white border-2 border-black shadow-lg scale-102';
    } else if (targetIndex < currentIndex || isStepCompleted(stepName)) {
      return 'bg-gray-50 border border-gray-300 opacity-80';
    } else {
      return 'bg-gray-50 border border-gray-200 opacity-50';
    }
  }, [step, stepOrder, isStepCompleted]);

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
    setCompletedSteps(prev => new Set([...prev, step]));
    setStep(nextStep);
  };

  const getStepExplanation = (step: string) => {
    switch (step) {
      case 'input':
        return "In this step, we collect binary inputs (0 or 1) from 1000 clients. Each client's input represents their private data point. The sum of these inputs will be computed privately in later steps using the ZKDP protocol.";
      case 'commit-inputs':
        return "The curator commits to the raw inputs using a Pedersen commitment scheme. This creates a binding but hiding commitment that can be verified later without revealing the actual input.";
      case 'set-epsilon':
        return "The privacy parameters ε (epsilon) and δ (delta) are set to control the level of differential privacy. Epsilon (ε) determines the privacy budget - a smaller ε provides stronger privacy guarantees but may reduce accuracy. Delta (δ) represents the probability of privacy failure - a smaller δ means a lower chance of privacy violation. Together, (ε,δ)-differential privacy provides a rigorous mathematical guarantee that the presence or absence of any individual's data will not significantly affect the output of the computation.";
      case 'sample-bits':
        return "n_b (determined by epsilon) private random bits are sampled. These bits will be used to add DP-noise to the computation.";
      case 'commit-bits':
        return "Clients commit to their private random bits using Pedersen commitments, similar to step 2. This ensures the bits cannot be changed later.";
      case 'prove-binary':
        return "Clients generate zero-knowledge proofs that their committed values are binary (0 or 1). This ensures the integrity of the computation.";
      case 'morra':
        return "A secure multi-party computation protocol (Morra) is used to generate public random bits that will be combined with the private bits.";
      case 'xor-bits':
        return "The private and public bits are XORed together. This step helps in adding the necessary noise for differential privacy.";
      case 'compute-sum':
        return "The sum of the noisy inputs is computed. The noise ensures differential privacy while maintaining reasonable accuracy.";
      case 'compute-z':
        return "An auxiliary value z is computed to help in verifying the correctness of the computation without revealing private inputs.";
      case 'commit-pedersen':
        return "The final result and auxiliary value are committed using Pedersen commitments for verification.";
      case 'release-proofs':
        return "All necessary zero-knowledge proofs are released to allow verification of the computation's correctness.";
      case 'verify':
        return "The verifier checks all commitments and proofs to ensure the computation was performed correctly while maintaining privacy.";
      default:
        return "";
    }
  };

  const StepHeader = ({ step, title }: { step: string, title: string }) => (
    <div className="flex items-center justify-center gap-2 mb-5">
      <h4 className="m-0 text-gray-700 text-xl">{title}</h4>
      <div className="tooltip">
        <button className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold hover:bg-gray-800">i</button>
        <div className="tooltiptext w-96">
          <div className="text-sm text-left p-2">
            {getStepExplanation(step)}
          </div>
        </div>
      </div>
    </div>
  );

  // Optimize the handleCommitInputs function
  const handleCommitInputs = useCallback(() => {
    if (isCommitting || clients.length === 0) return;
    setIsCommitting(true);

    // Create all commitments at once with animation delays
    const newCommitments: PedersenCommitment[] = clients.map((client, index) => ({
      id: client.id,
      x: client.value,
      r: Math.floor(Math.random() * 1000000),
      status: 'pending',
      animationDelay: (index / clients.length) * 2
    }));

    // Update state once with all commitments
    setPedersenCommitments(newCommitments);
    
    // Set a timeout to mark all commitments as committed after animations
    setTimeout(() => {
      setPedersenCommitments(prev => 
        prev.map(commit => ({ ...commit, status: 'committed' }))
      );
      setIsCommitting(false);
      handleStepComplete('set-epsilon');
    }, 1000);
  }, [isCommitting, clients, handleStepComplete]);

  // Generate and verify the proof
  const verifyProof = () => {
    // In a real implementation, this would generate a proper zero-knowledge proof
    handleStepComplete('verify');
  };

  // Define the component that renders a single cell in the virtualized grid
  const Cell = useCallback(({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
    const numCols = 50;
    const index = rowIndex * numCols + columnIndex;

    if (index >= pedersenCommitments.length) {
      return null;
    }

    const commit = pedersenCommitments[index];

    return (
      <div style={style}>
        <div
          className={`w-full h-full transition-all duration-300 relative flex items-center justify-center tooltip ${
            commit.status === 'pending' ? 'bg-gray-200 opacity-0' :
            commit.status === 'committing' ? 'bg-blue-400 animate-pulse' :
            'bg-green-500'
          }`}
          style={{
            animation: commit.status === 'pending' ? `fadeIn 0.3s ease-in-out forwards` : 'none',
            animationDelay: `${commit.animationDelay}s`
          }}
        >
          <span className="text-[12px] font-mono text-black">
            <span style={{ position: 'relative', display: 'inline-block' }}>
              c
              <span style={{ position: 'absolute', bottom: '-0.5em', left: '0.5em', fontSize: '0.7em' }}>{index}</span>
            </span>
          </span>
          <div className="tooltiptext">
            <div className="text-sm whitespace-nowrap">
              <div>Client {index + 1}:</div>
              <div>Bit: {commit.x}</div>
              <div>Random r: {commit.r}</div>
              <div>Commitment: g<sup>{commit.x}</sup>h<sup>{commit.r}</sup></div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [pedersenCommitments]);

  const PrivateBitsCell = useCallback(({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
    const numCols = 50;
    const index = rowIndex * numCols + columnIndex;

    if (index >= privateBits.length) {
      return null;
    }

    const bit = privateBits[index];
    const isCommitted = bit.committed;
    const r = Math.floor(Math.random() * 1000000); // Random number for Pedersen commitment

    return (
      <div style={style}>
        <div
          className={`w-full h-full transition-all duration-300 relative flex items-center justify-center tooltip ${
            !isCommitted ? 'bg-gray-200 opacity-0' :
            isCommitting ? 'bg-gray-400 animate-pulse' :
            'bg-green-500'
          }`}
          style={{
            animation: !isCommitted ? `fadeIn 0.3s ease-in-out forwards` : 'none',
            animationDelay: `${(index / privateBits.length) * 2}s`
          }}
        >
          <span className="text-[12px] font-mono text-black">
            <span style={{ position: 'relative', display: 'inline-block' }}>
              c
              <span style={{ position: 'absolute', top: '-0.5em', left: '0.5em', fontSize: '0.7em' }}>'</span>
              <span style={{ position: 'absolute', bottom: '-0.5em', left: '0.5em', fontSize: '0.7em' }}>{index}</span>
            </span>
          </span>
          <div className="tooltiptext">
            <div className="text-sm whitespace-nowrap">
              <div>Bit {index + 1}:</div>
              <div>Value: {bit.value}</div>
              <div>Sampled via: {bit.sampledVia}</div>
              {isCommitted && (
                <>
                  <div>Random r: {r}</div>
                  <div>Commitment: g<sup>{bit.value}</sup>h<sup>{r}</sup></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [privateBits, isCommitting]);

  const handleCommitPrivateBits = useCallback(() => {
    if (isCommitting || privateBits.length === 0) return;
    setIsCommitting(true);

    // Mark all bits as committed
    setPrivateBits(prev => 
      prev.map(bit => ({ ...bit, committed: true }))
    );
    
    // Set a timeout to complete the step after animations
    setTimeout(() => {
      setIsCommitting(false);
      handleStepComplete('prove-binary');
    }, 1000);
  }, [isCommitting, privateBits, handleStepComplete]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCSVUpload = (results: CSVResult) => {
    console.log('CSV upload started', results);
    setIsParsing(true);
    setParseError(null);
    
    try {
      if (results.data && results.data.length > 0) {
        console.log('CSV data received, rows:', results.data.length);
        
        // Get headers from the first row
        const headers = Object.keys(results.data[0]);
        console.log('Headers found:', headers);

        const columns: CSVColumn[] = headers.map((header: string) => {
          // Get all values for this column
          const values = results.data.map((row: Record<string, string>) => {
            const value = row[header];
            // Try to parse as number
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              return numValue;
            }
            // Try to parse as boolean
            const lowerValue = value.toLowerCase();
            if (lowerValue === 'true' || lowerValue === 'false') {
              return lowerValue === 'true';
            }
            // If not a number or boolean, skip this value
            return 0;
          });

          // Check if column is binary (only contains true/false or 0/1)
          const isBinary = values.every((v: number | boolean) => 
            v === true || v === false || v === 0 || v === 1
          );

          // Take first 5 values for preview
          const preview = values.slice(0, 5);

          return {
            name: header,
            isBinary,
            values: values as (number | boolean)[],
            preview
          };
        });

        console.log('Columns processed:', columns.length);
        setCSVColumns(columns);
      } else {
        console.error('No data found in CSV');
        setParseError('No data found in CSV file');
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setParseError('Error parsing CSV file: ' + (error as Error).message);
    } finally {
      setIsParsing(false);
    }
  };

  const processSelectedColumn = () => {
    if (!selectedColumn) return;

    const column = csvColumns.find(col => col.name === selectedColumn);
    if (!column) return;

    const newClients: ClientInput[] = column.values.map((value, index) => {
      let binaryValue: number;
      if (column.isBinary) {
        binaryValue = value === true || value === 1 ? 1 : 0;
      } else {
        binaryValue = (value as number) >= threshold ? 1 : 0;
      }

      return {
        id: index + 1,
        value: binaryValue,
        committed: true
      };
    });

    setClients(newClients);
    setCount(newClients.reduce((sum, client) => sum + client.value, 0));
    setDisplayedClientCount(newClients.length);
    handleStepComplete('commit-inputs');
  };

  // Add function to calculate n_b based on epsilon
  const calculateNB = (epsilon: number) => {
    // From Lemma 2.7 in the paper: n_b = (10/epsilon)^2 * ln(2/delta)
    return Math.ceil(Math.pow(10 / epsilon, 2) * Math.log(2 / delta));
  };

  // Add event listeners for mouse up outside the grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setLastDraggedIndex(null);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleBitMouseDown = useCallback((index: number) => {
    setIsDragging(true);
    setLastDraggedIndex(index);
    // Toggle the bit value
    setPrivateBits(prev => {
      const newBits = [...prev];
      newBits[index] = {
        ...newBits[index],
        value: newBits[index].value === 1 ? 0 : 1
      };
      return newBits;
    });
  }, []);

  const handleBitMouseEnter = useCallback((index: number) => {
    if (isDragging && lastDraggedIndex !== null) {
      // Toggle all bits between lastDraggedIndex and current index
      setPrivateBits(prev => {
        const newBits = [...prev];
        const start = Math.min(lastDraggedIndex, index);
        const end = Math.max(lastDraggedIndex, index);
        for (let i = start; i <= end; i++) {
          newBits[i] = {
            ...newBits[i],
            value: newBits[lastDraggedIndex].value
          };
        }
        return newBits;
      });
    }
  }, [isDragging, lastDraggedIndex]);

  const handleBitMouseUp = useCallback(() => {
    setIsDragging(false);
    setLastDraggedIndex(null);
  }, []);

  const PrivateBitsGrid = useCallback(() => {
    if (privateBits.length === 0) return null;

    return (
      <div className="w-full flex flex-col items-center gap-4 mt-4">
        <div className="w-[1200px] border rounded-lg shadow-sm bg-white p-4">
          {privateBits[0]?.sampledVia === 'manual' ? (
            <div className="grid grid-cols-[repeat(100,minmax(0,1fr))] gap-0">
              {privateBits.map((bit, index) => (
                <div
                  key={index}
                  className={`aspect-square text-white flex items-center justify-center tooltip cursor-pointer ${
                    bit.value === 1 ? 'bg-blue-700' : 'bg-blue-500'
                  }`}
                  style={{ minWidth: '20px', minHeight: '20px' }}
                  onMouseDown={() => handleBitMouseDown(index)}
                  onMouseEnter={() => handleBitMouseEnter(index)}
                  onMouseUp={handleBitMouseUp}
                >
                  <span className={`text-[8px] font-mono ${bit.value === 1 ? 'text-white' : 'text-blue-700'}`}>{bit.value}</span>
                  <div className="tooltiptext">
                    <div className="text-sm whitespace-nowrap">
                      <div>Bit {index + 1}:</div>
                      <div>Value: {bit.value}</div>
                      <div>Sampled via: {bit.sampledVia}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(100,minmax(0,1fr))] gap-0">
              {privateBits.map((bit, index) => (
                <div
                  key={index}
                  className={`aspect-square text-white flex items-center justify-center tooltip ${
                    bit.value === 1 ? 'bg-blue-700' : 'bg-blue-500'
                  }`}
                  style={{ minWidth: '20px', minHeight: '20px' }}
                >
                  <span className={`text-[8px] font-mono ${bit.value === 1 ? 'text-white' : 'text-blue-700'}`}>{bit.value}</span>
                  <div className="tooltiptext">
                    <div className="text-sm whitespace-nowrap">
                      <div>Bit {index + 1}:</div>
                      <div>Value: {bit.value}</div>
                      <div>Sampled via: {bit.sampledVia}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }, [privateBits, isDragging, lastDraggedIndex, handleBitMouseDown, handleBitMouseEnter, handleBitMouseUp]);

  const handleUniformSample = () => {
    const n_b = calculateNB(epsilon);
    const newBits = Array(n_b).fill(0).map(() => ({
      value: Math.random() < 0.5 ? 1 : 0,
      sampledVia: 'uniform' as const,
      committed: false
    }));
    setPrivateBits(newBits);
    setSamplingMethod('uniform');
  };

  const handleManualSet = () => {
    const n_b = calculateNB(epsilon);
    const newBits = Array(n_b).fill(0).map(() => ({
      value: 0,
      sampledVia: 'manual' as const,
      committed: false
    }));
    setPrivateBits(newBits);
    setSamplingMethod('manual');
  };

  const handleProbabilitySet = () => {
    const n_b = calculateNB(epsilon);
    const newBits = Array(n_b).fill(0).map(() => ({
      value: Math.random() < probability ? 1 : 0,
      sampledVia: 'manual probability' as const,
      committed: false
    }));
    setPrivateBits(newBits);
    setSamplingMethod('probability');
  };

  const handleConfirmPrivateBits = () => {
    handleStepComplete('commit-bits');
  };

  const resetSamplingMethod = () => {
    setSamplingMethod(null);
    setPrivateBits([]);
  };

  const handlePlayMorra = () => {
    setIsMorraPlaying(true);
    setMorraAnimationCompleted(false);
  };

  const handleMorraComplete = () => {
    setMorraAnimationCompleted(true);
    // Generate n_b public bits when Morra completes
    const n_b = calculateNB(epsilon);
    const generatedPublicBits = Array(n_b).fill(0).map(() => ({
      value: Math.random() < 0.5 ? 1 : 0,
    }));
    setPublicBits(generatedPublicBits);
  };

  // New component for Public Bits Grid
  const PublicBitsGrid = useCallback(() => {
    if (publicBits.length === 0) return null;

    const numCols = 100; // Keep consistent with PrivateBitsGrid
    const gridWidth = 1200; // Keep consistent

    return (
      <div className="w-full flex flex-col items-center gap-4 mt-4">
         <h4 className="text-md font-semibold text-gray-700">Generated Public Bits (z<sub>i</sub>) (uniformly random)</h4>
         <div className={`w-[${gridWidth}px] border rounded-lg shadow-sm bg-white p-4`}>
          <div className={`grid grid-cols-[repeat(${numCols},minmax(0,1fr))] gap-0`}>
            {publicBits.map((bit, index) => (
              <div
                key={index}
                className={`aspect-square text-white flex items-center justify-center tooltip ${
                  bit.value === 1 ? 'bg-green-700' : 'bg-green-500' // Use green theme
                }`}
                style={{ minWidth: '20px', minHeight: '20px' }} // Consistent size
              >
                <span className={`text-[8px] font-mono ${bit.value === 1 ? 'text-white' : 'text-green-700'}`}>{bit.value}</span>
                <div className="tooltiptext">
                  <div className="text-sm whitespace-nowrap">
                    <div>Public Bit {index + 1}:</div>
                    <div>Value: {bit.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [publicBits]);

  const handleComputeXOR = () => {
    if (privateBits.length === 0 || publicBits.length === 0 || privateBits.length !== publicBits.length) {
      console.error("Cannot compute XOR: Bit arrays mismatch or empty.");
      return;
    }
    const resultBits = privateBits.map((privateBit, index) => ({
      value: privateBit.value ^ publicBits[index].value,
    }));
    setNoiseBits(resultBits);
    setXorCompleted(true);
  };

  // Add useEffect to calculate uniformity confidence interval
  useEffect(() => {
    if (xorCompleted && noiseBits.length > 0) {
      const n = noiseBits.length;
      const count1 = noiseBits.reduce((sum, bit) => sum + bit.value, 0);
      const pHat = count1 / n;

      // Check if sample size is large enough for Wald interval approximation
      // (np >= 5 and n(1-p) >= 5 is a common rule of thumb)
      if (n > 0 && n * pHat >= 5 && n * (1 - pHat) >= 5) {
        const z = 1.96; // For 95% confidence
        const marginOfError = z * Math.sqrt(pHat * (1 - pHat) / n);
        const lowerBound = Math.max(0, pHat - marginOfError);
        const upperBound = Math.min(1, pHat + marginOfError);
        setUniformityConfidenceInterval(`95% CI for proportion of 1s: [${lowerBound.toFixed(3)}, ${upperBound.toFixed(3)}]`);
      } else if (n > 0) {
          // If sample size is too small, just report the observed proportion
          setUniformityConfidenceInterval(`Observed proportion of 1s: ${pHat.toFixed(3)} (Sample size too small for reliable 95% CI)`);
      } else {
          setUniformityConfidenceInterval("No noise bits to analyze.");
      }
    } else {
      setUniformityConfidenceInterval(null); // Reset if not completed or no bits
    }
  }, [noiseBits, xorCompleted]);

  // Reusable Static Bit Grid Component for Step 8 display
  const StaticBitGrid = ({ bits, label, colorTheme }: { bits: {value: number}[], label: string, colorTheme: 'blue' | 'green' }) => {
    if (!bits || bits.length === 0) return null;

    const numCols = 100;
    const gridWidth = 1200;
    const bgColor = colorTheme === 'blue'
      ? (val: number) => (val === 1 ? 'bg-blue-700' : 'bg-blue-500')
      : (val: number) => (val === 1 ? 'bg-green-700' : 'bg-green-500');
    const textColor = colorTheme === 'blue'
      ? (val: number) => (val === 1 ? 'text-white' : 'text-blue-700')
      : (val: number) => (val === 1 ? 'text-white' : 'text-green-700');


    return (
      <div className="w-full flex flex-col items-center gap-2 mt-4">
        <h4 className="text-md font-semibold text-gray-700">{label}</h4>
        <div className={`w-[${gridWidth}px] max-h-[300px] overflow-y-auto border rounded-lg shadow-sm bg-white p-4`}>
          <div className={`grid grid-cols-[repeat(${numCols},minmax(0,1fr))] gap-0`}>
            {bits.map((bit, index) => (
              <div
                key={index}
                className={`aspect-square flex items-center justify-center ${bgColor(bit.value)}`}
                style={{ minWidth: '20px', minHeight: '20px' }}
              >
                <span className={`text-[8px] font-mono ${textColor(bit.value)}`}>{bit.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Handler for Step 9: Compute Sum (y)
  const handleComputeSumY = () => {
    if (calculationProgress !== 0 || noiseBits.length === 0) return;

    setCalculationProgress(1);
    setNoisySumY(null);
    setIntermediateValues({});

    // Simulate calculation steps with delays for animation
    setTimeout(() => {
      // Step 9.1: Sum of Noise Bits
      const sumNoise = noiseBits.reduce((sum, bit) => sum + bit.value, 0);
      setIntermediateValues(prev => ({ ...prev, sumNoise }));
      
      setTimeout(() => {
        // Step 9.2: Calculate n_b / 2
        const n_b = calculateNB(epsilon);
        const nbOver2 = n_b / 2;
        setIntermediateValues(prev => ({ ...prev, nbOver2 }));

        setTimeout(() => {
          // Step 9.3: Calculate Noise Value
          const noiseVal = sumNoise - nbOver2;
          setIntermediateValues(prev => ({ ...prev, noiseVal }));

          setTimeout(() => {
            // Step 9.4: Calculate Noisy Sum y
            const originalY = count + noiseVal;
            const finalY = Math.ceil(originalY); // Round up
            setIntermediateValues(prev => ({ ...prev, noiseVal, originalNoisySumY: originalY }));
            setNoisySumY(finalY);

            setTimeout(() => {
              // Step 9.5: Mark calculation as done
              setCalculationProgress(2);
            }, 700); // Delay before marking done
          }, 700); // Delay before showing final sum
        }, 700); // Delay before showing noise value
      }, 700); // Delay before showing nb/2
    }, 500); // Initial delay
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          @keyframes revealProof {
            0% {
              background-color: rgb(156, 163, 175);
            }
            100% {
              background-color: rgb(34, 197, 94); /* Green */
            }
          }
          @keyframes hideEllipsis {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes showProofResult {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          .tooltip {
            position: relative;
            display: inline-block;
          }

          .tooltip .tooltiptext {
            visibility: hidden;
            background-color: #333;
            color: #fff;
            text-align: left;
            padding: 8px;
            border-radius: 6px;
            position: absolute;
            z-index: 9999;
            bottom: 125%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.3s;
            min-width: 120px;
            pointer-events: none;
          }

          .tooltip:hover .tooltiptext {
            visibility: visible;
            opacity: 1;
          }

          .tooltip .tooltiptext::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #333 transparent transparent transparent;
          }

          .pedersen-grid-container {
            scrollbar-width: thin;
            scrollbar-color: #888 #f1f1f1;
          }

          .pedersen-grid-container::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          .pedersen-grid-container::-webkit-scrollbar-track {
            background: #f1f1f1;
          }

          .pedersen-grid-container::-webkit-scrollbar-thumb {
            background-color: #888;
            border-radius: 4px;
          }

          .drop-zone {
            border: 2px dashed #ccc;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
          }

          .drop-zone.dragging {
            border-color: #666;
            background-color: #f0f0f0;
          }

          .fade-in-step {
            animation: fadeIn 0.5s ease-in-out forwards;
            opacity: 0;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
      <GameNavbar onBack={onBack} />
      <div className="flex-1 p-5 overflow-y-auto mt-16">
        <div className="p-4 bg-white rounded-lg shadow-sm mx-auto min-w-[1000px] w-full">
          <h3 className="text-xl font-bold mb-4">Differentially Private Computation</h3>
          <div className="flex flex-col gap-8 my-5 p-3">
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('input')}`}>
              <StepHeader step="input" title="Step 1: Input Collection" />
              <div className="flex flex-col items-center gap-4">
                <CSVReader
                  onUploadAccepted={handleCSVUpload}
                  config={{
                    header: true,
                    skipEmptyLines: true
                  }}
                >
                  {({ getRootProps, acceptedFile, ProgressBar, getRemoveFileProps }: CSVReaderProps) => (
                    <div className="w-full">
                      <div
                        {...getRootProps()}
                        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                        onDragEnter={() => setIsDragging(true)}
                        onDragLeave={() => setIsDragging(false)}
                      >
                        {acceptedFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <p className="text-lg">{acceptedFile.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(acceptedFile.size)}
                            </p>
                            <ProgressBar />
                            {isParsing && (
                              <div className="mt-2 text-blue-500">
                                Parsing CSV...
                              </div>
                            )}
                            {parseError && (
                              <div className="mt-2 text-red-500">
                                {parseError}
                              </div>
                            )}
                            <div {...getRemoveFileProps()}>
                              <Button variant="outline" size="sm">
                                Remove File
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-lg">Drag and drop a CSV file here, or click to select</p>
                        )}
                      </div>
                    </div>
                  )}
                </CSVReader>

                {csvColumns.length > 0 && !isParsing && (
                  <div className="w-full max-w-4xl mx-auto mt-4">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Column to Process
                      </label>
                      <div className="relative">
                        <div className="flex gap-3 overflow-x-auto pb-4 h-[200px] snap-x snap-mandatory scroll-smooth">
                          {csvColumns.map((column) => (
                            <div
                              key={column.name}
                              onClick={() => setSelectedColumn(column.name)}
                              className={`flex-shrink-0 w-48 p-3 rounded-lg border cursor-pointer transition-all snap-start ${
                                selectedColumn === column.name
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900 text-sm truncate" title={column.name}>
                                  {column.name}
                                </h4>
                                {column.isBinary && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                    Binary
                                  </span>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                {column.preview.map((value, index) => (
                                  <div key={index} className="text-xs text-gray-600 truncate">
                                    {typeof value === 'boolean' ? value.toString() : value}
                                  </div>
                                ))}
                                {column.values.length > 5 && (
                                  <div className="text-xs text-gray-500 space-y-1">
                                    <div>+{column.values.length - 5} more values</div>
                                    {!column.isBinary && (
                                      <div className="text-gray-600">
                                        Range: {Math.min(...column.values as number[])} to {Math.max(...column.values as number[])}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white to-transparent pointer-events-none opacity-50" />
                        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white to-transparent pointer-events-none opacity-50" />
                      </div>
                      <div className="flex justify-center mt-2">
                        <div className="text-xs text-gray-500">
                          Scroll horizontally to see more columns
                        </div>
                      </div>
                    </div>

                    {selectedColumn && !csvColumns.find(col => col.name === selectedColumn)?.isBinary && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Set Threshold Value
                        </label>
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                            className="flex-1 px-3 py-2 border rounded-md"
                          />
                          <div className="text-sm text-gray-500">
                            Values ≥ {threshold} will be converted to 1, others to 0
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={processSelectedColumn}
                      className="w-full"
                      disabled={!selectedColumn || step !== 'input'}
                    >
                      Process Selected Column
                    </Button>
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded text-lg font-bold text-blue-500 transition-all relative" ref={countRef}>
                  <div className="relative inline-block group">
                    Client count: {displayedClientCount} | Hidden count sum: {count}
                    <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-300 bottom-full left-1/2 transform -translate-x-1/2 z-10 bg-gray-800 text-white text-left p-2 rounded-lg min-w-[120px] mb-2">
                      <div className="max-h-40 overflow-y-auto">
                        {clients.length === 0 ? (
                          <div className="text-sm">No client data processed yet!</div>
                        ) : (
                          clients.map((client, index) => (
                            <div key={client.id} className="text-sm">
                              Client {index + 1}: +{client.value}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('commit-inputs')}`}>
              <StepHeader step="commit-inputs" title="Step 2: Commit Client Inputs" />
              <div className="flex flex-col items-center gap-4">
                {isCommitting ? <p className="m-0 mb-5 text-gray-600 text-lg">Committing all raw inputs...</p> : null}
                <div className="w-full mb-4">
                  {pedersenCommitments.length > 0 && (
                    <div className="w-full flex justify-center">
                      <div className="w-[600px] h-[600px] overflow-y-auto border rounded-lg shadow-sm bg-white">
                        <Grid
                          className="pedersen-grid-container"
                          columnCount={50}
                          columnWidth={30}
                          rowCount={Math.ceil(pedersenCommitments.length / 50)}
                          rowHeight={30}
                          width={600}
                          height={600}
                        >
                          {Cell}
                        </Grid>
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-full flex justify-center">
                  <Button 
                    onClick={handleCommitInputs}
                    disabled={!isStepEnabled('commit-inputs') || clients.length === 0 || isCommitting || step !== 'commit-inputs'}
                    className="w-1/2 py-6 text-lg"
                  >
                    {isCommitting ? 'Committing...' : 'Commit Inputs'}
                  </Button>
                </div>
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('set-epsilon')}`}>
              <StepHeader step="set-epsilon" title="Step 3: Set Privacy Parameters" />
              <div className="text-sm text-gray-600 mb-4">
                Formula: n<sub>b</sub> = (10/ε)² × ln(2/δ)
              </div>
              <div className="flex flex-col items-center gap-5 w-full my-5">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <label className="text-sm text-gray-600">Epsilon (ε)</label>
                    <input 
                      type="number" 
                      min="0.1" 
                      max="5" 
                      step="0.1" 
                      value={epsilon} 
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0.1 && value <= 5) {
                          setEpsilon(value);
                        }
                      }}
                      className="w-32 px-3 py-2 border rounded-md text-center"
                    />
                    <span className="text-xl font-bold text-blue-500 px-4 py-1 bg-blue-50 rounded">ε = {epsilon}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <label className="text-sm text-gray-600">Delta (δ)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="1" 
                      step="0.001" 
                      value={delta} 
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= 1) {
                          setDelta(value);
                        }
                      }}
                      className="w-32 px-3 py-2 border rounded-md text-center"
                    />
                    <span className="text-xl font-bold text-blue-500 px-4 py-1 bg-blue-50 rounded">δ = {delta}</span>
                  </div>
                </div>
                {isStepCompleted('set-epsilon') && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="text-lg font-semibold text-blue-700">
                      Calculated n<sub>b</sub> = {calculateNB(epsilon).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      This is the number of private random bits that will be sampled in the next step
                    </div>
                  </div>
                )}
              </div>
              <Button 
                onClick={() => handleStepComplete('sample-bits')}
                disabled={!isStepEnabled('set-epsilon') || !isStepCompleted('commit-inputs') || step !== 'set-epsilon'}
              >
                Confirm Privacy Parameters
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('sample-bits')}`}>
              <StepHeader step="sample-bits" title="Step 4: Sample Private Bits" />
              <div className="flex flex-col items-center gap-4">
                <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mx-auto">
                  <Button 
                    onClick={handleUniformSample}
                    disabled={!isStepEnabled('sample-bits') || !isStepCompleted('set-epsilon') || step !== 'sample-bits' || samplingMethod !== null}
                    className={`w-full py-4 ${samplingMethod === 'uniform' ? 'bg-black' : ''}`}
                  >
                    Uniformly Sample Private Bits
                  </Button>
                  <Button 
                    onClick={handleManualSet}
                    disabled={!isStepEnabled('sample-bits') || !isStepCompleted('set-epsilon') || step !== 'sample-bits' || samplingMethod !== null}
                    className={`w-full py-4 bg-red-500 hover:bg-red-600 ${samplingMethod === 'manual' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                  >
                    Manually Set Private Bits
                  </Button>
                  <Button 
                    onClick={handleProbabilitySet}
                    disabled={!isStepEnabled('sample-bits') || !isStepCompleted('set-epsilon') || step !== 'sample-bits' || samplingMethod !== null}
                    className={`w-full py-4 bg-red-500 hover:bg-red-600 ${samplingMethod === 'probability' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                  >
                    Set Probability Distribution
                  </Button>
                </div>
                {samplingMethod && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex justify-center gap-4">
                      <Button
                        onClick={resetSamplingMethod}
                        variant="outline"
                        className="text-sm"
                      >
                        Reset Sampling Method
                      </Button>
                      <Button
                        onClick={handleConfirmPrivateBits}
                        className="text-sm"
                        disabled={!privateBits.length}
                      >
                        Confirm Private Bits
                      </Button>
                    </div>
                    {samplingMethod === 'manual' && (
                      <div className="text-gray-600 text-lg">
                        Click and drag to modify bits
                      </div>
                    )}
                    {samplingMethod === 'probability' && (
                      <div className="flex flex-col items-center gap-4 w-full max-w-md">
                        <div className="w-full">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Probability of 1: {probability.toFixed(2)}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={probability}
                            onChange={(e) => {
                              setProbability(parseFloat(e.target.value));
                              const n_b = calculateNB(epsilon);
                              const newBits = Array(n_b).fill(0).map(() => ({
                                value: Math.random() < parseFloat(e.target.value) ? 1 : 0,
                                sampledVia: 'manual probability' as const,
                                committed: false
                              }));
                              setPrivateBits(newBits);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <PrivateBitsGrid />
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('commit-bits')}`}>
              <StepHeader step="commit-bits" title="Step 5: Commit Private Bits" />
              <div className="flex flex-col items-center gap-4">
                {isCommitting ? <p className="m-0 mb-5 text-gray-600 text-lg">Committing all private bits...</p> : null}
                <div className="w-full mb-4">
                  {privateBits.length > 0 && (
                    <div className="w-full flex justify-center">
                      <div className="w-[600px] h-[600px] overflow-y-auto border rounded-lg shadow-sm bg-white">
                        <Grid
                          className="pedersen-grid-container"
                          columnCount={50}
                          columnWidth={30}
                          rowCount={Math.ceil(privateBits.length / 50)}
                          rowHeight={30}
                          width={600}
                          height={600}
                        >
                          {PrivateBitsCell}
                        </Grid>
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-full flex justify-center">
                  <Button 
                    onClick={handleCommitPrivateBits}
                    disabled={!isStepEnabled('commit-bits') || privateBits.length === 0 || isCommitting || step !== 'commit-bits'}
                    className="w-1/2 py-6 text-lg"
                  >
                    {isCommitting ? 'Committing...' : 'Commit Private Bits'}
                  </Button>
                </div>
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('prove-binary')}`}>
              <StepHeader step="prove-binary" title="Step 6: Prove Binary Values to the Verifier" />
              <div className="flex flex-col items-center gap-4">
                <div className="w-full flex justify-center">
                  <Button 
                    onClick={() => handleStepComplete('morra')}
                    disabled={!isStepEnabled('prove-binary') || !isStepCompleted('commit-bits') || step !== 'prove-binary'}
                    className="w-1/2 py-6 text-lg"
                  >
                    Generate Sigma-OR Proofs
                  </Button>
                </div>
                {isStepCompleted('prove-binary') && (
                  <div className="w-full mb-4">
                    <div className="w-full flex justify-center">
                      <div className="w-[600px] h-[600px] overflow-y-auto border rounded-lg shadow-sm bg-white">
                        <Grid
                          className="pedersen-grid-container"
                          columnCount={50}
                          columnWidth={30}
                          rowCount={Math.ceil(privateBits.length / 50)}
                          rowHeight={30}
                          width={600}
                          height={600}
                        >
                          {({ columnIndex, rowIndex, style }) => {
                            const numCols = 50;
                            const index = rowIndex * numCols + columnIndex;
                            if (index >= privateBits.length) return null;
                            const bit = privateBits[index];
                            return (
                              <div key={index} style={style}>
                                <div
                                  className="w-full h-full transition-all duration-300 relative flex items-center justify-center tooltip"
                                  style={{
                                    animation: `fadeIn 0.3s ease-in-out forwards, revealProof 0.3s ease-in-out forwards`,
                                    animationDelay: `${(index / privateBits.length) * 2}s, ${(index / privateBits.length) * 2 + 0.3}s`,
                                    backgroundColor: 'rgb(156, 163, 175)'
                                  }}
                                >
                                  <span
                                    className="text-[12px] font-mono text-white absolute"
                                    style={{
                                      animation: `hideEllipsis 0.1s ease-in-out forwards`,
                                      animationDelay: `${(index / privateBits.length) * 2 + 0.3}s`,
                                      opacity: 1
                                    }}
                                  >
                                    ...
                                  </span>
                                  <span
                                    className="text-[12px] font-mono text-white absolute"
                                    style={{
                                      animation: `showProofResult 0.1s ease-in-out forwards`,
                                      animationDelay: `${(index / privateBits.length) * 2 + 0.3}s`,
                                      opacity: 0
                                    }}
                                  >
                                    1
                                  </span>
                                  <div className="tooltiptext">
                                    <div className="text-sm whitespace-nowrap">
                                      <div>Bit {index + 1}:</div>
                                      <div>Actual Value: {bit.value}</div>
                                      <div>ZK Proof: Valid</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        </Grid>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
                  <p className="mb-2">In this step, we use a zero-knowledge proof system to verify that the computation was performed correctly while maintaining privacy. The protocol ensures that the noise added for differential privacy was generated faithfully, without revealing the actual noise values.</p>
                  <p>The verifier checks that each commitment corresponds to a valid binary value (0 or 1) using the Sigma-OR protocol. For each commitment c_i, the prover demonstrates knowledge of either the opening (0, r_i) or (1, r_i') without revealing which one, where r_i and r_i' are the random values used in the Pedersen commitment scheme.</p>
                </div>
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-center items-center min-h-[200px] ${getStepStyle('morra')}`}>
              <StepHeader step="morra" title="Step 7: Generate Public Randomness (Morra)" />
              {!isMorraPlaying && !morraAnimationCompleted ? (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-gray-600 mb-4">
                    Run the Morra protocol with the verifier to generate public, unbiased random bits.
                  </p>
                  <Button
                    onClick={handlePlayMorra}
                    disabled={!isStepEnabled('morra') || !isStepCompleted('prove-binary') || step !== 'morra'}
                  >
                    Start Morra Protocol
                  </Button>
                </div>
              ) : (
                <MorraAnimation onComplete={handleMorraComplete} />
              )}

              {/* Show Public Bits Grid after animation is complete, regardless of subsequent step */}
              {morraAnimationCompleted && (
                <PublicBitsGrid />
              )}

              {/* Show Proceed button only after animation is complete AND we are still in the morra step */}
              {morraAnimationCompleted && step === 'morra' && (
                 <Button
                   onClick={() => handleStepComplete('xor-bits')}
                   disabled={step !== 'morra'}
                   className="mt-4" // Add margin top to separate from grid
                 >
                   Proceed to Step 8: XOR Bits
                 </Button>
              )}
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-center items-center min-h-[200px] ${getStepStyle('xor-bits')}`}>
              <StepHeader step="xor-bits" title="Step 8: XOR Private & Public Bits (bᵢ = b'ᵢ ⊕ zᵢ)" />
              <div className="flex flex-col items-center gap-4 w-full">
                {/* Render grids only when step is reached or passed */}
                {stepOrder.indexOf(step) >= stepOrder.indexOf('xor-bits') && (
                  <>
                    <StaticBitGrid
                      bits={privateBits}
                      label="Private Random Bits (b'ᵢ from Step 4)"
                      colorTheme="blue"
                    />
                    <StaticBitGrid
                      bits={publicBits}
                      label="Public Random Bits (zᵢ from Step 7)"
                      colorTheme="green"
                    />

                    <div className="flex items-center justify-center gap-4 my-4">
                       <span className="text-4xl font-bold text-gray-600">⊕</span>
                       <Button
                         onClick={handleComputeXOR}
                         disabled={xorCompleted || privateBits.length === 0 || publicBits.length === 0 || privateBits.length !== publicBits.length || step !== 'xor-bits'}
                         className="px-6 py-3 text-lg"
                       >
                         {xorCompleted ? "XOR Computed" : "Compute XOR"}
                       </Button>
                     </div>
                  </>
                 )}

                 {/* Render noise bits only after XOR is done */}
                 {xorCompleted && (
                   <>
                     <StaticBitGrid
                       bits={noiseBits}
                       label="Resulting Private Noise Bits (bᵢ = b'ᵢ ⊕ zᵢ)"
                       colorTheme="blue" // Noise bits are also private
                     />
                     {uniformityConfidenceInterval && (
                        <div className="mt-4 text-sm text-gray-600 p-2 bg-gray-50 rounded border w-full max-w-[1200px] text-center">
                          <strong>Uniformity Check (Wald interval):</strong> {uniformityConfidenceInterval}
                          {uniformityConfidenceInterval.includes("CI for proportion") && !uniformityConfidenceInterval.includes("small") && (
                            <p className="text-xs mt-1">If this interval contains 0.5, the data is consistent with a uniform distribution (p=0.5) at the 95% confidence level.</p>
                          )}
                        </div>
                     )}
                   </>
                 )}

                 {/* Proceed Button - Show only when XOR is done and we are in step 8 */}
                 {xorCompleted && step === 'xor-bits' && (
                   <Button
                     onClick={() => handleStepComplete('compute-sum')}
                     className="mt-6 py-4 px-8 text-lg" // Make proceed button larger
                   >
                     Proceed to Step 9: Compute Sum (y)
                   </Button>
                 )}
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('compute-sum')}`}>
              <StepHeader step="compute-sum" title="Step 9: Compute Sum" />
              <div className="flex flex-col items-center gap-4 w-full">
                <Button
                  onClick={handleComputeSumY}
                  disabled={!isStepEnabled('compute-sum') || !isStepCompleted('xor-bits') || step !== 'compute-sum' || calculationProgress === 1 || noiseBits.length === 0}
                  className="px-6 py-3 text-lg mb-6"
                >
                  {calculationProgress === 0 ? "Compute Noisy Sum (y)" : calculationProgress === 1 ? "Calculating..." : "Calculation Complete"}
                </Button>

                {calculationProgress > 0 && noiseBits.length > 0 && (
                  <div className="calculation-details w-full max-w-xl p-6 bg-blue-50 rounded-lg border border-blue-200 space-y-4 text-left text-lg">
                    {intermediateValues.sumNoise !== undefined && (
                      <div className="fade-in-step">
                        Sum of Noise Bits (Σ bᵢ): <span className="font-mono font-semibold text-blue-700">{intermediateValues.sumNoise.toLocaleString()}</span>
                      </div>
                    )}
                    {intermediateValues.nbOver2 !== undefined && (
                      <div className="fade-in-step" style={{ animationDelay: '0.7s' }}>
                        Target Noise Offset (n<sub>b</sub>/2): <span className="font-mono font-semibold text-blue-700">{intermediateValues.nbOver2.toLocaleString()}</span>
                      </div>
                    )}
                    {intermediateValues.noiseVal !== undefined && (
                      <div className="fade-in-step font-bold text-blue-800" style={{ animationDelay: '1.4s' }}>
                        Differential Privacy Noise = (Σ bᵢ) - (n<sub>b</sub>/2) = <span className="font-mono">{intermediateValues.noiseVal.toLocaleString()}</span>
                      </div>
                    )}
                    {noisySumY !== null && (
                      <div className="fade-in-step mt-6 pt-4 border-t border-blue-200" style={{ animationDelay: '2.1s' }}>
                        <div className="mb-2">Hidden Count Sum (Step 1): <span className="font-mono font-semibold text-gray-700">{count.toLocaleString()}</span></div>
                        <div className="mb-2">DP Noise (calculated above): <span className="font-mono font-semibold text-blue-700">{intermediateValues.noiseVal?.toLocaleString()}</span></div>
                        <div className="text-xl text-gray-800">
                          Intermediate Noisy Sum = <span className="font-mono">{intermediateValues.originalNoisySumY?.toLocaleString()}</span>
                        </div>
                        {/* Show rounding step only if original value is different from rounded value */}                   
                        {intermediateValues.originalNoisySumY !== noisySumY && (
                          <div className="text-sm text-blue-600 italic mt-1">
                            Rounding up: <span className="font-mono">{intermediateValues.originalNoisySumY?.toLocaleString()} ≈ {noisySumY.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="text-2xl font-bold text-black mt-2">
                          Final Noisy Sum (y) = <span className="font-mono">{noisySumY.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {noiseBits.length === 0 && step === 'compute-sum' && isStepCompleted('xor-bits') && (
                   <p className="text-red-500">Cannot compute sum: Noise bits (bᵢ) from Step 8 are missing.</p>
                )}
              </div>
              {calculationProgress === 2 && (
                <Button
                  onClick={() => handleStepComplete('compute-z')}
                  disabled={step !== 'compute-sum'}
                  className="mt-6 py-4 px-8 text-lg"
                >
                  Proceed to Step 10: Compute z
                </Button>
              )}
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('compute-z')}`}>
              <StepHeader step="compute-z" title="Step 10: Compute z" />
              <Button 
                onClick={() => handleStepComplete('commit-pedersen')}
                disabled={!isStepEnabled('compute-z') || !isStepCompleted('compute-sum') || step !== 'compute-z'}
              >
                Compute z
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('commit-pedersen')}`}>
              <StepHeader step="commit-pedersen" title="Step 11: Commit Pedersen" />
              <Button 
                onClick={() => handleStepComplete('release-proofs')}
                disabled={!isStepEnabled('commit-pedersen') || !isStepCompleted('compute-z') || step !== 'commit-pedersen'}
              >
                Commit Com(y,z)
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('release-proofs')}`}>
              <StepHeader step="release-proofs" title="Step 12: Release Proofs" />
              <Button 
                onClick={() => handleStepComplete('verify')}
                disabled={!isStepEnabled('release-proofs') || !isStepCompleted('commit-pedersen') || step !== 'release-proofs'}
              >
                Release All Proofs
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('verify')}`}>
              <StepHeader step="verify" title="Step 13: Verification" />
              <div className="verification-visual">
                <p>Verifier checking all commitments and proofs...</p>
                <Button 
                  onClick={verifyProof}
                  disabled={!isStepEnabled('verify') || !isStepCompleted('release-proofs') || step !== 'verify'}
                >
                  Complete Verification
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 