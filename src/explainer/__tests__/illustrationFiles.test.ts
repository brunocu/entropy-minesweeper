import { access } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { buildIllustrationFiles, ILLUSTRATION_DIR } from '../illustrations.ts'
import { imageTags, readArticle, referencedIllustrations } from './support/explainerSource.ts'

describe('illustration files', () => {
  const files = buildIllustrationFiles()

  it('emits one standalone SVG document per illustration', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const { name, source } of files) {
      // Goes straight into the endpoint's `params`: a directory or extension here shifts the URL.
      expect(name, `${name} is not a bare URL name`).toMatch(/^[a-z0-9-]+$/)
      // Loaded via <img>, so each file has to stand on its own: no external CSS applies and
      // the xmlns is required for the browser to parse it as SVG at all.
      expect(source.startsWith('<svg ')).toBe(true)
      expect(source).toContain('xmlns="http://www.w3.org/2000/svg"')
      expect(source.trimEnd().endsWith('</svg>')).toBe(true)
    }
  })

  it('is served from the directory the article loads it from', async () => {
    // The endpoint's path cannot read `ILLUSTRATION_DIR`, so moving either side alone breaks it.
    const endpoint = new URL(`../../pages/${ILLUSTRATION_DIR}/[name].svg.ts`, import.meta.url)
    await expect(access(endpoint), `no endpoint serves ${ILLUSTRATION_DIR}/`).resolves.toBeUndefined()
  })

  it('gives every illustration a distinct name', () => {
    const names = files.map((file) => file.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('generates every illustration the article asks for', async () => {
    const generated = new Set(files.map((file) => file.name))
    for (const reference of referencedIllustrations(await readArticle())) {
      expect(generated, `the article loads ${reference}, which nothing generates`).toContain(reference)
    }
  })

  it('generates nothing the article does not use', async () => {
    const referenced = referencedIllustrations(await readArticle())
    for (const { name } of files) {
      expect(referenced, `${name} is generated but never referenced`).toContain(name)
    }
  })

  it('inlines no illustration markup into the article', async () => {
    // The whole point of the split: the article ships as prose, not as a wall of path data.
    expect(await readArticle()).not.toContain('<svg')
  })

  it('reuses one root-board file across both worlds-tree figures', async () => {
    const article = await readArticle()
    expect([...article.matchAll(/\billustration\('worlds-tree-board'\)/g)]).toHaveLength(2)
    expect(files.filter((file) => file.name === 'worlds-tree-board').length).toBe(1)
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
