const PLACEHOLDER_PATTERN = /(\{\{\d+\}\})/g;
const IS_PLACEHOLDER = /^\{\{\d+\}\}$/;

/**
 * Renders a template's body text with its `{{1}}`-style variable
 * placeholders visually highlighted — used on both the Templates list and
 * the New Campaign template picker, so a staff member can see at a glance
 * what they're about to fill in / send.
 */
export function TemplateBodyPreview({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER_PATTERN);
  return (
    <p className="whitespace-pre-wrap text-small text-text-muted">
      {parts.map((part, index) =>
        IS_PLACEHOLDER.test(part) ? (
          <span key={index} className="rounded bg-primary/10 px-1 font-semibold text-primary">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}
