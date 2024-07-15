import './styles/style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const canvas = document.querySelector('.webgl');
const scene = new THREE.Scene();
const gltfLoader = new GLTFLoader()
const sizes = { width: window.innerWidth, height: window.innerHeight }
const directionalLight = new THREE.DirectionalLight('#ffffff', .6)
const ambientLight = new THREE.AmbientLight("#ffffff", .5)
const camera = new THREE.PerspectiveCamera(10, sizes.width / sizes.height, 0.1, 500)
const controls = new OrbitControls(camera, canvas)

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
})
const minPan = new THREE.Vector3( -5, -2, -5 )
const maxPan = new THREE.Vector3( 5, 2, 5 )
const effect = new OutlineEffect( renderer )

let mixer
let clock = new THREE.Clock()

const vertexShader = `
    #include <common>
    #include <shadowmap_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <worldpos_vertex>
        #include <shadowmap_vertex>

        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        vec4 clipPosition = projectionMatrix * viewPosition;

        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-viewPosition.xyz);

        gl_Position = clipPosition;
    }
`


const fragmentShader = `
    #include <common>
    #include <packing>
    #include <lights_pars_begin>
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>

    uniform vec3 uColor;
    uniform float uGlossiness;

    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
        // shadow map
        DirectionalLightShadow directionalShadow = directionalLightShadows[0];

        float shadow = getShadow(
            directionalShadowMap[0],
            directionalShadow.shadowMapSize,
            directionalShadow.shadowBias,
            directionalShadow.shadowRadius,
            vDirectionalShadowCoord[0]
        );

        // directional light
        float NdotL = dot(vNormal, directionalLights[0].direction);
        float lightIntensity = smoothstep(0.0, .05, NdotL * shadow);
        vec3 directionalLight = directionalLights[0].color * lightIntensity;
        
        // specular reflection
        vec3 halfVector = normalize(directionalLights[0].direction + vViewDir);
        float NdotH = dot(vNormal, halfVector);

        float specularIntensity = pow(NdotH * lightIntensity, 1000.0 / uGlossiness);
        float specularIntensitySmooth = smoothstep(0.05, 0.1, specularIntensity);

        vec3 specular = specularIntensitySmooth * directionalLights[0].color;
        
        // rim lighting
        float rimDot = 1.0 - dot(vViewDir, vNormal);
        float rimAmount = 0.6;

        float rimThreshold = 0.2;
        float rimIntensity = rimDot * pow(NdotL, rimThreshold);
        rimIntensity = smoothstep(rimAmount - 0.01, rimAmount + 0.01, rimIntensity);

        vec3 rim = rimIntensity * directionalLights[0].color;
        
        gl_FragColor = vec4(uColor * (ambientLightColor + directionalLight + specular + rim), 1.0);
    }
`

gltfLoader.load(
    'model.glb',
    (gltf) => {
        gltf.scene.traverse( child => {

            if(child.isMesh) {
                const shaderMaterial = new THREE.ShaderMaterial({
                    lights: true,
                    uniforms: { 
                        ...THREE.UniformsLib.lights, 
                        uColor: { value: new THREE.Color('#ffffff') },
                        uGlossiness: { value: 4 }
                    },
                    vertexShader,
                    fragmentShader
                })

                shaderMaterial.userData.outlineParameters = {
                    thickness: 0.004,
                    color: [0, 0, 0],
                    alpha: 1,
                    keepAlive: true,
                    visible: true
                }
                
                shaderMaterial.uniforms.uColor.value = new THREE.Color(getMaterials(child.material.name))
                 
                child.material = shaderMaterial
                child.castShadow = true
            }
        })

        const animations = gltf.animations
        mixer = new THREE.AnimationMixer(gltf.scene)
        animations.forEach( clip => mixer.clipAction(clip).play())

        scene.add(gltf.scene)
    }
)

const getLights = () => {
    directionalLight.position.set(-2, 2, 1);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 150;
    scene.add(directionalLight, ambientLight)
}

const getCamera = () => {
    camera.position.x = 5
    camera.position.y = 2.25
    camera.position.z = 6
    scene.add(camera)
}

const getRenderer = () => {
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.CineonToneMapping
    renderer.toneMappingExposure = 1.75
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.physicallyCorrectLights = true
}

const getControls = () => {
    controls.enableDamping = true
    controls.enableZoom = true
    controls.enablePan = true
    controls.minDistance = 5 //max zoom
    controls.maxDistance = 10
    controls.minPolarAngle = Math.PI / 2.25
    controls.maxPolarAngle = Math.PI / 2
    controls.minAzimuthAngle = - Math.PI / 16
    controls.maxAzimuthAngle = Math.PI / 2
}

const getMaterials = (name) => {
    const materialColors = {
        'Gameboy': '#6063AA',
        'Casette': '#81B2DB',
        'Button': '#252232',
        'Grass': '#719c57',
        'Border': '#000223',
        'Pipe': '#aaf683',
        'Planta': '#84a570',
        'Mushroom': '#fbfefb',
        'Mushroom Top': '#e27396',
        'Mushroom Top2': '#407FB0',
        'Cube': '#F8E886',
        'Text': '#ffffff',
        'Led': '#8AFF64'
    }

    if (materialColors.hasOwnProperty(name)) {
        return materialColors[name]
    }
}


const tick = () => {
    controls.update()
    controls.target.clamp( minPan, maxPan )
	effect.render(scene, camera)
    window.requestAnimationFrame(tick)

    let delta = clock.getDelta()
    if ( mixer ) mixer.update( delta )
}

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
})

getControls()
getRenderer()
getCamera()
getLights()
tick()
