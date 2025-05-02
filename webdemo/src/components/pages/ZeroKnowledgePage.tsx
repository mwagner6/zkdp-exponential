export default function ZeroKnowledgePage() {
  return (
    <div className="text-m leading-relaxed text-gray-700">
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
    </div>
  );
} 