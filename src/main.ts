import "./style.css";

import {
    AmbientLight,
    AnimationClip,
    AnimationMixer,
    ArrowHelper,
    DirectionalLight,
    EquirectangularReflectionMapping,
    Fog,
    Group,
    Light,
    LoadingManager,
    Mesh,
    MeshStandardMaterial,
    PCFShadowMap,
    PerspectiveCamera,
    Plane,
    PlaneHelper,
    RepeatWrapping,
    Scene,
    SRGBColorSpace,
    TextureLoader,
    Vector2,
    Vector3,
    WebGLRenderer
} from "three";
import {
    EffectComposer,
    GLTFLoader,
    OutputPass,
    RenderPass,
    SMAAPass,
    TexturePass
} from "three/examples/jsm/Addons.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

import {
    EmotesClient,
    EmoteObject,
    CallbackEmoteInfo,
    EmoteLoader,
    MaterialKind
} from "twitch-emote-client";

import { SnowPass } from "./overlay";
import { RingBuffer } from "./ringbuffer";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Counter } from "./counter";

// a default array of twitch channels to join
let channels: string[] = [];

// the following few lines of code will allow you to add ?channels=channel1,channel2,channel3 to the URL in order to override the default array of channels
const params = new URL(window.location.toString()).searchParams;

if (params.has("channels") || params.has("channel")) {
    const temp = params.get("channels") + "," + params.get("channel");
    channels = temp
        .split(",")
        .filter((value) => value.length > 0 && value !== "null");
}

// performance stats enabled using ?stats=true in the browser URL
let stats: Stats | undefined;
let emoteCountPanel: Stats.Panel | undefined;
if (params.get("stats") === "true") {
    stats = new Stats();
    emoteCountPanel = new Stats.Panel("EMOTES", "#f5b942", "#523909");
    stats.addPanel(emoteCountPanel);
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
}

/*
 ** Initiate ThreeJS scene
 */

let camera = new PerspectiveCamera(
    20,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

const scene = new Scene();

let loadingManager = new LoadingManager();
let gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

let walkAnim: AnimationClip;

let envMap = await new TextureLoader(loadingManager)
    .loadAsync("https://cdn.juliapixel.com/christmas/skybox.png")
    .then((t) => {
        t.mapping = EquirectangularReflectionMapping;
        t.colorSpace = SRGBColorSpace;
        return t;
    });

// load the scene from blender
await gltfLoader
    .loadAsync("https://cdn.juliapixel.com/christmas/wutville_comp.glb")
    .then((glb) => {
        // things this animation are applied to must all be called "root" or it no
        // workie
        walkAnim = glb.animations[0];
        walkAnim.tracks.forEach((val) => {
            val.name = val.name.replace("Plane001", "root");
        });

        camera.position.copy(glb.cameras[0].position);
        camera.rotation.copy(glb.cameras[0].rotation);
        camera.fov = (glb.cameras[0] as PerspectiveCamera).fov;
        camera.far = 75;
        camera.near = 0.1;
        camera.updateProjectionMatrix();

        glb.scene.traverse((obj) => {
            // blender lights are really fucking strong
            if (obj instanceof Light) {
                obj.intensity *= 0.003;
            }
            if (obj instanceof Mesh && obj.material instanceof MeshStandardMaterial) {
                obj.material.envMap = envMap
            }
        });

        scene.add(glb.scene);
    });

scene.add(new AmbientLight("#bdd6ff", 0.6));
scene.fog = new Fog("#20538a", 5, 75);

scene.background = envMap;

const renderer = new WebGLRenderer({ antialias: false, stencil: false });

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;

// cool post-processing
let composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);

composer.addPass(new RenderPass(scene, camera));

let smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

let snow = await new TextureLoader(loadingManager).loadAsync(
    "https://cdn.juliapixel.com/christmas/snow.png"
);
snow.colorSpace = SRGBColorSpace;
composer.addPass(new SnowPass(snow, 0.5));

