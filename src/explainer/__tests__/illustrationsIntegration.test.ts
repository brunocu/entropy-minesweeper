// The publishing step, which the generator tests do not cover: they pin what each illustration
// *is*, and this pins that every one of them actually reaches the build output. The article
// references these by fixed URL, so a file the integration forgets to write is a broken image on
// the live page and nothing else in the suite would notice.
//
// It drives the real `astro:build:done` hook against a temporary directory rather than inspecting
// `dist/`, so it does not need a build to have been run first - `npm test` runs before
// `npm run build` in CI.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AstroIntegrationLogger } from 'astro'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildIllustrationFiles } from '../illustrations.ts'
import { explainerIllustrations } from '../illustrationsIntegration.ts'

const NOOP_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as unknown as AstroIntegrationLogger

let outDir: string

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'explainer-illustrations-'))
})

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true })
})

/** Runs the integration's build hook the way Astro does: `dir` is a `URL`, not a path. */
async function runBuildHook(): Promise<void> {
  const hook = explainerIllustrations().hooks['astro:build:done']
  expect(hook, 'integration has no astro:build:done hook').toBeDefined()
  await hook!({
    dir: pathToFileURL(`${outDir}/`),
    pages: [],
    assets: new Map(),
    logger: NOOP_LOGGER,
  } as unknown as Parameters<NonNullable<typeof hook>>[0])
}

describe('explainer illustrations integration', () => {
  it('writes every generated illustration into the build output', async () => {
    await runBuildHook()

    const written = await Promise.all(
      buildIllustrationFiles().map(async ({ fileName }) => {
        const contents = await readFile(join(outDir, fileName), 'utf8').catch(() => null)
        return [fileName, contents] as const
      }),
    )

    const missing = written.filter(([, contents]) => contents === null).map(([fileName]) => fileName)
    expect(missing, 'illustrations the build output is missing').toEqual([])
  })

  it('writes each illustration byte-for-byte as its generator produced it', async () => {
    await runBuildHook()

    for (const { fileName, source } of buildIllustrationFiles()) {
      expect(await readFile(join(outDir, fileName), 'utf8'), fileName).toBe(source)
    }
  })
})
