import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import GameNavbar from '../navigation/GameNavbar';
import { Button } from '../ui/button';
import { useCSVReader } from 'react-papaparse';
import MorraAnimation from '../morra/MorraAnimation';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:9537'  // Local backend
  : 'https://zkdp-backend-production.up.railway.app';  // Production backend

interface LhsResponse {
  lhs: number;
}

interface RhsResponse {
  rhs: number;
}

interface XorBitsResponse {
    xor_bits: number[];
}

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
  value: number;  // Random number
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
  s?: number; // Random number for Pedersen commitment
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

// State for Step 10: Compute Z
interface ZIntermediateValues {
  sumR?: number;
  sumS?: number;
}

interface CommitsResponse {
  commits: string[];
}

interface PrivateCommitsResponse {
  private_commits: string[];
}

interface RandomResponse {
  random_bits: number[];
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
  const [publicBits, setPublicBits] = useState<PublicBit[]>([]); // Remove setPublicBits since it's not used
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
  const [isModifyingXOR, setIsModifyingXOR] = useState<boolean>(false);
  const [originalXORBits, setOriginalXORBits] = useState<NoiseBit[]>([]);
  const [isDraggingXOR, setIsDraggingXOR] = useState<boolean>(false);
  const [lastDraggedXORIndex, setLastDraggedXORIndex] = useState<number | null>(null);

  // State for Step 9: Compute Sum (y)
  const [noisySumY, setNoisySumY] = useState<number | null>(null);
  const [calculationProgress, setCalculationProgress] = useState<number>(0); // 0: idle, 1: calculating, 2: done
  const [intermediateValues, setIntermediateValues] = useState<CalculationIntermediateValues>({});

  // State for Step 10: Compute Z
  const [zValue, setZValue] = useState<number | null>(null);
  const [zCalculationProgress] = useState<number>(0); // 0: idle, 1: calculating, 2: done
  const [zIntermediateValues] = useState<ZIntermediateValues>({});

  // State for Step 11: Commit y and z
  const [isYZCommitted, setIsYZCommitted] = useState<boolean>(false);

  // State for Step 12: Verification
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'running' | 'success' | 'failure'>('idle');

