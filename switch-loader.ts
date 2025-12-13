// Canvas sizing with devicePixelRatio for crisp rendering
(async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;

    const onResize = () => {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
    };

    onResize();
    new ResizeObserver(onResize).observe(document.body);

    // Execute the switch demo
    // @ts-expect-error
    const example = await import('./src/switch/index.ts');

    // Create controls panel
    createControlsPanel(example);
})();

function createControlsPanel(example: Record<string, unknown>) {
    const controlsPanel = document.createElement('div');
    controlsPanel.style.cssText = `
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 100;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 0.875rem;
    color: white;
    min-width: 200px;
    max-width: 280px;
  `;
    document.body.appendChild(controlsPanel);

    for (const controls of Object.values(example)) {
        if (typeof controls === 'function' || !controls) continue;

        for (const [label, params] of Object.entries(controls as Record<string, ControlParam>)) {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; flex-direction: column; gap: 0.25rem;';

            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.style.cssText = 'font-weight: 500; opacity: 0.8;';
            row.appendChild(labelEl);

            if ('onSliderChange' in params) {
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = `${params.min ?? 0}`;
                slider.max = `${params.max ?? 1}`;
                slider.step = `${params.step ?? 0.01}`;
                slider.value = `${params.initial ?? 0}`;
                slider.style.cssText = 'width: 100%; accent-color: #667eea;';
                slider.addEventListener('input', () => params.onSliderChange(parseFloat(slider.value)));
                row.appendChild(slider);
                params.onSliderChange(parseFloat(slider.value));
            }

            if ('onSelectChange' in params) {
                const select = document.createElement('select');
                select.innerHTML = params.options.map((opt: string) => `<option value="${opt}">${opt}</option>`).join('');
                select.value = params.initial ?? params.options[0];
                select.style.cssText = 'padding: 0.5rem; border-radius: 6px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);';
                select.addEventListener('change', () => params.onSelectChange(select.value));
                row.appendChild(select);
                params.onSelectChange(select.value);
            }

            if ('onColorChange' in params) {
                const input = document.createElement('input');
                input.type = 'color';
                const initial = params.initial ?? [0, 0, 0];
                input.value = rgbToHex(initial);
                input.style.cssText = 'width: 100%; height: 32px; border: none; border-radius: 6px; cursor: pointer;';
                input.addEventListener('input', () => params.onColorChange(hexToRgb(input.value)));
                row.appendChild(input);
                params.onColorChange(initial);
            }

            if ('onToggleChange' in params) {
                const toggle = document.createElement('input');
                toggle.type = 'checkbox';
                toggle.checked = params.initial ?? false;
                toggle.style.cssText = 'width: 20px; height: 20px; accent-color: #667eea;';
                toggle.addEventListener('change', () => params.onToggleChange(toggle.checked));
                row.appendChild(toggle);
                params.onToggleChange(toggle.checked);
            }

            controlsPanel.appendChild(row);
        }
    }
}

type ControlParam = {
    initial?: unknown;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    onSliderChange?: (v: number) => void;
    onSelectChange?: (v: string) => void;
    onColorChange?: (v: [number, number, number]) => void;
    onToggleChange?: (v: boolean) => void;
};

function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
    ];
}

function rgbToHex(rgb: readonly [number, number, number]): string {
    return '#' + rgb.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
}
