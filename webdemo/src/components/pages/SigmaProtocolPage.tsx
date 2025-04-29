export default function SigmaProtocolPage() {
  return (
    <div className="explanation">
      <p>
        A <strong>Sigma-OR protocol</strong> is a special type of zero-knowledge proof that allows a prover to demonstrate they know <em>at least one</em> of two secrets, 
        without revealing which one they know. Think of it like proving you can solve either addition <em>or</em> multiplication problems, without showing which type you're solving.
      </p>
      <p>
        Here's how it works in three simple steps:
      </p>
      <ol>
        <li>
          <strong>Commit:</strong> The student prepares two problems - one they can solve (like addition) and one they can't (like multiplication). 
          For the one they can solve, they work it out properly. For the other, they "fake" a solution that looks convincing.
        </li>
        <li>
          <strong>Challenge:</strong> The teacher gives a single challenge that applies to both problems.
        </li>
        <li>
          <strong>Response:</strong> The student splits the challenge between both problems. For the one they can solve, they provide a real answer. 
          For the other, they use their pre-prepared "fake" solution.
        </li>
      </ol>
      <p>
        This works because:
      </p>
      <ul>
        <li>If the student knows at least one type of problem, they can always respond correctly (<strong>completeness</strong>)</li>
        <li>If they don't know either type, they can't consistently provide correct answers (<strong>soundness</strong>)</li>
        <li>The teacher can't tell which type of problem the student actually knows (<strong>zero-knowledge</strong>)</li>
      </ul>
    </div>
  );
} 