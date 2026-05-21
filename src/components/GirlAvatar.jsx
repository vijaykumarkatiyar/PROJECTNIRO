/* eslint-disable react-hooks/immutability */
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import * as THREE from 'three'
import { VISEME_TO_MORPH, SILENCE_VISEME_STATE } from '../services/lipsync'

const AVATAR_MODELS = {
  female: {
    url: import.meta.env.BASE_URL + 'andra.glb',
    targetHeight: 1.55,
  },
  male: {
    url: import.meta.env.BASE_URL + 'ready_player_me_male_avatar.glb',
    targetHeight: 1.55,
    idleLookYawScale: 1,
    idleLookPitchScale: 1,
  },
}

const RPM_TALK_ANIMATIONS = {
  female: import.meta.env.BASE_URL + 'animations/rpm_f_talk_001.glb',
  male: import.meta.env.BASE_URL + 'animations/rpm_m_talk_001.glb',
}

const RPM_TALK_TRACK_PREFIXES = [
  'spine',
  'neck',
  'head',
  'leftshoulder',
  'leftarm',
  'leftforearm',
  'lefthand',
  'rightshoulder',
  'rightarm',
  'rightforearm',
  'righthand',
]

const normalizeBoneTrackName = (name = '') =>
  String(name)
    .toLowerCase()
    .replace(/^mixamorig[:.]?/i, '')
    .replace(/[_\-.]\d+$/g, '')
    .replace(/[^a-z0-9]/g, '')

const isRpmUpperBodyTrack = (sourceName, propertyName) => {
  if (!sourceName || propertyName.includes('position') || propertyName.includes('scale')) return false
  const key = normalizeBoneTrackName(sourceName)
  if (!key || key.includes('eye') || key.includes('toe')) return false
  return RPM_TALK_TRACK_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix))
}

const createRetargetedRpmClip = (clip, scene, name) => {
  if (!clip || !scene) return null

  const modelBoneNames = []
  scene.traverse((child) => {
    if ((child.isBone || child.type === 'Bone') && child.name) modelBoneNames.push(child.name)
  })

  const exactBoneMap = new Map()
  for (const boneName of modelBoneNames) {
    const key = normalizeBoneTrackName(boneName)
    if (key && !exactBoneMap.has(key)) exactBoneMap.set(key, boneName)
  }

  const findModelBone = (sourceName) => {
    const sourceKey = normalizeBoneTrackName(sourceName)
    if (!sourceKey) return null
    if (exactBoneMap.has(sourceKey)) return exactBoneMap.get(sourceKey)

    const compatible = modelBoneNames.find((boneName) => {
      const modelKey = normalizeBoneTrackName(boneName)
      return modelKey === sourceKey || modelKey.startsWith(sourceKey) || sourceKey.startsWith(modelKey)
    })
    return compatible || null
  }

  const retargetedTracks = []
  for (const track of clip.tracks) {
    const dotIndex = track.name.indexOf('.')
    if (dotIndex === -1) continue

    const sourceName = track.name.substring(0, dotIndex)
    const propertyName = track.name.substring(dotIndex)
    if (!isRpmUpperBodyTrack(sourceName, propertyName)) continue

    const targetBone = findModelBone(sourceName)
    if (!targetBone) continue

    const retargetedTrack = track.clone()
    retargetedTrack.name = targetBone + propertyName
    retargetedTracks.push(retargetedTrack)
  }

  return retargetedTracks.length > 0
    ? new THREE.AnimationClip(name || `${clip.name}_retargeted`, clip.duration, retargetedTracks)
    : null
}

const normalizeMorphName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const MOUTH_MORPH_KEYS = [
  'viseme',
  'jawopen',
  'mouthopen',
  'mouthclose',
  'mouthfunnel',
  'mouthpucker',
  'mouthpress',
  'mouthstretch',
  'mouthsmile',
  'mouthlowerdown',
  'mouthupperup',
  'mouthroll',
  'mouthshrug',
]

const LIP_SYNC_PROFILES = {
  female: {
    primaryViseme: 0.58,
    fallbackViseme: 0.08,
    openAmount: 0.50,
    smoothing: 0.45,
    maxTarget: 0.72,
    closeScale: 0.50,
    stretchScale: 0.75,
    speechOpenFloor: 0.06,
    secondaryMotion: 0.10,
  },
  male: {
    primaryViseme: 0.75,
    fallbackViseme: 0.1,
    openAmount: 0.70,
    smoothing: 0.42,
    maxTarget: 0.85,
    closeScale: 0.50,
    stretchScale: 0.80,
    speechOpenFloor: 0.12,
    secondaryMotion: 0.15,
  },
}

const VISEME_FALLBACK_MORPHS = {
  aa: ['mouthOpen', 'jawOpen'],
  E: ['mouthOpen', 'jawOpen'],
  I: ['mouthOpen', 'jawOpen'],
  O: ['mouthFunnel', 'mouthPucker', 'mouthOpen', 'jawOpen'],
  U: ['mouthPucker', 'mouthFunnel', 'mouthOpen', 'jawOpen'],
  PP: ['mouthClose', 'mouthPressLeft', 'mouthPressRight'],
  SS: ['mouthStretchLeft', 'mouthStretchRight'],
  TH: ['mouthOpen', 'jawOpen'],
  CH: ['mouthOpen', 'jawOpen'],
  FF: ['mouthPressLeft', 'mouthPressRight'],
  kk: ['mouthOpen', 'jawOpen'],
  nn: ['mouthClose'],
  RR: ['mouthOpen', 'jawOpen'],
  DD: ['mouthOpen', 'jawOpen'],
}

const OPEN_VISEMES = ['aa', 'E', 'I', 'O', 'U']
const CLOSED_VISEMES = ['PP', 'FF', 'SS', 'nn', 'sil']

const isMouthMorphName = (name) => {
  const normalized = normalizeMorphName(name)
  return MOUTH_MORPH_KEYS.some((key) => normalized.includes(key))
}

const morphMatches = (name, candidates) => {
  const normalized = normalizeMorphName(name)
  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeMorphName(candidate)
    return normalized === normalizedCandidate || normalized.includes(normalizedCandidate)
  })
}

const getMorphInstanceKey = (morph) => `${morph.mesh.uuid}:${morph.index}`

