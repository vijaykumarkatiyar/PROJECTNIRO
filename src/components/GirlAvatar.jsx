import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import * as THREE from 'three'

const MODEL_URL = import.meta.env.BASE_URL + 'andra.glb'

export function GirlAvatar({ action = 'idle', onDance, yawRef, onLoaded, wordEventRef, headPositionRef, ...props }) {
  const yawGroupRef = useRef(null)
  const { scene } = useGLTF(MODEL_URL)
  const [autoScale, setAutoScale] = useState(0.9)
  const [danceAnim, setDanceAnim] = useState(null)
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  const prevActionRef = useRef(action)
  const resetBlendRef = useRef(0) // 0 = no reset blending, 1 = fully blending back

  // Load and retarget dance.fbx animation
  useEffect(() => {
    if (!scene) return
    
    const modelBoneNames = []
    scene.traverse((child) => {
      if (child.isBone || child.type === 'Bone') {
        modelBoneNames.push(child.name)
      }
    })

    const loader = new FBXLoader()
    loader.load(import.meta.env.BASE_URL + 'dance.fbx', (fbx) => {
      if (fbx.animations && fbx.animations.length > 0) {
        const clip = fbx.animations[0]

        const fbxBoneMap = {}
        fbx.traverse((child) => {
          if (child.isBone || child.type === 'Bone') {
            const stripped = child.name.replace(/^mixamorig[:\.]?/i, '')
            fbxBoneMap[child.name] = stripped
          }
        })

        const boneMapping = {}
        for (const [fbxName, strippedName] of Object.entries(fbxBoneMap)) {
          let match = modelBoneNames.find(n => n === strippedName)
          if (!match) match = modelBoneNames.find(n => n.toLowerCase() === strippedName.toLowerCase())
          if (!match) match = modelBoneNames.find(n => n.toLowerCase().includes(strippedName.toLowerCase()))
          if (!match) match = modelBoneNames.find(n => strippedName.toLowerCase().includes(n.toLowerCase()) && n.length > 3)
          if (match) boneMapping[fbxName] = match
        }

        const retargetedTracks = []
        for (const track of clip.tracks) {
          const dotIndex = track.name.indexOf('.')
          if (dotIndex === -1) continue
          const boneName = track.name.substring(0, dotIndex)
          const property = track.name.substring(dotIndex)
          
          // Disable root motion / positional movement to keep character in front
          if (property.includes('position')) continue;

          const mappedBone = boneMapping[boneName]
          if (mappedBone) {
            track.name = mappedBone + property
            retargetedTracks.push(track)
          }
        }

        if (retargetedTracks.length > 0) {
          setDanceAnim(new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks))
        } else {
          setDanceAnim(clip)
        }
      }
    }, undefined, () => {})
  }, [scene])

  // Auto-scale model
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene)
      const size = box.getSize(new THREE.Vector3())
      console.log('Model size:', size)
      if (size.y > 0) {
        const scale = 1.55 / size.y
        console.log('Setting autoScale to:', scale)
        setAutoScale(scale)
      }
    }
  }, [scene])

  useEffect(() => {
    if (scene) onLoaded?.()
  }, [scene, onLoaded])

  // Collect every bone (scene graph + skinned mesh skeletons — GLTF often duplicates)
  const bones = useMemo(() => {
    if (!scene) return {}
    const seen = new Set()
    const allBones = []
    const pushBone = (b) => {
      if (!b || seen.has(b.uuid)) return
      seen.add(b.uuid)
      allBones.push(b)
    }
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
      if (child.isBone || child.type === 'Bone') pushBone(child)
      if (child.isSkinnedMesh && child.skeleton?.bones) {
        for (const b of child.skeleton.bones) pushBone(b)
      }
    })

    const jawScore = (name) => {
      const n = name.toLowerCase().replace(/^mixamorig[:.]/i, '')
      if (n === 'jaw' || n.endsWith('_jaw') || n.endsWith(':jaw')) return 100
      if (n.includes('lower') && n.includes('jaw')) return 92
      if (n.includes('j_bone_jaw') || n.includes('bone_jaw')) return 95
      if (n.includes('jaw')) return 80
      if (n.includes('mandible')) return 75
      if (n.includes('j_art') && n.includes('lower')) return 70
      if (n.includes('chin') && (n.includes('j') || n.includes('bone') || n.includes('root'))) return 55
      if (n.includes('mouth') && n.includes('low')) return 50
      return 0
    }

    let h,
      la,
      ra,
      s,
      j,
      neck,
      le,
      re,
      bestJaw = 0
    for (const child of allBones) {
      const name = child.name.toLowerCase()
      if (!h && name.includes('head') && !name.includes('top') && !name.includes('end')) h = child
      if (!la && (name.includes('leftarm') || name.includes('leftupperarm') || name.includes('left_arm')) && !name.includes('forearm') && !name.includes('hand')) la = child
      if (!ra && (name.includes('rightarm') || name.includes('rightupperarm') || name.includes('right_arm')) && !name.includes('forearm') && !name.includes('hand')) ra = child
      if (!s && (name.includes('spine') || name.includes('torso'))) s = child
      if (!neck && name.includes('neck')) neck = child
      if (!le && (name.includes('lefteye') || name.includes('left_eye'))) le = child
      if (!re && (name.includes('righteye') || name.includes('right_eye'))) re = child
      const js = jawScore(child.name)
      if (js > bestJaw) {
        bestJaw = js
        j = child
      }
    }

    // If still no jaw, search under head (common VRM / CC layout)
    if (!j && h) {
      h.traverse((child) => {
        if (!child.isBone && child.type !== 'Bone') return
        const js = jawScore(child.name)
        if (js > bestJaw) {
          bestJaw = js
          j = child
        }
      })
    }

    return { head: h, leftArm: la, rightArm: ra, spine: s, jaw: j, neck: neck, leftEye: le, rightEye: re }
  }, [scene])

  // Discover morph targets for lip sync
  const mouthMorphs = useMemo(() => {
    if (!scene) return null
    const morphs = []
    const isMouthMorphName = (name) => {
      const lower = name.toLowerCase().trim()
      const allowed = ['viseme_aa', 'viseme_e', 'viseme_i', 'viseme_o', 'viseme_u', 'viseme_ch', 'viseme_dd', 'viseme_ff', 'viseme_kk', 'viseme_nn', 'viseme_pp', 'viseme_rr', 'viseme_sil', 'viseme_ss', 'viseme_th', 'jawopen', 'mouthopen']
      return allowed.includes(lower)
    }
    scene.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        const dict = child.morphTargetDictionary
        for (const [name, index] of Object.entries(dict)) {
          if (isMouthMorphName(name)) morphs.push({ mesh: child, name, index })
        }
      }
    })
    return morphs.length > 0 ? morphs : null
  }, [scene])

  // Play dance keyframe animation
  useEffect(() => {
    if (action === 'dance' && danceAnim) {
      const actionClip = mixer.clipAction(danceAnim)
      const { head, leftArm, rightArm, spine } = bones
      if (head) { if (!head.userData.initRot) head.userData.initRot = head.rotation.clone(); head.rotation.copy(head.userData.initRot) }
      if (spine) { if (!spine.userData.initRot) spine.userData.initRot = spine.rotation.clone(); spine.rotation.copy(spine.userData.initRot) }
      if (leftArm) { if (!leftArm.userData.initRot) leftArm.userData.initRot = leftArm.rotation.clone(); leftArm.rotation.copy(leftArm.userData.initRot) }
      if (rightArm) { if (!rightArm.userData.initRot) rightArm.userData.initRot = rightArm.rotation.clone(); rightArm.rotation.copy(rightArm.userData.initRot) }
      actionClip.reset().fadeIn(0.5).play()
      return () => {
        // Stop the dance animation and all mixer actions completely
        actionClip.stop()
        mixer.stopAllAction()
        // Trigger a smooth reset blend back to the default pose
        resetBlendRef.current = 1.0
      }
    }
  }, [action, danceAnim, mixer, bones])

  // Per-frame animation
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    if (yawGroupRef.current && yawRef && !isNaN(yawRef.current)) {
      yawGroupRef.current.rotation.y = yawRef.current
    }
    if (!scene) return

    // Access bones via property lookup (not const destructuring)
    // to avoid TDZ errors during Vite HMR reloads
    const bHead = bones.head
    const bLeftArm = bones.leftArm
    const bRightArm = bones.rightArm
    const bSpine = bones.spine
    const bJaw = bones.jaw
    const bNeck = bones.neck
    const bLeftEye = bones.leftEye
    const bRightEye = bones.rightEye
    
    ;[bHead, bLeftArm, bRightArm, bSpine, bNeck].forEach(b => {
        if (b && !b.userData.initRot) {
           b.userData.initRot = b.rotation.clone()
           if (isNaN(b.userData.initRot.x)) b.userData.initRot.x = 0;
           if (isNaN(b.userData.initRot.y)) b.userData.initRot.y = 0;
           if (isNaN(b.userData.initRot.z)) b.userData.initRot.z = 0;
        }
    })

    // Track the real head world position for perfect "eye to eye" camera locking
    if (bHead && headPositionRef && headPositionRef.current) {
      bHead.getWorldPosition(headPositionRef.current)
      // Keep tracking target at chin/throat level so her head is framed near the top of the screen
      headPositionRef.current.y -= 0.02
    }

    // Pointer Tracking (Mouse look) — disabled while talking
    const isTalking = action === 'talk'
    const targetYaw = isTalking ? 0 : ((state.pointer.x * Math.PI) / 4 || 0)
    const targetPitch = isTalking ? 0 : (-(state.pointer.y * Math.PI) / 6 || 0)

    const safeLerp = (start, end, amt) => {
      const s = isNaN(start) ? 0 : start;
      const e = isNaN(end) ? 0 : end;
      const res = THREE.MathUtils.lerp(s, e, amt);
      return isNaN(res) ? 0 : res;
    }

    // Detect transition out of dance and trigger reset blend
    if (prevActionRef.current === 'dance' && action !== 'dance') {
      resetBlendRef.current = 1.0
    }
    prevActionRef.current = action

    // Dance — let the mixer drive everything
    if (action === 'dance' && danceAnim) {
      mixer.update(delta)
      if (mouthMorphs) {
        for (const m of mouthMorphs) {
          m.mesh.morphTargetInfluences[m.index] *= 0.9
        }
      }
      return
    }

    // Smooth reset blend: after dance ends, lerp all bones back to initial rotations
    if (resetBlendRef.current > 0) {
      const blendSpeed = 3.0 // how fast to blend back (higher = faster)
      resetBlendRef.current = Math.max(0, resetBlendRef.current - delta * blendSpeed)
      const t_blend = 1.0 - resetBlendRef.current // 0 -> 1 as we approach default
      const allBones = [bHead, bLeftArm, bRightArm, bSpine, bNeck, bJaw, bLeftEye, bRightEye]
      for (const b of allBones) {
        if (b && b.userData.initRot) {
          b.rotation.x = safeLerp(b.rotation.x, b.userData.initRot.x, t_blend)
          b.rotation.y = safeLerp(b.rotation.y, b.userData.initRot.y, t_blend)
          b.rotation.z = safeLerp(b.rotation.z, b.userData.initRot.z, t_blend)
        }
      }
      if (resetBlendRef.current > 0.01) return // still blending, skip normal idle/talk
    }

    if (action === 'idle') {
      if (bSpine) {
        bSpine.rotation.z = bSpine.userData.initRot.z + Math.sin(t) * 0.01
        bSpine.rotation.x = safeLerp(bSpine.rotation.x, bSpine.userData.initRot.x + targetPitch * 0.2, 0.1)
        bSpine.rotation.y = safeLerp(bSpine.rotation.y, bSpine.userData.initRot.y + targetYaw * 0.2, 0.1)
      }
      if (bNeck) {
        bNeck.rotation.x = safeLerp(bNeck.rotation.x, bNeck.userData.initRot.x + targetPitch * 0.4, 0.1)
        bNeck.rotation.y = safeLerp(bNeck.rotation.y, bNeck.userData.initRot.y + targetYaw * 0.4, 0.1)
      }
      if (bHead) {
        bHead.rotation.y = safeLerp(bHead.rotation.y, bHead.userData.initRot.y + targetYaw * 0.6 + Math.sin(t * 0.5) * 0.05, 0.1)
        bHead.rotation.x = safeLerp(bHead.rotation.x, bHead.userData.initRot.x + targetPitch * 0.6, 0.1)
        bHead.rotation.z = bHead.userData.initRot.z
      }
      if (bLeftEye) {
        bLeftEye.rotation.y = safeLerp(bLeftEye.rotation.y, targetYaw * 0.4, 0.15)
        bLeftEye.rotation.x = safeLerp(bLeftEye.rotation.x, targetPitch * 0.4, 0.15)
      }
      if (bRightEye) {
        bRightEye.rotation.y = safeLerp(bRightEye.rotation.y, targetYaw * 0.4, 0.15)
        bRightEye.rotation.x = safeLerp(bRightEye.rotation.x, targetPitch * 0.4, 0.15)
      }
      if (bLeftArm) {
        bLeftArm.rotation.x = bLeftArm.userData.initRot.x
        bLeftArm.rotation.y = bLeftArm.userData.initRot.y
        bLeftArm.rotation.z = bLeftArm.userData.initRot.z + Math.sin(t * 1.5) * 0.05
      }
      if (bRightArm) {
        bRightArm.rotation.x = bRightArm.userData.initRot.x
        bRightArm.rotation.y = bRightArm.userData.initRot.y
        bRightArm.rotation.z = bRightArm.userData.initRot.z - Math.sin(t * 1.5) * 0.05
      }
      if (bJaw) bJaw.rotation.x = safeLerp(bJaw.rotation.x, 0, 0.1)
      if (mouthMorphs) {
        for (const m of mouthMorphs) {
          m.mesh.morphTargetInfluences[m.index] *= 0.9
        }
      }

    } else if (action === 'talk') {
      // ── Word-boundary-driven lip sync ──
      // Uses real timestamps from browser's speech boundary events
      const now = performance.now()
      const timeSinceWord = wordEventRef?.current ? (now - wordEventRef.current) / 1000.0 : 1.0

      // Pseudo-random hash for varied mouth shapes per word
      const hash = (n) => {
        let x = Math.sin(n * 127.1 + 311.7) * 43758.5453
        return x - Math.floor(x)
      }

      // Word-driven envelope: mouth opens when a new word fires, holds, then closes
      // timeSinceWord: 0 = word just started, ~0.3s = typical word duration
      const wordDuration = 0.32 // how long mouth stays open per word
      const wordPhase = Math.min(timeSinceWord / wordDuration, 1.0)
      
      // Smooth attack + release per word
      const attack = Math.min(wordPhase * 4.0, 1.0)  // open in first 25% of word
      const release = wordPhase > 0.6 ? Math.pow(1.0 - (wordPhase - 0.6) / 0.4, 2.0) : 1.0
      const wordEnvelope = attack * release

      // Vary intensity per word
      const wordIndex = Math.floor(wordEventRef?.current / 200) || 0
      const wordIntensity = 0.4 + hash(wordIndex) * 0.45

      // Is mouth open (recent word) or closed (between words / pause)
      const mouthOpen = timeSinceWord < wordDuration * 1.3
      const lipValue = mouthOpen ? Math.min(wordEnvelope * wordIntensity, 0.6) : 0

      // Rotate viseme shapes per word
      const visemeGroup = wordIndex % 5

      if (mouthMorphs) {
        for (const m of mouthMorphs) {
          const lower = m.name.toLowerCase()
          let target = 0

          if (lower === 'jawopen' || lower === 'mouthopen') {
            target = lipValue * 0.5
          } else if (lower.includes('viseme_aa')) {
            target = (visemeGroup === 0 || visemeGroup === 3) ? lipValue * 0.6 : lipValue * 0.05
          } else if (lower.includes('viseme_o') || lower.includes('viseme_u')) {
            target = (visemeGroup === 1 || visemeGroup === 4) ? lipValue * 0.55 : lipValue * 0.03
          } else if (lower.includes('viseme_i') || lower.includes('viseme_e')) {
            target = (visemeGroup === 2) ? lipValue * 0.5 : lipValue * 0.04
          } else if (lower.includes('viseme_ff') || lower.includes('viseme_th')) {
            target = (visemeGroup === 3) ? lipValue * 0.3 : 0
          } else if (lower.includes('viseme_pp') || lower.includes('viseme_nn') || lower.includes('viseme_dd')) {
            target = !mouthOpen ? lipValue * 0.2 : lipValue * 0.06
          } else if (lower.includes('viseme_ss') || lower.includes('viseme_ch')) {
            target = (visemeGroup === 4) ? lipValue * 0.35 : 0
          } else if (lower.includes('viseme_rr') || lower.includes('viseme_kk')) {
            target = (visemeGroup === 0) ? lipValue * 0.2 : 0
          } else if (lower.includes('viseme_sil')) {
            target = !mouthOpen ? 0.2 : 0
          }

          // Smooth interpolation for natural glide
          const current = m.mesh.morphTargetInfluences[m.index]
          m.mesh.morphTargetInfluences[m.index] = current + (target - current) * 0.18
        }
      }

      if (bJaw) {
        const jawTarget = lipValue * 0.25
        bJaw.rotation.x = safeLerp(bJaw.rotation.x, jawTarget, 0.15)
        bJaw.rotation.z = safeLerp(bJaw.rotation.z, 0, 0.1)
      }

      const hasMorphDriver = mouthMorphs && mouthMorphs.length > 0
      const mouthProxy = lipValue * (!bJaw && !hasMorphDriver ? 0.32 : !bJaw || !hasMorphDriver ? 0.14 : 0.045)

      // Subtle body movement while talking — no cursor tracking
      if (bSpine) {
        bSpine.rotation.z = safeLerp(bSpine.rotation.z, bSpine.userData.initRot.z + Math.sin(t * 0.8) * 0.01, 0.06)
        bSpine.rotation.x = safeLerp(bSpine.rotation.x, bSpine.userData.initRot.x + Math.sin(t * 0.5) * 0.005 + mouthProxy * 0.25, 0.06)
        bSpine.rotation.y = safeLerp(bSpine.rotation.y, bSpine.userData.initRot.y, 0.06)
      }

      if (bNeck) {
        bNeck.rotation.x = safeLerp(bNeck.rotation.x, bNeck.userData.initRot.x + Math.sin(t * 0.6) * 0.008 + mouthProxy * 0.3, 0.06)
        bNeck.rotation.y = safeLerp(bNeck.rotation.y, bNeck.userData.initRot.y + Math.sin(t * 0.4) * 0.02, 0.06)
        bNeck.rotation.z = safeLerp(bNeck.rotation.z, bNeck.userData.initRot.z, 0.06)
      }

      if (bHead) {
        bHead.rotation.y = safeLerp(bHead.rotation.y, bHead.userData.initRot.y + Math.sin(t * 0.5) * 0.03, 0.06)
        bHead.rotation.x = safeLerp(bHead.rotation.x, bHead.userData.initRot.x + Math.sin(t * 0.7) * 0.015 + mouthProxy * 0.5, 0.06)
        bHead.rotation.z = safeLerp(bHead.rotation.z, bHead.userData.initRot.z + Math.sin(t * 0.3) * 0.01, 0.06)
      }

      // Eyes look forward while talking (no cursor tracking)
      if (bLeftEye) {
        bLeftEye.rotation.y = safeLerp(bLeftEye.rotation.y, 0, 0.1)
        bLeftEye.rotation.x = safeLerp(bLeftEye.rotation.x, 0, 0.1)
      }
      if (bRightEye) {
        bRightEye.rotation.y = safeLerp(bRightEye.rotation.y, 0, 0.1)
        bRightEye.rotation.x = safeLerp(bRightEye.rotation.x, 0, 0.1)
      }

      if (bLeftArm) {
        bLeftArm.rotation.x = safeLerp(bLeftArm.rotation.x, bLeftArm.userData.initRot.x + Math.sin(t * 0.9) * 0.04, 0.05)
        bLeftArm.rotation.y = bLeftArm.userData.initRot.y
        bLeftArm.rotation.z = safeLerp(bLeftArm.rotation.z, bLeftArm.userData.initRot.z + Math.sin(t * 1.1) * 0.05, 0.05)
      }
      if (bRightArm) {
        bRightArm.rotation.x = safeLerp(bRightArm.rotation.x, bRightArm.userData.initRot.x + Math.sin(t * 1.0) * 0.03, 0.05)
        bRightArm.rotation.y = bRightArm.userData.initRot.y
        bRightArm.rotation.z = safeLerp(bRightArm.rotation.z, bRightArm.userData.initRot.z - Math.sin(t * 0.8) * 0.05, 0.05)
      }

    } else if (action === 'dance') {
      if (bSpine) bSpine.rotation.z = bSpine.userData.initRot.z + Math.sin(t * 4) * 0.1
      if (bHead) bHead.rotation.z = bHead.userData.initRot.z + Math.sin(t * 4) * 0.2
      if (bLeftArm) { bLeftArm.rotation.x = bLeftArm.userData.initRot.x + Math.sin(t * 6); bLeftArm.rotation.z = bLeftArm.userData.initRot.z + 1.0 }
      if (bRightArm) { bRightArm.rotation.x = bRightArm.userData.initRot.x - Math.sin(t * 6); bRightArm.rotation.z = bRightArm.userData.initRot.z - 1.0 }
    }
  })

  return (
    <group {...props} dispose={null}>
      <group ref={yawGroupRef}>
        <group position={[0, -0.8, 0]}>
          <primitive object={scene} scale={autoScale} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL)
