/**
 * Schema.org structured data.
 *
 * This does double duty. Search engines use it for rich results; answer engines
 * use it because a typed, explicit fact ("this Organization is located in this
 * Country, this Dataset was measured on this date") survives summarisation far
 * better than the same fact buried in prose. Every claim emitted here is one the
 * page also states in words — structured data that says more than the page does
 * is spam, and gets treated as such.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Content is generated from our own data, never user input.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
