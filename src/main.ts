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

import { EmotesClient, EmoteObject, CallbackEmoteInfo } from "twitch-emote-client";

import { SnowPass } from "./overlay";
import { RingBuffer } from "./ringbuffer";

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
camera.position.z = 5;

const scene = new Scene();

let loadingManager = new LoadingManager();
let gltfLoader = new GLTFLoader(loadingManager);

let sunDir = new Vector3();
let walkAnim: AnimationClip;

// load the scene from blender
await gltfLoader.loadAsync("/wutville.glb").then((glb) => {
    // things this animation are applied to must all be called "root" or it no
    // workie
    walkAnim = glb.animations[0];
    walkAnim.tracks.forEach((val) => {
        val.name = val.name.replace("Plane001", "root");
    });

    camera.position.copy(glb.cameras[0].position);
    camera.rotation.copy(glb.cameras[0].rotation);

    glb.scene.traverse((obj) => {
        // blender lights are really fucking strong
        if (obj instanceof Light) {
            obj.intensity *= 0.003;
        }
    });

    scene.add(glb.scene);
});

scene.add(new AmbientLight("#bdd6ff", 0.6));
scene.fog = new Fog("#20538a", 5, 75);

new TextureLoader(loadingManager).loadAsync("/skybox.png").then((t) => {
    t.mapping = EquirectangularReflectionMapping;
    t.colorSpace = SRGBColorSpace;
    scene.background = t;
});

const renderer = new WebGLRenderer({ antialias: false, stencil: false });

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;

// cool post-processing
let composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);

composer.addPass(new RenderPass(scene, camera));

let snow = await new TextureLoader(loadingManager).loadAsync("/snow.png");
snow.colorSpace = SRGBColorSpace;
composer.addPass(new SnowPass(snow, 0.5));

let smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

composer.addPass(new OutputPass());

// separate from three.js hierarchy, we want to keep track of emotes
// to update them with custom logic every render tick
declare module "twitch-emote-client" {
    interface EmoteObject {
        updateAnim: (deltaTime: number) => void;
        userData: {
            timestamp: number;
            lifetime?: number;
            lifespan: number;
            velocity: Vector3;
        };
    }
}

const sceneEmoteArray: EmoteObject[] = [];
let emoteQueue = new RingBuffer<EmoteObject>(50);

setInterval(() => {
    let emote = emoteQueue.dequeue();
    if (emote === undefined) {
        return;
    }
    emote.userData.timestamp = Date.now()
    sceneEmoteArray.push(emote)
    scene.add(emote)
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
        if (element.userData.timestamp + element.userData.lifespan < Date.now()) {
            sceneEmoteArray.splice(index, 1);
            scene.remove(element);
        } else if (element.updateAnim) {
            element.updateAnim(delta);
        }
    }

    composer.render(delta);

    // update stats and shit
    if (stats && emoteCountPanel) {
        stats.end();
        if (sceneEmoteArray.length > 0) {
            emoteCountPanel.update(
                sceneEmoteArray
                    .map((group) => group.children.length)
                    .reduce((sum, cur) => (sum += cur)),
                50
            );
        } else {
            emoteCountPanel.update(0, 50);
        }
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
const spawnEmote = (emotes: CallbackEmoteInfo[], channel: string) => {
    //prevent lag caused by emote buildup when you tab out from the page for a while
    if (performance.now() - lastFrame > 1000) return;

    let slicedEmotes = emotes.slice(0, 12);
    for (const emote of slicedEmotes) {
        new EmoteObject(emote.source, client.config.emotesApi, emote, (obj) => {
            // make it smoller
            obj.scale.multiplyScalar(0.8);

            obj.userData.timestamp = 0;
            obj.name = "root";

            let mixer = new AnimationMixer(obj);
            let action = mixer.clipAction(walkAnim);
            action.play();

            obj.userData.lifespan = walkAnim.duration * 1000;

            obj.updateAnim = (deltaTime: number) => {
                obj.animateTexture((performance.now() + obj.userData.timestamp) / 1000)
                mixer.update(deltaTime);

                // make it point the right way
                obj.rotateX(-Math.PI / 2);
                obj.rotateZ(Math.PI / 2);
                obj.translateY(-0.2);
            };

            emoteQueue.enqueue(obj)
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
