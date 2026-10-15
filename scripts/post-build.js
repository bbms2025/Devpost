// Post-build: copy manifest.json and icons into dist/
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Copy manifest
copyFileSync(resolve(root, 'manifest.json'), resolve(root, 'dist', 'manifest.json'))
console.log('✓ Copied manifest.json')

// Copy icons
mkdirSync(resolve(root, 'dist', 'icons'), { recursive: true })
for (const f of readdirSync(resolve(root, 'icons'))) {
  copyFileSync(resolve(root, 'icons', f), resolve(root, 'dist', 'icons', f))
}
console.log('✓ Copied icons/')

// Fix side_panel path in dist manifest to match Vite's HTML output location
import { readFileSync, writeFileSync } from 'fs'
const manifestPath = resolve(root, 'dist', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

// Vite puts panel.html at dist/src/panel/panel.html because the input
// is src/panel/panel.html — update the manifest to match
manifest.side_panel.default_path = 'src/panel/panel.html'
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
console.log('✓ Fixed side_panel path in dist/manifest.json')
