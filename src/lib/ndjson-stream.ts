/**
 * Reads an NDJSON response body one line at a time.
 *
 * Both long-running routes - catalog sync and reconciliation - stream progress
 * as one JSON object per line, so the screen can narrate work that takes tens of
 * seconds instead of showing a frozen button. A chunk can split a line anywhere,
 * hence the buffer.
 */

/** Yields one parsed object per line, tolerating chunks that split a line. */
export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) yield JSON.parse(line) as T
      newline = buffer.indexOf('\n')
    }
  }
  const rest = buffer.trim()
  if (rest) yield JSON.parse(rest) as T
}
