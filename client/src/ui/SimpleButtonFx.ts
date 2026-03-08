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

// Keep button geometry stable across menus: interaction feedback uses alpha only.
const HOVER_SCALE = 1;
const PRESS_SCALE = 1;
const TWEEN_MS = 90;
const TWEEN_MS_PRESS = 75;
const MIN_TOUCH_TARGET = 44;

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

function isFiniteRect(rect: Phaser.Geom.Rectangle): boolean {
    return Number.isFinite(rect.x)
        && Number.isFinite(rect.y)
        && Number.isFinite(rect.width)
        && Number.isFinite(rect.height)
        && rect.width > 0
        && rect.height > 0;
}

function canScaleWithoutDrift(
    target: ScalableTarget,
    hitArea: Phaser.GameObjects.Rectangle,
): boolean {
    if (target instanceof Phaser.GameObjects.Text) {
        return true;
    }

    if (target instanceof Phaser.GameObjects.Graphics) {
        const boundsGetter = (target as unknown as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds;
        const bounds = boundsGetter ? boundsGetter.call(target) : undefined;
        if (!bounds || !isFiniteRect(bounds)) return false;
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;
        const threshold = Math.max(hitArea.width, hitArea.height) * 0.55 + 12;
        const distance = Phaser.Math.Distance.Between(centerX, centerY, hitArea.x, hitArea.y);
        return distance <= threshold;
    }

    return true;
}

export function createSimpleButtonFx(
    scene: Phaser.Scene,
    hitArea: Phaser.GameObjects.Rectangle,
    targets: Phaser.GameObjects.GameObject[],
    options?: ButtonOptions,
): SimpleButtonController {
    const ensureHitTargetSize = () => {
        const currentW = Number(hitArea.width ?? 0);
        const currentH = Number(hitArea.height ?? 0);
        if (currentW >= MIN_TOUCH_TARGET && currentH >= MIN_TOUCH_TARGET) return;
        hitArea.setSize(
            Math.max(MIN_TOUCH_TARGET, currentW),
            Math.max(MIN_TOUCH_TARGET, currentH),
        );
    };
    ensureHitTargetSize();

    const scalable = targets
        .filter((target) => target && typeof (target as any).setScale === 'function')
        .map((target) => target as ScalableTarget);

    const textTargets = targets
        .filter((target) => target instanceof Phaser.GameObjects.Text)
        .map((target) => target as Phaser.GameObjects.Text);
    const visualTargets = scalable.filter((target) => !(target instanceof Phaser.GameObjects.Text));
    const animatedTargets = visualTargets.length > 0 ? visualTargets : scalable;
    const scaleTargets = animatedTargets.filter((target) => canScaleWithoutDrift(target, hitArea));
    const alphaOnlyTargets = animatedTargets.filter((target) => !scaleTargets.includes(target));

    const baseScaleByTarget = new Map<ScalableTarget, { x: number; y: number }>();
    scalable.forEach((target) => {
        baseScaleByTarget.set(target, {
            x: target.scaleX ?? 1,
            y: target.scaleY ?? 1,
        });
    });

    const canInteract = () => Boolean(hitArea.input?.enabled && hitArea.visible && hitArea.active);
    const isTouchPointer = (pointer?: Phaser.Input.Pointer) => {
        const pointerType = String((pointer as unknown as { pointerType?: string })?.pointerType ?? '');
        return pointerType === 'touch';
    };

    const syncBaseScales = () => {
        baseScaleByTarget.forEach((value, target) => {
            value.x = target.scaleX ?? 1;
            value.y = target.scaleY ?? 1;
        });
    };

    const animate = (factor: number, duration: number) => {
        scaleTargets.forEach((target) => scene.tweens.killTweensOf(target));
        scaleTargets.forEach((target) => {
            const base = baseScaleByTarget.get(target) ?? { x: 1, y: 1 };
            scene.tweens.add({
                targets: target,
                scaleX: base.x * factor,
                scaleY: base.y * factor,
                duration,
                ease: 'Sine.Out',
            });
        });

        const visualAlpha = factor < 1 ? 0.96 : 1;
        alphaOnlyTargets.forEach((target) => {
            scene.tweens.killTweensOf(target);
            scene.tweens.add({
                targets: target,
                alpha: visualAlpha,
                duration: Math.min(duration, 70),
                ease: 'Sine.Out',
            });
        });

        const textAlpha = factor < 1 ? 0.96 : 1;
        textTargets.forEach((text) => {
            scene.tweens.killTweensOf(text);
            scene.tweens.add({
                targets: text,
                alpha: textAlpha,
                duration: Math.min(duration, 70),
                ease: 'Sine.Out',
            });
        });
    };

    const reset = () => {
        scalable.forEach((target) => scene.tweens.killTweensOf(target));
        scalable.forEach((target) => {
            const base = baseScaleByTarget.get(target) ?? { x: 1, y: 1 };
            target.setScale(base.x, base.y);
            const alphaSetter = (target as unknown as { setAlpha?: (alpha: number) => unknown }).setAlpha;
            if (alphaSetter) alphaSetter.call(target, 1);
        });
        textTargets.forEach((text) => {
            scene.tweens.killTweensOf(text);
            text.setAlpha(1);
        });
    };

    let pressed = false;
    let hovered = false;
    let activePointerId: number | null = null;

    const onOver = (pointer: Phaser.Input.Pointer) => {
        if (isTouchPointer(pointer)) return;
        if (hovered) return;
        if (pressed) return;
        if (!canInteract()) return;
        hovered = true;
        syncBaseScales();
        animate(HOVER_SCALE, TWEEN_MS);
    };
    const onOut = () => {
        hovered = false;
        if (pressed) return;
        reset();
    };
    const onDown = (pointer: Phaser.Input.Pointer) => {
        if (pressed) return;
        if (!canInteract()) return;
        pressed = true;
        activePointerId = pointer?.id ?? null;
        syncBaseScales();
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
    const onUpOutside = () => {
        hovered = false;
        onRelease();
    };
    const onScenePointerUp = () => {
        if (!pressed) return;
        hovered = false;
        onRelease();
    };
    const onSceneUpdate = () => {
        ensureHitTargetSize();
        if (!canInteract() && (pressed || hovered)) {
            hovered = false;
            onRelease();
            return;
        }
        if (!pressed && !hovered) {
            syncBaseScales();
        }
    };

    hitArea.on('pointerover', onOver);
    hitArea.on('pointerout', onOut);
    hitArea.on('pointerdown', onDown);
    hitArea.on('pointerup', onUp);
    hitArea.on('pointerupoutside', onUpOutside);
    scene.input.on('gameout', onUpOutside);
    scene.input.on('pointerup', onScenePointerUp);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onSceneUpdate);

    return {
        reset: () => {
            hovered = false;
            onRelease();
        },
        destroy: () => {
            hitArea.off('pointerover', onOver);
            hitArea.off('pointerout', onOut);
            hitArea.off('pointerdown', onDown);
            hitArea.off('pointerup', onUp);
            hitArea.off('pointerupoutside', onUpOutside);
            scene.input.off('gameout', onUpOutside);
            scene.input.off('pointerup', onScenePointerUp);
            scene.events.off(Phaser.Scenes.Events.UPDATE, onSceneUpdate);
            onRelease();
        },
    };
}