  // States for backend integration
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isCommittingInputs, setIsCommittingInputs] = useState<boolean>(false);
  const [isCommittingPrivateBits, setIsCommittingPrivateBits] = useState<boolean>(false);
  const [isComputingXOR, setIsComputingXOR] = useState<boolean>(false);
  const [isComputingSum, setIsComputingSum] = useState<boolean>(false);
  const [isComputingZ, setIsComputingZ] = useState<boolean>(false);
  const [isCommittingYZ, setIsCommittingYZ] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

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
        return "In this step, we collect binary inputs (0 or 1) from clients, where each input represents a private data point. These inputs will be aggregated while preserving privacy using the ZKDP protocol. The sum of these inputs will be used as the base for our differentially private computation.";
      case 'commit-inputs':
        return "The curator commits to each raw input using a Pedersen commitment scheme, which creates a binding but hiding commitment. This commitment can be verified later without revealing the actual input value, ensuring both privacy and integrity of the data.";
      case 'set-epsilon':
        return "The privacy parameters ε (epsilon) and δ (delta) are set to control the level of differential privacy. A smaller ε provides stronger privacy but reduces accuracy, while δ represents the probability of privacy failure. These parameters determine how much noise we need to add to protect privacy.";
      case 'sample-bits':
        return "We sample n_b private random bits, where n_b is calculated based on the epsilon value. These bits form the basis of our noise generation mechanism. The randomness of these bits is crucial for providing differential privacy guarantees.";
      case 'commit-bits':
        return "The curator commits to the private random bits using Pedersen commitments. This step ensures the bits cannot be changed later and provides a way to verify the noise was generated honestly. The commitments will be used in later verification steps.";
      case 'prove-binary':
        return "Zero-knowledge proofs are generated to prove that all committed values are binary (0 or 1). This ensures the integrity of both the input data and noise bits. The proofs convince a verifier without revealing the actual values.";
      case 'morra':
        return "We use the Morra protocol to generate public random bits through secure multi-party computation. These bits will be combined with private bits to create unbiased noise. This step ensures the randomness cannot be manipulated by any single party.";
      case 'xor-bits':
        return "The private and public random bits are XORed together to generate the final noise bits. This combination ensures the noise is both verifiable and truly random. The resulting bits will be used to add noise to our sum.";
      case 'compute-sum':
        return "We compute the noisy sum by adding the differential privacy noise to the original sum. The noise is derived from the XORed bits in the previous step. This provides a differentially private result that protects individual privacy.";
      case 'compute-z':
        return "We compute an auxiliary value z that combines the randomness used in all Pedersen commitments. This value will be used to verify that all steps were performed correctly. The z value helps prove the computation was honest without revealing private information.";
      case 'commit-pedersen':
        return "The final noisy sum y and auxiliary value z are committed using a Pedersen commitment. This creates a binding commitment to both values that will be used in verification. The commitment ensures these values cannot be changed during verification.";
      case 'verify':
        return "The verifier checks all commitments and proofs to ensure the computation was performed correctly. This step validates that differential privacy was properly applied and no tampering occurred. The verification succeeds only if all steps were performed honestly.";
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
  const handleCommitInputs = useCallback(async () => {
    if (isCommitting || clients.length === 0) return;
    setIsCommittingInputs(true);

    try {
      // Send commitments to backend
      const response = await fetch(`${API_BASE_URL}/commits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      if (response.ok) {
        const data = (await response.json()) as CommitsResponse;
        console.log("Commits:", data.commits);

        const newCommitments: PedersenCommitment[] = clients.map((client, index) => ({
          id: client.id,
          x: client.value,
          value: parseInt(data.commits[index], 10),
          status: 'pending',
          animationDelay: (index / clients.length) * 2
        }));

        setPedersenCommitments(newCommitments);
        
        // Set a timeout to mark all commitments as committed after animations
        setTimeout(() => {
          setPedersenCommitments(prev => 
            prev.map(commit => ({ ...commit, status: 'committed' }))
          );
          setIsCommitting(false);
          handleStepComplete('set-epsilon');
        }, 1000);
      } else {
        console.error("Failed to get commits:", response.status, response.statusText);
      }
    } finally {
      setIsCommittingInputs(false);
    }
  }, [isCommitting, clients, handleStepComplete, sessionId]);

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
              <div>Value: {commit.value}</div>
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
    const s = bit.s; // Use the stored s value

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
                  <div>Random s: {s}</div>
                  <div>Commitment: g<sup>{bit.value}</sup>h<sup>{s}</sup></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [privateBits, isCommitting]);

  const sendPrivateBitsToBackend = useCallback(async (privateBits: PrivateBit[]) => {
    console.log("Sending private bits to backend", privateBits);
    console.log("Bit values", privateBits.map(bit => bit.value));
    
    try {
      // Send commitments to backend
      const response = await fetch(`${API_BASE_URL}/randomness`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,  // sessionId is already the correct format
          bits: privateBits.map(bit => bit.value)
        })
      });

      console.log("Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Response data:", data);
      } else {
        console.error("Failed to send randomness:", response.status, response.statusText);
        const errorData = await response.json();
        console.error("Error details:", errorData);
      }
    } catch (error) {
      console.error("Network error:", error);
    }
  }, [sessionId]);

  const handleCommitPrivateBits = useCallback(async () => {
    if (isCommitting || privateBits.length === 0) return;
    setIsCommittingPrivateBits(true);

    try {
      // Mark all bits as committed and generate random s
      setPrivateBits(prev => 
        prev.map(bit => ({
          ...bit,
          committed: true,
        }))
      );

      // Get commitment from backend
      const response = await fetch(`${API_BASE_URL}/priv_random_commits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      if (response.ok) {
        const data = (await response.json()) as PrivateCommitsResponse;
        console.log("Commits:", data.private_commits);

        const newCommitments = privateBits.map((bit, index) => ({
          id: index,
          x: bit.value,
          value: parseInt(data.private_commits[index], 10),
          status: 'committed' as const,
          animationDelay: index * 100
        }));

        setPedersenCommitments(newCommitments);

        // Set a timeout to complete the step after animations
        setTimeout(() => {
          setIsCommitting(false);
          handleStepComplete('prove-binary');
        }, 1000);
      } else {
        console.error("Failed to get commits:", response.status, response.statusText);
      }
    } finally {
      setIsCommittingPrivateBits(false);
    }
  }, [isCommitting, privateBits, handleStepComplete, sessionId]);

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

  const processSelectedColumn = async () => {
    if (!selectedColumn) return;
    setIsInitializing(true);

    try {
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

      // Initialize session
      const response = await fetch(`${API_BASE_URL}/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // n: newClients.length, // depricated by max
          x: newClients.map(client => client.value)
        })
      });

      if (response.ok) {
        const sessionId = await response.text();
        setSessionId(sessionId);
        console.log("Session ID:", sessionId);
        handleStepComplete('commit-inputs');
      } else {
        console.error("Failed to initialize session:", response.status, response.statusText);
        try {
          const errorData = await response.json();
          console.error("Error details:", errorData);
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }
      }
    } finally {
      setIsInitializing(false);
    }
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

  const handleConfirmPrivateBits = async (privateBits: PrivateBit[]) => {
    console.log("handleConfirmPrivateBits called with", privateBits.length, "bits");
    try {
      await sendPrivateBitsToBackend(privateBits);
      handleStepComplete('commit-bits');
    } catch (error) {
      console.error("Error in handleConfirmPrivateBits:", error);
    }
  };

  const resetSamplingMethod = () => {
    setSamplingMethod(null);
    setPrivateBits([]);
  };

  const handlePlayMorra = () => {
    setIsMorraPlaying(true);
    setMorraAnimationCompleted(false);
  };

  const handleMorraComplete = async() => {
    try {
      const response = await fetch(`${API_BASE_URL}/public_random`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
        })
      });

      if (response.ok) {
        const data = (await response.json()) as RandomResponse;
        console.log("Public Random Bits:", data.random_bits);
        const generatedPublicBits = data.random_bits.map(value => ({ value }));
        setPublicBits(generatedPublicBits);
      } else {
        console.error("Failed to get public random:", response.status, response.statusText);
      }
    } finally {
      setMorraAnimationCompleted(true);
    }
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

  const handleComputeXOR = async () => {
    if (privateBits.length === 0 || publicBits.length === 0 || privateBits.length !== publicBits.length) {
      console.error("Cannot compute XOR: Bit arrays mismatch or empty.");
      return;
    }
    setIsComputingXOR(true);

    try {
      const response = await fetch(`${API_BASE_URL}/xor_bits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      if (response.ok) {
        const data = (await response.json()) as XorBitsResponse;
        console.log("XOR Bits:", data.xor_bits);
        setNoiseBits(data.xor_bits.map(bit => ({ value: bit })));
        setXorCompleted(true);
      } else {
        console.error("Failed to get XOR bits:", response.status, response.statusText);
      }
    } finally {
      setIsComputingXOR(false);
    }
  };

  const overwriteXORBits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/overwrite_xor_bits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          bits: noiseBits.map(bit => bit.value)
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Response data:", data);
      } else {
        console.error("Failed to send randomness:", response.status, response.statusText);
        const errorData = await response.json();
        console.error("Error details:", errorData);
      }
    } catch (error) {
      console.error("Network error:", error);
    }
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

  useEffect(() => {
    const resetScroll = () => {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    };

    // Reset on mount
    resetScroll();

    // Reset on navigation events
    window.addEventListener('popstate', resetScroll);
    window.addEventListener('beforeunload', resetScroll);
    window.addEventListener('load', resetScroll);
    window.addEventListener('DOMContentLoaded', resetScroll);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', resetScroll);
      window.removeEventListener('beforeunload', resetScroll);
      window.removeEventListener('load', resetScroll);
      window.removeEventListener('DOMContentLoaded', resetScroll);
    };
  }, []);

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
  const handleComputeSumY = async () => {
    if (calculationProgress !== 0 || noiseBits.length === 0) return;
    setIsComputingSum(true);

    try {
      setCalculationProgress(1);
      setNoisySumY(null);
      setIntermediateValues({});

      // Calculate all values first
      const sumNoise = noiseBits.reduce((sum, bit) => sum + bit.value, 0);
      const n_b = calculateNB(epsilon);
      const nbOver2 = n_b / 2;
      const noiseVal = sumNoise - nbOver2;
      const originalY = count + noiseVal;
      const finalY = Math.ceil(originalY);

      // Make API call
      const response = await fetch(`${API_BASE_URL}/compute_sum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      let apiSum: number | undefined;
      if (response.ok) {
        const data = await response.json() as { final_sum: number };
        console.log("Final Sum:", data.final_sum);
        apiSum = data.final_sum;
        console.log("API Sum:", apiSum);
      } else {
        console.error("Failed to compute sum:", response.status, response.statusText);
      }

      // Now update UI with animations
      setTimeout(() => {
        setIntermediateValues(prev => ({ ...prev, sumNoise }));
        
        setTimeout(() => {
          setIntermediateValues(prev => ({ ...prev, nbOver2 }));

          setTimeout(() => {
            setIntermediateValues(prev => ({ ...prev, noiseVal }));

            setTimeout(() => {
              setIntermediateValues(prev => ({ ...prev, noiseVal, originalNoisySumY: originalY }));
              setNoisySumY(finalY);

              setTimeout(() => {
                setCalculationProgress(2);
              }, 700);
            }, 700);
          }, 700);
        }, 700);
      }, 500);
    } finally {
      setIsComputingSum(false);
    }
  };

  const handleComputeZ = async () => {
    if (noisySumY === null) return;
    setIsComputingZ(true);

    try {
      setCalculationProgress(1);
      setZValue(null);

      const response = await fetch(`${API_BASE_URL}/z`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
        })
      });

      if (response.ok) {
        const data = await response.json() as { z: number };
        console.log("Z:", data.z);
        setZValue(data.z);
        handleStepComplete('commit-pedersen');
      } else {
        console.error("Failed to compute z:", response.status, response.statusText);
      }
    } finally {
      setIsComputingZ(false);
    }
  };

  // Handler for Step 11: Commit y and z
  const handleCommitYZ = async () => {
    if (isYZCommitted || noisySumY === null || zValue === null) return;
    setIsCommittingYZ(true);

    try {
      const response = await fetch(`${API_BASE_URL}/commit_pedersons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
        })
      });

      if (response.ok) {
        console.log("Pedersen commitments committed");
        setIsYZCommitted(true);
      } else {
        console.error("Failed to commit pedersons:", response.status, response.statusText);
      }
    } finally {
      setIsCommittingYZ(false);
    }
  };

  const verifyProof = async () => {
    setIsVerifying(true);
    try {
      // Get LHS value
      const lhsResponse = await fetch(`${API_BASE_URL}/lhs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
        })
      });

      if (!lhsResponse.ok) {
        console.error("Failed to get LHS:", lhsResponse.status, lhsResponse.statusText);
        return false;
      }

      const lhsData = await lhsResponse.json() as LhsResponse;
      console.log("LHS:", lhsData.lhs);

      // Get RHS value
      const rhsResponse = await fetch(`${API_BASE_URL}/rhs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
        })
      });

      if (!rhsResponse.ok) {
        console.error("Failed to get RHS:", rhsResponse.status, rhsResponse.statusText);
        return false;
      }

      const rhsData = await rhsResponse.json() as RhsResponse;
      console.log("RHS:", rhsData.rhs);

      // Compare values and return result
      return lhsData.lhs === rhsData.rhs;
    } catch (error) {
      console.error("Error during verification:", error);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const handleXORBitMouseDown = useCallback((index: number) => {
    if (!isModifyingXOR) return;
    setIsDraggingXOR(true);
    setLastDraggedXORIndex(index);
    // Toggle the bit value
    setNoiseBits(prev => {
      const newBits = [...prev];
      newBits[index] = {
        ...newBits[index],
        value: newBits[index].value === 1 ? 0 : 1
      };
      return newBits;
    });
  }, [isModifyingXOR]);

  const handleXORBitMouseEnter = useCallback((index: number) => {
    if (isDraggingXOR && lastDraggedXORIndex !== null && isModifyingXOR) {
      // Toggle all bits between lastDraggedIndex and current index
      setNoiseBits(prev => {
        const newBits = [...prev];
        const start = Math.min(lastDraggedXORIndex, index);
        const end = Math.max(lastDraggedXORIndex, index);
        for (let i = start; i <= end; i++) {
          newBits[i] = {
            ...newBits[i],
            value: newBits[lastDraggedXORIndex].value
          };
        }
        return newBits;
      });
    }
  }, [isDraggingXOR, lastDraggedXORIndex, isModifyingXOR]);

  const handleXORBitMouseUp = useCallback(() => {
    setIsDraggingXOR(false);
    setLastDraggedXORIndex(null);
  }, []);

  const handleModifyXOR = () => {
    setOriginalXORBits([...noiseBits]);
    setIsModifyingXOR(true);
  };

  const handleRevertXOR = () => {
    setNoiseBits([...originalXORBits]);
    setIsModifyingXOR(false);
  };

  const handleApplyXORChanges = async () => {
    await overwriteXORBits();
    setIsModifyingXOR(false);
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
      <div className="flex-1 p-2 min-[1300px]:p-5 overflow-y-auto mt-16">
        <div className="p-2 min-[1300px]:p-4 bg-white rounded-lg shadow-sm mx-auto w-full max-w-[100vw] min-[1300px]:min-w-[1000px]">
          <h3 className="text-xl font-bold mb-4">Differentially Private Computation</h3>
          <div className="flex flex-col gap-4 min-[1300px]:gap-8 my-2 min-[1300px]:my-5 p-2 min-[1300px]:p-3">
            {/* Update each step container to be mobile responsive */}
            <div className={`p-4 min-[1300px]:p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('input')}`}>
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
                            <p className="text-base min-[1300px]:text-lg">{acceptedFile.name}</p>
                            <p className="text-xs min-[1300px]:text-sm text-gray-500">
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
                          <p className="text-base min-[1300px]:text-lg">Drag and drop a CSV file here, or click to select</p>
                        )}
                      </div>
                    </div>
                  )}
                </CSVReader>

                {csvColumns.length > 0 && !isParsing && (
                  <div className="w-full max-w-full min-[1300px]:max-w-4xl mx-auto mt-4">
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
                              className={`flex-shrink-0 w-36 min-[1300px]:w-48 p-2 min-[1300px]:p-3 rounded-lg border cursor-pointer transition-all snap-start ${
                                selectedColumn === column.name
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900 text-xs min-[1300px]:text-sm truncate" title={column.name}>
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
                        <div className="flex flex-col min-[1300px]:flex-row items-center gap-4">
                          <input
                            type="number"
                            value={threshold}
                            onChange={(e) => setThreshold(parseFloat(e.target.value))}
                            className="w-full min-[1300px]:flex-1 px-3 py-2 border rounded-md"
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
                      disabled={!selectedColumn || step !== 'input' || isInitializing}
                    >
                      {isInitializing ? 'Processing...' : 'Process Selected Column'}
                    </Button>
                  </div>
                )}

                <div className="mt-4 p-2 min-[1300px]:p-3 bg-blue-50 rounded text-base min-[1300px]:text-lg font-bold text-blue-500 transition-all relative" ref={countRef}>
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

            {/* Update the grid containers to be responsive */}
            <div className={`p-4 min-[1300px]:p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('commit-inputs')}`}>
              <StepHeader step="commit-inputs" title="Step 2: Commit Client Inputs" />
              <div className="flex flex-col items-center gap-4">
                {isCommitting ? <p className="m-0 mb-5 text-gray-600 text-base min-[1300px]:text-lg">Committing all raw inputs...</p> : null}
                <div className="w-full mb-4">
                  {pedersenCommitments.length > 0 && (
                    <div className="w-full flex justify-center">
                      <div className="w-full min-[1300px]:w-[600px] h-[300px] min-[1300px]:h-[600px] overflow-y-auto border rounded-lg shadow-sm bg-white">
                        <Grid
                          className="pedersen-grid-container"
                          columnCount={50}
                          columnWidth={30}
                          rowCount={Math.ceil(pedersenCommitments.length / 50)}
                          rowHeight={30}
                          width={window.innerWidth < 1300 ? window.innerWidth - 32 : 600}
                          height={window.innerWidth < 1300 ? 300 : 600}
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
                    disabled={!isStepEnabled('commit-inputs') || clients.length === 0 || isCommitting || step !== 'commit-inputs' || isCommittingInputs}
                    className="w-full min-[1300px]:w-1/2 py-4 min-[1300px]:py-6 text-base min-[1300px]:text-lg"
                  >
                    {isCommittingInputs ? 'Committing...' : 'Commit Inputs'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Continue updating other step containers similarly... */}
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
                        disabled={!isStepEnabled('sample-bits') || step !== 'sample-bits'}
                      >
                        Reset Sampling Method
                      </Button>
                      <Button
                        onClick={() => {
                          console.log("Confirm Private Bits button clicked");
                          console.log("Current privateBits:", privateBits);
                          handleConfirmPrivateBits(privateBits);
                        }}
                        className="text-sm"
                        disabled={!privateBits.length || !isStepEnabled('sample-bits') || step !== 'sample-bits'}
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
                    disabled={!isStepEnabled('commit-bits') || privateBits.length === 0 || isCommitting || step !== 'commit-bits' || isCommittingPrivateBits}
                    className="w-1/2 py-6 text-lg"
                  >
                    {isCommittingPrivateBits ? 'Committing...' : 'Commit Private Bits'}
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

              {/* Disclaimer about Commitment Updates */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-left text-gray-700 max-w-4xl mx-auto">
                <p className="font-semibold mb-2">Note on Commitment Updates:</p>
                <p className="mb-2">
                  The Σ-OR (i.e. <code>O<sub>OR</sub></code>) check (Step 6) is only used on the initial private-coin commitments <code>c'<sub>j,k</sub> = Com(v<sub>j,k</sub>, s<sub>j,k</sub>)</code> to ensure each <code>v<sub>j,k</sub></code> ∈ {'{0, 1}'}.
                </p>
                <p className="mb-2">
                  After the public bits <code>b<sub>j,k</sub></code> arrive from Morra (this step), the prover updates these commitments homomorphically based on the public bit value:
                </p>
                <ul className="list-disc list-inside mb-2 ml-4 space-y-1 font-mono text-xs">
                  <li>If <code>b<sub>j,k</sub> = 1</code>: &nbsp; <code>c'<sub>j,k</sub> ← Com(1,1) × c'<sub>j,k</sub><sup>-1</sup></code></li>
                  <li>If <code>b<sub>j,k</sub> = 0</code>: &nbsp; <code>c'<sub>j,k</sub></code> remains unchanged</li>
                </ul>
                 <p className="mb-2">
                  This effectively transforms <code>c'<sub>j,k</sub></code> into a commitment to <code>v<sub>j,k</sub> ⊕ b<sub>j,k</sub></code> (which becomes <code>b<sub>i</sub></code> in Step 8).
                </p>
                 <p>
                  No further Σ-OR checks are performed on these updated commitments. The correctness of this update (ensuring the committed value remains binary and the XOR was performed correctly) is verified globally in the final step (Step 13) via the homomorphic consistency check: <code>(∏<sub>i</sub> c<sub>i,k</sub>) × (∏<sub>j</sub> c'<sub>j,k</sub>) = Com(y<sub>k</sub>, z<sub>k</sub>)</code>.
                </p>
              </div>
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
                         disabled={xorCompleted || privateBits.length === 0 || publicBits.length === 0 || privateBits.length !== publicBits.length || step !== 'xor-bits' || isComputingXOR}
                         className="px-6 py-3 text-lg"
                       >
                         {isComputingXOR ? "Computing XOR..." : xorCompleted ? "XOR Computed" : "Compute XOR"}
                       </Button>
                     </div>
                  </>
                 )}

                 {/* Render noise bits only after XOR is done */}
                 {xorCompleted && (
                   <>
                     <div className="w-full flex flex-col items-center gap-4">
                       <div className="w-full max-w-[1200px]">
                         <div className={`grid grid-cols-[repeat(100,minmax(0,1fr))] gap-0`}>
                           {noiseBits.map((bit, index) => (
                             <div
                               key={index}
                               className={`aspect-square text-white flex items-center justify-center tooltip ${
                                 bit.value === 1 ? 'bg-blue-700' : 'bg-blue-500'
                               } ${isModifyingXOR ? 'cursor-pointer' : ''}`}
                               style={{ minWidth: '20px', minHeight: '20px' }}
                               onMouseDown={() => handleXORBitMouseDown(index)}
                               onMouseEnter={() => handleXORBitMouseEnter(index)}
                               onMouseUp={handleXORBitMouseUp}
                             >
                               <span className={`text-[8px] font-mono ${bit.value === 1 ? 'text-white' : 'text-blue-700'}`}>{bit.value}</span>
                               <div className="tooltiptext">
                                 <div className="text-sm whitespace-nowrap">
                                   <div>Noise Bit {index + 1}:</div>
                                   <div>Value: {bit.value}</div>
                                 </div>
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                       <div className="flex flex-col items-center gap-4">
                         {!isModifyingXOR ? (
                           <Button
                             onClick={handleModifyXOR}
                             className="bg-red-500 hover:bg-red-600 text-white px-6 py-3"
                             disabled={!isStepEnabled('xor-bits') || step !== 'xor-bits'}
                           >
                             Modify XOR Output (modify noise added)
                           </Button>
                         ) : (
                           <div className="flex gap-4">
                             <Button
                               onClick={handleRevertXOR}
                               variant="outline"
                               className="px-6 py-3"
                               disabled={!isStepEnabled('xor-bits') || step !== 'xor-bits'}
                             >
                               Revert to Original
                             </Button>
                             <Button
                               onClick={handleApplyXORChanges}
                               className="bg-green-500 hover:bg-green-600 text-white px-6 py-3"
                               disabled={!isStepEnabled('xor-bits') || step !== 'xor-bits'}
                             >
                               Apply Changes
                             </Button>
                           </div>
                         )}
                       </div>
                     </div>
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
                  disabled={!isStepEnabled('compute-sum') || !isStepCompleted('xor-bits') || step !== 'compute-sum' || calculationProgress === 1 || noiseBits.length === 0 || isComputingSum}
                  className="px-6 py-3 text-lg mb-6"
                >
                  {isComputingSum ? "Computing..." : calculationProgress === 0 ? "Compute Noisy Sum (y)" : calculationProgress === 1 ? "Calculating..." : "Calculation Complete"}
                </Button>

                {calculationProgress > 0 && noiseBits.length > 0 && (
                  <div className="calculation-details w-full max-w-xl p-6 bg-gray-50 rounded-lg border border-gray-200 space-y-4 text-left text-base text-black">
                    {intermediateValues.sumNoise !== undefined && (
                      <div className="fade-in-step">
                        Sum of Noise Bits (Σ bᵢ): <span className="font-mono font-semibold">{intermediateValues.sumNoise.toLocaleString()}</span>
                      </div>
                    )}
                    {intermediateValues.nbOver2 !== undefined && (
                      <div className="fade-in-step" style={{ animationDelay: '0.7s' }}>
                        Target Noise Offset (n<sub>b</sub>/2): <span className="font-mono font-semibold">{intermediateValues.nbOver2.toLocaleString()}</span>
                      </div>
                    )}
                    {intermediateValues.noiseVal !== undefined && (
                      <div className="fade-in-step font-semibold" style={{ animationDelay: '1.4s' }}>
                        Differential Privacy Noise = (Σ bᵢ) - (n<sub>b</sub>/2) = <span className="font-mono">{intermediateValues.noiseVal.toLocaleString()}</span>
                      </div>
                    )}
                    {noisySumY !== null && (
                      <div className="fade-in-step mt-6 pt-4 border-t border-blue-200" style={{ animationDelay: '2.1s' }}>
                        <div className="mb-2">Hidden Count Sum (Step 1): <span className="font-mono font-semibold">{count.toLocaleString()}</span></div>
                        <div className="mb-2">DP Noise (calculated above): <span className="font-mono font-semibold">{intermediateValues.noiseVal?.toLocaleString()}</span></div>
                        <div className="text-base mb-1">
                          Intermediate Noisy Sum = <span className="font-mono">{intermediateValues.originalNoisySumY?.toLocaleString()}</span>
                        </div>
                        {/* Show rounding step only if original value is different from rounded value */}
                        {intermediateValues.originalNoisySumY !== noisySumY && (
                          <div className="text-sm italic mt-1">
                            Rounding up: <span className="font-mono">{intermediateValues.originalNoisySumY?.toLocaleString()} ≈ {noisySumY.toLocaleString()}</span>
                          </div>
                        )}
                        {/* Style the final sum */}
                        <div className="mt-4 p-2 border border-blue-700 bg-blue-50 rounded inline-block">
                            <div className="text-xl font-bold text-blue-700">
                              Final Noisy Sum (y) = <span className="font-mono text-blue-700">{noisySumY.toLocaleString()}</span>
                            </div>
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
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="text-lg text-gray-700 font-mono p-4 bg-gray-100 rounded border mb-4">
                  z = Σ rᵢ + Σ sⱼ
                </div>
                <Button 
                  onClick={handleComputeZ}
                  disabled={!isStepEnabled('compute-z') || !isStepCompleted('compute-sum') || step !== 'compute-z' || zCalculationProgress === 1 || pedersenCommitments.length === 0 || privateBits.length === 0 || isComputingZ}
                  className="px-6 py-3 text-lg mb-6"
                >
                  {isComputingZ ? "Computing..." : zCalculationProgress === 0 ? "Compute z" : zCalculationProgress === 1 ? "Calculating..." : "z Calculation Complete"}
                </Button>
                {zValue !== null && (
                  <div className="text-sm text-blue-700 bg-blue-50 p-1 rounded border border-blue-200 mb-2">
                    z = {zValue.toLocaleString()}
                  </div>
                )}

                {zCalculationProgress > 0 && (
                  <div className="calculation-details w-full max-w-xl p-6 bg-gray-50 rounded-lg border border-gray-200 space-y-4 text-left text-base text-black">
                    {zIntermediateValues.sumR !== undefined && (
                      <div className="fade-in-step">
                        Sum of client random values (Σ rᵢ): <span className="font-mono font-semibold">{zIntermediateValues.sumR.toLocaleString()}</span>
                      </div>
                    )}
                    {zIntermediateValues.sumS !== undefined && (
                      <div className="fade-in-step" style={{ animationDelay: '0.7s' }}>
                        Sum of private bit random values (Σ sⱼ): <span className="font-mono font-semibold">{zIntermediateValues.sumS.toLocaleString()}</span>
                      </div>
                    )}
                    {zValue !== null && (
                      <div className="fade-in-step mt-6 pt-4 border-t border-blue-200 font-semibold" style={{ animationDelay: '1.4s' }}>
                        Final z = (Σ rᵢ) + (Σ sⱼ) = 
                        <span className="font-mono ml-2 p-2 border border-blue-700 bg-blue-50 rounded text-xl text-blue-700">{zValue.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {(pedersenCommitments.length === 0 || privateBits.length === 0) && step === 'compute-z' && isStepCompleted('compute-sum') && (
                   <p className="text-red-500">Cannot compute z: Commitment data (rᵢ or sⱼ) is missing.</p>
                )}
              </div>
              {zCalculationProgress === 2 && (
                <Button
                  onClick={() => handleStepComplete('commit-pedersen')}
                  disabled={step !== 'compute-z'}
                  className="mt-6 py-4 px-8 text-lg"
                >
                  Proceed to Step 11: Commit Com(y,z)
                </Button>
              )}
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-center items-center min-h-[200px] ${getStepStyle('commit-pedersen')}`}>
              <StepHeader step="commit-pedersen" title="Step 11: Commit y and z (Com(y,z))" />
              <div className="flex flex-col items-center gap-6 w-full">
                {!isYZCommitted ? (
                  <Button 
                    onClick={handleCommitYZ}
                    disabled={!isStepEnabled('commit-pedersen') || !isStepCompleted('compute-z') || step !== 'commit-pedersen' || noisySumY === null || zValue === null || isCommittingYZ}
                    className="px-6 py-3 text-lg"
                  >
                    Commit Com(y,z)
                  </Button>
                ) : (
                  <div className="fade-in-step w-48 h-48 bg-green-500 rounded-lg shadow-md flex items-center justify-center tooltip">
                    <span className="text-white text-2xl font-bold">Com(y,z)</span>
                    <div className="tooltiptext">
                      <div className="text-sm whitespace-nowrap p-1">
                        <div>Commitment: g<sup>y</sup>h<sup>z</sup></div>
                        <div>y (Noisy Sum): {noisySumY?.toLocaleString()}</div>
                        <div>z (Sum of Randomness): {zValue?.toLocaleString()}</div>
                        <div>(g, h are public parameters)</div>
                      </div>
                    </div>
                  </div>
                )}

                {isYZCommitted && (
                  <Button
                    onClick={() => handleStepComplete('verify')}
                    disabled={step !== 'commit-pedersen'}
                    className="mt-6 py-4 px-8 text-lg"
                  >
                    Proceed to Step 12: Verification
                  </Button>
                )}
                 {(noisySumY === null || zValue === null) && step === 'commit-pedersen' && isStepCompleted('compute-z') && (
                   <p className="text-red-500 mt-4">Cannot commit: Values y or z are missing.</p>
                 )}
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('verify')}`}>
              <StepHeader step="verify" title="Step 12: Verification" />
              <div className="flex flex-col items-center gap-6 w-full">
                <Button 
                  onClick={async () => {
                    setVerificationStatus('running');
                    setTimeout(async () => {
                      const isValid = await verifyProof();
                      setVerificationStatus(isValid ? 'success' : 'failure');
                    }, 2000);
                  }}
                  disabled={!isStepEnabled('verify') || !isStepCompleted('commit-pedersen') || step !== 'verify' || verificationStatus === 'running' || isVerifying}
                  className="px-6 py-3 text-lg"
                >
                  {isVerifying ? "Verifying..." : verificationStatus === 'idle' ? "Start Verification" : verificationStatus === 'running' ? "Verifying..." : "Run Verification Again"}
                </Button>

                {verificationStatus === 'running' && (
                  <div className="animate-spin text-4xl">⚙️</div>
                )}

                {verificationStatus === 'success' && (
                  <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-lg font-semibold text-lg">
                    ✅ Verification Successful - I see that you did not lie!
                  </div>
                )}
                {verificationStatus === 'failure' && (
                  <div className="mt-4 p-4 bg-red-100 text-red-800 rounded-lg font-semibold text-lg">
                    ❌ Verification Failed - The math doesn't check out... you must have lied!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}