composer.addPass(new OutputPass());

// separate from three.js hierarchy, we want to keep track of emotes
// to update them with custom logic every render tick
declare module "twitch-emote-client" {
    interface EmoteObject {
        updateAnim: (deltaTime: number) => void;
        userData: {
            timestamp: number;
            animationMixer: AnimationMixer;
        };
    }
}

const sceneEmoteArray: EmoteObject[] = [];
let emoteQueue = new RingBuffer<EmoteObject>(50);
let textureUseCount = new Counter<number>();

setInterval(() => {
    let emote = emoteQueue.dequeue();
    if (emote === undefined) {
        return;
    }
    emote.userData.timestamp = Date.now();
    sceneEmoteArray.push(emote);
    scene.add(emote);
    textureUseCount.add(emote.material.map?.id as number);
}, 500);

function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    let width = window.innerWidth;
    let height = window.innerHeight;

    renderer.setSize(width, height);
    composer.setSize(width, height);
}

/*
 ** Draw loop
 */

let lastFrame = performance.now();
function draw() {
    if (stats) stats.begin();
    requestAnimationFrame(draw);
    const delta = Math.min(1, Math.max(0, (performance.now() - lastFrame) / 1000));
    lastFrame = performance.now();

    for (let index = sceneEmoteArray.length - 1; index >= 0; index--) {
        const element = sceneEmoteArray[index];
        if (element.userData.animationMixer.time >= walkAnim.duration) {
            sceneEmoteArray.splice(index, 1);
            scene.remove(element);
            let texCount = textureUseCount.sub(element.material.map?.id as number);
            if (texCount === 0) {
                if (import.meta.env.DEV) {
                    console.debug("diposed of", element.material.map);
                }
                element.material.map?.dispose();
            }
        } else if (element.updateAnim) {
            element.updateAnim(delta);
        }
    }

    composer.render(delta);

    // update stats and shit
    if (stats && emoteCountPanel) {
        stats.end();
        emoteCountPanel.update(sceneEmoteArray.length, 50);
    }
}

/*
 ** Twitch chat configuration
 */

let client = new EmotesClient({ channels: channels });
client.on("emote", (emotes, channel) => {
    spawnEmote(emotes, channel);
});

/*
 ** Handle Twitch Chat Emotes
 */

const emoteLoader = new EmoteLoader(loadingManager, client.config.emotesApi, MaterialKind.Standard);
const spawnEmote = (emotes: CallbackEmoteInfo[], channel: string) => {
    //prevent lag caused by emote buildup when you tab out from the page for a while
    if (performance.now() - lastFrame > 1000) return;

    let slicedEmotes = emotes.slice(0, 12);
    for (const emote of slicedEmotes) {
        emoteLoader.loadAsync(emote).then((obj) => {
            // make it smoller
            obj.scale.multiplyScalar(0.8);

            obj.userData.timestamp = 0;
            obj.name = "root";

            obj.material.envMap = envMap;

            let mixer = new AnimationMixer(obj);
            let action = mixer.clipAction(walkAnim);
            action.play();

            obj.userData.animationMixer = mixer;

            obj.updateAnim = (deltaTime: number) => {
                obj.animateTexture(
                    (performance.now() + obj.userData.timestamp) / 1000
                );
                obj.userData.animationMixer.update(deltaTime);

                // make it point the right way
                obj.rotateX(-Math.PI / 2);
                obj.rotateZ(Math.PI / 2);
                obj.translateY(-0.1);
            };

            emoteQueue.enqueue(obj);
        });
    }
};

if (document.readyState != "loading") {
    window.addEventListener("resize", resize);
    if (stats) document.body.appendChild(stats.dom);
    document.body.appendChild(renderer.domElement);
    draw();
} else {
    window.addEventListener("DOMContentLoaded", () => {
        window.addEventListener("resize", resize);
        if (stats) document.body.appendChild(stats.dom);
        document.body.appendChild(renderer.domElement);
        draw();
    });
}
