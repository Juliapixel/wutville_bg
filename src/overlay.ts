import { RepeatWrapping, ShaderMaterial, Texture, WebGLRenderer, WebGLRenderTarget } from "three";
import { ShaderPass } from "three/examples/jsm/Addons.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";

export const shader = {
    name: "OverlayPassShader",
    fragmentShader: `
    uniform sampler2D tDiffuse;

    uniform sampler2D tMap;

    uniform highp float alpha;

    uniform highp float timestamp;

    varying highp vec2 vUv;

    void main() {
        ivec2 size = textureSize(tDiffuse, 0);
        vec2 newUv = vec2(vUv.x * float(size.x) / float(size.y), vUv.y);

        vec2 uv1 = newUv / 1.5;
        uv1.x += timestamp / 4.0 + sin(timestamp) / 6.0;
        uv1.y += timestamp / 3.0;
        highp vec4 texel = texture2D(tMap, uv1);

        vec2 uv2 = newUv * 2.0;
        uv2.x += timestamp / 6.0 + cos(timestamp) / 6.0;
        uv2.y += timestamp / 3.0;
        highp vec4 texel2 = texture2D(tMap, uv2);

        vec2 uv3 = newUv * 5.0;
        uv3.x += timestamp / 9.0 + cos(timestamp) / 6.0;
        uv3.y += timestamp / 3.0;
        highp vec4 texel3 = texture2D(tMap, uv3);

        gl_FragColor =
            texture2D(tDiffuse, vUv)
            + (texel * texel.a * alpha * 0.3);
        gl_FragColor =
            gl_FragColor
            + (texel2 * texel2.a * alpha * 0.6);
        gl_FragColor =
            gl_FragColor
            + (texel3 * texel3.a * alpha * 0.4);

        // gl_FragColor = texture2D(tDiffuse, newUv);
    }`,
    vertexShader: `
    varying vec2 vUv;

    void main () {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
    `,

}

export class SnowPass extends ShaderPass {
    map: Texture;

    constructor(map: Texture, alpha: number) {
        map.wrapS = RepeatWrapping;
        map.wrapT = RepeatWrapping;

        let mat = new ShaderMaterial({
            fragmentShader: shader.fragmentShader,
            vertexShader: shader.vertexShader,
            uniforms: {
                "tMap": {value: map},
                "timestamp": {value: 0},
                "alpha": {value: alpha}
            },
            transparent: true
        })
        super(mat)
    }

    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
        this.uniforms[ this.textureID ] = { value: readBuffer.texture }
        this.uniforms.timestamp.value += deltaTime;

        this.fsQuad.material = this.material;

        if ( this.renderToScreen ) {

            renderer.setRenderTarget( null );
            this.fsQuad.render( renderer );

        } else {

            renderer.setRenderTarget( writeBuffer );
            if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
            this.fsQuad.render( renderer );

        }
    }
}
