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
    const isTouchPointer = (pointer?: Phaser.Input.Pointer) => {
        const pointerType = String((pointer as unknown as { pointerType?: string })?.pointerType ?? '');
        return pointerType === 'touch';
    };

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

    let pressed = false;
    let activePointerId: number | null = null;

    const onOver = (pointer: Phaser.Input.Pointer) => {
        if (isTouchPointer(pointer)) return;
        if (pressed) return;
        if (!canInteract()) return;
        animate(HOVER_SCALE, TWEEN_MS);
    };
    const onOut = () => {
        if (pressed) return;
        reset();
    };
    const onDown = (pointer: Phaser.Input.Pointer) => {
        if (!canInteract()) return;
        pressed = true;
        activePointerId = pointer?.id ?? null;
        animate(PRESS_SCALE, TWEEN_MS_PRESS);
    };
    const onRelease = () => {
        pressed = false;
        activePointerId = null;
        reset();
    };
    const onUp = (pointer: Phaser.Input.Pointer) => {
        if (!canInteract()) {
            onRelease();
            return;
        }

        if (activePointerId !== null && pointer?.id !== activePointerId) return;
        const inside = hitArea.getBounds().contains(pointer.x, pointer.y);
        const touch = isTouchPointer(pointer);

        onRelease();
        if (!inside) return;

        if (!touch) animate(HOVER_SCALE, TWEEN_MS);
        if (options?.playClickSfx !== false) {
            playUiClick(scene);
        }
        options?.onClick?.();
    };
    const onUpOutside = () => onRelease();

    hitArea.on('pointerover', onOver);
    hitArea.on('pointerout', onOut);
    hitArea.on('pointerdown', onDown);
    hitArea.on('pointerup', onUp);
    hitArea.on('pointerupoutside', onUpOutside);
    scene.input.on('gameout', onUpOutside);

    return {
        reset: onRelease,
        destroy: () => {
            hitArea.off('pointerover', onOver);
            hitArea.off('pointerout', onOut);
            hitArea.off('pointerdown', onDown);
            hitArea.off('pointerup', onUp);
            hitArea.off('pointerupoutside', onUpOutside);
            scene.input.off('gameout', onUpOutside);
            onRelease();
        },
    };
}
