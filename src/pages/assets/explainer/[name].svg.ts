// Serves the explainer's generated illustrations, one route per file.
//
// The `.svg` in this file's name is where the emitted extension comes from - Astro strips only the
// trailing `.ts` - so `params.name` is the bare name.
import type { APIRoute, GetStaticPaths } from 'astro'
import { buildIllustrationFiles } from '../../../explainer/illustrations.ts'

interface IllustrationProps {
  readonly source: string
}

export const getStaticPaths = (() =>
  buildIllustrationFiles().map(({ name, source }) => ({
    params: { name },
    props: { source },
  }))) satisfies GetStaticPaths

export const GET: APIRoute<IllustrationProps> = ({ props }) =>
  new Response(props.source, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    },
  })
