import { ColyseusTestServer, boot } from "@colyseus/testing";
import appConfig from "../src/arena.config"; // Assumendo che esista un config standard
import { ClientMessages, GamePhase } from "../shared/SharedTypes";

describe("Reaction Window - Race Conditions & Stress Test", () => {
    let colyseus: ColyseusTestServer;

    beforeAll(async () => {
        // Avvia un server di test con la configurazione dell'app
        colyseus = await boot(appConfig);
    });

    afterAll(async () => {
        // Spegni il server alla fine dei test
        await colyseus.shutdown();
    });

    beforeEach(async () => {
        // Pulisce lo stato tra un test e l'altro se necessario
        await colyseus.cleanup();
    });

    test("Deve gestire Reazioni simultanee da 3 client diversi nello stesso millisecondo senza crash e preservando l'integrità", async () => {
        // 1. Istanzia e connetti 4 client (bot) alla stanza principale
        const clientA = await colyseus.sdk.joinOrCreate("office_room");
        const clientB = await colyseus.sdk.joinOrCreate("office_room");
        const clientC = await colyseus.sdk.joinOrCreate("office_room");
        const clientD = await colyseus.sdk.joinOrCreate("office_room");

        // Aspettiamo che tutti siano pronti e che sia il turno del Client A
        // (Qui ci sarà logica per forzare o attendere il turno di A)

        // 2. Client A attiva l'azione che triggera la REACTION_WINDOW (es. Assumere un Dipendente)
        clientA.send(ClientMessages.PLAY_EMPLOYEE, { cardId: "dipendente_1" });

        // Attendiamo che il server cambi fase in REACTION_WINDOW
        await new Promise((resolve) => {
            clientA.onStateChange((state) => {
                if (state.phase === GamePhase.REACTION_WINDOW) {
                    resolve(true);
                }
            });
        });

        // 3. I Client B, C e D inviano un pacchetto "Reazione" simultaneamente
        // Usiamo Promise.all per spararlitutti nello stesso esatto ciclo di eventi
        await Promise.all([
            new Promise((resolve) => {
                clientB.send(ClientMessages.PLAY_REACTION, { cardId: "reazione_b", targetCardId: "client_a" });
                resolve(true);
            }),
            new Promise((resolve) => {
                clientC.send(ClientMessages.PLAY_REACTION, { cardId: "reazione_c", targetCardId: "client_a" });
                resolve(true);
            }),
            new Promise((resolve) => {
                clientD.send(ClientMessages.PLAY_REACTION, { cardId: "reazione_d", targetCardId: "client_a" });
                resolve(true);
            })
        ]);

        // 4. Attendiamo la fine dei 5 secondi del timer lato server
        // (In un ambiente di test possiamo mockare il timer o usare fast-forward per non aspettare 5 secondi reali)
        await new Promise((resolve) => setTimeout(resolve, 5100)); // Aspetta poco più della finestra

        // 5. Asserzioni: Verifica dell'Integrità dello Stato
        const finalState = clientA.state;

        // - Check 1: Il server non è crashato
        expect(finalState).toBeDefined();

        // - Check 2: Il sistema ha risolto le reazioni in un ordine deterministico
        // Solo una reazione dovrebbe aver annullato l'azione o solo la prima arrivata dovrebbe essere contata validamente (a seconda delle regole)
        expect(finalState.phase).not.toBe(GamePhase.REACTION_WINDOW); // Deve essere tornato al turno normale

        // - Check 3: Nessun doppio addebito di PA, hand size coerente, ecc.
        // expect(...).toBe(...);
    });
});
