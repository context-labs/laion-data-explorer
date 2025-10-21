export function LearnMoreContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This dataset was built using a specialized small model, fine-tuned by{" "}
        <a
          href="https://inference.net"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Inference.net
        </a>
        , in collaboration with{" "}
        <a
          href="https://laion.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          LAION
        </a>
        .
      </p>
      <p className="text-sm text-muted-foreground">
        This is a small 100,000 sample preview of the full ~50m sample dataset.
        Our fine-tuned model extracts structured summaries from original,
        arbitrary text data.
      </p>
      <p className="text-sm text-muted-foreground">
        This data explorer allows you to explore the dataset. We've embedded the
        papers and computed clusters using a combination of dimensionality
        reduction and clustering algorithms.
      </p>
    </div>
  );
}
