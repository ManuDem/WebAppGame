type Listener = (event?: unknown) => void;

export class FakeClassList {
    private readonly classes = new Set<string>();

    add(...tokens: string[]): void {
        tokens.forEach((token) => {
            const trimmed = String(token).trim();
            if (trimmed.length > 0) this.classes.add(trimmed);
        });
    }

    remove(...tokens: string[]): void {
        tokens.forEach((token) => this.classes.delete(String(token).trim()));
    }

    toggle(token: string, force?: boolean): boolean {
        const normalized = String(token).trim();
        if (!normalized) return false;
        if (force === true) {
            this.classes.add(normalized);
            return true;
        }
        if (force === false) {
            this.classes.delete(normalized);
            return false;
        }
        if (this.classes.has(normalized)) {
            this.classes.delete(normalized);
            return false;
        }
        this.classes.add(normalized);
        return true;
    }

    contains(token: string): boolean {
        return this.classes.has(String(token).trim());
    }
}

export class FakeElement {
    public id = '';
    public className = '';
    public textContent = '';
    public type = '';
    public disabled = false;
    public children: FakeElement[] = [];
    public parentElement: FakeElement | null = null;
    public dataset: Record<string, string> = {};
    public style: Record<string, string> & { setProperty: (name: string, value: string) => void };
    public classList = new FakeClassList();
    public attributes: Record<string, string> = {};

    private readonly listeners = new Map<string, Listener[]>();
    private innerHtmlValue = '';

    constructor(public readonly tagName: string) {
        const styleStore: Record<string, string> = {};
        this.style = Object.assign(styleStore, {
            setProperty: (name: string, value: string) => {
                styleStore[name] = value;
            },
        });
    }

    setAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    appendChild(child: FakeElement): FakeElement {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    remove(): void {
        if (!this.parentElement) return;
        this.parentElement.removeChild(this);
    }

    removeChild(child: FakeElement): void {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        child.parentElement = null;
    }

    addEventListener(type: string, listener: Listener): void {
        const bag = this.listeners.get(type) ?? [];
        bag.push(listener);
        this.listeners.set(type, bag);
    }

    click(): void {
        if (this.disabled) return;
        const clickListeners = this.listeners.get('click') ?? [];
        clickListeners.forEach((listener) => listener({}));
    }

    querySelector(selector: string): FakeElement | null {
        if (!selector.startsWith('#')) return null;
        const id = selector.slice(1).trim();
        if (!id) return null;
        return this.findById(id);
    }

    set innerHTML(value: string) {
        this.innerHtmlValue = value;
        if (value === '') this.children = [];
    }

    get innerHTML(): string {
        return this.innerHtmlValue;
    }

    private findById(id: string): FakeElement | null {
        if (this.id === id) return this;
        for (const child of this.children) {
            const found = child.findById(id);
            if (found) return found;
        }
        return null;
    }
}

export class FakeDocument {
    createElement(tagName: string): FakeElement {
        return new FakeElement(String(tagName).toLowerCase());
    }
}

export function createMockUiRoot(): FakeElement {
    const root = new FakeElement('div');
    root.id = 'ui-root';
    return root;
}

export function toButtonList(root: FakeElement): FakeElement[] {
    const out: FakeElement[] = [];
    const walk = (node: FakeElement) => {
        if (node.tagName === 'button') out.push(node);
        node.children.forEach(walk);
    };
    walk(root);
    return out;
}

export function getButtonByLabel(root: FakeElement, label: string): FakeElement {
    const match = toButtonList(root).find((button) => button.textContent === label);
    if (!match) throw new Error(`button not found: ${label}`);
    return match;
}

