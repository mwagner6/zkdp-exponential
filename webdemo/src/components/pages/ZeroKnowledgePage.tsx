export default function ZeroKnowledgePage() {
  return (
    <div className="explanation">
      <p>
        A <strong>zero-knowledge proof</strong> is a method by which one party (the <strong>prover</strong>) can prove to another party (the <strong>verifier</strong>) 
        that they know a specific piece of information, without revealing any details about that information itself.
      </p>
      <p>
        Think of it like a <strong>teacher</strong> testing a <strong>student</strong>'s knowledge of addition. The teacher wants to verify that the student 
        truly understands how to add numbers, but the student wants to hide their actual method or thought process.
      </p>
      <p>
        Here's how it works: The teacher randomly selects pairs of numbers (like 17 and 42), and the student provides 
        only the correct sums (59). After many rounds of this, the teacher becomes increasingly confident that the student 
        genuinely knows how to add numbers. This works because:
      </p>
      <ul>
        <li>If the student really knows addition, they'll always give correct answers (<strong>completeness</strong>)</li>
        <li>If the student doesn't actually know addition, the probability they can consistently provide correct answers approaches zero (<strong>soundness</strong>)</li>
        <li>The teacher learns nothing about how the student adds numbers (<strong>zero-knowledge</strong>)</li>
      </ul>
    </div>
  );
} 