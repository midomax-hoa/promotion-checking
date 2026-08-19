// The promises flavour, so `question` can be awaited instead of nested.
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'

/**
 * Terminal questions for the `user:*` commands.
 *
 * A password is always asked for rather than passed as a flag: a flag ends up in
 * the shell history and in the process list, where anyone on the box can read it.
 */

export async function ask(label: string, fallback?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(fallback ? `${label} [${fallback}]: ` : `${label}: `)
    return answer.trim() === '' && fallback ? fallback : answer.trim()
  } finally {
    rl.close()
  }
}

/**
 * Same, without echoing what is typed.
 *
 * readline is given a sink that throws every byte away, so nothing is printed
 * back; the prompt itself is written to stdout by hand beforehand.
 */
export async function askHidden(label: string): Promise<string> {
  process.stdout.write(`${label}: `)
  const sink = new Writable({
    write(_chunk, _encoding, done) {
      done()
    },
  })
  const rl = createInterface({ input: process.stdin, output: sink, terminal: true })
  try {
    return await rl.question('')
  } finally {
    rl.close()
    // The newline the user's Enter would normally have echoed.
    process.stdout.write('\n')
  }
}

/** Reads `--name value` out of argv; returns undefined when the flag is absent. */
export function flag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  if (index === -1) return undefined
  const value = argv[index + 1]
  // A missing value must not silently swallow the next flag as its argument.
  return value == null || value.startsWith('--') ? undefined : value
}

export function fail(message: string): never {
  console.error(`Lỗi: ${message}`)
  process.exit(1)
}
