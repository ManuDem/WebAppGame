import Phaser from 'phaser';
import { ICardData } from '../../../shared/SharedTypes';

export class CardGameObject extends Phaser.GameObjects.Container {
    private bgRect: Phaser.GameObjects.Rectangle;
    private titleText: Phaser.GameObjects.Text;
    private costText: Phaser.GameObjects.Text;
    public cardData: ICardData;

    constructor(scene: Phaser.Scene, x: number, y: number, data: ICardData) {
        super(scene, x, y);
        this.cardData = data;

        // Card Dimensions
        const width = 100;
        const height = 150;

        // Card Background
        this.bgRect = scene.add.rectangle(0, 0, width, height, 0xdddddd)
            .setStrokeStyle(2, 0x000000);

        // Card Title
        this.titleText = scene.add.text(0, -height / 2 + 10, data.templateId, {
            fontSize: '14px',
            color: '#000000',
            align: 'center',
            wordWrap: { width: width - 10 }
        }).setOrigin(0.5, 0);

        // Card Cost
        const costStr = data.costPA !== undefined ? `Costo: ${data.costPA} PA` : '';
        this.costText = scene.add.text(0, height / 2 - 20, costStr, {
            fontSize: '12px',
            color: '#ff0000',
            align: 'center'
        }).setOrigin(0.5, 0.5);

        // Add elements to container
        this.add([this.bgRect, this.titleText, this.costText]);

        // Make interactive for Drag & Drop later
        this.setSize(width, height);
        this.setInteractive({ useHandCursor: true });
        scene.input.setDraggable(this);
    }
}