export function GirlAvatar({ action = 'idle', avatarMode = 'female', yawRef, onLoaded, visemeCurrentRef, headPositionRef, bgMode = 'default', ...props }) {
  const yawGroupRef = useRef(null)
  const avatarConfig = AVATAR_MODELS[avatarMode] || AVATAR_MODELS.female
  const { scene } = useGLTF(avatarConfig.url)
  const femaleTalkAsset = useGLTF(RPM_TALK_ANIMATIONS.female)
  const maleTalkAsset = useGLTF(RPM_TALK_ANIMATIONS.male)
  const [autoScale, setAutoScale] = useState(0.9)
  const [danceAnim, setDanceAnim] = useState(null)
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  const talkAnim = useMemo(() => {
    const animationAsset = avatarMode === 'male' ? maleTalkAsset : femaleTalkAsset
    const sourceClip = animationAsset?.animations?.[0]
    return createRetargetedRpmClip(sourceClip, scene, `${avatarMode}_rpm_talk_upper_body`)
  }, [avatarMode, femaleTalkAsset, maleTalkAsset, scene])
  const prevActionRef = useRef(action)
  const resetBlendRef = useRef(0) // 0 = no reset blending, 1 = fully blending back
  const blinkMorphsRef = useRef(null)
  const blinkStartedAtRef = useRef(-10)
  const nextBlinkAtRef = useRef(1.5)

  useEffect(() => {
    blinkMorphsRef.current = null
    resetBlendRef.current = 1.0
    prevActionRef.current = 'idle'
    setDanceAnim(null)
    nextBlinkAtRef.current = 1.5 + Math.random() * 2
  }, [scene])

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
            const stripped = child.name.replace(/^mixamorig[:.]?/i, '')
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
    }, undefined, () => { })
  }, [scene])

  // Auto-scale model
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene)
      const size = box.getSize(new THREE.Vector3())
      console.log('Model size:', size)
      if (size.y > 0) {
        const scale = avatarConfig.targetHeight / size.y
        console.log('Setting autoScale to:', scale)
        setAutoScale(scale)
      }
    }
  }, [avatarConfig.targetHeight, scene])

  useEffect(() => {
    if (scene) onLoaded?.(avatarMode)
  }, [avatarMode, scene, onLoaded])

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
        child.frustumCulled = false
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

    let h, la, ra, s, j, neck, le, re, bestJaw = 0
    let hips, leftUpLeg, rightUpLeg, leftLeg, rightLeg, leftFoot, rightFoot
    let leftShoulder, rightShoulder, leftForeArm, rightForeArm, leftHand, rightHand
    const leftMouseFingers = []
    const rightMouseFingers = []

    for (const child of allBones) {
      const name = child.name.toLowerCase()
      if (!h && name.includes('head') && !name.includes('top') && !name.includes('end')) h = child
      if (!la && (name.includes('leftarm') || name.includes('leftupperarm') || name.includes('left_arm')) && !name.includes('forearm') && !name.includes('hand')) la = child
      if (!ra && (name.includes('rightarm') || name.includes('rightupperarm') || name.includes('right_arm')) && !name.includes('forearm') && !name.includes('hand')) ra = child
      if (!s && (name.includes('spine') || name.includes('torso'))) s = child
      if (!neck && name.includes('neck')) neck = child
      if (!le && (name.includes('lefteye') || name.includes('left_eye'))) le = child
      if (!re && (name.includes('righteye') || name.includes('right_eye'))) re = child

      // Custom bone lookups for Sitting/Desk posture
      if (!hips && (name.includes('hips') || name.includes('pelvis') || name === 'root')) hips = child
      if (!leftUpLeg && (name.includes('leftupleg') || name.includes('left_thigh') || name.includes('leftthigh') || name.includes('left_up_leg'))) leftUpLeg = child
      if (!rightUpLeg && (name.includes('rightupleg') || name.includes('right_thigh') || name.includes('rightthigh') || name.includes('right_up_leg'))) rightUpLeg = child
      if (!leftLeg && (name.includes('leftleg') || name.includes('left_shin') || name.includes('leftshin') || name.includes('left_leg')) && !name.includes('upleg')) leftLeg = child
      if (!rightLeg && (name.includes('rightleg') || name.includes('right_shin') || name.includes('rightshin') || name.includes('right_leg')) && !name.includes('upleg')) rightLeg = child
      if (!leftFoot && (name.includes('leftfoot') || name.includes('left_foot'))) leftFoot = child
      if (!rightFoot && (name.includes('rightfoot') || name.includes('right_foot'))) rightFoot = child
      if (!leftShoulder && (name.includes('leftshoulder') || name.includes('left_shoulder'))) leftShoulder = child
      if (!rightShoulder && (name.includes('rightshoulder') || name.includes('right_shoulder'))) rightShoulder = child
      if (!leftForeArm && (name.includes('leftforearm') || name.includes('left_forearm') || name.includes('leftforearm'))) leftForeArm = child
      if (!rightForeArm && (name.includes('rightforearm') || name.includes('right_forearm') || name.includes('rightforearm'))) rightForeArm = child
      if (!leftHand && (name.includes('lefthand') || name.includes('left_hand'))) leftHand = child
      if (!rightHand && (name.includes('righthand') || name.includes('right_hand'))) rightHand = child
      if (/lefthand(index|middle|ring|pinky|thumb)[1-3]/.test(name)) leftMouseFingers.push(child)
      if (/righthand(index|middle|ring|pinky|thumb)[1-3]/.test(name)) rightMouseFingers.push(child)

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

    return {
      head: h, leftArm: la, rightArm: ra, spine: s, jaw: j, neck: neck, leftEye: le, rightEye: re,
      hips, leftUpLeg, rightUpLeg, leftLeg, rightLeg, leftFoot, rightFoot,
      leftShoulder, rightShoulder, leftForeArm, rightForeArm, leftHand, rightHand,
      leftMouseFingers, rightMouseFingers
    }
  }, [scene])

  // Discover morph targets for lip sync
  const mouthMorphs = useMemo(() => {
    if (!scene) return null
    const morphs = []
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

  const expressionMorphs = useMemo(() => {
    if (!scene) return null
    const morphs = []
    const getExpressionWeight = (name) => {
      const lower = name.toLowerCase().trim()
      if (
        isMouthMorphName(name) ||
        lower.includes('blink') ||
        lower.includes('eyeclosed') ||
        lower.includes('eye_close')
      ) {
        return 0
      }
      if (lower.includes('smile') || lower.includes('happy') || lower.includes('mouth_smile')) return 0.28
      if (lower.includes('cheek') && (lower.includes('raise') || lower.includes('squint'))) return 0.16
      if (lower.includes('brow') && (lower.includes('up') || lower.includes('raise'))) return 0.1
      if (lower.includes('eye') && lower.includes('wide')) return 0.06
      return 0
    }

    scene.traverse((child) => {
      if (!child.isSkinnedMesh || !child.morphTargetDictionary || !child.morphTargetInfluences) return
      for (const [name, index] of Object.entries(child.morphTargetDictionary)) {
        const weight = getExpressionWeight(name)
        if (weight > 0) morphs.push({ mesh: child, index, weight })
      }
    })
    return morphs.length > 0 ? morphs : null
  }, [scene])

  // Play dance keyframe animation
  useEffect(() => {
    if (action === 'dance' && danceAnim) {
      const actionClip = mixer.clipAction(danceAnim)
      const {
        head, leftArm, rightArm, spine, neck, leftEye, rightEye, hips,
        leftUpLeg, rightUpLeg, leftLeg, rightLeg, leftFoot, rightFoot,
        leftShoulder, rightShoulder, leftForeArm, rightForeArm, leftHand, rightHand,
        leftMouseFingers = [], rightMouseFingers = [],
      } = bones
        ;[
          head, spine, neck, leftEye, rightEye,
          leftShoulder, rightShoulder, leftArm, rightArm, leftForeArm, rightForeArm, leftHand, rightHand,
          leftUpLeg, rightUpLeg, leftLeg, rightLeg, leftFoot, rightFoot,
          ...leftMouseFingers, ...rightMouseFingers,
        ].forEach((bone) => {
          if (!bone) return
          if (!bone.userData.initRot) bone.userData.initRot = bone.rotation.clone()
          bone.rotation.copy(bone.userData.initRot)
        })
      if (hips) {
        if (!hips.userData.initPos) hips.userData.initPos = hips.position.clone()
        hips.position.copy(hips.userData.initPos)
      }
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

  useEffect(() => {
    if (action !== 'talk' || bgMode === 'sitting_room' || !talkAnim) return undefined

    const actionClip = mixer.clipAction(talkAnim)
    actionClip.reset()
    actionClip.setLoop(THREE.LoopRepeat, Infinity)
    actionClip.clampWhenFinished = false
    actionClip.enabled = true
    actionClip.setEffectiveWeight(0.36)
    actionClip.fadeIn(0.18).play()

    return () => {
      actionClip.stop()
      resetBlendRef.current = Math.max(resetBlendRef.current, 0.65)
    }
  }, [action, bgMode, mixer, talkAnim])

  // Per-frame animation
  // Touch tracking for mobile gestures
  const touchRef = useRef({ x: 0, y: 0, active: false })
  const touchNodRef = useRef(0)

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0]
        touchRef.current.x = (touch.clientX / window.innerWidth) * 2 - 1
        touchRef.current.y = -(touch.clientY / window.innerHeight) * 2 + 1
        touchRef.current.active = true
        
        // Trigger a gentle, warm nod and smile reaction
        touchNodRef.current = 1.0
      }
    }

    const handleTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0]
        touchRef.current.x = (touch.clientX / window.innerWidth) * 2 - 1
        touchRef.current.y = -(touch.clientY / window.innerHeight) * 2 + 1
        touchRef.current.active = true
      }
    }

    const handleTouchEnd = () => {
      touchRef.current.active = false
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    if (!blinkMorphsRef.current) {
      const blinkMorphs = []
      scene.traverse((child) => {
        if (!child.morphTargetDictionary || !child.morphTargetInfluences) return
        for (const [name, index] of Object.entries(child.morphTargetDictionary)) {
          const key = name.toLowerCase()
          if (
            key.includes('blink') ||
            key.includes('eyeclosed') ||
            key.includes('eye_close') ||
            key.includes('eyelid') ||
            key.includes('closeeye')
          ) {
            blinkMorphs.push({ mesh: child, index })
          }
        }
      })
      blinkMorphsRef.current = blinkMorphs
    }

    if (t >= nextBlinkAtRef.current) {
      blinkStartedAtRef.current = t
      nextBlinkAtRef.current = t + 2.4 + Math.random() * 3.8
      if (Math.random() > 0.78) nextBlinkAtRef.current += 0.18
    }

    const blinkElapsed = t - blinkStartedAtRef.current
    const blinkAmount =
      blinkElapsed >= 0 && blinkElapsed < 0.18
        ? Math.sin((blinkElapsed / 0.18) * Math.PI)
        : 0

    if (blinkMorphsRef.current?.length) {
      for (const morph of blinkMorphsRef.current) {
        const currentBlink = morph.mesh.morphTargetInfluences[morph.index] || 0
        morph.mesh.morphTargetInfluences[morph.index] = currentBlink + (blinkAmount - currentBlink) * 0.62
      }
    }

    const safeLerp = (start, end, amt) => {
      const s = isNaN(start) ? 0 : start;
      const e = isNaN(end) ? 0 : end;
      const res = THREE.MathUtils.lerp(s, e, amt);
      return isNaN(res) ? 0 : res;
    }

    const applyExpression = (amount, speed = 0.1) => {
      if (!expressionMorphs) return
      for (const morph of expressionMorphs) {
        const current = morph.mesh.morphTargetInfluences[morph.index] || 0
        const target = amount * morph.weight
        morph.mesh.morphTargetInfluences[morph.index] = current + (target - current) * speed
      }
    }

    const resetMouthMorphs = (speed = 0.3) => {
      if (!mouthMorphs) return
      for (const morph of mouthMorphs) {
        const current = morph.mesh.morphTargetInfluences[morph.index] || 0
        morph.mesh.morphTargetInfluences[morph.index] = current + (0 - current) * speed
      }
    }

    if (yawGroupRef.current && yawRef && !isNaN(yawRef.current)) {
      if (bgMode === 'sitting_room') {
        yawRef.current = safeLerp(yawRef.current, 0, 0.1)
      }
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

    // Extra bones for sitting/desk setup
    const bHips = bones.hips
    const bLeftUpLeg = bones.leftUpLeg
    const bRightUpLeg = bones.rightUpLeg
    const bLeftLeg = bones.leftLeg
    const bRightLeg = bones.rightLeg
    const bLeftFoot = bones.leftFoot
    const bRightFoot = bones.rightFoot
    const bLeftShoulder = bones.leftShoulder
    const bRightShoulder = bones.rightShoulder
    const bLeftForeArm = bones.leftForeArm
    const bRightForeArm = bones.rightForeArm
    const bLeftHand = bones.leftHand
    const bRightHand = bones.rightHand
    const bLeftMouseFingers = bones.leftMouseFingers || []
    const bRightMouseFingers = bones.rightMouseFingers || []

      ;[
        bHead, bLeftArm, bRightArm, bSpine, bNeck,
        bLeftEye, bRightEye,
        bHips, bLeftUpLeg, bRightUpLeg, bLeftLeg, bRightLeg, bLeftFoot, bRightFoot,
        bLeftShoulder, bRightShoulder, bLeftForeArm, bRightForeArm, bLeftHand, bRightHand,
        ...bLeftMouseFingers, ...bRightMouseFingers
      ].forEach(b => {
        if (b && !b.userData.initRot) {
          b.userData.initRot = b.rotation.clone()
          if (isNaN(b.userData.initRot.x)) b.userData.initRot.x = 0;
          if (isNaN(b.userData.initRot.y)) b.userData.initRot.y = 0;
          if (isNaN(b.userData.initRot.z)) b.userData.initRot.z = 0;
        }
      })

    if (bHips && !bHips.userData.initPos) {
      bHips.userData.initPos = bHips.position.clone()
    }

    // Track the real head world position for perfect "eye to eye" camera locking
    if (bHead && headPositionRef && headPositionRef.current) {
      bHead.getWorldPosition(headPositionRef.current)
      // Keep tracking target at chin/throat level so her head is framed near the top of the screen
      headPositionRef.current.y -= 0.02
    }

    // Pointer Tracking (Mouse look) — disabled while talking
    const isTalking = action === 'talk'
    const pointerX = touchRef.current.active ? touchRef.current.x : state.pointer.x
    const pointerY = touchRef.current.active ? touchRef.current.y : state.pointer.y

    const idleLookYawScale = avatarConfig.idleLookYawScale ?? 1
    const idleLookPitchScale = avatarConfig.idleLookPitchScale ?? 1
    const userLookYaw = (((pointerX * Math.PI) / 4 || 0) * idleLookYawScale)
    const userLookPitch = ((-(pointerY * Math.PI) / 6 || 0) * idleLookPitchScale)
    const targetYaw = isTalking ? 0 : userLookYaw
    const targetPitch = isTalking ? 0 : userLookPitch
    const relaxedArmX = avatarConfig.relaxedArmX || 0
    const relaxedArmZ = avatarConfig.relaxedArmZ || 0

    const applyRelaxedArms = (sway = 0, speed = 0.12) => {
      if (bLeftArm?.userData.initRot) {
        bLeftArm.rotation.x = safeLerp(bLeftArm.rotation.x, bLeftArm.userData.initRot.x + relaxedArmX, speed)
        bLeftArm.rotation.y = safeLerp(bLeftArm.rotation.y, bLeftArm.userData.initRot.y, speed)
        bLeftArm.rotation.z = safeLerp(bLeftArm.rotation.z, bLeftArm.userData.initRot.z + relaxedArmZ + sway, speed)
      }
      if (bRightArm?.userData.initRot) {
        bRightArm.rotation.x = safeLerp(bRightArm.rotation.x, bRightArm.userData.initRot.x + relaxedArmX, speed)
        bRightArm.rotation.y = safeLerp(bRightArm.rotation.y, bRightArm.userData.initRot.y, speed)
        bRightArm.rotation.z = safeLerp(bRightArm.rotation.z, bRightArm.userData.initRot.z - relaxedArmZ - sway, speed)
      }
    }

    // Decaying touch nod effect (smooth sine nod animation)
    let nodOffset = 0
    if (touchNodRef.current > 0) {
      touchNodRef.current -= delta * 2.2 // decays over ~450ms
      if (touchNodRef.current < 0) touchNodRef.current = 0
      
      // Dip head rotation down and up organically
      nodOffset = Math.sin(touchNodRef.current * Math.PI) * 0.12
    }



    // Detect transition out of dance and trigger reset blend
    if (prevActionRef.current === 'dance' && action !== 'dance') {
      resetBlendRef.current = 1.0
    }
    prevActionRef.current = action

    // Dance — let the mixer drive everything
    if (action === 'dance' && danceAnim) {
      mixer.update(delta)
      if (bHips?.userData.initPos) {
        bHips.position.y = safeLerp(bHips.position.y, bHips.userData.initPos.y, 0.22)
        bHips.position.z = safeLerp(bHips.position.z, bHips.userData.initPos.z, 0.22)
      }
      ;[bLeftEye, bRightEye].forEach((eye) => {
        if (!eye?.userData.initRot) return
        eye.rotation.x = safeLerp(eye.rotation.x, eye.userData.initRot.x, 0.22)
        eye.rotation.y = safeLerp(eye.rotation.y, eye.userData.initRot.y, 0.22)
        eye.rotation.z = safeLerp(eye.rotation.z, eye.userData.initRot.z, 0.22)
      })
      resetMouthMorphs(0.34)
      applyExpression(0, 0.18)
      return
    }

    // Smooth reset blend: after dance ends, lerp all bones back to initial rotations
    if (resetBlendRef.current > 0) {
      const blendSpeed = 3.0 // how fast to blend back (higher = faster)
      resetBlendRef.current = Math.max(0, resetBlendRef.current - delta * blendSpeed)
      const t_blend = 1.0 - resetBlendRef.current // 0 -> 1 as we approach default
      const allBones = [
        bHead, bLeftArm, bRightArm, bSpine, bNeck, bJaw, bLeftEye, bRightEye,
        bHips, bLeftUpLeg, bRightUpLeg, bLeftLeg, bRightLeg, bLeftFoot, bRightFoot,
        bLeftShoulder, bRightShoulder, bLeftForeArm, bRightForeArm, bLeftHand, bRightHand,
        ...bLeftMouseFingers, ...bRightMouseFingers,
      ]
      for (const b of allBones) {
        if (b && b.userData.initRot) {
          b.rotation.x = safeLerp(b.rotation.x, b.userData.initRot.x, t_blend)
          b.rotation.y = safeLerp(b.rotation.y, b.userData.initRot.y, t_blend)
          b.rotation.z = safeLerp(b.rotation.z, b.userData.initRot.z, t_blend)
        }
      }
      if (bHips?.userData.initPos) {
        bHips.position.y = safeLerp(bHips.position.y, bHips.userData.initPos.y, t_blend)
        bHips.position.z = safeLerp(bHips.position.z, bHips.userData.initPos.z, t_blend)
      }
      if (resetBlendRef.current > 0.01 && bgMode !== 'sitting_room') return // still blending, skip normal idle/talk outside the room
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
        bHead.rotation.x = safeLerp(bHead.rotation.x, bHead.userData.initRot.x + targetPitch * 0.6 + nodOffset, 0.1)
        bHead.rotation.z = bHead.userData.initRot.z
      }
      if (bLeftEye) {
        const eyeBase = bLeftEye.userData.initRot
        bLeftEye.rotation.y = safeLerp(bLeftEye.rotation.y, (eyeBase?.y || 0) + targetYaw * 0.22, 0.15)
        bLeftEye.rotation.x = safeLerp(bLeftEye.rotation.x, (eyeBase?.x || 0) + targetPitch * 0.18, 0.15)
        bLeftEye.rotation.z = safeLerp(bLeftEye.rotation.z, eyeBase?.z || 0, 0.15)
      }
      if (bRightEye) {
        const eyeBase = bRightEye.userData.initRot
        bRightEye.rotation.y = safeLerp(bRightEye.rotation.y, (eyeBase?.y || 0) + targetYaw * 0.22, 0.15)
        bRightEye.rotation.x = safeLerp(bRightEye.rotation.x, (eyeBase?.x || 0) + targetPitch * 0.18, 0.15)
        bRightEye.rotation.z = safeLerp(bRightEye.rotation.z, eyeBase?.z || 0, 0.15)
      }
      applyRelaxedArms(Math.sin(t * 1.5) * 0.05, 0.14)
      if (bJaw) bJaw.rotation.x = safeLerp(bJaw.rotation.x, 0, 0.1)
      resetMouthMorphs(visemeCurrentRef?.current?.forceClose ? 0.82 : 0.32)
      const touchSmile = Math.sin(touchNodRef.current * Math.PI) * 0.55
      applyExpression(touchSmile, 0.08)

    } else if (action === 'talk') {
      // ── Precise Text-to-Viseme Lip Sync (TalkingHead Port) ──
      const visemeState = visemeCurrentRef?.current || SILENCE_VISEME_STATE
      
      const isSpeaking = visemeState.viseme !== 'sil' || visemeState.nextViseme !== 'sil'
      const lipProfile = LIP_SYNC_PROFILES[avatarMode] || LIP_SYNC_PROFILES.female
      const clampedPhase = Math.max(0, Math.min(1, visemeState.phase || 0))
      const easedPhase = clampedPhase * clampedPhase * (3 - 2 * clampedPhase)
      const energyDriven = Number.isFinite(visemeState.energy)
      const speechEnergy = energyDriven
        ? Math.max(0, Math.min(1, visemeState.energy))
        : 1
      
      // Map visemes to every matching head/teeth morph target. RPM exports can
      // include duplicate targets such as viseme_aa and viseme_aa.001.
      const targetWeights = new Map()
      
      const addMorphTargets = (candidates, amount) => {
        if (!mouthMorphs || !candidates.length || amount <= 0) return
        for (const m of mouthMorphs) {
          if (!morphMatches(m.name, candidates)) continue
          const key = getMorphInstanceKey(m)
          targetWeights.set(key, Math.max(targetWeights.get(key) || 0, amount))
        }
      }

      const hasPrimaryViseme = (viseme) => {
        if (!mouthMorphs || !viseme) return false
        const primaryMorph = VISEME_TO_MORPH[viseme]
        if (!primaryMorph) return false
        return mouthMorphs.some(m => normalizeMorphName(m.name) === normalizeMorphName(primaryMorph))
      }

      const addVisemeTargets = (viseme, blendAmount) => {
        if (!viseme || viseme === 'sil' || blendAmount <= 0) return
        const primaryMorph = VISEME_TO_MORPH[viseme]
        const drivenBlend = blendAmount * speechEnergy
        if (primaryMorph && hasPrimaryViseme(viseme)) {
          addMorphTargets([primaryMorph], drivenBlend * lipProfile.primaryViseme)
        } else {
          addMorphTargets(VISEME_FALLBACK_MORPHS[viseme] || [], drivenBlend * lipProfile.fallbackViseme)
        }
      }

      addVisemeTargets(visemeState.viseme, 1.0 - easedPhase)
      if (visemeState.nextViseme !== visemeState.viseme) addVisemeTargets(visemeState.nextViseme, easedPhase)

      // Special handling for jaw
      let jawTarget = 0
      if (isSpeaking) {
        // Jaw opens for vowels, closes for consonants/silence
        const currentIsOpen = OPEN_VISEMES.includes(visemeState.viseme)
        const nextIsOpen = OPEN_VISEMES.includes(visemeState.nextViseme)
        const currentIsClosed = CLOSED_VISEMES.includes(visemeState.viseme)
        const nextIsClosed = CLOSED_VISEMES.includes(visemeState.nextViseme)
        
        const currentOpenWeight = currentIsOpen ? (1.0 - easedPhase) : 0
        const nextOpenWeight = nextIsOpen ? easedPhase : 0
        const closedWeight =
          (currentIsClosed ? (1.0 - easedPhase) : 0) +
          (nextIsClosed ? easedPhase : 0)
        const speechOpenFloor = lipProfile.speechOpenFloor * speechEnergy * (1 - Math.min(0.75, closedWeight * 0.75))
        
        jawTarget = Math.max((currentOpenWeight + nextOpenWeight) * lipProfile.openAmount * speechEnergy, speechOpenFloor)

        const secondaryMotion = (lipProfile.secondaryMotion || 0) * speechEnergy
        if (secondaryMotion > 0) {
          const isRounded = ['O', 'U'].includes(visemeState.viseme) || ['O', 'U'].includes(visemeState.nextViseme)
          const isClosed = currentIsClosed || nextIsClosed
          const lipPulse = Math.sin(clampedPhase * Math.PI)
          const lipAsymmetry = Math.sin(t * 3.2 + easedPhase * Math.PI) * 0.5 + 0.5
          const openBias = currentIsOpen || nextIsOpen ? 1 : 0.45
          const looseScale = isClosed ? 0.35 : 1

          addMorphTargets(['mouthSmileLeft'], secondaryMotion * (0.35 + lipAsymmetry * 0.35) * looseScale)
          addMorphTargets(['mouthSmileRight'], secondaryMotion * (0.62 - lipAsymmetry * 0.28) * looseScale)
          addMorphTargets(['mouthSmile'], secondaryMotion * 0.28 * looseScale)
          addMorphTargets(['mouthStretchLeft', 'mouthStretchRight', 'mouthStretch'], secondaryMotion * (0.45 + lipPulse * 0.35) * looseScale)
          addMorphTargets(['mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthLowerDown'], secondaryMotion * (0.55 + lipPulse * 0.65) * openBias * looseScale)
          addMorphTargets(['mouthUpperUpLeft', 'mouthUpperUpRight', 'mouthUpperUp'], secondaryMotion * (0.22 + lipPulse * 0.42) * openBias * looseScale)

          if (isRounded) {
            addMorphTargets(['mouthFunnel', 'mouthPucker'], secondaryMotion * (0.95 + lipPulse * 0.55))
          } else if (!isClosed) {
            jawTarget += secondaryMotion * 0.18 * lipPulse * openBias
          }

          if (isClosed) {
            addMorphTargets(['mouthPressLeft', 'mouthPressRight'], secondaryMotion * 0.22)
          }
        }
      }

      if (mouthMorphs) {
        for (const m of mouthMorphs) {
          const lower = normalizeMorphName(m.name)
          let target = targetWeights.get(getMorphInstanceKey(m)) || 0
          
          if (lower === 'jawopen' || lower === 'mouthopen') {
            target = Math.max(target, jawTarget)
          } else if (lower.includes('mouthclose') || lower.includes('mouthpress')) {
            target = Math.min(target * lipProfile.closeScale, 0.28)
          } else if (lower.includes('mouthstretch')) {
            target = Math.min(target * lipProfile.stretchScale, 0.34)
          } else {
            target = Math.min(target, lipProfile.maxTarget)
          }

          // Smooth enough for natural lips, still fast enough to stay aligned.
          const current = m.mesh.morphTargetInfluences[m.index] || 0
          m.mesh.morphTargetInfluences[m.index] = current + (target - current) * lipProfile.smoothing
        }
      } else {
        resetMouthMorphs(0.36)
      }
      applyExpression(isSpeaking ? 0.6 : 0.35, 0.12)

      if (bJaw) {
        const hasVisemeSupport = mouthMorphs && mouthMorphs.some(m => normalizeMorphName(m.name).startsWith('viseme'))
        const jawBoneScale = hasVisemeSupport ? 0.015 : 0.1
        bJaw.rotation.x = safeLerp(bJaw.rotation.x, Math.max(0, jawTarget * jawBoneScale), 0.35)
        bJaw.rotation.z = safeLerp(bJaw.rotation.z, 0, 0.1)
      }

      const speechMotion = isSpeaking ? 0.1 : 0
      const talkLookYaw = userLookYaw * 0.46
      const talkLookPitch = userLookPitch * 0.38
      applyRelaxedArms(Math.sin(t * 1.1) * 0.025, 0.08)
      if (bSpine) {
        bSpine.rotation.z = safeLerp(bSpine.rotation.z, bSpine.userData.initRot.z + Math.sin(t * 0.8) * 0.01, 0.06)
        bSpine.rotation.x = safeLerp(bSpine.rotation.x, bSpine.userData.initRot.x + Math.sin(t * 0.5) * 0.005 + speechMotion * 0.25, 0.06)
        bSpine.rotation.y = safeLerp(bSpine.rotation.y, bSpine.userData.initRot.y + talkLookYaw * 0.12, 0.06)
      }

      if (bNeck) {
        bNeck.rotation.x = safeLerp(bNeck.rotation.x, bNeck.userData.initRot.x + talkLookPitch * 0.34 + Math.sin(t * 0.6) * 0.008 + speechMotion * 0.3, 0.06)
        bNeck.rotation.y = safeLerp(bNeck.rotation.y, bNeck.userData.initRot.y + talkLookYaw * 0.32 + Math.sin(t * 0.4) * 0.02, 0.06)
        bNeck.rotation.z = safeLerp(bNeck.rotation.z, bNeck.userData.initRot.z, 0.06)
      }

      if (bHead) {
        bHead.rotation.y = safeLerp(bHead.rotation.y, bHead.userData.initRot.y + talkLookYaw * 0.42 + Math.sin(t * 0.5) * 0.03, 0.06)
        bHead.rotation.x = safeLerp(bHead.rotation.x, bHead.userData.initRot.x + talkLookPitch * 0.42 + Math.sin(t * 0.7) * 0.015 + speechMotion * 0.5, 0.06)
        bHead.rotation.z = safeLerp(bHead.rotation.z, bHead.userData.initRot.z + Math.sin(t * 0.3) * 0.01, 0.06)
      }

      // Keep soft eye contact with the user/cursor while talking.
      if (bLeftEye) {
        const eyeBase = bLeftEye.userData.initRot
        bLeftEye.rotation.y = safeLerp(bLeftEye.rotation.y, (eyeBase?.y || 0) + talkLookYaw * 0.2, 0.12)
        bLeftEye.rotation.x = safeLerp(bLeftEye.rotation.x, (eyeBase?.x || 0) + talkLookPitch * 0.18, 0.12)
        bLeftEye.rotation.z = safeLerp(bLeftEye.rotation.z, eyeBase?.z || 0, 0.1)
      }
      if (bRightEye) {
        const eyeBase = bRightEye.userData.initRot
        bRightEye.rotation.y = safeLerp(bRightEye.rotation.y, (eyeBase?.y || 0) + talkLookYaw * 0.2, 0.12)
        bRightEye.rotation.x = safeLerp(bRightEye.rotation.x, (eyeBase?.x || 0) + talkLookPitch * 0.18, 0.12)
        bRightEye.rotation.z = safeLerp(bRightEye.rotation.z, eyeBase?.z || 0, 0.1)
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

      if (talkAnim && bgMode !== 'sitting_room') {
        mixer.update(delta)
      }

    } else if (action === 'dance') {
      if (bSpine) bSpine.rotation.z = bSpine.userData.initRot.z + Math.sin(t * 4) * 0.1
      if (bHead) bHead.rotation.z = bHead.userData.initRot.z + Math.sin(t * 4) * 0.2
      if (bLeftArm) { bLeftArm.rotation.x = bLeftArm.userData.initRot.x + Math.sin(t * 6); bLeftArm.rotation.z = bLeftArm.userData.initRot.z + 1.0 }
      if (bRightArm) { bRightArm.rotation.x = bRightArm.userData.initRot.x - Math.sin(t * 6); bRightArm.rotation.z = bRightArm.userData.initRot.z - 1.0 }
    }

    if (!blinkMorphsRef.current?.length && action !== 'dance') {
      const eyeScaleY = 1 - blinkAmount * 0.82
      if (bLeftEye) bLeftEye.scale.y = safeLerp(bLeftEye.scale.y || 1, eyeScaleY, 0.55)
      if (bRightEye) bRightEye.scale.y = safeLerp(bRightEye.scale.y || 1, eyeScaleY, 0.55)
    }

    // ── Sitting Posture Post-Processing Override ──
    const shouldSit = bgMode === 'sitting_room' && action !== 'dance'

    if (shouldSit) {
      const sitTalkLookYaw = isTalking ? userLookYaw * 0.34 : 0
      const sitTalkLookPitch = isTalking ? userLookPitch * 0.3 : 0

      // 1. Position hips sitting down and slightly back relative to cached initPos
      if (bHips && bHips.userData.initPos) {
        bHips.position.y = bHips.userData.initPos.y - 0.4
        bHips.position.z = bHips.userData.initPos.z - 0.24
      }

      if (bSpine?.userData.initRot) {
        bSpine.rotation.x = safeLerp(bSpine.rotation.x, bSpine.userData.initRot.x + 0.04 + sitTalkLookPitch * 0.08, 0.1)
        bSpine.rotation.y = safeLerp(bSpine.rotation.y, bSpine.userData.initRot.y + sitTalkLookYaw * 0.08, 0.1)
        bSpine.rotation.z = safeLerp(bSpine.rotation.z, bSpine.userData.initRot.z, 0.1)
      }
      if (bNeck?.userData.initRot) {
        bNeck.rotation.x = safeLerp(bNeck.rotation.x, bNeck.userData.initRot.x - 0.07 + sitTalkLookPitch * 0.26, 0.1)
        bNeck.rotation.y = safeLerp(bNeck.rotation.y, bNeck.userData.initRot.y + sitTalkLookYaw * 0.3, 0.1)
        bNeck.rotation.z = safeLerp(bNeck.rotation.z, bNeck.userData.initRot.z, 0.1)
      }
      if (bHead?.userData.initRot) {
        bHead.rotation.x = safeLerp(bHead.rotation.x, bHead.userData.initRot.x - 0.12 + sitTalkLookPitch * 0.42 + Math.sin(t * 0.7) * 0.01, 0.1)
        bHead.rotation.y = safeLerp(bHead.rotation.y, bHead.userData.initRot.y + sitTalkLookYaw * 0.42, 0.1)
        bHead.rotation.z = safeLerp(bHead.rotation.z, bHead.userData.initRot.z, 0.1)
      }
      ;[bLeftEye, bRightEye].forEach((eye) => {
        if (!eye?.userData.initRot) return
        eye.rotation.x = safeLerp(eye.rotation.x, eye.userData.initRot.x - 0.04 + sitTalkLookPitch * 0.18, 0.16)
        eye.rotation.y = safeLerp(eye.rotation.y, eye.userData.initRot.y + sitTalkLookYaw * 0.2, 0.16)
        eye.rotation.z = safeLerp(eye.rotation.z, eye.userData.initRot.z, 0.16)
      })

      // 2. Legs in chair pose. This GLB's thighs have mirrored ~180deg Z rest rotations,
      // so keep the rest Z/Y axes and bend relative to the imported pose.
      const thighBend = Math.PI / 2 - 0.1
      const kneeBend = Math.PI / 2 - 0.05
      const footLift = 0.72
      const legSplay = 0.05
      const sitLerp = 0.12

      const applySeatedLeg = (upperLeg, lowerLeg, foot, side) => {
        if (upperLeg?.userData.initRot) {
          upperLeg.rotation.x = safeLerp(upperLeg.rotation.x, upperLeg.userData.initRot.x - thighBend, sitLerp)
          upperLeg.rotation.y = safeLerp(upperLeg.rotation.y, upperLeg.userData.initRot.y + side * legSplay, sitLerp)
          upperLeg.rotation.z = safeLerp(upperLeg.rotation.z, upperLeg.userData.initRot.z, sitLerp)
        }
        if (lowerLeg?.userData.initRot) {
          lowerLeg.rotation.x = safeLerp(lowerLeg.rotation.x, lowerLeg.userData.initRot.x - kneeBend, sitLerp)
          lowerLeg.rotation.y = safeLerp(lowerLeg.rotation.y, lowerLeg.userData.initRot.y, sitLerp)
          lowerLeg.rotation.z = safeLerp(lowerLeg.rotation.z, lowerLeg.userData.initRot.z, sitLerp)
        }
        if (foot?.userData.initRot) {
          foot.rotation.x = safeLerp(foot.rotation.x, foot.userData.initRot.x + footLift, sitLerp)
          foot.rotation.y = safeLerp(foot.rotation.y, foot.userData.initRot.y, sitLerp)
          foot.rotation.z = safeLerp(foot.rotation.z, foot.userData.initRot.z, sitLerp)
        }
      }

      applySeatedLeg(bLeftUpLeg, bLeftLeg, bLeftFoot, 1)
      applySeatedLeg(bRightUpLeg, bRightLeg, bRightFoot, -1)

      // 4. Arms forward on the table. In this GLB, the named left arm is the
      // visible right-side working arm in the seated camera, so it drives mouse grip.
      const mouseSlide = Math.sin(t * 1.5) * Math.cos(t * 0.7) * 0.02
      const mouseGripPulse = Math.sin(t * 3.2) * 0.015
      if (bLeftShoulder?.userData.initRot) {
        bLeftShoulder.rotation.x = safeLerp(bLeftShoulder.rotation.x, 1.42, 0.08)
        bLeftShoulder.rotation.y = safeLerp(bLeftShoulder.rotation.y, -0.3, 0.08)
        bLeftShoulder.rotation.z = safeLerp(bLeftShoulder.rotation.z, -1.6, 0.08)
      }
      if (bLeftArm) {
        bLeftArm.rotation.x = safeLerp(bLeftArm.rotation.x, 3.37 + mouseGripPulse * 0.4, 0.12)
        bLeftArm.rotation.y = safeLerp(bLeftArm.rotation.y, 2.47 + mouseSlide * 1.4, 0.12)
        bLeftArm.rotation.z = safeLerp(bLeftArm.rotation.z, -2.60, 0.12)
      }
      if (bLeftForeArm) {
        bLeftForeArm.rotation.x = safeLerp(bLeftForeArm.rotation.x, -2.64 + mouseGripPulse, 0.12)
        bLeftForeArm.rotation.y = safeLerp(bLeftForeArm.rotation.y, 0.42 + mouseSlide * 1.6, 0.12)
        bLeftForeArm.rotation.z = safeLerp(bLeftForeArm.rotation.z, 1.49, 0.12)
      }
      if (bLeftHand) {
        bLeftHand.rotation.x = safeLerp(bLeftHand.rotation.x, -0.59 + mouseGripPulse * 0.5, 0.12)
        bLeftHand.rotation.y = safeLerp(bLeftHand.rotation.y, -0.07 + mouseSlide * 1.1, 0.12)
        bLeftHand.rotation.z = safeLerp(bLeftHand.rotation.z, 0.35, 0.12)
      }
      bLeftMouseFingers.forEach((finger) => {
        if (!finger.userData.initRot) return
        const isThumb = finger.name.toLowerCase().includes('thumb')
        const curl = isThumb ? 0.18 : 0.42
        finger.rotation.x = safeLerp(finger.rotation.x, finger.userData.initRot.x + curl, 0.12)
      })

      const typeWobbleX = Math.sin(t * 16) * 0.025
      const typeWobbleY = Math.cos(t * 24) * 0.015
      if (bRightShoulder?.userData.initRot) {
        bRightShoulder.rotation.x = safeLerp(bRightShoulder.rotation.x, 1.42, 0.08)
        bRightShoulder.rotation.y = safeLerp(bRightShoulder.rotation.y, 0.3, 0.08)
        bRightShoulder.rotation.z = safeLerp(bRightShoulder.rotation.z, 1.6, 0.08)
      }
      if (bRightArm) {
        bRightArm.rotation.x = safeLerp(bRightArm.rotation.x, 3.18 + typeWobbleX * 0.35, 0.12)
        bRightArm.rotation.y = safeLerp(bRightArm.rotation.y, -2.2 + typeWobbleY * 0.9, 0.12)
        bRightArm.rotation.z = safeLerp(bRightArm.rotation.z, 2.28, 0.12)
      }
      if (bRightForeArm) {
        bRightForeArm.rotation.x = safeLerp(bRightForeArm.rotation.x, -2.42 + typeWobbleX, 0.12)
        bRightForeArm.rotation.y = safeLerp(bRightForeArm.rotation.y, -0.34 + typeWobbleY, 0.12)
        bRightForeArm.rotation.z = safeLerp(bRightForeArm.rotation.z, -1.32, 0.12)
      }
      if (bRightHand) {
        bRightHand.rotation.x = safeLerp(bRightHand.rotation.x, -0.72 + typeWobbleX * 0.5, 0.12)
        bRightHand.rotation.y = safeLerp(bRightHand.rotation.y, 0.08 + typeWobbleY * 0.5, 0.12)
        bRightHand.rotation.z = safeLerp(bRightHand.rotation.z, -0.28, 0.12)
      }
      bRightMouseFingers.forEach((finger) => {
        if (!finger.userData.initRot) return
        const isThumb = finger.name.toLowerCase().includes('thumb')
        const curl = isThumb ? 0.05 : 0.12 + Math.max(typeWobbleX, 0) * 1.2
        finger.rotation.x = safeLerp(finger.rotation.x, finger.userData.initRot.x + curl, 0.12)
      })
    } else {
      // Smoothly blend hips & legs back to default standing pose
      if (bHips && bHips.userData.initPos) {
        bHips.position.y = safeLerp(bHips.position.y, bHips.userData.initPos.y, 0.1)
        bHips.position.z = safeLerp(bHips.position.z, bHips.userData.initPos.z, 0.1)
      }
      ;[bLeftUpLeg, bRightUpLeg, bLeftLeg, bRightLeg, bLeftFoot, bRightFoot].forEach(b => {
        if (b && b.userData.initRot) {
          b.rotation.x = safeLerp(b.rotation.x, b.userData.initRot.x, 0.1)
          b.rotation.y = safeLerp(b.rotation.y, b.userData.initRot.y, 0.1)
          b.rotation.z = safeLerp(b.rotation.z, b.userData.initRot.z, 0.1)
        }
      })
        // Forearms and hands back to default
        ;[
          bLeftShoulder, bRightShoulder, bLeftForeArm, bRightForeArm, bLeftHand, bRightHand,
          ...bLeftMouseFingers, ...bRightMouseFingers,
        ].forEach(b => {
          if (b && b.userData.initRot) {
            b.rotation.x = safeLerp(b.rotation.x, b.userData.initRot.x, 0.1)
            b.rotation.y = safeLerp(b.rotation.y, b.userData.initRot.y, 0.1)
            b.rotation.z = safeLerp(b.rotation.z, b.userData.initRot.z, 0.1)
          }
        })
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

Object.values(AVATAR_MODELS).forEach((model) => useGLTF.preload(model.url))
Object.values(RPM_TALK_ANIMATIONS).forEach((url) => useGLTF.preload(url))
