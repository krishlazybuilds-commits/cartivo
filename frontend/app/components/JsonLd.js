/**
 * Renders a JSON-LD structured-data <script> for SEO / search rich results.
 *
 * The payload is escaped so a stray "<" in product data (e.g. a description)
 * can't break out of the <script> tag, which is the standard XSS-safe way to
 * embed JSON-LD in HTML.
 *
 * @param {{ data: object }} props
 */
export default function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
