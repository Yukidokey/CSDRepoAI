import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { PageHeader, EmptyState } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { averageIso, getEvaluations, saveEvaluation, scoreSus } from "../services/evaluation";

const SUS_QUESTIONS = [
  "I would use this system frequently.",
  "I found the system unnecessarily complex.",
  "The system was easy to use.",
  "I would need technical support to use this system.",
  "The system's features were well integrated.",
  "There was too much inconsistency in the system.",
  "Most people would learn to use this system quickly.",
  "The system was cumbersome to use.",
  "I felt confident using the system.",
  "I needed to learn many things before using the system.",
];

const ISO_QUESTIONS = [
  ["functionalSuitability", "Functional suitability", "The system provides the functions I need for research repository tasks."],
  ["performanceEfficiency", "Performance efficiency", "The system responds quickly and uses resources efficiently."],
  ["usability", "Usability", "The system is clear, learnable, and easy to operate."],
  ["security", "Security", "The system protects accounts, research files, and submitted information."],
  ["reliability", "Reliability", "The system performs consistently and recovers appropriately from errors."],
];

const SCALE = [1, 2, 3, 4, 5];

export default function Evaluation() {
  const { user, role } = useAuth();
  const [susAnswers, setSusAnswers] = useState(Array(10).fill(0));
  const [isoAnswers, setIsoAnswers] = useState({});
  const [comments, setComments] = useState("");
  const [evaluations, setEvaluations] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role !== "admin") return;
    getEvaluations().then(setEvaluations).catch((err) => setError(err.message));
  }, [role]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await saveEvaluation({ respondentId: user.id, susAnswers, isoAnswers, comments });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout>
      <PageHeader
        eyebrow="System Evaluation"
        title="Usability & Quality Evaluation"
        description="Your feedback helps measure the repository using the System Usability Scale and ISO/IEC 25010 quality characteristics."
      />

      {role === "admin" && <AdminSummary evaluations={evaluations} />}

      {role === "admin" ? null : submitted ? (
        <div className="card card-pad evaluation-success">
          <h2>Evaluation submitted</h2>
          <p>Thank you. Your SUS and ISO/IEC 25010 responses have been recorded.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="evaluation-form">
          <section className="card card-pad">
            <div className="evaluation-section-heading">
              <span className="page-eyebrow">Part 1</span>
              <h2>System Usability Scale</h2>
              <p>Rate each statement from 1 (Strongly disagree) to 5 (Strongly agree).</p>
            </div>
            <div className="evaluation-list">
              {SUS_QUESTIONS.map((question, index) => <RatingRow key={question} label={`${index + 1}. ${question}`} value={susAnswers[index]} onChange={(value) => setSusAnswers((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} />)}
            </div>
          </section>

          <section className="card card-pad">
            <div className="evaluation-section-heading">
              <span className="page-eyebrow">Part 2</span>
              <h2>ISO/IEC 25010 Quality</h2>
              <p>Rate each quality characteristic from 1 (Very poor) to 5 (Excellent).</p>
            </div>
            <div className="evaluation-list">
              {ISO_QUESTIONS.map(([key, label, question]) => <RatingRow key={key} label={`${label}: ${question}`} value={isoAnswers[key] || 0} onChange={(value) => setIsoAnswers((current) => ({ ...current, [key]: value }))} />)}
            </div>
            <label className="field evaluation-comments">
              <span className="field-label">Comments or recommendations</span>
              <textarea className="input" rows={4} value={comments} onChange={(event) => setComments(event.target.value)} />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={susAnswers.includes(0) || ISO_QUESTIONS.some(([key]) => !isoAnswers[key])}>Submit evaluation</button>
          </section>
        </form>
      )}
    </Layout>
  );
}

function RatingRow({ label, value, onChange }) {
  return <div className="evaluation-row"><span>{label}</span><div className="evaluation-scale">{SCALE.map((scale) => <button type="button" key={scale} className={`evaluation-rating${value === scale ? " selected" : ""}`} onClick={() => onChange(scale)} aria-label={`${scale} out of 5`}>{scale}</button>)}</div></div>;
}

function AdminSummary({ evaluations }) {
  return <section className="card card-pad evaluation-summary">
    <div><span className="page-eyebrow">Admin view</span><h2>Evaluation results</h2></div>
    {evaluations.length === 0 ? <EmptyState title="No responses yet" /> : <div className="evaluation-summary-stats"><div><strong>{evaluations.length}</strong><span>Responses</span></div><div><strong>{(evaluations.reduce((sum, item) => sum + scoreSus(item.sus_answers), 0) / evaluations.length).toFixed(1)}</strong><span>Average SUS</span></div><div><strong>{averageIso(evaluations)}</strong><span>Average ISO rating</span></div></div>}
  </section>;
}