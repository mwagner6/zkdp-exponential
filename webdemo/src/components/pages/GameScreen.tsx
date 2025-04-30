import { useState, useRef, useCallback, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import GameNavbar from '../navigation/GameNavbar';
import { Button } from '../ui/button';
import { useCSVReader } from 'react-papaparse';

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
  sampledVia: 'uniform' | 'manual' | 'probability';
}

export default function GameScreen({ onBack }: GameScreenProps) {
  const [clients, setClients] = useState<ClientInput[]>([]);
  const [epsilon, setEpsilon] = useState<number>(0.1);
  const [delta, setDelta] = useState<number>(0.1);
  const [count, setCount] = useState<number>(0);
  const [displayedClientCount, setDisplayedClientCount] = useState<number>(0);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [pedersenCommitments, setPedersenCommitments] = useState<PedersenCommitment[]>([]);
  const [privateBits, setPrivateBits] = useState<PrivateBit[]>([]);
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
  const countRef = useRef<HTMLDivElement>(null);
  const { CSVReader } = useCSVReader();
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

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
        return "The privacy parameter ε is set, which controls the level of differential privacy. A smaller ε provides stronger privacy guarantees but may reduce accuracy.";
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
      animationDelay: (index / clients.length) * 5 // Spread animations over 5 seconds
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
    }, 5000); // 5 seconds total animation time
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
          <span className="text-[12px] font-mono text-black">c<sub>{index}</sub></span>
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

  const PrivateBitsGrid = useCallback(() => {
    if (privateBits.length === 0) return null;

    return (
      <div className="w-full flex justify-center mt-4">
        <div className="w-[600px] border rounded-lg shadow-sm bg-white p-4">
          <div className="grid grid-cols-100 gap-1">
            {privateBits.map((bit, index) => (
              <div
                key={index}
                className="aspect-square bg-blue-500 text-white flex items-center justify-center tooltip"
              >
                <span className="text-[8px] font-mono">+{bit.value}</span>
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
        </div>
      </div>
    );
  }, [privateBits]);

  const handleUniformSample = () => {
    const n_b = calculateNB(epsilon);
    const newBits = Array(n_b).fill(0).map(() => ({
      value: Math.random() < 0.5 ? 1 : 0,
      sampledVia: 'uniform' as const
    }));
    setPrivateBits(newBits);
    handleStepComplete('commit-bits');
  };

  const handleManualSet = () => {
    const n_b = calculateNB(epsilon);
    const newBits = Array(n_b).fill(0).map(() => ({
      value: 0,
      sampledVia: 'manual' as const
    }));
    setPrivateBits(newBits);
    // TODO: Implement manual bit setting interface
    alert('Manual bit setting interface would go here');
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
                      disabled={!selectedColumn}
                    >
                      Process Selected Column
                    </Button>
                  </div>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded text-lg font-bold text-blue-500 transition-all relative" ref={countRef}>
                  <div className="relative inline-block group">
                    Client count: {displayedClientCount} | Current (hidden) sum: {count}
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
                    disabled={!isStepEnabled('commit-inputs') || clients.length === 0 || isCommitting}
                    className="w-1/2 py-6 text-lg"
                  >
                    {isCommitting ? 'Committing...' : 'Commit Inputs'}
                  </Button>
                </div>
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('set-epsilon')}`}>
              <StepHeader step="set-epsilon" title="Step 3: Set Privacy Parameters" />
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
                      min="0.01" 
                      max="0.5" 
                      step="0.01" 
                      value={delta} 
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0.01 && value <= 0.5) {
                          setDelta(value);
                        }
                      }}
                      className="w-32 px-3 py-2 border rounded-md text-center"
                    />
                    <span className="text-xl font-bold text-blue-500 px-4 py-1 bg-blue-50 rounded">δ = {delta}</span>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => handleStepComplete('sample-bits')}
                disabled={!isStepEnabled('set-epsilon') || !isStepCompleted('commit-inputs')}
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
                    disabled={!isStepEnabled('sample-bits') || !isStepCompleted('set-epsilon')}
                    className="w-full py-4"
                  >
                    Uniformly Sample Private Bits
                  </Button>
                  <Button 
                    onClick={handleManualSet}
                    disabled={!isStepEnabled('sample-bits') || !isStepCompleted('set-epsilon')}
                    className="w-full py-4 bg-red-500 hover:bg-red-600"
                  >
                    Manually Set Private Bits
                  </Button>
                  <Button 
                    onClick={handleManualSet}
                    disabled={!isStepEnabled('sample-bits') || !isStepCompleted('set-epsilon')}
                    className="w-full py-4 bg-red-500 hover:bg-red-600"
                  >
                    Manually Set Probability
                  </Button>
                </div>
                <PrivateBitsGrid />
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('commit-bits')}`}>
              <StepHeader step="commit-bits" title="Step 5: Commit Private Bits" />
              <Button 
                onClick={() => handleStepComplete('prove-binary')}
                disabled={!isStepEnabled('commit-bits') || !isStepCompleted('sample-bits')}
              >
                Commit Bits
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('prove-binary')}`}>
              <StepHeader step="prove-binary" title="Step 6: Prove Binary Values" />
              <Button 
                onClick={() => handleStepComplete('morra')}
                disabled={!isStepEnabled('prove-binary') || !isStepCompleted('commit-bits')}
              >
                Generate Sigma-OR Proof
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('morra')}`}>
              <StepHeader step="morra" title="Step 7: Play Morra" />
              <div className="morra-game">
                <p>Play Morra to generate public bits</p>
                <Button 
                  onClick={() => handleStepComplete('xor-bits')}
                  disabled={!isStepEnabled('morra') || !isStepCompleted('prove-binary')}
                >
                  Play Morra
                </Button>
              </div>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('xor-bits')}`}>
              <StepHeader step="xor-bits" title="Step 8: XOR Private & Public Bits" />
              <Button 
                onClick={() => handleStepComplete('compute-sum')}
                disabled={!isStepEnabled('xor-bits') || !isStepCompleted('morra')}
              >
                Compute XOR
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('compute-sum')}`}>
              <StepHeader step="compute-sum" title="Step 9: Compute Sum" />
              <Button 
                onClick={() => handleStepComplete('compute-z')}
                disabled={!isStepEnabled('compute-sum') || !isStepCompleted('xor-bits')}
              >
                Compute y
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('compute-z')}`}>
              <StepHeader step="compute-z" title="Step 10: Compute z" />
              <Button 
                onClick={() => handleStepComplete('commit-pedersen')}
                disabled={!isStepEnabled('compute-z') || !isStepCompleted('compute-sum')}
              >
                Compute z
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('commit-pedersen')}`}>
              <StepHeader step="commit-pedersen" title="Step 11: Commit Pedersen" />
              <Button 
                onClick={() => handleStepComplete('release-proofs')}
                disabled={!isStepEnabled('commit-pedersen') || !isStepCompleted('compute-z')}
              >
                Commit Com(y,z)
              </Button>
            </div>
            <div className={`p-8 text-center border rounded transition-all relative w-full flex flex-col justify-between min-h-[200px] ${getStepStyle('release-proofs')}`}>
              <StepHeader step="release-proofs" title="Step 12: Release Proofs" />
              <Button 
                onClick={() => handleStepComplete('verify')}
                disabled={!isStepEnabled('release-proofs') || !isStepCompleted('commit-pedersen')}
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
                  disabled={!isStepEnabled('verify') || !isStepCompleted('release-proofs')}
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