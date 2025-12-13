/// <reference types="@webgpu/types" />
/**
 * JellyOS Loader
 * Initializes the combined 3D scene with both switch and slider
 */

import { initCombinedScene } from './src/combined-scene.ts';

// DOM Elements
const loadingEl = document.getElementById('loading') as HTMLDivElement;
const themeStatusEl = document.getElementById('theme-status') as HTMLElement;
const sliderValueEl = document.getElementById('slider-value') as HTMLElement;
const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;

// Update UI
function updateThemeStatus(enabled: boolean) {
    if (themeStatusEl) {
        themeStatusEl.innerHTML = `
            <span class="status-dot"></span>
            <span>${enabled ? 'Enabled' : 'Disabled'}</span>
        `;
        themeStatusEl.className = `status ${enabled ? 'active' : ''}`;
    }
}

function updateSliderDisplay(percent: number) {
    const value = Math.round(percent * 100);
    if (sliderValueEl) {
        sliderValueEl.textContent = `${value}%`;
    }
}

// Initialize canvas
function initCanvas(): boolean {
    if (!mainCanvas) return false;

    const dpr = window.devicePixelRatio || 1;
    mainCanvas.width = window.innerWidth * dpr;
    mainCanvas.height = window.innerHeight * dpr;

    return mainCanvas.width > 0 && mainCanvas.height > 0;
}

// Resize handler
window.addEventListener('resize', () => {
    const dpr = window.devicePixelRatio || 1;
    mainCanvas.width = window.innerWidth * dpr;
    mainCanvas.height = window.innerHeight * dpr;
});

// Hide loading
function hideLoading() {
    if (loadingEl) {
        loadingEl.classList.add('hidden');
    }
}

// Show error
function showError(message: string) {
    document.body.innerHTML = `
        <div class="error-overlay">
            <h2>⚠️ WebGPU Required</h2>
            <p>${message}</p>
        </div>
    `;
}

// Check WebGPU
async function checkWebGPU(): Promise<boolean> {
    if (!navigator.gpu) return false;
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter !== null;
    } catch {
        return false;
    }
}

// Initialize app
async function initApp() {
    const hasWebGPU = await checkWebGPU();

    if (!hasWebGPU) {
        showError('Your browser does not support WebGPU. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.');
        return;
    }

    if (!initCanvas()) {
        showError('Failed to initialize canvas.');
        return;
    }

    try {
        await initCombinedScene(mainCanvas, {
            onSwitchToggle: (isOn) => {
                console.log('Switch toggled:', isOn);
                updateThemeStatus(!isOn); // OFF = dark enabled
            },
            onSliderChange: (percent) => {
                updateSliderDisplay(percent);
            },
            onReady: () => {
                hideLoading();
                console.log('JellyOS Combined Scene Ready');
            },
        });

    } catch (error) {
        console.error('Failed to initialize JellyOS:', error);
        showError('Failed to initialize the 3D components. Check console for details.');
    }
}

// Start
initApp().catch(console.error);
