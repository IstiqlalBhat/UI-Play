/**
 * JellyOS Combined Scene
 * Both Switch and Slider in the same 3D WebGPU scene
 * Shared lighting, different colors for each component
 */

import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import * as sdf from '@typegpu/sdf';
import { fullScreenTriangle } from 'typegpu/common';
import { randf } from '@typegpu/noise';

// Import behavior classes
import { SwitchBehavior } from './switch/switch.ts';
import { Slider } from './slider/slider.ts';
import { CameraController } from './switch/camera.ts';
import { TAAResolver } from './switch/taa.ts';

// Import constants and types from switch
import {
    AMBIENT_COLOR,
    AMBIENT_INTENSITY,
    AO_BIAS,
    AO_INTENSITY,
    AO_RADIUS,
    AO_STEPS,
    DARK_GROUND_ALBEDO,
    JELLY_HALFSIZE,
    JELLY_IOR,
    JELLY_SCATTER_STRENGTH,
    LIGHT_GROUND_ALBEDO,
    MAX_DIST,
    MAX_STEPS,
    SPECULAR_INTENSITY,
    SPECULAR_POWER,
    SURF_DIST,
    SWITCH_RAIL_LENGTH,
} from './switch/constants.ts';

import {
    BoundingBox,
    DirectionalLight,
    HitInfo,
    ObjectType,
    Ray,
    rayMarchLayout,
    sampleLayout,
} from './switch/dataTypes.ts';

import {
    beerLambert,
    createBackgroundTexture,
    createTextures,
    fresnelSchlick,
    intersectBox,
} from './switch/utils.ts';

// Import slider constants
import { LINE_HALF_THICK, LINE_RADIUS, GROUND_ALBEDO } from './slider/constants.ts';

// Slider data types
const SliderHitInfo = d.struct({
    distance: d.f32,
    objectType: d.u32,
    t: d.f32,
});

// Callbacks interface
export interface CombinedCallbacks {
    onSwitchToggle?: (isOn: boolean) => void;
    onSliderChange?: (percent: number) => void;
    onReady?: () => void;
}

