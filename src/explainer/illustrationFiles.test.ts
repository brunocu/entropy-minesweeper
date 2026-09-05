import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { compileExplainer } from './compileExplainer.ts'
import { buildIllustrationFiles, ILLUSTRATION_DIR } from './illustrations.ts'

const SHELL = new URL('../../explainer.html', import.meta.url)
const MARKDOWN = new URL('../../explainer.md', import.meta.url)

async function readPage(): Promise<string> {
  const [shell, markdown] = await Promise.all([readFile(SHELL, 'utf8'), readFile(MARKDOWN, 'utf8')])
  return compileExplainer(shell, markdown)
}

/** Every `/assets/explainer/*.svg` the page loads, deduplicated. */
async function referencedFiles(): Promise<Set<string>> {
  const page = await readPage()
  return new Set([...page.matchAll(/src="\/([^"]*\.svg)"/g)].map((match) => match[1]))
}

describe('illustration files', () => {
  const files = buildIllustrationFiles()

  it('emits one standalone SVG document per illustration', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const { fileName, source } of files) {
      expect(fileName.startsWith(`${ILLUSTRATION_DIR}/`), `${fileName} outside ${ILLUSTRATION_DIR}`).toBe(true)
      expect(fileName.endsWith('.svg')).toBe(true)
      // Loaded via <img>, so each file has to stand on its own: no external CSS applies and
      // the xmlns is required for the browser to parse it as SVG at all.
      expect(source.startsWith('<svg ')).toBe(true)
      expect(source).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(source.trimEnd().endsWith('</svg>')).toBe(true)
    }
  })

  it('gives every illustration a distinct file name', () => {
    const names = files.map((file) => file.fileName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('generates every file the page asks for', async () => {
    const generated = new Set(files.map((file) => file.fileName))
    for (const reference of await referencedFiles()) {
      expect(generated, `explainer.html loads ${reference}, which nothing generates`).toContain(reference)
    }
  })

  it('generates nothing the page does not use', async () => {
    const referenced = await referencedFiles()
    for (const { fileName } of files) {
      expect(referenced, `${fileName} is generated but never referenced`).toContain(fileName)
    }
  })

  it('inlines no illustration markup into the page', async () => {
    // The whole point of the split: the article ships as prose, not as a wall of path data.
    expect(await readPage()).not.toContain('<svg')
  })

  it('reuses one root-board file across both worlds-tree figures', async () => {
    const page = await readPage()
    const rootBoard = `${ILLUSTRATION_DIR}/worlds-tree-board.svg`
    expect((page.match(new RegExp(rootBoard.replace(/\//g, '\\/'), 'g')) ?? []).length).toBe(2)
    expect(files.filter((file) => file.fileName === rootBoard).length).toBe(1)
  })

  it('describes each illustration for readers who cannot see it', async () => {
    const page = await readPage()
    const images = [...page.matchAll(/<img\b[^>]*>/g)].map((match) => match[0])
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) {
      const alt = image.match(/alt="([^"]*)"/)
      expect(alt, `image without alt text: ${image.slice(0, 80)}`).not.toBeNull()
      expect(alt![1].length).toBeGreaterThan(30)
    }
  })
})
