const { Peer } = require('peerjs');
const wrtc = require('wrtc'); // Simula o navegador para o PeerJS funcionar no Node
const express = require('express');

// ==========================================
// TRUQUE PARA O RENDER: Servidor HTTP Básico
// O Render exige que a aplicação abra uma porta, caso contrário ele cancela o deploy.
// ==========================================
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Servidor Dedicado Madness Z está ONLINE!'));
app.listen(port, () => console.log(`[SISTEMA] Servidor HTTP de suporte rodando na porta ${port}`));

// ==========================================
// LÓGICA DO JOGO (MADNESS Z BOT)
// ==========================================
const botPlayer = {
    name: "[BOT] SERVIDOR",
    x: 10000, 
    y: -5000, // No céu, longe de tudo
    hp: 99999, // Imortal
    walkCycle: 0,
    currentWeapon: null,
    reserveWeapon: null,
    dir: 1,
    aimAngle: 0,
    outfit: { hat: 8, shirt: 7, pants: 5, shoes: 5, hair: 5 },
    currentInterior: false,
    width: 30, height: 55
};

let peerConnections = [];
let otherPlayers = {};
let hostLoop = null;

// Você pode definir o código fixo aqui ou via Variável de Ambiente no Render
const roomCode = process.env.ROOM_CODE || "MDZ-1234";

console.log(`[SISTEMA] Inicializando PeerJS com código: ${roomCode}...`);

// Passamos o 'wrtc' para o PeerJS entender como se conectar fora do navegador
const peer = new Peer(roomCode, {
    wrtc: wrtc
});

peer.on('open', (id) => {
    console.log(`[SUCESSO] Servidor aberto! Código da Sala: ${id}`);
    startHostLoop();
});

peer.on('connection', (conn) => {
    console.log(`[INFO] Novo jogador conectando: ${conn.peer}`);
    
    // Limite de jogadores (11, baseado no seu código original)
    if (peerConnections.length >= 11) {
        console.log(`[AVISO] Conexão recusada (Servidor Cheio): ${conn.peer}`);
        conn.close();
        return;
    }

    peerConnections.push(conn);
    console.log(`[INFO] Total de jogadores: ${peerConnections.length}`);

    conn.on('open', () => {
        console.log(`[SUCESSO] Jogador entrou no mundo: ${conn.peer}`);
        conn.send({ type: 'world_sync', houses: [], tents: [], campfires: [], drops: [] });
    });

    conn.on('data', (data) => {
        if (data.type === 'player_update') {
            otherPlayers[conn.peer] = data.player;
        } 
        else if (data.type === 'route_damage') {
            let targetConn = peerConnections.find(c => c.peer === data.target);
            if (targetConn) targetConn.send({ type: 'take_damage', amount: data.amount });
            console.log(`[COMBATE] Repassando dano de ${conn.peer} para ${data.target}`);
        }
    });

    conn.on('close', () => {
        console.log(`[AVISO] Jogador desconectou: ${conn.peer}`);
        peerConnections = peerConnections.filter(c => c.peer !== conn.peer);
        delete otherPlayers[conn.peer];
        console.log(`[INFO] Total de jogadores: ${peerConnections.length}`);
    });
});

peer.on('error', (err) => {
    console.error(`[ERRO PEERJS] ${err.type} - ${err.message}`);
});

// Loop de Atualização do Servidor (20 ticks por segundo)
function startHostLoop() {
    if(hostLoop) clearInterval(hostLoop);
    
    console.log("[SISTEMA] Loop do servidor iniciado (20 ticks/s).");
    
    hostLoop = setInterval(() => {
        otherPlayers['HOST'] = botPlayer;

        let hostPayload = {
            type: 'host_update', 
            players: otherPlayers,
            zombies: [],
            drops: [],
            shots: []
        };

        peerConnections.forEach(c => {
            if(c.open) c.send(hostPayload);
        });
    }, 50);
}
