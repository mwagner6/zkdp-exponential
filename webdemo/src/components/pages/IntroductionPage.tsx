import { useEffect } from 'react';

export default function IntroductionPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="text-m leading-relaxed text-gray-700">
      {/* Zero Knowledge Proofs Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Zero-Knowledge Proofs</h2>
        <p className="mb-6">
          A <strong className="font-semibold">zero-knowledge proof</strong> is a method by which one party (the <strong className="font-semibold">prover</strong>) can prove to another party (the <strong className="font-semibold">verifier</strong>) 
          that they know a specific piece of information, without revealing any details about that information itself.
        </p>
        <p className="mb-6">
          Think of it like a <strong className="font-semibold">teacher</strong> testing a <strong className="font-semibold">student</strong>'s knowledge of addition. The teacher wants to verify that the student 
          truly understands how to add numbers, but the student wants to hide their actual method or thought process.
        </p>
        <p className="mb-6">
          Here's how it works: The teacher randomly selects pairs of numbers (like 17 and 42), and the student provides 
          only the correct sums (59). After many rounds of this, the teacher becomes increasingly confident that the student 
          genuinely knows how to add numbers. This works because:
        </p>
        <ul className="my-6 pl-8 list-disc list-inside">
          <li className="mb-4">If the student really knows addition, they'll always give correct answers (<strong className="font-semibold">completeness</strong>)</li>
          <li className="mb-4">If the student doesn't actually know addition, the probability they can consistently provide correct answers approaches zero (<strong className="font-semibold">soundness</strong>)</li>
          <li className="mb-4">The teacher learns nothing about how the student adds numbers (<strong className="font-semibold">zero-knowledge</strong>)</li>
        </ul>
      </section>

      {/* Differential Privacy Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Differential Privacy</h2>
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
      </section>

      {/* Sigma Protocol Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">Sigma-OR Protocol</h2>
        <p className="mb-6">
          A <strong className="font-semibold">Sigma-OR protocol</strong> is a special type of zero-knowledge proof that allows a prover to demonstrate they know <em>at least one</em> of two secrets, 
          without revealing which one they know. Think of it like proving you can solve either addition <em>or</em> multiplication problems, without showing which type you're solving.
        </p>
        <p className="mb-6">
          Here's how it works in three simple steps:
        </p>
        <ol className="my-6 pl-8 list-decimal list-inside">
          <li className="mb-4">
            <strong className="font-semibold">Commit:</strong> The student prepares two problems - one they can solve (like addition) and one they can't (like multiplication). 
            For the one they can solve, they work it out properly. For the other, they "fake" a solution that looks convincing.
          </li>
          <li className="mb-4">
            <strong className="font-semibold">Challenge:</strong> The teacher gives a single challenge that applies to both problems.
          </li>
          <li className="mb-4">
            <strong className="font-semibold">Response:</strong> The student splits the challenge between both problems. For the one they can solve, they provide a real answer. 
            For the other, they use their pre-prepared "fake" solution.
          </li>
        </ol>
        <p className="mb-6">
          This works because:
        </p>
        <ul className="my-6 pl-8 list-disc list-inside">
          <li className="mb-4">If the student knows at least one type of problem, they can always respond correctly (<strong className="font-semibold">completeness</strong>)</li>
          <li className="mb-4">If they don't know either type, they can't consistently provide correct answers (<strong className="font-semibold">soundness</strong>)</li>
          <li className="mb-4">The teacher can't tell which type of problem the student actually knows (<strong className="font-semibold">zero-knowledge</strong>)</li>
        </ul>
      </section>
    </div>
  );
} 