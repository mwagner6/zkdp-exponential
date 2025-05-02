export default function SigmaProtocolPage() {
  return (
    <div className="text-m leading-relaxed text-gray-700">
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
    </div>
  );
} 