/**
 * JellyOS Combined Scene - Fixed & Robust
 * Both Switch and Slider visible in the same 3D WebGPU scene
 * Uses simplified slider geometry that actually works
 * Fixed lighting and defaults
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

// Switch constants
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

// Callbacks
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

    // Initialize switch behavior
    const switchBehavior = new SwitchBehavior(root);
    await switchBehavior.init();

    // Set initial switch state to ON (Dark Mode)
    switchBehavior.toggled = true;
    switchBehavior.stateUniform.writePartial({ progress: 1.0 });

    // Slider state
    const sliderStateUniform = root.createUniform(d.vec2f, d.vec2f(0.0, 0)); // x = endX, y = unused

    let qualityScale = 0.75;
    let [width, height] = [canvas.width * qualityScale, canvas.height * qualityScale];

    let textures = createTextures(root, width, height);
    let backgroundTexture = createBackgroundTexture(root, width, height);

    const filteringSampler = root['~unstable'].createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    // Camera to see both components clearly
    const camera = new CameraController(
        root,
        d.vec3f(0, 3.2, 2.0),    // High angle
        d.vec3f(0, -0.4, 0),     // Look slightly lower
        d.vec3f(0, 1, 0),
        Math.PI / 4,
        width,
        height,
    );
    const cameraUniform = camera.cameraUniform;

    // Shared lighting - reduced intensity to prevent whiteout
    const lightUniform = root.createUniform(DirectionalLight, {
        direction: std.normalize(d.vec3f(0.2, -0.4, 0.6)),
        color: d.vec3f(0.9, 0.9, 0.9),
    });

    // Jelly colors
    const switchColorUniform = root.createUniform(d.vec4f, d.vec4f(0.1, 0.5, 1.0, 1.0));   // Blue
    const sliderColorUniform = root.createUniform(d.vec4f, d.vec4f(1.0, 0.35, 0.1, 1.0)); // Orange

    // Default to Dark Mode (1)
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

    // Component positioning
    const SWITCH_Y = 0.25;
    const SLIDER_Y = -0.45;
    const SLIDER_START_X = -0.6;
    const SLIDER_END_X = 0.6;

    const getSceneBounds = () => {
        'use gpu';
        return BoundingBox({
            min: d.vec3f(-1.5, -0.8, -0.6),
            max: d.vec3f(1.5, 0.8, 0.6),
        });
    };

    // Ground parameters
    const GroundParams = {
        groundThickness: 0.03,
        groundRadius: 0.05,
        groundRoundness: 0.02,
    };

    // Ground cutout for switch
    const switchCutoutDist = (position: d.v2f) => {
        'use gpu';
        const groundRoundness = GroundParams.groundRoundness;
        const groundRadius = GroundParams.groundRadius;
        const offset = d.vec2f(position.x, position.y - SWITCH_Y * 0.5); // Adjust cutout placement
        return sdf.sdRoundedBox2d(
            offset,
            d.vec2f(SWITCH_RAIL_LENGTH * 0.5 + 0.2 + groundRoundness, groundRadius + groundRoundness),
            groundRadius + groundRoundness,
        );
    };

    // Ground cutout for slider
    const sliderCutoutDist = (position: d.v2f) => {
        'use gpu';
        return sdf.sdRoundedBox2d(
            d.vec2f(position.x, position.y - SLIDER_Y),
            d.vec2f(0.75, 0.16),
            0.03,
        );
    };

    // Main scene SDF
    const getMainSceneDist = (position: d.v3f) => {
        'use gpu';
        const groundThickness = GroundParams.groundThickness;
        const groundRoundness = GroundParams.groundRoundness;

        const ground = sdf.sdPlane(position, d.vec3f(0, 1, 0), 0.06);

        // Switch cutout logic
        // We position the cutout around the switch
        const switchPos = d.vec2f(position.x, position.z - SWITCH_Y * 0.5);
        const switchCutout = sdf.opExtrudeY(
            position,
            -sdf.sdRoundedBox2d(d.vec2f(position.x, position.z + 0.05), d.vec2f(0.5, 0.15), 0.05),
            groundThickness - groundRoundness,
        ) - groundRoundness;

        // Slider cutout logic
        const sliderCutout = sdf.opExtrudeY(
            position,
            -sdf.sdRoundedBox2d(d.vec2f(position.x, position.z - SLIDER_Y - 0.05), d.vec2f(0.8, 0.2), 0.05),
            groundThickness - groundRoundness,
        ) - groundRoundness;

        return sdf.opUnion(sdf.opUnion(ground, switchCutout), sliderCutout);
    };

    // Bend operation for switch
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
            (state.progress - 0.5) * SWITCH_RAIL_LENGTH - state.squashX * (state.progress - 0.5) * 0.2,
            SWITCH_Y + JELLY_HALFSIZE.y * 0.5,
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

    // Slider jelly SDF
    const SLIDER_SIZE = d.vec3f(0.14, 0.12, 0.14);

    const getSliderJellyDist = (position: d.v3f) => {
        'use gpu';
        const sliderX = sliderStateUniform.$.x;
        const jellyOrigin = d.vec3f(sliderX, SLIDER_Y + SLIDER_SIZE.y * 0.5 + 0.06, 0);
        const localPos = position.sub(jellyOrigin);

        const squash = std.sin(sliderX * 6) * 0.03;
        const squashedPos = d.vec3f(localPos.x * (1 + squash), localPos.y * (1 - squash), localPos.z);

        return sdf.sdRoundedBox3d(opCheapBend(squashedPos, 0.4), SLIDER_SIZE.sub(0.04), 0.04);
    };

    // Slider track SDF
    const getSliderTrackDist = (position: d.v3f) => {
        'use gpu';
        const trackCenter = d.vec3f(0, SLIDER_Y + 0.035, 0);
        const localPos = position.sub(trackCenter);

        const halfLen = (SLIDER_END_X - SLIDER_START_X) * 0.5 + 0.05;
        const qx = std.max(0, std.abs(localPos.x) - halfLen);
        const dist2d = std.length(d.vec2f(qx, localPos.y)) - 0.03;

        return std.max(dist2d, std.abs(localPos.z) - 0.08);
    };

    // Combined scene distance
    const getSceneDist = (position: d.v3f) => {
        'use gpu';
        const mainScene = getMainSceneDist(position);
        const switchJelly = getSwitchJellyDist(position);
        const sliderJelly = getSliderJellyDist(position);
        const sliderTrack = getSliderTrackDist(position);

        let minDist = mainScene;
        let type = ObjectType.BACKGROUND;

        if (sliderTrack < minDist) {
            minDist = sliderTrack;
            type = d.u32(3); // Track
        }
        if (switchJelly < minDist) {
            minDist = switchJelly;
            type = d.u32(1); // Switch
        }
        if (sliderJelly < minDist) {
            minDist = sliderJelly;
            type = d.u32(2); // Slider (jelly)
        }

        const hitInfo = HitInfo();
        hitInfo.distance = minDist;
        hitInfo.objectType = type;
        return hitInfo;
    };

    const getSceneDistForAO = (position: d.v3f) => {
        'use gpu';
        const mainScene = getMainSceneDist(position);
        const switchJelly = getSwitchJellyDist(position);
        const sliderJelly = getSliderJellyDist(position);
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
        // Simplified bounds check for normal calc
        if (std.abs(position.z) > 1.0 || std.abs(position.x) > 1.8) {
            return d.vec3f(0, 1, 0);
        }
        return getApproxNormal(position, 0.0001);
    };

    const sqLength = (a: d.v3f) => std.dot(a, a);

    // Simple shadow logic
    const getFakeShadow = (position: d.v3f, lightDir: d.v3f): d.v3f => {
        'use gpu';
        if (position.y < -GroundParams.groundThickness) {
            return d.vec3f(0.8); // Simple ambient occlusion in holes
        }
        return d.vec3f(1);
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
        const baseColor = d.vec3f(0.8); // Greyscale base
        const directionalLight = baseColor.mul(lightUniform.$.color).mul(diffuse).mul(fakeShadow);
        const ambientLight = baseColor.mul(AMBIENT_COLOR).mul(AMBIENT_INTENSITY);
        return std.saturate(directionalLight.add(ambientLight).add(specular.mul(fakeShadow)));
    };

    // Make LIGHT_GROUND_ALBEDO slightly off-white to prevent blowout
    const SAFE_LIGHT_ALBEDO = d.vec3f(0.92, 0.92, 0.92);

    const renderBackground = (rayOrigin: d.v3f, rayDirection: d.v3f, backgroundHitDist: number) => {
        'use gpu';
        const state = switchBehavior.stateUniform.$;
        const hitPosition = rayOrigin.add(rayDirection.mul(backgroundHitDist));
        const newNormal = getNormal(hitPosition);

        // Switch bounce light
        const switchX = (state.progress - 0.5) * SWITCH_RAIL_LENGTH;
        const switchColor = switchColorUniform.$;
        const sqDistSwitch = sqLength(hitPosition.sub(d.vec3f(switchX, SWITCH_Y, 0)));
        const bounceSwitch = switchColor.xyz.mul(1 / (sqDistSwitch * 8 + 1) * 0.5);

        // Slider bounce light
        const sliderX = sliderStateUniform.$.x;
        const sliderColor = sliderColorUniform.$;
        const sqDistSlider = sqLength(hitPosition.sub(d.vec3f(sliderX, SLIDER_Y, 0)));
        const bounceSlider = sliderColor.xyz.mul(1 / (sqDistSlider * 8 + 1) * 0.4);

        const emission = std.smoothstep(0.7, 1, state.progress) * 1.5 + 0.5;
        const litColor = calculateLighting(hitPosition, newNormal, rayOrigin);

        const albedo = std.select(SAFE_LIGHT_ALBEDO, DARK_GROUND_ALBEDO, darkModeUniform.$ === 1);

        const backgroundColor = albedo.mul(litColor)
            .add(d.vec4f(bounceSwitch.mul(emission), 0))
            .add(d.vec4f(bounceSlider, 0));

        return d.vec4f(backgroundColor.xyz, 1);
    };

    const renderTrack = (hitPosition: d.v3f, normal: d.v3f, rayOrigin: d.v3f) => {
        'use gpu';
        const litColor = calculateLighting(hitPosition, normal, rayOrigin);
        const trackColor = d.vec3f(0.25, 0.25, 0.3); // Dark slate
        return d.vec4f(trackColor.mul(litColor), 1.0);
    };

    const rayMarchNoJelly = (rayOrigin: d.v3f, rayDirection: d.v3f) => {
        'use gpu';
        let distanceFromOrigin = d.f32();
        for (let i = 0; i < 6; i++) {
            const p = rayOrigin.add(rayDirection.mul(distanceFromOrigin));
            const hit = getMainSceneDist(p);
            distanceFromOrigin += hit;
            if (distanceFromOrigin > MAX_DIST || hit < SURF_DIST * 10) break;
        }
        if (distanceFromOrigin < MAX_DIST) {
            return renderBackground(rayOrigin, rayDirection, distanceFromOrigin).xyz;
        }
        return d.vec3f();
    };

    const rayMarch = (rayOrigin: d.v3f, rayDirection: d.v3f, uv: d.v2f) => {
        'use gpu';
        let totalSteps = d.u32();
        let backgroundDist = d.f32();

        // March to background
        for (let i = 0; i < MAX_STEPS; i++) {
            const p = rayOrigin.add(rayDirection.mul(backgroundDist));
            const hit = getMainSceneDist(p);
            backgroundDist += hit;
            if (hit < SURF_DIST) break;
        }
        const background = renderBackground(rayOrigin, rayDirection, backgroundDist);

        const bbox = getSceneBounds();
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

                if (hitInfo.objectType === d.u32(3)) {
                    const N = getNormal(hitPosition);
                    return renderTrack(hitPosition, N, rayOrigin);
                }

                // Jelly
                const isSlider = hitInfo.objectType === d.u32(2);
                const jellyColor = std.select(switchColorUniform.$, sliderColorUniform.$, isSlider);

                const N = getNormal(hitPosition);
                const I = rayDirection;
                const cosi = std.min(1.0, std.max(0.0, std.dot(std.neg(I), N)));
                const F = fresnelSchlick(cosi, d.f32(1.0), d.f32(JELLY_IOR));
                const reflection = std.saturate(d.vec3f(hitPosition.y + 0.5)); // Brighter reflection

                const eta = 1.0 / JELLY_IOR;
                const k = 1.0 - eta * eta * (1.0 - cosi * cosi);
                let refractedColor = d.vec3f();

                if (k > 0.0) {
                    const refrDir = std.normalize(std.add(I.mul(eta), N.mul(eta * cosi - std.sqrt(k))));
                    const exitPos = hitPosition.add(refrDir.mul(SURF_DIST * 4.0));
                    const env = rayMarchNoJelly(exitPos, refrDir);

                    const scatterTint = jellyColor.xyz.mul(1.5);
                    const density = d.f32(15.0);
                    const absorb = d.vec3f(1.0).sub(jellyColor.xyz).mul(density);

                    const state = switchBehavior.stateUniform.$;
                    const progress = std.saturate(std.mix(1, 0.5, (hitPosition.y + 0.5) * 1.5)) *
                        std.select(state.progress, d.f32(0.9), isSlider);
                    const T = beerLambert(absorb.mul(progress ** 2), 0.1);

                    const lightDir = std.neg(lightUniform.$.direction);
                    const forward = std.max(0.0, std.dot(lightDir, refrDir));
                    const scatter = scatterTint.mul(JELLY_SCATTER_STRENGTH * forward * progress ** 2);
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
        const exposure = std.select(1.2, 1.7, darkModeUniform.$ === 1); // Reduced exposure
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
    let currentSliderX = 0;

    function render(timestamp: number) {
        if (!isRunning) return;

        frameCount++;
        camera.jitter();
        const deltaTime = Math.min((timestamp - lastTimeStamp) * 0.001, 0.1);
        lastTimeStamp = timestamp;

        randomUniform.write(d.vec2f((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));

        switchBehavior.update(deltaTime);
        sliderStateUniform.write(d.vec2f(currentSliderX, 0));

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

    let currentToggleState = true; // Default ON
    let isDragging = false;
    let lastSliderPercent = 0.5;

    function getClickArea(clientX: number, clientY: number): 'switch' | 'slider' | 'none' {
        const rect = canvas.getBoundingClientRect();
        const normY = (clientY - rect.top) / rect.height;
        if (normY < 0.5) return 'switch';
        return 'slider';
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

    function handleMouseUp() {
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
        // range -0.6 to 0.6
        const minX = SLIDER_START_X;
        const maxX = SLIDER_END_X;

        // Convert 0-1 normX to range
        const targetX = minX + normX * (maxX - minX);
        currentSliderX = Math.max(minX, Math.min(maxX, targetX));

        lastSliderPercent = (currentSliderX - minX) / (maxX - minX);
        callbacks?.onSliderChange?.(lastSliderPercent);
    }

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

    requestAnimationFrame(render);
    callbacks?.onReady?.();

    return {
        setSwitchToggled: (value: boolean) => { switchBehavior.toggled = value; currentToggleState = value; },
        isSwitchToggled: () => currentToggleState,
        getSliderPercent: () => lastSliderPercent,
        setDarkMode: (dark: boolean) => darkModeUniform.write(d.u32(dark ? 1 : 0)),
        setSwitchColor: (r: number, g: number, b: number) => switchColorUniform.write(d.vec4f(r, g, b, 1.0)),
        setSliderColor: (r: number, g: number, b: number) => sliderColorUniform.write(d.vec4f(r, g, b, 1.0)),
        setLightDirection: (x: number, y: number, z: number) => {
            lightUniform.writePartial({ direction: std.normalize(d.vec3f(x, y, z)) });
        },
        destroy: () => {
            isRunning = false;
            resizeObserver.disconnect();
            root.destroy();
        },
    };
}
