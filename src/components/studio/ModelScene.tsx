import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildModel, disposeModel, sceneColor, type ModelConfig } from '@/lib/studio/model';
export default function ModelScene({config,view,zoom,reset,wireframe}:{config:ModelConfig;view:string;zoom:number;reset:number;wireframe:boolean}) {
 const host=useRef<HTMLDivElement>(null);
 const sceneRef=useRef<{scene:THREE.Scene;camera:THREE.PerspectiveCamera;controls:OrbitControls;model:THREE.Group|null}>(null);
 useEffect(()=>{const element=host.current;if(!element)return;
 const scene=new THREE.Scene();scene.background=sceneColor('--viewport');
 const camera=new THREE.PerspectiveCamera(34,1,.1,2000);camera.position.set(110,135,165);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;element.appendChild(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,5,0);controls.minDistance=80;controls.maxDistance=500;controls.maxPolarAngle=Math.PI*.49;
 scene.add(new THREE.HemisphereLight(sceneColor('--foreground'),sceneColor('--model-graphite'),3));const key=new THREE.DirectionalLight(sceneColor('--foreground'),5);key.position.set(-70,150,75);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-100;key.shadow.camera.right=100;key.shadow.camera.top=100;key.shadow.camera.bottom=-100;key.shadow.bias=-.001;scene.add(key);const fill=new THREE.DirectionalLight(sceneColor('--model-gold'),2);fill.position.set(80,30,-60);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(1500,1500),new THREE.MeshStandardMaterial({color:sceneColor('--viewport'),roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.8;floor.receiveShadow=true;scene.add(floor);
 const grid=new THREE.GridHelper(1000,100,sceneColor('--grid'),sceneColor('--grid'));grid.position.y=-.7;scene.add(grid);
 sceneRef.current={scene,camera,controls,model:null};
 const resize=()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(element);resize();let frame=0;const render=()=>{frame=requestAnimationFrame(render);controls.update();renderer.render(scene,camera);};render();
 return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();const current=sceneRef.current;if(current?.model)disposeModel(current.model);floor.geometry.dispose();(floor.material as THREE.Material).dispose();grid.geometry.dispose();(grid.material as THREE.Material).dispose();renderer.dispose();renderer.domElement.remove();sceneRef.current=null;};},[]);
 useEffect(()=>{const current=sceneRef.current;if(!current)return;if(current.model){current.scene.remove(current.model);disposeModel(current.model);}const model=buildModel(config);model.rotation.x=-Math.PI/2;model.rotation.z=-.1;model.position.y=1;model.traverse(child=>{if(child instanceof THREE.Mesh){const mats=Array.isArray(child.material)?child.material:[child.material];mats.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial)m.wireframe=wireframe;});}});current.scene.add(model);current.model=model;},[config,wireframe]);
 useEffect(()=>{const current=sceneRef.current;if(!current)return;const {camera,controls}=current;if(view==='2d')camera.position.set(0,240,1);else camera.position.set(110,135,165);camera.zoom=zoom/100;camera.updateProjectionMatrix();controls.target.set(0,5,0);controls.update();},[view,zoom,reset]);
 return <div className="scene-container" ref={host} aria-label="Modelo 3D interativo da medalha" />;
}
