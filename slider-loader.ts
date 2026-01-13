// Canvas sizing with devicePixelRatio for crisp rendering
(async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;

    const onResize = () => {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
    };

    onResize();
    new ResizeObserver(onResize).observe(document.body);

    // Execute the slider demo
    // @ts-expect-error
    const example = await import('./src/slider/index.ts');

    // Create controls panel
    createControlsPanel(example);
})();

function createControlsPanel(example: Record<string, unknown>) {
    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes panelSlideIn {
            from {
                opacity: 0;
                transform: translateY(-10px) scale(0.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        @keyframes panelSlideOut {
            from {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            to {
                opacity: 0;
                transform: translateY(-10px) scale(0.98);
            }
        }
        @keyframes rowFadeIn {
            from {
                opacity: 0;
                transform: translateX(-8px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        /* Main Panel */
        .ctrl-panel {
            position: fixed;
            top: 1.25rem;
            right: 1.25rem;
            z-index: 100;
            width: 290px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            animation: panelSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .ctrl-panel.hidden {
            pointer-events: none;
        }

        .ctrl-panel.hidden .ctrl-panel-inner {
            animation: panelSlideOut 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .ctrl-panel-inner {
            background: linear-gradient(145deg, #1a1a2e 0%, #16162a 50%, #12121f 100%);
            border-radius: 20px;
            overflow: hidden;
            box-shadow:
                0 20px 60px rgba(0, 0, 0, 0.5),
                0 8px 25px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        /* Header */
        .ctrl-header {
            padding: 1.25rem 1.25rem 1rem;
            background: linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(244, 114, 182, 0.08) 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            position: relative;
        }

        .ctrl-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #ec4899, #f472b6, #fb7185);
            background-size: 200% 100%;
            animation: gradientShift 4s ease infinite;
        }

        .ctrl-eyebrow {
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #8b8b9e;
            margin-bottom: 0.35rem;
        }

        .ctrl-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.01em;
        }

        .ctrl-title-accent {
            background: linear-gradient(135deg, #f472b6 0%, #fb7185 50%, #fda4af 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        /* Body */
        .ctrl-body {
            padding: 1rem 1.25rem 1.35rem;
            display: flex;
            flex-direction: column;
            gap: 1.1rem;
        }

        /* Control Rows */
        .ctrl-row {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
            animation: rowFadeIn 0.4s ease backwards;
        }

        .ctrl-row:nth-child(1) { animation-delay: 0.05s; }
        .ctrl-row:nth-child(2) { animation-delay: 0.1s; }
        .ctrl-row:nth-child(3) { animation-delay: 0.15s; }
        .ctrl-row:nth-child(4) { animation-delay: 0.2s; }
        .ctrl-row:nth-child(5) { animation-delay: 0.25s; }

        .ctrl-label {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            font-size: 0.8rem;
            font-weight: 600;
            color: #c4c4d4;
        }

        .ctrl-icon {
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #2a2a45 0%, #252540 100%);
            border-radius: 8px;
            font-size: 0.75rem;
            box-shadow:
                0 2px 4px rgba(0, 0, 0, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        /* Slider */
        .ctrl-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 8px;
            border-radius: 4px;
            background: #252538;
            outline: none;
            cursor: pointer;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        .ctrl-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: linear-gradient(145deg, #ffffff 0%, #e8e8f0 100%);
            cursor: pointer;
            box-shadow:
                0 3px 10px rgba(0, 0, 0, 0.4),
                0 0 0 3px rgba(236, 72, 153, 0.2),
                inset 0 -2px 4px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            border: none;
        }

        .ctrl-slider::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            box-shadow:
                0 4px 15px rgba(0, 0, 0, 0.45),
                0 0 0 4px rgba(236, 72, 153, 0.35),
                inset 0 -2px 4px rgba(0, 0, 0, 0.1);
        }

        .ctrl-slider::-moz-range-thumb {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: linear-gradient(145deg, #ffffff 0%, #e8e8f0 100%);
            cursor: pointer;
            border: none;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
        }

        /* Select Dropdown */
        .ctrl-select {
            width: 100%;
            padding: 0.75rem 1rem;
            padding-right: 2.5rem;
            border-radius: 10px;
            background: #252538;
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.06);
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b8b9e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 0.75rem center;
        }

        .ctrl-select:hover {
            border-color: rgba(236, 72, 153, 0.4);
            background-color: #2a2a42;
        }

        .ctrl-select:focus {
            border-color: #ec4899;
            box-shadow:
                inset 0 2px 4px rgba(0, 0, 0, 0.2),
                0 0 0 3px rgba(236, 72, 153, 0.15);
        }

        .ctrl-select option {
            background: #1a1a2e;
            color: #ffffff;
            padding: 0.5rem;
        }

        /* Color Picker */
        .ctrl-color-wrap {
            position: relative;
            width: 100%;
            height: 48px;
            border-radius: 10px;
            overflow: hidden;
            background: #252538;
            box-shadow:
                inset 0 2px 4px rgba(0, 0, 0, 0.3),
                0 0 0 1px rgba(255, 255, 255, 0.04);
            transition: box-shadow 0.2s ease;
        }

        .ctrl-color-wrap:hover {
            box-shadow:
                inset 0 2px 4px rgba(0, 0, 0, 0.3),
                0 0 0 2px rgba(236, 72, 153, 0.3);
        }

        .ctrl-color {
            width: 100%;
            height: 100%;
            border: none;
            cursor: pointer;
            padding: 4px;
            background: transparent;
        }

        .ctrl-color::-webkit-color-swatch-wrapper {
            padding: 0;
        }

        .ctrl-color::-webkit-color-swatch {
            border: none;
            border-radius: 6px;
        }

        /* Toggle Switch */
        .ctrl-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .ctrl-toggle-status {
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b6b7d;
            transition: color 0.2s ease;
        }

        .ctrl-toggle-status.on {
            color: #f472b6;
        }

        .ctrl-toggle {
            position: relative;
            width: 54px;
            height: 30px;
            background: #252538;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
        }

        .ctrl-toggle::after {
            content: '';
            position: absolute;
            top: 3px;
            left: 3px;
            width: 24px;
            height: 24px;
            background: linear-gradient(145deg, #ffffff 0%, #e8e8f0 100%);
            border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow:
                0 2px 8px rgba(0, 0, 0, 0.35),
                inset 0 -1px 2px rgba(0, 0, 0, 0.1);
        }

        .ctrl-toggle.on {
            background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);
            box-shadow:
                inset 0 2px 6px rgba(0, 0, 0, 0.2),
                0 0 20px rgba(236, 72, 153, 0.3);
        }

        .ctrl-toggle.on::after {
            transform: translateX(24px);
            box-shadow:
                0 2px 10px rgba(0, 0, 0, 0.3),
                0 0 10px rgba(255, 255, 255, 0.2);
        }

        /* Toggle Button (show/hide panel) */
        .ctrl-toggle-btn {
            position: fixed;
            top: 1.25rem;
            right: 1.25rem;
            width: 50px;
            height: 50px;
            border-radius: 14px;
            border: none;
            background: linear-gradient(145deg, #1a1a2e 0%, #16162a 100%);
            color: #c4c4d4;
            cursor: pointer;
            z-index: 101;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow:
                0 8px 25px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.05),
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .ctrl-toggle-btn:hover {
            background: linear-gradient(145deg, #222240 0%, #1e1e38 100%);
            color: #ffffff;
            transform: scale(1.05);
            box-shadow:
                0 12px 35px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(236, 72, 153, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .ctrl-toggle-btn:active {
            transform: scale(0.95);
        }

        .ctrl-toggle-btn svg {
            width: 22px;
            height: 22px;
            transition: transform 0.3s ease;
        }

        .ctrl-panel:not(.hidden) ~ .ctrl-toggle-btn {
            opacity: 0;
            pointer-events: none;
            transform: scale(0.8);
        }

        /* Close Button */
        .ctrl-close-btn {
            position: absolute;
            top: 1rem;
            right: 1rem;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: none;
            background: rgba(255, 255, 255, 0.06);
            color: #8b8b9e;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .ctrl-close-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
        }

        .ctrl-close-btn svg {
            width: 16px;
            height: 16px;
        }

        /* Mobile & Tablet */
        @media (max-width: 768px) {
            .ctrl-panel {
                top: auto;
                bottom: 1rem;
                right: 1rem;
                left: 1rem;
                width: auto;
            }

            .ctrl-panel-inner {
                border-radius: 18px;
            }

            .ctrl-header {
                padding: 1rem;
            }

            .ctrl-body {
                padding: 0.875rem 1rem 1.15rem;
                gap: 1rem;
            }

            .ctrl-slider::-webkit-slider-thumb {
                width: 26px;
                height: 26px;
            }

            .ctrl-toggle {
                width: 58px;
                height: 32px;
            }

            .ctrl-toggle::after {
                width: 26px;
                height: 26px;
            }

            .ctrl-toggle.on::after {
                transform: translateX(26px);
            }

            .ctrl-toggle-btn {
                top: auto;
                bottom: 1rem;
                right: 1rem;
                width: 54px;
                height: 54px;
                border-radius: 16px;
            }
        }

        @media (max-width: 480px) {
            .ctrl-panel {
                bottom: 0.75rem;
                right: 0.75rem;
                left: 0.75rem;
            }

            .ctrl-title {
                font-size: 1.1rem;
            }

            .ctrl-toggle-btn {
                bottom: 0.75rem;
                right: 0.75rem;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .ctrl-panel,
            .ctrl-panel-inner,
            .ctrl-row,
            .ctrl-header::before {
                animation: none;
            }
        }
    `;
    document.head.appendChild(styleSheet);

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ctrl-toggle-btn';
    toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
    `;
    // Create panel
    const panel = document.createElement('div');
    panel.className = 'ctrl-panel';

    const panelInner = document.createElement('div');
    panelInner.className = 'ctrl-panel-inner';

    // Header
    const header = document.createElement('div');
    header.className = 'ctrl-header';
    header.innerHTML = `
        <div class="ctrl-eyebrow">Settings</div>
        <div class="ctrl-title"><span class="ctrl-title-accent">Jelly Slider</span></div>
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ctrl-close-btn';
    closeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
    `;
    header.appendChild(closeBtn);
    panelInner.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'ctrl-body';

    const icons: Record<string, string> = {
        'Quality': '✨',
        'Light dir': '☀️',
        'Jelly Color': '🎨',
        'Dark Mode': '🌙',
        'Blur': '💫',
        'Rope Color': '🪢',
        'Handle Color': '🔵',
    };

    for (const controls of Object.values(example)) {
        if (typeof controls === 'function' || !controls) continue;

        for (const [label, params] of Object.entries(controls as Record<string, ControlParam>)) {
            const row = document.createElement('div');
            row.className = 'ctrl-row';

            const labelEl = document.createElement('label');
            labelEl.className = 'ctrl-label';
            labelEl.innerHTML = `<span class="ctrl-icon">${icons[label] || '⚙️'}</span>${label}`;
            row.appendChild(labelEl);

            if ('onSliderChange' in params) {
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'ctrl-slider';
                slider.min = `${params.min ?? 0}`;
                slider.max = `${params.max ?? 1}`;
                slider.step = `${params.step ?? 0.01}`;
                slider.value = `${params.initial ?? 0}`;
                slider.addEventListener('input', () => params.onSliderChange(parseFloat(slider.value)));
                row.appendChild(slider);
                params.onSliderChange(parseFloat(slider.value));
            }

            if ('onSelectChange' in params) {
                const select = document.createElement('select');
                select.className = 'ctrl-select';
                select.innerHTML = params.options.map((opt: string) => `<option value="${opt}">${opt}</option>`).join('');
                select.value = params.initial ?? params.options[0];
                select.addEventListener('change', () => params.onSelectChange(select.value));
                row.appendChild(select);
                params.onSelectChange(select.value);
            }

            if ('onColorChange' in params) {
                const wrapper = document.createElement('div');
                wrapper.className = 'ctrl-color-wrap';
                const input = document.createElement('input');
                input.type = 'color';
                input.className = 'ctrl-color';
                const initial = params.initial ?? [0, 0, 0];
                input.value = rgbToHex(initial);
                input.addEventListener('input', () => params.onColorChange(hexToRgb(input.value)));
                wrapper.appendChild(input);
                row.appendChild(wrapper);
                params.onColorChange(initial);
            }

            if ('onToggleChange' in params) {
                const wrapper = document.createElement('div');
                wrapper.className = 'ctrl-toggle-row';

                const status = document.createElement('span');
                status.className = `ctrl-toggle-status ${params.initial ? 'on' : ''}`;
                status.textContent = params.initial ? 'On' : 'Off';

                const toggle = document.createElement('div');
                toggle.className = `ctrl-toggle ${params.initial ? 'on' : ''}`;

                toggle.addEventListener('click', () => {
                    const isOn = toggle.classList.toggle('on');
                    status.classList.toggle('on', isOn);
                    status.textContent = isOn ? 'On' : 'Off';
                    params.onToggleChange(isOn);
                });

                wrapper.appendChild(status);
                wrapper.appendChild(toggle);
                row.appendChild(wrapper);
                params.onToggleChange(params.initial ?? false);
            }

            body.appendChild(row);
        }
    }

    panelInner.appendChild(body);
    panel.appendChild(panelInner);
    document.body.appendChild(panel);
    document.body.appendChild(toggleBtn);

    // Toggle functionality
    let isHidden = false;

    const hidePanel = () => {
        isHidden = true;
        panel.classList.add('hidden');
    };

    const showPanel = () => {
        isHidden = false;
        panel.classList.remove('hidden');
    };

    toggleBtn.addEventListener('click', showPanel);
    closeBtn.addEventListener('click', hidePanel);
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
