import Phaser from 'phaser';

type ScalableTarget = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

export interface SimpleButtonController {
    reset: () => void;
    destroy: () => void;
}

type ButtonOptions = {
    onClick?: () => void;
    playClickSfx?: boolean;
};

const HOVER_SCALE = 1.03;
const PRESS_SCALE = 0.97;
const TWEEN_MS = 110;
const TWEEN_MS_PRESS = 85;

function playUiClick(scene: Phaser.Scene) {
    const soundManager = scene.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
    const ctx = soundManager?.context;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        void ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.028, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
}

export function createSimpleButtonFx(
    scene: Phaser.Scene,
    hitArea: Phaser.GameObjects.Rectangle,
    targets: Phaser.GameObjects.GameObject[],
    options?: ButtonOptions,
): SimpleButtonController {
    const scalable = targets
        .filter((target) => target && typeof (target as any).setScale === 'function')
        .map((target) => ({
            target: target as ScalableTarget,
            baseX: (target as ScalableTarget).scaleX ?? 1,
            baseY: (target as ScalableTarget).scaleY ?? 1,
        }));

    const canInteract = () => Boolean(hitArea.input?.enabled);

    const animate = (factor: number, duration: number) => {
        scalable.forEach((entry) => scene.tweens.killTweensOf(entry.target));
        scalable.forEach((entry) => {
            scene.tweens.add({
                targets: entry.target,
                scaleX: entry.baseX * factor,
                scaleY: entry.baseY * factor,
                duration,
                ease: 'Sine.Out',
            });
        });
    };

    const reset = () => {
        scalable.forEach((entry) => scene.tweens.killTweensOf(entry.target));
        scalable.forEach((entry) => entry.target.setScale(entry.baseX, entry.baseY));
    };

    const onOver = () => {
        if (!canInteract()) return;
        animate(HOVER_SCALE, TWEEN_MS);
    };
    const onOut = () => reset();
    const onDown = () => {
        if (!canInteract()) return;
        animate(PRESS_SCALE, TWEEN_MS_PRESS);
    };
    const onUp = () => {
        if (!canInteract()) return;
        reset();
        if (options?.playClickSfx !== false) {
            playUiClick(scene);
        }
        options?.onClick?.();
    };

    hitArea.on('pointerover', onOver);
    hitArea.on('pointerout', onOut);
    hitArea.on('pointerdown', onDown);
    hitArea.on('pointerup', onUp);

    return {
        reset,
        destroy: () => {
            hitArea.off('pointerover', onOver);
            hitArea.off('pointerout', onOut);
            hitArea.off('pointerdown', onDown);
            hitArea.off('pointerup', onUp);
            reset();
        },
    };
}
