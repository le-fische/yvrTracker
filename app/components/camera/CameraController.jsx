'use client'

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { DEFAULT_FOV, AIRCRAFT_BASE_Y } from '../core/constants'
import { CAMERA_VIEWS } from './views'

export default function CameraController({ cameraMode, selectedAircraftId, resetTrigger, chaseViewIndex }) {
  const controlsRef = useRef()
  const { camera, gl } = useThree()
  
  const lookRefs = useRef({ yaw: 0, pitch: 0, isDragging: false, lastX: 0, lastY: 0 })

  useEffect(() => {
    const dom = gl.domElement;
    const onDown = (e) => {
      if (chaseViewIndex > 0 && CAMERA_VIEWS[chaseViewIndex]?.id === 'COCKPIT') {
        lookRefs.current.isDragging = true;
        lookRefs.current.lastX = e.clientX;
        lookRefs.current.lastY = e.clientY;
      }
    };
    const onMove = (e) => {
      if (lookRefs.current.isDragging && chaseViewIndex > 0 && CAMERA_VIEWS[chaseViewIndex]?.id === 'COCKPIT') {
        const dx = e.clientX - lookRefs.current.lastX;
        const dy = e.clientY - lookRefs.current.lastY;
        lookRefs.current.lastX = e.clientX;
        lookRefs.current.lastY = e.clientY;
        
        lookRefs.current.yaw -= dx * 0.005;
        lookRefs.current.pitch -= dy * 0.005;
        // Clamp pitch to +/- 70 degrees
        lookRefs.current.pitch = Math.max(-1.2, Math.min(1.2, lookRefs.current.pitch));
      }
    };
    const onUp = () => { lookRefs.current.isDragging = false; };
    
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gl, chaseViewIndex])

  // Reset look on aircraft or view change
  useEffect(() => {
    lookRefs.current.yaw = 0;
    lookRefs.current.pitch = 0;
  }, [selectedAircraftId, chaseViewIndex])

  useEffect(() => {
    const handleWheel = (e) => {
      if (cameraMode === 'TOWER') {
        e.preventDefault()
        e.stopPropagation()
        camera.fov += e.deltaY * 0.05
        camera.fov = Math.max(2, Math.min(camera.fov, DEFAULT_FOV))
        camera.updateProjectionMatrix()
      }
    }
    const domElement = gl.domElement;
    domElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => domElement.removeEventListener('wheel', handleWheel)
  }, [cameraMode, camera, gl])

  useEffect(() => {
    if (cameraMode !== 'TOWER') {
      camera.fov = DEFAULT_FOV
      camera.updateProjectionMatrix()
    }
  }, [cameraMode, camera])

  useEffect(() => {
    if (resetTrigger > 0 && controlsRef.current && cameraMode === 'GLOBAL' && !selectedAircraftId) {
      controlsRef.current.target.set(4.06, 0, -0.25)
    }
  }, [resetTrigger, cameraMode, selectedAircraftId])

  useFrame(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    const aircraftRef = selectedAircraftId && typeof window !== 'undefined' ? window.aircraftRefs?.[selectedAircraftId] : null;

    if (cameraMode === 'TOWER') {
      const towerPos = new THREE.Vector3(4.06, 0.7, -0.25);
      controls.enableZoom = false;
      controls.enablePan = false;
      
      if (aircraftRef) {
        controls.enabled = false; 
        camera.position.copy(towerPos);
        const planePos = new THREE.Vector3();
        aircraftRef.getWorldPosition(planePos);
        
        const targetRotation = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(camera.position, planePos, camera.up)
        );
        if (camera.quaternion.angleTo(targetRotation) > 0.05) {
          camera.quaternion.slerp(targetRotation, 0.05);
        } else {
          camera.quaternion.copy(targetRotation);
        }
      } else {
        controls.enabled = true;
        controls.enableZoom = true;
        controls.minDistance = 0.0001;
        controls.maxDistance = 0.0001;
        controls.target.copy(towerPos);
      }
    } else {
      controls.minDistance = 1;
      controls.maxDistance = 200;

      if (aircraftRef) {
        const planePos = new THREE.Vector3();
        aircraftRef.getWorldPosition(planePos);
        
        if (controls.target.distanceTo(planePos) > 0.5) {
          controls.target.lerp(planePos, 0.05);
        } else {
          controls.target.copy(planePos);
        }
        
        if (chaseViewIndex > 0 && CAMERA_VIEWS[chaseViewIndex]) {
          controls.enabled = false;
          const view = CAMERA_VIEWS[chaseViewIndex];
          const metrics = aircraftRef.userData.metrics;
          
          let offset = new THREE.Vector3();
          
          if (view.id === 'COCKPIT' || view.id === 'TAIL') {
             if (metrics) {
                const height = metrics.maxY - metrics.minY;
                const length = metrics.maxZ - metrics.minZ;
                if (view.id === 'COCKPIT') {
                   // Proportional ahead of nose and up from bottom
                   offset.set(0, AIRCRAFT_BASE_Y + height * 0.45, metrics.minZ - length * 0.05);
                } else if (view.id === 'TAIL') {
                   // Proportional above and behind fin
                   offset.set(0, AIRCRAFT_BASE_Y + height * 1.5, metrics.maxZ + length * 0.2);
                }
             } else {
                offset.fromArray([0, 0.4, 1.2]); // Fallback to CHASE
             }
          } else if (view.offset) {
             offset.fromArray(view.offset);
          }
          
          offset.applyQuaternion(aircraftRef.quaternion);
          const targetCamPos = planePos.clone().add(offset);
          camera.position.copy(targetCamPos);
          
          const { yaw, pitch } = lookRefs.current;
          
          if (view.lookAt === 'forward') {
             // Forward vector in world space (-Z locally)
             const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraftRef.quaternion);
             const lookTarget = targetCamPos.clone().add(forward);
             const targetRotation = new THREE.Quaternion().setFromRotationMatrix(
                new THREE.Matrix4().lookAt(camera.position, lookTarget, camera.up)
             );
             // Apply free look offsets only if COCKPIT
             if (view.id === 'COCKPIT') {
                 const euler = new THREE.Euler().setFromQuaternion(targetRotation, 'YXZ');
                 euler.y += yaw;
                 euler.x += pitch;
                 camera.quaternion.setFromEuler(euler);
             } else {
                 camera.quaternion.copy(targetRotation);
             }
          } else {
             // 'aircraft' lookAt
             const targetRotation = new THREE.Quaternion().setFromRotationMatrix(
               new THREE.Matrix4().lookAt(camera.position, planePos, camera.up)
             );
             // Apply free look offsets only if COCKPIT
             if (view.id === 'COCKPIT') {
                 const euler = new THREE.Euler().setFromQuaternion(targetRotation, 'YXZ');
                 euler.y += yaw;
                 euler.x += pitch;
                 camera.quaternion.setFromEuler(euler);
             } else {
                 camera.quaternion.copy(targetRotation);
             }
          }
        } else {
          controls.enabled = true;
          controls.enableZoom = true;
          controls.enablePan = true;
        }
      } else {
        controls.enabled = true;
        controls.enableZoom = true;
        controls.enablePan = true;
        
        if (typeof window.lastResetTrigger === 'undefined') window.lastResetTrigger = 0;
        
        if (resetTrigger > window.lastResetTrigger) {
           window.isResetting = true;
           window.lastResetTrigger = resetTrigger;
        }

        if (window.isResetting) {
           const defaultTarget = new THREE.Vector3(4.06, 0, -0.25);
           const defaultPos = new THREE.Vector3(4, 10, 18);
           controls.target.lerp(defaultTarget, 0.05);
           camera.position.lerp(defaultPos, 0.05);
           
           if (controls.target.distanceTo(defaultTarget) < 0.1 && camera.position.distanceTo(defaultPos) < 0.1) {
               window.isResetting = false;
           }
        }
      }
    }
    
    if (controls.enabled) {
      controls.update();
    }
  })

  return <OrbitControls ref={controlsRef} target={[4.06, 0, -0.25]} maxPolarAngle={Math.PI / 2 - 0.01} makeDefault />
}
