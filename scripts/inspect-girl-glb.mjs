import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '..', 'public', 'girl.glb')

const buf = fs.readFileSync(file)
if (buf.readUInt32LE(0) !== 0x46546c67) {
  console.error('Not a glTF binary')
  process.exit(1)
}

let offset = 12
const jsonChunkLength = buf.readUInt32LE(offset)
const jsonChunkType = buf.toString('utf8', offset + 4, offset + 8)
offset += 8
if (jsonChunkType !== 'JSON') {
  console.error('Expected JSON chunk first')
  process.exit(1)
}
const jsonStr = buf.toString('utf8', offset, offset + jsonChunkLength)
offset += jsonChunkLength
const gltf = JSON.parse(jsonStr)

const nodes = gltf.nodes || []
const skins = gltf.skins || []
const meshes = gltf.meshes || []

console.log('=== Asset ===')
console.log('generator:', gltf.asset?.generator)
console.log('nodes:', nodes.length, 'skins:', skins.length, 'meshes:', meshes.length)

console.log('\n=== Nodes with jaw/mouth/head/neck in name ===')
nodes.forEach((n, i) => {
  const name = n.name || ''
  if (/jaw|chin|mandible|mouth|lip|teeth|tongue|head|neck|face|vrm|J_|j_/i.test(name)) {
    console.log(`[${i}] ${name}  skin=${n.skin ?? '-'} mesh=${n.mesh ?? '-'}`)
  }
})

console.log('\n=== All node names (index: name) ===')
nodes.forEach((n, i) => console.log(`${i}\t${n.name || '(unnamed)'}`))

console.log('\n=== Skins: joint node indices → node names ===')
skins.forEach((skin, si) => {
  console.log(`\nSkin ${si} inverseBindMatrices=${skin.inverseBindMatrices} joints=${skin.joints?.length}`)
  const jnames = (skin.joints || []).map((ji) => nodes[ji]?.name || `?${ji}`)
  console.log(jnames.join('\n'))
})

console.log('\n=== Meshes with morph targets (primitive extras) ===')
meshes.forEach((mesh, mi) => {
  mesh.primitives?.forEach((prim, pi) => {
    const t = prim.targets
    if (!t?.length) return
    console.log(`\nMesh[${mi}] prim[${pi}] targets count=${t.length}`)
    const dict = mesh.extras?.targetNames
    if (Array.isArray(dict)) {
      dict.forEach((nm, i) => console.log(`  ${i}\t${nm}`))
    } else {
      console.log('  (no extras.targetNames — listing placeholder indices 0..' + (t.length - 1) + ')')
    }
  })
})

// VRM extension often has humanoid / blend shape proxy
if (gltf.extensionsUsed?.length) {
  console.log('\n=== extensionsUsed ===')
  console.log(gltf.extensionsUsed.join(', '))
}
