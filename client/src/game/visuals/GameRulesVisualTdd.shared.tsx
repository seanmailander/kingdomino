type PlayerCount = 2 | 3 | 4;

type SetupRuleSummary = {
  playerCount: PlayerCount;
  dominoesInUse: number;
  dominoesRemoved: number;
  kingsInPlay: number;
  lineSize: number;
  turns: number;
};

type TurnOrderEntry = {
  orderLabel: string;
  kingColor: string;
  dominoNumber: number;
};

type PropertyScore = {
  terrain: string;
  tiles: number;
  crowns: number;
  score: number;
};

const setupRuleSummaries: SetupRuleSummary[] = [
  {
    playerCount: 2,
    dominoesInUse: 24,
    dominoesRemoved: 24,
    kingsInPlay: 4,
    lineSize: 4,
    turns: 6,
  },
  {
    playerCount: 3,
    dominoesInUse: 36,
    dominoesRemoved: 12,
    kingsInPlay: 3,
    lineSize: 3,
    turns: 12,
  },
  {
    playerCount: 4,
    dominoesInUse: 48,
    dominoesRemoved: 0,
    kingsInPlay: 4,
    lineSize: 4,
    turns: 12,
  },
];

const turnOrderExample: TurnOrderEntry[] = [
  { orderLabel: "1st", kingColor: "Blue king", dominoNumber: 8 },
  { orderLabel: "2nd", kingColor: "Yellow king", dominoNumber: 19 },
  { orderLabel: "3rd", kingColor: "Pink king", dominoNumber: 32 },
];

const propertyScores: PropertyScore[] = [
  { terrain: "Wheat", tiles: 4, crowns: 3, score: 12 },
  { terrain: "Forest", tiles: 4, crowns: 2, score: 8 },
];

export type RuleScenarioProps = {
  title: string;
  ruleFocus: string;
  given: string;
  when: string;
  expectedOutcome: string;
};

export function RuleScenarioScaffold({
  title,
  ruleFocus,
  given,
  when,
  expectedOutcome,
}: RuleScenarioProps) {
  return (
    <section
      style={{ padding: 16, border: "1px dashed #777", borderRadius: 8, background: "#fff" }}
    >
      <h2>{title}</h2>
      <p>
        <strong>Rule focus:</strong> {ruleFocus}
      </p>
      <p>
        <strong>Given:</strong> {given}
      </p>
      <p>
        <strong>When:</strong> {when}
      </p>
      <p>
        <strong>Expected outcome:</strong> {expectedOutcome}
      </p>
      <p>
        This is a visual test scaffold based on rules.md. Replace with real game harness inputs and
        concrete assertions.
      </p>
    </section>
  );
}

export function SetupByPlayerCountHarness() {
  return (
    <section
      style={{ padding: 16, border: "1px dashed #777", borderRadius: 8, background: "#fff" }}
    >
      <h2>Setup by player count</h2>
      <p>
        <strong>Rule focus:</strong> Setup changes by player count before any implementation details
        are introduced.
      </p>
      <table aria-label="Kingdomino setup rules by player count">
        <caption>Canonical setup values derived from rules.md</caption>
        <thead>
          <tr>
            <th scope="col">Players</th>
            <th scope="col">Dominoes in use</th>
            <th scope="col">Dominoes removed</th>
            <th scope="col">Kings in play</th>
            <th scope="col">Visible line size</th>
            <th scope="col">Turns</th>
          </tr>
        </thead>
        <tbody>
          {setupRuleSummaries.map((summary) => (
            <tr key={summary.playerCount}>
              <th scope="row">{summary.playerCount} players</th>
              <td>{summary.dominoesInUse}</td>
              <td>{summary.dominoesRemoved}</td>
              <td>{summary.kingsInPlay}</td>
              <td>{summary.lineSize}</td>
              <td>{summary.turns}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Use this harness as the template for replacing prose-only scaffolds with executable rule
        checks.
      </p>
    </section>
  );
}

export function TurnOrderHarness() {
  return (
    <section
      style={{ padding: 16, border: "1px dashed #777", borderRadius: 8, background: "#fff" }}
    >
      <h2>Turn order from chosen domino positions</h2>
      <p>
        <strong>Rule focus:</strong> Turn order follows ascending domino number from the current
        line.
      </p>
      <table aria-label="Current line king turn order">
        <caption>Turn order for this round</caption>
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">King</th>
            <th scope="col">Chosen domino</th>
          </tr>
        </thead>
        <tbody>
          {turnOrderExample.map((entry) => (
            <tr key={entry.orderLabel}>
              <th scope="row">{entry.orderLabel}</th>
              <td>{entry.kingColor}</td>
              <td>#{entry.dominoNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Lowest chosen domino number takes the next placement turn first.</p>
    </section>
  );
}

export function ScoringByPropertyHarness() {
  const totalPrestige = propertyScores.reduce((sum, property) => sum + property.score, 0);

  return (
    <section
      style={{ padding: 16, border: "1px dashed #777", borderRadius: 8, background: "#fff" }}
    >
      <h2>Property scoring equals area x crowns</h2>
      <p>
        <strong>Rule focus:</strong> Connected properties score tile count multiplied by crowns.
      </p>
      <table aria-label="Scoring summary by property">
        <caption>Completed kingdom property scores</caption>
        <thead>
          <tr>
            <th scope="col">Terrain</th>
            <th scope="col">Tiles</th>
            <th scope="col">Crowns</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {propertyScores.map((property) => (
            <tr key={property.terrain}>
              <th scope="row">{property.terrain}</th>
              <td>{property.tiles}</td>
              <td>{property.crowns}</td>
              <td>{property.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Total prestige: {totalPrestige}</p>
    </section>
  );
}