export async function initCombinedScene(canvas: HTMLCanvasElement, callbacks?: CombinedCallbacks) {
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;

    const root = await tgpu.init({
        device: { optionalFeatures: ['timestamp-query'] },
    });

    context.configure({
        device: root.device,
        format: presentationFormat,
        alphaMode: 'premultiplied',
    });

    // Initialize behaviors
    const switchBehavior = new SwitchBehavior(root);
    await switchBehavior.init();

    const NUM_POINTS = 17;
    const slider = new Slider(
        root,
        d.vec2f(-0.5, -0.35), // Position lower and to the right
        d.vec2f(0.8, -0.35),
        NUM_POINTS,
        0,
    );

    let qualityScale = 0.7;
    let [width, height] = [canvas.width * qualityScale, canvas.height * qualityScale];

    let textures = createTextures(root, width, height);
    let backgroundTexture = createBackgroundTexture(root, width, height);

    const filteringSampler = root['~unstable'].createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    // Camera positioned to see both
    const camera = new CameraController(
        root,
        d.vec3f(0.0, 2.5, 2.5), // Higher and further back
        d.vec3f(0, -0.1, 0),     // Look slightly down
        d.vec3f(0, 1, 0),
        Math.PI / 4,
        width,
        height,
    );
    const cameraUniform = camera.cameraUniform;

    // Shared lighting
    const lightUniform = root.createUniform(DirectionalLight, {
        direction: std.normalize(d.vec3f(0.19, -0.24, 0.75)),
        color: d.vec3f(1, 1, 1),
    });

    // Different colors for each jelly
    const switchColorUniform = root.createUniform(d.vec4f, d.vec4f(0.08, 0.5, 1.0, 1.0)); // Blue
    const sliderColorUniform = root.createUniform(d.vec4f, d.vec4f(1.0, 0.45, 0.1, 1.0)); // Orange

    const darkModeUniform = root.createUniform(d.u32, d.u32(1));
    const randomUniform = root.createUniform(d.vec2f);

    // ========================================
    // GPU Shader Functions
    // ========================================

    const getRay = (ndc: d.v2f) => {
        'use gpu';
        const clipPos = d.vec4f(ndc.x, ndc.y, -1.0, 1.0);
        const invView = cameraUniform.$.viewInv;
        const invProj = cameraUniform.$.projInv;
        const viewPos = invProj.mul(clipPos);
        const viewPosNormalized = d.vec4f(viewPos.xyz.div(viewPos.w), 1.0);
        const worldPos = invView.mul(viewPosNormalized);
        const rayOrigin = invView.columns[3].xyz;
        const rayDir = std.normalize(worldPos.xyz.sub(rayOrigin));
        return Ray({ origin: rayOrigin, direction: rayDir });
    };

    // Switch position offset
    const SWITCH_OFFSET = d.vec3f(-0.3, 0.15, 0);

    const getJellyBounds = () => {
        'use gpu';
        return BoundingBox({
            min: d.vec3f(-1.5, -1, -1),
            max: d.vec3f(1.5, 1, 1),
        });
    };

    const GroundParams = {
        groundThickness: 0.03,
        groundRadius: 0.05,
        groundRoundness: 0.02,
    };

    // Ground for switch area
    const rectangleCutoutDistSwitch = (position: d.v2f) => {
        'use gpu';
        const groundRoundness = GroundParams.groundRoundness;
        const groundRadius = GroundParams.groundRadius;
        const offsetPos = d.vec2f(position.x - SWITCH_OFFSET.x, position.y);
        return sdf.sdRoundedBox2d(
            offsetPos,
            d.vec2f(SWITCH_RAIL_LENGTH * 0.5 + 0.2 + groundRoundness, groundRadius + groundRoundness),
            groundRadius + groundRoundness,
        );
    };

    // Ground for slider area
    const rectangleCutoutDistSlider = (position: d.v2f) => {
        'use gpu';
        const groundRoundness = 0.02;
        return sdf.sdRoundedBox2d(
            d.vec2f(position.x + 0.15, position.y + 0.35),
            d.vec2f(0.8, 0.15),
            groundRoundness,
        );
    };

    const getMainSceneDist = (position: d.v3f) => {
        'use gpu';
        const groundThickness = GroundParams.groundThickness;
        const groundRoundness = GroundParams.groundRoundness;

        // Main ground plane
        const ground = sdf.sdPlane(position, d.vec3f(0, 1, 0), 0.06);

        // Switch cutout
        const switchCutout = sdf.opExtrudeY(
            position,
            -rectangleCutoutDistSwitch(position.xz),
            groundThickness - groundRoundness,
        ) - groundRoundness;

        // Slider cutout
        const sliderCutout = sdf.opExtrudeY(
            position,
            -rectangleCutoutDistSlider(position.xz),
            groundThickness - groundRoundness,
        ) - groundRoundness;

        return sdf.opUnion(sdf.opUnion(ground, switchCutout), sliderCutout);
    };

    const opCheapBend = (p: d.v3f, k: number) => {
        'use gpu';
        const c = std.cos(k * p.x);
        const s = std.sin(k * p.x);
        const m = d.mat2x2f(c, -s, s, c);
        return d.vec3f(m.mul(p.xy), p.z);
    };

    const opRotateAxisAngle = (p: d.v3f, axis: d.v3f, angle: number) => {
        'use gpu';
        return std.add(
            std.mix(axis.mul(std.dot(p, axis)), p, std.cos(angle)),
            std.cross(p, axis).mul(std.sin(angle)),
        );
    };

    // Switch jelly SDF
    const getSwitchJellyDist = (position: d.v3f) => {
        'use gpu';
        const state = switchBehavior.stateUniform.$;
        const jellyOrigin = d.vec3f(
            SWITCH_OFFSET.x + (state.progress - 0.5) * SWITCH_RAIL_LENGTH -
            state.squashX * (state.progress - 0.5) * 0.2,
            SWITCH_OFFSET.y + JELLY_HALFSIZE.y * 0.5,
            0,
        );
        const jellyInvScale = d.vec3f(1 - state.squashX, 1, 1 - state.squashZ);
        const localPos = opRotateAxisAngle(
            position.sub(jellyOrigin).mul(jellyInvScale),
            d.vec3f(0, 0, 1),
            state.wiggleX,
        );
        return sdf.sdRoundedBox3d(opCheapBend(localPos, 0.8), JELLY_HALFSIZE.sub(0.1), 0.1);
    };

    // Slider rope SDF (simplified for performance)
    const getSliderApproxDist = (position: d.v3f) => {
        'use gpu';
        // Approximate slider as a horizontal capsule that follows the drag
        const endCapX = slider.endCapUniform.$.x;
        const startX = -0.5;
        const y = -0.3;

        // Simple capsule approximation
        const capsuleCenter = d.vec2f((startX + endCapX) * 0.5, y);
        const capsuleHalfLen = std.abs(endCapX - startX) * 0.5;

        const p2d = d.vec2f(position.x, position.y);
        const d2d = std.length(d.vec2f(std.max(0, std.abs(p2d.x - capsuleCenter.x) - capsuleHalfLen), p2d.y - capsuleCenter.y));

        return d2d - 0.08; // radius
    };

    const getSceneDist = (position: d.v3f) => {
        'use gpu';
        const mainScene = getMainSceneDist(position);
        const switchJelly = getSwitchJellyDist(position);
        const sliderJelly = getSliderApproxDist(position);

        const hitInfo = HitInfo();

        // Check which object is closest
        const minJelly = std.min(switchJelly, sliderJelly);

        if (minJelly < mainScene) {
            hitInfo.distance = minJelly;
            hitInfo.objectType = std.select(ObjectType.SLIDER, d.u32(2), sliderJelly < switchJelly);
        } else {
            hitInfo.distance = mainScene;
            hitInfo.objectType = ObjectType.BACKGROUND;
        }
        return hitInfo;
    };

    const getSceneDistForAO = (position: d.v3f) => {
        'use gpu';
        const mainScene = getMainSceneDist(position);
        const switchJelly = getSwitchJellyDist(position);
        const sliderJelly = getSliderApproxDist(position);
        return std.min(std.min(mainScene, switchJelly), sliderJelly);
    };

    const getApproxNormal = (p: d.v3f, e: number): d.v3f => {
        'use gpu';
        const dist = getSceneDist(p).distance;
        const n = d.vec3f(
            getSceneDist(std.add(p, d.vec3f(e, 0, 0))).distance - dist,
            getSceneDist(std.add(p, d.vec3f(0, e, 0))).distance - dist,
            getSceneDist(std.add(p, d.vec3f(0, 0, e))).distance - dist,
        );
        return std.normalize(n);
    };

    const getNormal = (position: d.v3f) => {
        'use gpu';
        if (std.abs(position.z) > 0.5 || std.abs(position.x) > 1.5) {
            return d.vec3f(0, 1, 0);
        }
        return getApproxNormal(position, 0.0001);
    };

    const sqLength = (a: d.v3f) => {
        'use gpu';
        return std.dot(a, a);
    };

    const getFakeShadow = (position: d.v3f, lightDir: d.v3f): d.v3f => {
        'use gpu';
        if (position.y < -GroundParams.groundThickness) {
            const fadeSharpness = 30;
            const inset = 0.02;
            const cutout = std.min(
                rectangleCutoutDistSwitch(position.xz),
                rectangleCutoutDistSlider(position.xz)
            ) + inset;
            const edgeDarkening = std.saturate(1 - cutout * fadeSharpness);
            const lightGradient = std.saturate(-position.z * 4 * lightDir.z + 1);
            return d.vec3f(1).mul(edgeDarkening).mul(lightGradient * 0.5);
        }
        return d.vec3f(1);
    };

    const calculateAO = (position: d.v3f, normal: d.v3f) => {
        'use gpu';
        let totalOcclusion = d.f32(0.0);
        let sampleWeight = d.f32(1.0);
        const stepDistance = AO_RADIUS / AO_STEPS;
        for (let i = 1; i <= AO_STEPS; i++) {
            const sampleHeight = stepDistance * d.f32(i);
            const samplePosition = position.add(normal.mul(sampleHeight));
            const distanceToSurface = getSceneDistForAO(samplePosition) - AO_BIAS;
            const occlusionContribution = std.max(0.0, sampleHeight - distanceToSurface);
            totalOcclusion += occlusionContribution * sampleWeight;
            sampleWeight *= 0.5;
            if (totalOcclusion > AO_RADIUS / AO_INTENSITY) break;
        }
        const rawAO = 1.0 - (AO_INTENSITY * totalOcclusion) / AO_RADIUS;
        return std.saturate(rawAO);
    };

    const calculateLighting = (hitPosition: d.v3f, normal: d.v3f, rayOrigin: d.v3f) => {
        'use gpu';
        const lightDir = std.neg(lightUniform.$.direction);
        const fakeShadow = getFakeShadow(hitPosition, lightDir);
        const diffuse = std.max(std.dot(normal, lightDir), 0.0);
        const viewDir = std.normalize(rayOrigin.sub(hitPosition));
        const reflectDir = std.reflect(std.neg(lightDir), normal);
        const specularFactor = std.max(std.dot(viewDir, reflectDir), 0) ** SPECULAR_POWER;
        const specular = lightUniform.$.color.mul(specularFactor * SPECULAR_INTENSITY);
        const baseColor = d.vec3f(0.9);
        const directionalLight = baseColor.mul(lightUniform.$.color).mul(diffuse).mul(fakeShadow);
        const ambientLight = baseColor.mul(AMBIENT_COLOR).mul(AMBIENT_INTENSITY);
        const finalSpecular = specular.mul(fakeShadow);
        return std.saturate(directionalLight.add(ambientLight).add(finalSpecular));
    };

    const applyAO = (litColor: d.v3f, hitPosition: d.v3f, normal: d.v3f) => {
        'use gpu';
        const ao = calculateAO(hitPosition, normal);
        const finalColor = litColor.mul(ao);
        return d.vec4f(finalColor, 1.0);
    };

    const rayMarchNoJelly = (rayOrigin: d.v3f, rayDirection: d.v3f) => {
        'use gpu';
        let distanceFromOrigin = d.f32();
        let hit = d.f32();
        for (let i = 0; i < 6; i++) {
            const p = rayOrigin.add(rayDirection.mul(distanceFromOrigin));
            hit = getMainSceneDist(p);
            distanceFromOrigin += hit;
            if (distanceFromOrigin > MAX_DIST || hit < SURF_DIST * 10) break;
        }
        if (distanceFromOrigin < MAX_DIST) {
            return renderBackground(rayOrigin, rayDirection, distanceFromOrigin).xyz;
        }
        return d.vec3f();
    };

    const renderBackground = (rayOrigin: d.v3f, rayDirection: d.v3f, backgroundHitDist: number) => {
        'use gpu';
        const state = switchBehavior.stateUniform.$;
        const hitPosition = rayOrigin.add(rayDirection.mul(backgroundHitDist));
        const newNormal = getNormal(hitPosition);

        // Switch bounce light
        const switchX = SWITCH_OFFSET.x + (state.progress - 0.5) * SWITCH_RAIL_LENGTH;
        const switchColor = switchColorUniform.$;
        const sqDistSwitch = sqLength(hitPosition.sub(d.vec3f(switchX, SWITCH_OFFSET.y, 0)));
        const bounceSwitch = switchColor.xyz.mul(1 / (sqDistSwitch * 15 + 1) * 0.4);

        // Slider bounce light
        const endCapX = slider.endCapUniform.$.x;
        const sliderColor = sliderColorUniform.$;
        const sqDistSlider = sqLength(hitPosition.sub(d.vec3f(endCapX, -0.3, 0)));
        const bounceSlider = sliderColor.xyz.mul(1 / (sqDistSlider * 15 + 1) * 0.3);

        const emission = std.smoothstep(0.7, 1, state.progress) * 2 + 0.7;
        const litColor = calculateLighting(hitPosition, newNormal, rayOrigin);
        const backgroundColor = applyAO(
            std.select(LIGHT_GROUND_ALBEDO, DARK_GROUND_ALBEDO, darkModeUniform.$ === 1).mul(litColor),
            hitPosition,
            newNormal,
        ).add(d.vec4f(bounceSwitch.mul(emission), 0)).add(d.vec4f(bounceSlider, 0));

        return d.vec4f(backgroundColor.xyz, 1);
    };

    const rayMarch = (rayOrigin: d.v3f, rayDirection: d.v3f, uv: d.v2f) => {
        'use gpu';
        let totalSteps = d.u32();
        let backgroundDist = d.f32();

        for (let i = 0; i < MAX_STEPS; i++) {
            const p = rayOrigin.add(rayDirection.mul(backgroundDist));
            const hit = getMainSceneDist(p);
            backgroundDist += hit;
            if (hit < SURF_DIST) break;
        }
        const background = renderBackground(rayOrigin, rayDirection, backgroundDist);

        const bbox = getJellyBounds();
        const intersection = intersectBox(rayOrigin, rayDirection, bbox);
        if (!intersection.hit) return background;

        let distanceFromOrigin = std.max(d.f32(0.0), intersection.tMin);

        for (let i = 0; i < MAX_STEPS; i++) {
            if (totalSteps >= MAX_STEPS) break;
            const currentPosition = rayOrigin.add(rayDirection.mul(distanceFromOrigin));
            const hitInfo = getSceneDist(currentPosition);
            distanceFromOrigin += hitInfo.distance;
            totalSteps++;

            if (hitInfo.distance < SURF_DIST) {
                const hitPosition = rayOrigin.add(rayDirection.mul(distanceFromOrigin));
                if (hitInfo.objectType === ObjectType.BACKGROUND) break;

                // Determine which jelly we hit
                const isSlider = hitInfo.objectType === d.u32(2);
                const jellyColor = std.select(switchColorUniform.$, sliderColorUniform.$, isSlider);

                const N = getNormal(hitPosition);
                const I = rayDirection;
                const cosi = std.min(1.0, std.max(0.0, std.dot(std.neg(I), N)));
                const F = fresnelSchlick(cosi, d.f32(1.0), d.f32(JELLY_IOR));
                const reflection = std.saturate(d.vec3f(hitPosition.y + 0.2));

                const eta = 1.0 / JELLY_IOR;
                const k = 1.0 - eta * eta * (1.0 - cosi * cosi);
                let refractedColor = d.vec3f();

                if (k > 0.0) {
                    const refrDir = std.normalize(std.add(I.mul(eta), N.mul(eta * cosi - std.sqrt(k))));
                    const p = hitPosition.add(refrDir.mul(SURF_DIST * 2.0));
                    const exitPos = p.add(refrDir.mul(SURF_DIST * 2.0));
                    const env = rayMarchNoJelly(exitPos, refrDir);

                    const scatterTint = jellyColor.xyz.mul(1.5);
                    const density = d.f32(20.0);
                    const absorb = d.vec3f(1.0).sub(jellyColor.xyz).mul(density);

                    const state = switchBehavior.stateUniform.$;
                    const progress = std.saturate(std.mix(1, 0.6, hitPosition.y * 2 + 0.25)) *
                        std.select(state.progress, d.f32(1), isSlider);
                    const T = beerLambert(absorb.mul(progress ** 2), 0.08);

                    const lightDir = std.neg(lightUniform.$.direction);
                    const forward = std.max(0.0, std.dot(lightDir, refrDir));
                    const scatter = scatterTint.mul(JELLY_SCATTER_STRENGTH * forward * progress ** 3);
                    refractedColor = env.mul(T).add(scatter);
                }

                const jelly = std.add(reflection.mul(F), refractedColor.mul(1 - F));
                return d.vec4f(jelly, 1.0);
            }

            if (distanceFromOrigin > backgroundDist) break;
        }

        return background;
    };

    const raymarchFn = tgpu['~unstable'].fragmentFn({
        in: { uv: d.vec2f },
        out: d.vec4f,
    })(({ uv }) => {
        randf.seed2(randomUniform.$.mul(uv));
        const ndc = d.vec2f(uv.x * 2 - 1, -(uv.y * 2 - 1));
        const ray = getRay(ndc);
        const color = rayMarch(ray.origin, ray.direction, uv);
        const exposure = std.select(1.5, 2, darkModeUniform.$ === 1);
        return d.vec4f(std.tanh(color.xyz.mul(exposure)), 1);
    });

    const fragmentMain = tgpu['~unstable'].fragmentFn({
        in: { uv: d.vec2f },
        out: d.vec4f,
    })((input) => {
        return std.textureSample(sampleLayout.$.currentTexture, filteringSampler.$, input.uv);
    });

    const rayMarchPipeline = root['~unstable']
        .withVertex(fullScreenTriangle, {})
        .withFragment(raymarchFn, { format: 'rgba8unorm' })
        .createPipeline();

    const renderPipeline = root['~unstable']
        .withVertex(fullScreenTriangle, {})
        .withFragment(fragmentMain, { format: presentationFormat })
        .createPipeline();

    let lastTimeStamp = performance.now();
    let frameCount = 0;
    const taaResolver = new TAAResolver(root, width, height);

    function createBindGroups() {
        return {
            rayMarch: root.createBindGroup(rayMarchLayout, {
                backgroundTexture: backgroundTexture.sampled,
            }),
            render: [0, 1].map((frame) =>
                root.createBindGroup(sampleLayout, {
                    currentTexture: taaResolver.getResolvedTexture(frame),
                })
            ),
        };
    }

    let bindGroups = createBindGroups();
    let isRunning = true;

    function render(timestamp: number) {
        if (!isRunning) return;

        frameCount++;
        camera.jitter();
        const deltaTime = Math.min((timestamp - lastTimeStamp) * 0.001, 0.1);
        lastTimeStamp = timestamp;

        randomUniform.write(d.vec2f((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));

        // Update both behaviors
        switchBehavior.update(deltaTime);
        slider.update(deltaTime);

        const currentFrame = frameCount % 2;

        rayMarchPipeline
            .withColorAttachment({
                view: root.unwrap(textures[currentFrame].sampled),
                loadOp: 'clear',
                storeOp: 'store',
            })
            .draw(3);

        taaResolver.resolve(textures[currentFrame].sampled, frameCount, currentFrame);

        renderPipeline
            .withColorAttachment({
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
            })
            .with(bindGroups.render[currentFrame])
            .draw(3);

        requestAnimationFrame(render);
    }

    function handleResize() {
        [width, height] = [canvas.width * qualityScale, canvas.height * qualityScale];
        camera.updateProjection(Math.PI / 4, width, height);
        textures = createTextures(root, width, height);
        backgroundTexture = createBackgroundTexture(root, width, height);
        taaResolver.resize(width, height);
        frameCount = 0;
        bindGroups = createBindGroups();
    }

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(canvas);

    // ========================================
    // Event Handlers
    // ========================================

    let currentToggleState = false;
    let isDragging = false;
    let lastSliderPercent = 0.5;

    // Determine if click is in switch or slider area
    function getClickArea(clientX: number, clientY: number): 'switch' | 'slider' | 'none' {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const normX = x / rect.width;
        const normY = y / rect.height;

        // Switch is upper-left area
        if (normY < 0.6 && normX < 0.6) return 'switch';
        // Slider is lower area
        if (normY > 0.4) return 'slider';
        return 'none';
    }

    function handleMouseDown(e: MouseEvent) {
        const area = getClickArea(e.clientX, e.clientY);
        if (area === 'switch') {
            switchBehavior.pressed = true;
        } else if (area === 'slider') {
            isDragging = true;
            updateSliderFromMouse(e.clientX);
        }
    }

    function handleMouseUp(e: MouseEvent) {
        const area = getClickArea(e.clientX, e.clientY);
        if (switchBehavior.pressed) {
            switchBehavior.pressed = false;
            switchBehavior.toggled = !switchBehavior.toggled;
            currentToggleState = switchBehavior.toggled;
            callbacks?.onSwitchToggle?.(currentToggleState);
        }
        isDragging = false;
    }

    function handleMouseMove(e: MouseEvent) {
        if (isDragging) {
            updateSliderFromMouse(e.clientX);
        }
    }

    function updateSliderFromMouse(clientX: number) {
        const rect = canvas.getBoundingClientRect();
        const normX = (clientX - rect.left) / rect.width;
        // Map to slider range (-0.5 to 0.8)
        const sliderX = -0.5 + normX * 1.3;
        slider.setDragX(sliderX);

        // Calculate percentage and notify
        lastSliderPercent = Math.max(0, Math.min(1, normX));
        callbacks?.onSliderChange?.(lastSliderPercent);
    }

    // Touch events
    function handleTouchStart(e: TouchEvent) {
        if (e.touches.length === 0) return;
        const touch = e.touches[0];
        const area = getClickArea(touch.clientX, touch.clientY);
        if (area === 'switch') {
            switchBehavior.pressed = true;
        } else if (area === 'slider') {
            isDragging = true;
            updateSliderFromMouse(touch.clientX);
        }
        e.preventDefault();
    }

    function handleTouchEnd() {
        if (switchBehavior.pressed) {
            switchBehavior.pressed = false;
            switchBehavior.toggled = !switchBehavior.toggled;
            currentToggleState = switchBehavior.toggled;
            callbacks?.onSwitchToggle?.(currentToggleState);
        }
        isDragging = false;
    }

    function handleTouchMove(e: TouchEvent) {
        if (isDragging && e.touches.length > 0) {
            updateSliderFromMouse(e.touches[0].clientX);
        }
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('mouseup', () => {
        switchBehavior.pressed = false;
        isDragging = false;
    });

    // Start rendering
    requestAnimationFrame(render);
    callbacks?.onReady?.();

    // Return control interface
    return {
        setSwitchToggled: (value: boolean) => {
            switchBehavior.toggled = value;
            currentToggleState = value;
        },
        isSwitchToggled: () => currentToggleState,
        getSliderPercent: () => lastSliderPercent,
        setDarkMode: (dark: boolean) => darkModeUniform.write(d.u32(dark ? 1 : 0)),
        setSwitchColor: (r: number, g: number, b: number) => switchColorUniform.write(d.vec4f(r, g, b, 1.0)),
        setSliderColor: (r: number, g: number, b: number) => sliderColorUniform.write(d.vec4f(r, g, b, 1.0)),
        setLightDirection: (x: number, y: number, z: number) => {
            const dir = std.normalize(d.vec3f(x, y, z));
            lightUniform.writePartial({ direction: dir });
        },
        destroy: () => {
            isRunning = false;
            resizeObserver.disconnect();
            root.destroy();
        },
    };
}
