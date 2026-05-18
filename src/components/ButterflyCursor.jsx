import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'

const BUTTERFLY_URL = `${import.meta.env.BASE_URL}butterfly.glb`

function ButterflyModel() {
  const groupRef = useRef(null)
  const { scene, animations } = useGLTF(BUTTERFLY_URL)
  const model = useMemo(() => {
    const clonedModel = clone(scene)

    clonedModel.traverse((child) => {
      if (!child.isMesh) return

      const meshName = child.name.toLowerCase()
      if (meshName.includes('piez') || meshName.includes('eye')) {
        child.visible = false
        return
      }

      const material = child.material?.clone?.() || new THREE.MeshStandardMaterial()
      material.side = THREE.DoubleSide
      material.roughness = 0.42
      material.metalness = 0
      material.transparent = false
      material.opacity = 1
      material.depthWrite = true

      if (meshName.includes('wing') || meshName.includes('buttwi')) {
        material.color = meshName.includes('fr')
          ? new THREE.Color('#fb7185')
          : new THREE.Color('#22d3ee')
        material.emissive = meshName.includes('fr')
          ? new THREE.Color('#f472b6')
          : new THREE.Color('#38bdf8')
        material.emissiveIntensity = 0.38
      } else if (meshName.includes('body')) {
        material.color = new THREE.Color('#312e81')
        material.emissive = new THREE.Color('#facc15')
        material.emissiveIntensity = 0.08
      } else {
        material.color = new THREE.Color('#f8fafc')
        material.emissive = new THREE.Color('#38bdf8')
        material.emissiveIntensity = 0.12
      }

      child.material = material
      child.castShadow = false
      child.receiveShadow = false
      child.frustumCulled = false
    })

    const cursorScale = 0.0078
    clonedModel.scale.setScalar(cursorScale)
    clonedModel.position.set(-0.05 * cursorScale, -40.5 * cursorScale, 4.68 * cursorScale)

    return clonedModel
  }, [scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model])

  useEffect(() => {
    if (!animations.length) return undefined

    const primaryClip = animations[0]
    const action = mixer.clipAction(primaryClip)
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.timeScale = 1.55
    action.fadeIn(0.15).play()

    return () => {
      action.fadeOut(0.15)
      mixer.stopAllAction()
    }
  }, [animations, mixer])

  useFrame((state, delta) => {
    mixer.update(delta)

    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 5.4) * 0.045
    groupRef.current.position.x = Math.sin(t * 2.2) * 0.025
    groupRef.current.rotation.x = -0.05 + Math.sin(t * 2.1) * 0.03
    groupRef.current.rotation.y = -0.42 + Math.sin(t * 1.45) * 0.34
    groupRef.current.rotation.z = -0.07 + Math.sin(t * 3.1) * 0.08
  })

  return (
    <group ref={groupRef}>
      <group rotation={[0.72, -0.52, -0.06]}>
        <primitive object={model} />
      </group>
    </group>
  )
}

export function ButterflyCursor({ cursorRef }) {
  return (
    <div ref={cursorRef} className="butterfly-cursor" aria-hidden="true">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 3.2], zoom: 62 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={2.6} />
        <directionalLight position={[1.2, 1.4, 2]} intensity={2.2} />
        <pointLight position={[-1, -0.5, 2]} intensity={1.4} color="#67e8f9" />
        <Suspense fallback={null}>
          <ButterflyModel />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(BUTTERFLY_URL)
