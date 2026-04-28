/**
 * Serialise a JSON-LD payload for embedding inside a
 * <script type="application/ld+json"> tag.
 *
 * Browsers don't execute application/ld+json content as JS, but they DO
 * stop parsing the script body the first time they see "</script>" (case
 * insensitive). If a string field in the payload contains "</script>"
 * (because it came from a database column an attacker can write to,
 * e.g. tool.name / tool.description), the closing tag terminates the
 * script element early and everything after is parsed as HTML — a
 * stored DOM XSS via JSON-LD.
 *
 * We escape "<", ">" and "&" to their \u escape sequences. JSON parsers
 * still decode them back, so consumers (Google, schema.org validators)
 * see the original value, but the HTML tokenizer never sees a literal
 * "<" inside the script body.
 *
 * Always use this helper instead of JSON.stringify when feeding
 * dangerouslySetInnerHTML inside a <script type="application/ld+json"> tag.
 *
 * Lane 4.46. Drift guard: tests/unit/jsonld-xss-helper.test.ts.
 */
export function safeJsonLd(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
