import { Label } from "~/ui/components/ui/Label";

type SelectableCardProps = {
  selected: boolean;
  title: string;
  description: string;
  recommended?: boolean;
  onClick: () => void;
};

export function SelectableCard({
  description,
  onClick,
  recommended = false,
  selected,
  title,
}: SelectableCardProps) {
  return (
    <div
      className={`
        cursor-pointer rounded-lg border p-4 transition-colors

        ${
          selected
            ? "border-detail-brand"
            : `
              border-card-border

              hover:border-card-border-hover
            `
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex items-center justify-center">
          <div
            className={`
              h-4 w-4 rounded-full border

              ${
                selected
                  ? "border-detail-brand bg-detail-brand"
                  : "border-card-border"
              }
            `}
          >
            {selected && (
              <div
                className={`h-full w-full scale-50 rounded-full bg-secondary`}
              />
            )}
          </div>
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Label className="text-base font-semibold">{title}</Label>
            {recommended && (
              <span
                className={`
                  rounded border border-detail-brand px-2 py-1 text-xs
                  font-medium text-detail-brand
                `}
              >
                RECOMMENDED
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
