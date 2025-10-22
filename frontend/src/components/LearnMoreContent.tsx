export const LearnMoreLinks = () => {
  return (
    <p className="text-base text-muted-foreground">
      This dataset was built using a specialized small model, fine-tuned by{" "}
      <a
        href="https://inference.net"
        target="_blank"
        rel="noopener noreferrer"
        className={`
          underline

          hover:text-foreground
        `}
      >
        Inference.net
      </a>
      , in collaboration with{" "}
      <a
        href="https://laion.ai"
        target="_blank"
        rel="noopener noreferrer"
        className={`
          underline

          hover:text-foreground
        `}
      >
        LAION
      </a>
      .
    </p>
  );
};

export function LearnMoreContent() {
  return (
    <div className="space-y-4">
      <LearnMoreLinks />
      <p className="text-base text-muted-foreground">
        This is a small 100,000 sample preview of the full ~50m sample dataset.
        Our fine-tuned model extracts structured summaries from original,
        arbitrary text data.
      </p>
    </div>
  );
}
