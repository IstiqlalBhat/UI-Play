/**
 * JellyOS Combined Scene - Stabilized
 * Fixes "white screen" / glitches by using safer raymarching and simplified geometry.
 */

import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import * as sdf from '@typegpu/sdf';
import { fullScreenTriangle } from 'typegpu/common';
import { randf } from '@typegpu/noise';

// Import behavior classes
import { SwitchBehavior } from './switch/switch.ts';
import { CameraController } from './switch/camera.ts';
import { TAAResolver } from './switch/taa.ts';

// Constants
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

    // Initialize switch
    const switchBehavior = new SwitchBehavior(root);
    await switchBehavior.init();
    switchBehavior.toggled = true;
    switchBehavior.stateUniform.writePartial({ progress: 1.0 });

    // Slider state
    const sliderStateUniform = root.createUniform(d.vec2f, d.vec2f(0.0, 0));

    let qualityScale = 0.75;
    let [width, height] = [canvas.width * qualityScale, canvas.height * qualityScale];

    let textures = createTextures(root, width, height);
    let backgroundTexture = createBackgroundTexture(root, width, height);

    const filteringSampler = root['~unstable'].createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    // Camera
    const camera = new CameraController(
        root,
        d.vec3f(0, 3.2, 2.0),
        d.vec3f(0, -0.4, 0),
        d.vec3f(0, 1, 0),
        Math.PI / 4,
        width,
        height,
    );
    const cameraUniform = camera.cameraUniform;

    // Lighting - Safer intensity
    const lightUniform = root.createUniform(DirectionalLight, {
        direction: std.normalize(d.vec3f(0.2, -0.4, 0.6)),
        color: d.vec3f(0.8, 0.8, 0.8),
    });

    const switchColorUniform = root.createUniform(d.vec4f, d.vec4f(0.1, 0.5, 1.0, 1.0));
    const sliderColorUniform = root.createUniform(d.vec4f, d.vec4f(1.0, 0.35, 0.1, 1.0));
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

    const getSceneBounds = () => {
        'use gpu';
        return BoundingBox({
            min: d.vec3f(-2, -1, -1),
            max: d.vec3f(2, 1, 1),
        });
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

    const SWITCH_Y = 0.25;
    const SLIDER_Y = -0.45;

    // -- SDF Functions --

    const sdCapsule = (p: d.v2f, a: d.v2f, b: d.v2f, r: number) => {
        'use gpu';
        const pa = p.sub(a);
        const ba = b.sub(a);
        const h = std.clamp(std.dot(pa, ba) / std.dot(ba, ba), 0.0, 1.0);
        return std.length(pa.sub(ba.mul(h))) - r;
    };


    // Simple Plane Ground 
    const getMainSceneDist = (position: d.v3f) => {
        'use gpu';
        // Just a plane for now to avoid unstable boolean ops
        return sdf.sdPlane(position, d.vec3f(0, 1, 0), 0.0);
    };

    // Switch Jelly
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
        // Multiply by 0.6 (under-relaxation) for safe raymarching of bent objects
        return sdf.sdRoundedBox3d(opCheapBend(localPos, 0.8), JELLY_HALFSIZE.sub(0.1), 0.1) * 0.6;
    };

    // Slider Jelly
    const getSliderJellyDist = (position: d.v3f) => {
        'use gpu';
        const sliderX = sliderStateUniform.$.x;
        const jellyOrigin = d.vec3f(sliderX, SLIDER_Y + 0.1, 0);
        const localPos = position.sub(jellyOrigin);
        // Safer, simpler shape
        return sdf.sdRoundedBox3d(localPos, d.vec3f(0.12, 0.1, 0.12), 0.04);
    };

    // Slider Track
    const getSliderTrackDist = (position: d.v3f) => {
        'use gpu';
        const trackCenter = d.vec3f(0, SLIDER_Y, 0);
        const localPos = position.sub(trackCenter);
        // Simple capsule
        const dist2d = sdCapsule(localPos.xy, d.vec2f(-0.6, 0), d.vec2f(0.6, 0), 0.02);
        return std.max(dist2d, std.abs(localPos.z) - 0.02);
    };

    const getSceneDist = (position: d.v3f) => {
        'use gpu';
        const ground = getMainSceneDist(position);
        const track = getSliderTrackDist(position);
        const switchJelly = getSwitchJellyDist(position);
        const sliderJelly = getSliderJellyDist(position);

        let minDist = ground;
        let type = ObjectType.BACKGROUND;

        // Soft min or strict min? Strict for type checks.

        if (track < minDist) {
            minDist = track;
            type = d.i32(3); // Track
        }
        if (switchJelly < minDist) {
            minDist = switchJelly;
            type = d.i32(1); // Switch
        }
        if (sliderJelly < minDist) {
            minDist = sliderJelly;
            type = d.i32(2); // Slider
        }

        const hit = HitInfo();
        hit.distance = minDist;
        hit.objectType = type;
        return hit;
    };



    const getApproxNormal = (p: d.v3f, e: number): d.v3f => {
        'use gpu';
        const dist = getSceneDist(p).distance;
        return std.normalize(d.vec3f(
            getSceneDist(p.add(d.vec3f(e, 0, 0))).distance - dist,
            getSceneDist(p.add(d.vec3f(0, e, 0))).distance - dist,
            getSceneDist(p.add(d.vec3f(0, 0, e))).distance - dist,
        ));
    };

    const getNormal = (position: d.v3f) => {
        'use gpu';
        if (position.y < 0.01 && std.abs(position.x) > 1.5) return d.vec3f(0, 1, 0); // Fast ground normal
        return getApproxNormal(position, 0.001); // Slightly larger epsilon for stability
    };

    const calculateLighting = (hitPosition: d.v3f, normal: d.v3f, rayOrigin: d.v3f) => {
        'use gpu';
        const lightDir = std.neg(lightUniform.$.direction);
        const diffuse = std.max(std.dot(normal, lightDir), 0.0);
        const viewDir = std.normalize(rayOrigin.sub(hitPosition));
        const reflectDir = std.reflect(std.neg(lightDir), normal);
        const specularFactor = std.max(std.dot(viewDir, reflectDir), 0) ** SPECULAR_POWER;

        const baseColor = d.vec3f(0.8);
        const directional = baseColor.mul(lightUniform.$.color).mul(diffuse);
        const ambient = baseColor.mul(AMBIENT_COLOR).mul(AMBIENT_INTENSITY);
        const specular = lightUniform.$.color.mul(specularFactor * SPECULAR_INTENSITY);

        return std.saturate(directional.add(ambient).add(specular));
    };



    const renderBackground = (rayOrigin: d.v3f, rayDirection: d.v3f, backgroundHitDist: number) => {
        'use gpu';
        const hitPosition = rayOrigin.add(rayDirection.mul(backgroundHitDist));
        const normal = d.vec3f(0, 1, 0);

        // Check dark mode
        const isDark = darkModeUniform.$ === 1;
        const albedo = std.select(d.vec3f(0.9), d.vec3f(0.2), isDark);

        const litColor = calculateLighting(hitPosition, normal, rayOrigin);
        return d.vec4f(albedo.mul(litColor), 1.0);
    };

    const rayMarch = (rayOrigin: d.v3f, rayDirection: d.v3f, uv: d.v2f) => {
        'use gpu';

        let dist = d.f32(0.0);
        const maxSteps = 128;

        for (let i = 0; i < maxSteps; i++) {
            const p = rayOrigin.add(rayDirection.mul(dist));
            const hit = getSceneDist(p);

            // Robust hit check
            if (hit.distance < SURF_DIST) {
                const hitPos = rayOrigin.add(rayDirection.mul(dist));

                if (hit.objectType === ObjectType.BACKGROUND) {
                    return renderBackground(rayOrigin, rayDirection, dist);
                }
                if (hit.objectType === d.i32(3)) { // Track
                    const n = getNormal(hitPos);
                    const col = calculateLighting(hitPos, n, rayOrigin);
                    return d.vec4f(col.mul(0.3), 1);
                }

                // Jelly
                const isSlider = hit.objectType === d.i32(2);
                const color = std.select(switchColorUniform.$, sliderColorUniform.$, isSlider);

                const n = getNormal(hitPos);

                // Simple rim lighting + internal glow
                const rim = 1.0 - std.max(0, std.dot(std.neg(rayDirection), n));
                const base = color.xyz.mul(0.4).add(rim * 0.6);

                return d.vec4f(base, 1.0);
            }

            // Safety step clamp
            dist += hit.distance;

            if (dist > MAX_DIST) break;
        }

        // Background fallback
        return renderBackground(rayOrigin, rayDirection, dist);
    };

    const raymarchFn = tgpu['~unstable'].fragmentFn({
        in: { uv: d.vec2f },
        out: d.vec4f,
    })(({ uv }) => {
        const ndc = d.vec2f(uv.x * 2 - 1, -(uv.y * 2 - 1));
        const ray = getRay(ndc);
        const color = rayMarch(ray.origin, ray.direction, uv);
        return d.vec4f(std.tanh(color.xyz), 1);
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

    textures = createTextures(root, width, height);
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

    let currentToggleState = true;
    let isDragging = false;
    let lastSliderPercent = 0.5;

    function getClickArea(clientX: number, clientY: number): 'switch' | 'slider' | 'none' {
        const rect = canvas.getBoundingClientRect();
        const normY = (clientY - rect.top) / rect.height;
        if (normY < 0.5) return 'switch';
        return 'slider';
    }

    function updateSliderFromMouse(clientX: number) {
        const rect = canvas.getBoundingClientRect();
        const normX = (clientX - rect.left) / rect.width;
        const minX = -0.6, maxX = 0.6;
        const targetX = minX + normX * (maxX - minX);
        currentSliderX = Math.max(minX, Math.min(maxX, targetX));
        lastSliderPercent = (currentSliderX - minX) / (maxX - minX);
        callbacks?.onSliderChange?.(lastSliderPercent);
    }

    function handleMouseDown(e: MouseEvent) {
        const area = getClickArea(e.clientX, e.clientY);
        if (area === 'switch') switchBehavior.pressed = true;
        else if (area === 'slider') { isDragging = true; updateSliderFromMouse(e.clientX); }
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
    function handleMouseMove(e: MouseEvent) { if (isDragging) updateSliderFromMouse(e.clientX); }

    function handleTouchStart(e: TouchEvent) {
        if (e.touches.length === 0) return;
        handleMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as MouseEvent);
        e.preventDefault();
    }
    function handleTouchEnd() { handleMouseUp(); }
    function handleTouchMove(e: TouchEvent) {
        if (e.touches.length > 0) handleMouseMove({ clientX: e.touches[0].clientX } as MouseEvent);
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('mouseup', () => { switchBehavior.pressed = false; isDragging = false; });

    requestAnimationFrame(render);
    callbacks?.onReady?.();

    return {
        setSwitchToggled: (value: boolean) => { switchBehavior.toggled = value; currentToggleState = value; },
        isSwitchToggled: () => currentToggleState,
        getSliderPercent: () => lastSliderPercent,
        setDarkMode: (dark: boolean) => darkModeUniform.write(d.u32(dark ? 1 : 0)),
        setSwitchColor: (r: number, g: number, b: number) => switchColorUniform.write(d.vec4f(r, g, b, 1.0)),
        setSliderColor: (r: number, g: number, b: number) => sliderColorUniform.write(d.vec4f(r, g, b, 1.0)),
        setLightDirection: (x: number, y: number, z: number) => { lightUniform.writePartial({ direction: std.normalize(d.vec3f(x, y, z)) }); },
        destroy: () => { isRunning = false; resizeObserver.disconnect(); root.destroy(); },
    };
}
