"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficeRoomState = exports.PlayerState = exports.PendingActionState = exports.CardState = void 0;
const schema_1 = require("@colyseus/schema");
const SharedTypes_1 = require("../../shared/SharedTypes");
// ═════════════════════════════════════════════════════════
//  CardState — a single card instance (implements ICardData)
// ═════════════════════════════════════════════════════════
class CardState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.id = "";
        this.templateId = "";
        this.type = SharedTypes_1.CardType.EMPLOYEE;
        this.equippedItems = new schema_1.ArraySchema();
        this.subtype = "none";
    }
}
exports.CardState = CardState;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], CardState.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], CardState.prototype, "templateId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], CardState.prototype, "type", void 0);
__decorate([
    (0, schema_1.type)("uint8"),
    __metadata("design:type", Number)
], CardState.prototype, "costPA", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], CardState.prototype, "isFaceUp", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], CardState.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], CardState.prototype, "shortDesc", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], CardState.prototype, "description", void 0);
__decorate([
    (0, schema_1.type)("uint8"),
    __metadata("design:type", Number)
], CardState.prototype, "targetRoll", void 0);
__decorate([
    (0, schema_1.type)("int8"),
    __metadata("design:type", Number)
], CardState.prototype, "modifier", void 0);
__decorate([
    (0, schema_1.type)([CardState]),
    __metadata("design:type", Array)
], CardState.prototype, "equippedItems", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], CardState.prototype, "subtype", void 0);
// ═════════════════════════════════════════════════════════
//  PendingActionState — action context for Reaction Window
// ═════════════════════════════════════════════════════════
class PendingActionState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.id = "";
        this.playerId = "";
        this.actionType = SharedTypes_1.ClientMessages.PLAY_EMPLOYEE;
        this.timestamp = 0;
    }
}
exports.PendingActionState = PendingActionState;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PendingActionState.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PendingActionState.prototype, "playerId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PendingActionState.prototype, "actionType", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PendingActionState.prototype, "targetCardId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PendingActionState.prototype, "targetCrisisId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PendingActionState.prototype, "targetPlayerId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PendingActionState.prototype, "targetHeroCardId", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], PendingActionState.prototype, "timestamp", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PendingActionState.prototype, "isCancelled", void 0);
// ═════════════════════════════════════════════════════════
//  PlayerState — one connected player (implements IPlayer)
// ═════════════════════════════════════════════════════════
class PlayerState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.sessionId = "";
        this.username = "";
        this.isReady = false;
        this.isConnected = true;
        this.actionPoints = 3;
        // ── Hidden from other clients (server-authoritative / Fog of War) ──
        this.hand = new schema_1.ArraySchema();
        // ── Public area — "Azienda" (hired employees visible to all) ──
        this.company = new schema_1.ArraySchema();
        this.score = 0;
        this.victories = 0;
        this.activeEffects = new schema_1.ArraySchema();
    }
}
exports.PlayerState = PlayerState;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PlayerState.prototype, "sessionId", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], PlayerState.prototype, "username", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PlayerState.prototype, "isReady", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], PlayerState.prototype, "isConnected", void 0);
__decorate([
    (0, schema_1.type)("uint8"),
    __metadata("design:type", Number)
], PlayerState.prototype, "actionPoints", void 0);
__decorate([
    (0, schema_1.filter)(function (client, _value, _root) {
        return client.sessionId === this.sessionId;
    }),
    (0, schema_1.type)([CardState]),
    __metadata("design:type", Array)
], PlayerState.prototype, "hand", void 0);
__decorate([
    (0, schema_1.type)([CardState]),
    __metadata("design:type", Array)
], PlayerState.prototype, "company", void 0);
__decorate([
    (0, schema_1.type)("uint8"),
    __metadata("design:type", Number)
], PlayerState.prototype, "score", void 0);
__decorate([
    (0, schema_1.type)("uint8"),
    __metadata("design:type", Number)
], PlayerState.prototype, "victories", void 0);
__decorate([
    (0, schema_1.type)(["string"]),
    __metadata("design:type", Array)
], PlayerState.prototype, "activeEffects", void 0);
// ═════════════════════════════════════════════════════════
//  OfficeRoomState — ROOT state (implements IGameState)
// ═════════════════════════════════════════════════════════
class OfficeRoomState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.phase = SharedTypes_1.GamePhase.PRE_LOBBY;
        this.players = new schema_1.MapSchema();
        this.hostSessionId = "";
        this.playerOrder = new schema_1.ArraySchema();
        this.currentTurnPlayerId = "";
        this.centralCrises = new schema_1.ArraySchema();
        this.deckCount = 0;
        // ── Reaction Window ──
        // actionStack is server-private (not synced), but we expose pendingAction + reactionEndTime
        this.pendingAction = new PendingActionState();
        this.reactionEndTime = 0;
        this.turnNumber = 0;
        this.turnIndex = 0;
        // actionStack is NOT synced to clients (server-private LIFO queue)
        // It is exposed on the interface for CardEffectParser but not decorated with @type
        this.actionStack = [];
    }
}
exports.OfficeRoomState = OfficeRoomState;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], OfficeRoomState.prototype, "phase", void 0);
__decorate([
    (0, schema_1.type)({ map: PlayerState }),
    __metadata("design:type", Map)
], OfficeRoomState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], OfficeRoomState.prototype, "hostSessionId", void 0);
__decorate([
    (0, schema_1.type)(["string"]),
    __metadata("design:type", Array)
], OfficeRoomState.prototype, "playerOrder", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], OfficeRoomState.prototype, "currentTurnPlayerId", void 0);
__decorate([
    (0, schema_1.type)([CardState]),
    __metadata("design:type", Array)
], OfficeRoomState.prototype, "centralCrises", void 0);
__decorate([
    (0, schema_1.type)("uint16"),
    __metadata("design:type", Number)
], OfficeRoomState.prototype, "deckCount", void 0);
__decorate([
    (0, schema_1.type)(PendingActionState),
    __metadata("design:type", PendingActionState)
], OfficeRoomState.prototype, "pendingAction", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], OfficeRoomState.prototype, "reactionEndTime", void 0);
__decorate([
    (0, schema_1.type)("uint8"),
    __metadata("design:type", Number)
], OfficeRoomState.prototype, "turnNumber", void 0);
__decorate([
    (0, schema_1.type)("uint8"),
    __metadata("design:type", Number)
], OfficeRoomState.prototype, "turnIndex", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], OfficeRoomState.prototype, "winnerId", void 0);
//# sourceMappingURL=State.js.map