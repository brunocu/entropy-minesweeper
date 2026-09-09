import { describe, expect, it } from 'vitest'
import { buildIllustrationFiles, ILLUSTRATION_DIR } from '../illustrations.ts'
import { imageTags, readArticle, referencedIllustrations } from './support/explainerSource.ts'

/** The generated file each `illustration('name')` in the article resolves to. */
function referencedFiles(article: string): Set<string> {
  return new Set([...referencedIllustrations(article)].map((name) => `${ILLUSTRATION_DIR}/${name}.svg`))
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

  it('generates every file the article asks for', async () => {
    const generated = new Set(files.map((file) => file.fileName))
    for (const reference of referencedFiles(await readArticle())) {
      expect(generated, `the article loads ${reference}, which nothing generates`).toContain(reference)
    }
  })

  it('generates nothing the article does not use', async () => {
    const referenced = referencedFiles(await readArticle())
    for (const { fileName } of files) {
      expect(referenced, `${fileName} is generated but never referenced`).toContain(fileName)
    }
  })

  it('inlines no illustration markup into the article', async () => {
    // The whole point of the split: the article ships as prose, not as a wall of path data.
    expect(await readArticle()).not.toContain('<svg')
  })

  it('reuses one root-board file across both worlds-tree figures', async () => {
    const article = await readArticle()
    const rootBoard = `${ILLUSTRATION_DIR}/worlds-tree-board.svg`
    expect([...article.matchAll(/\billustration\('worlds-tree-board'\)/g)]).toHaveLength(2)
    expect(files.filter((file) => file.fileName === rootBoard).length).toBe(1)
  })

  it('describes each illustration for readers who cannot see it', async () => {
    const images = imageTags(await readArticle())
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) {
      const alt = image.match(/alt="([^"]*)"/)
      expect(alt, `image without alt text: ${image.slice(0, 80)}`).not.toBeNull()
      expect(alt![1].length).toBeGreaterThan(30)
    }
  })
})
