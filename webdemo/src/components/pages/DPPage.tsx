export default function DPPage() {
  return (
    <div className="text-m leading-relaxed text-gray-700">
      <p className="mb-6">
        <strong className="font-semibold">Differential Privacy</strong> is a mathematical framework that allows us to analyze and share data while protecting individual privacy. 
        Think of it like adding carefully measured noise to survey results - it lets us see overall trends while making it impossible to identify any single person's response.
      </p>
      <p className="mb-6">
        Here's how it works in three simple steps:
      </p>
      <ol className="my-6 pl-8 list-decimal list-inside">
        <li className="mb-4">
          <strong className="font-semibold">Data Collection:</strong> Imagine a survey asking people if they've had a certain medical condition. 
          Each person's answer is either "yes" (1) or "no" (0).
        </li>
        <li className="mb-4">
          <strong className="font-semibold">Adding Noise:</strong> Before sharing the results, we add carefully calculated random noise to the data. 
          This noise is designed to be just enough to protect individual privacy while still preserving useful statistical information.
        </li>
        <li className="mb-4">
          <strong className="font-semibold">Analysis:</strong> Researchers can now analyze the noisy data to understand general trends (like the percentage of people with the condition) 
          without being able to identify any individual's response.
        </li>
      </ol>
      <p className="mb-6">
        This approach provides strong privacy guarantees because:
      </p>
      <ul className="my-6 pl-8 list-disc list-inside">
        <li className="mb-4">Even if someone knows everything about the dataset except one person's data, they can't determine that person's information (<strong className="font-semibold">privacy</strong>)</li>
        <li className="mb-4">The added noise is carefully calibrated to maintain useful statistical information (<strong className="font-semibold">utility</strong>)</li>
        <li className="mb-4">This tradeoff is an important concept within Differential Privacy---finding an optimal balance between privacy and utility (<strong className="font-semibold">the privacy-utility tradeoff</strong>)</li>
      </ul>
    </div>
  );
} 